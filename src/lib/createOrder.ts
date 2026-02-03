import { supabase } from "./supabaseClient.ts";
import { toSafeInt } from "./money";

export type OrderItemAddonPayload = {
  id: string;
  name: string;
  // EUR cente (int)
  price: number;
  quantity: number;
};

export type OrderItemPayload = {
  cart_id: string;
  menu_item_id: string | null;
  name: string;
  size: "33" | "50" | null;
  quantity: number;

  // osnovna cijena bez dodataka (EUR cente)
  base_price: number | null;

  // cijena jedne stavke sa dodacima (EUR cente)
  price_per_item: number;

  addons: OrderItemAddonPayload[];
  note: string | null;

  image: string;
  category: string;
};

export type CreateOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;

  items: OrderItemPayload[];

  // total (EUR cente)
  total_price: number;
  total_items: number;

  note?: string | null;
};

function normalizeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function safeInt(value: unknown, fallback = 0) {
  return toSafeInt(value, fallback);
}

function isValidSize(size: unknown): size is "33" | "50" {
  return size === "33" || size === "50";
}

function formatSupabaseError(err: any) {
  const parts: string[] = [];
  if (err?.message) parts.push(String(err.message));
  if (err?.details) parts.push(String(err.details));
  if (err?.hint) parts.push(String(err.hint));
  if (err?.code) parts.push(`Kod: ${String(err.code)}`);
  return parts.filter(Boolean).join(" — ") || "Greška pri slanju porudžbine.";
}

async function notifyTelegramViaVercel(orderId: string) {
  // DEV: Vite dev server nema /api rute -> 404 spam.
  // Najstabilnije: u DEV ne šaljemo telegram iz browser-a.
  if (import.meta.env.DEV) {
    console.info("[telegram] DEV mode: Telegram notify je isključen (koristi 'vercel dev' za end-to-end test).");
    return;
  }

  // PROD: Ne rušimo porudžbinu ako Telegram padne, ali logujemo.
  try {
    const res = await fetch("/api/telegram-new-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("Telegram API failed:", res.status, json);
    }
  } catch (e) {
    console.error("Telegram API error:", e);
  }
}

export async function createOrder(payload: CreateOrderPayload) {
  const customer_name = normalizeString(payload.customer_name);
  const customer_phone = normalizeString(payload.customer_phone);
  const customer_address = normalizeString(payload.customer_address);

  if (customer_name.length < 2) throw new Error("Neispravno ime i prezime.");
  if (customer_phone.length < 6) throw new Error("Neispravan broj telefona.");
  if (customer_address.length < 5) throw new Error("Neispravna adresa za dostavu.");

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) throw new Error("Korpa je prazna.");

  const total_price_cents = safeInt(payload.total_price, 0);
  const total_items = safeInt(payload.total_items, 0);

  if (total_items <= 0 || total_price_cents <= 0) {
    throw new Error("Neispravan obračun korpe.");
  }

  const normalizedItems: any[] = items.map((i) => ({
    cart_id: String(i.cart_id),
    menu_item_id: i.menu_item_id ?? null,
    name: String(i.name ?? ""),
    size: isValidSize(i.size) ? i.size : null,
    quantity: Math.max(1, safeInt(i.quantity, 1)),

    base_price:
      typeof i.base_price === "number" && Number.isFinite(i.base_price)
        ? safeInt(i.base_price, 0)
        : null,

    price_per_item: safeInt(i.price_per_item, 0),

    addons: Array.isArray(i.addons)
      ? i.addons.map((a: any) => ({
          id: String(a.id),
          name: String(a.name),
          price: safeInt(a.price, 0),
          quantity: Math.max(1, safeInt(a.quantity, 1)),
        }))
      : [],

    note: i.note ? String(i.note).trim() || null : null,

    image: String(i.image ?? ""),
    category: String(i.category ?? ""),
  }));

  const order_note = payload.note ? payload.note.trim() || null : null;

  // Backwards compatible meta zapis u orders.items[0]
  const meta: Record<string, any> = { total_items };
  if (order_note) meta.order_note = order_note;
  normalizedItems.unshift(meta);

  // Bitno:
  // - total_eur_cents je int (cente)
  // - total_price (legacy numeric EUR) ostavljamo NULL da ga BEFORE INSERT trigger popuni iz total_eur_cents/100
  const row: Record<string, any> = {
    customer_name,
    customer_phone,
    customer_address,
    items: normalizedItems,

    // legacy EUR numeric -> neka trigger popuni (da ne upišemo 950 umjesto 9.50)
    total_price: null,

    currency: "EUR",
    total_eur_cents: total_price_cents,
    fx_rsd_per_eur: null,

    status: "pending",
  };

  const { data, error } = await supabase
    .from("orders")
    .insert([row])
    .select("id")
    .single();

  if (error) throw new Error(formatSupabaseError(error));

  const orderId = String((data as any)?.id ?? "").trim();
  if (orderId) {
    // Telegram šaljemo server-side preko Vercel API-ja
    void notifyTelegramViaVercel(orderId);
  } else {
    console.warn("Order inserted but no id returned; telegram not triggered.");
  }

  return { success: true, orderId };
}
