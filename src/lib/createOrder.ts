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

export type CreateOrderResult = { success: true; orderId: string };

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

function formatHttpError(status: number, body: any) {
  const parts: string[] = [];
  if (body?.error) parts.push(String(body.error));
  if (body?.code) parts.push(`Kod: ${String(body.code)}`);
  if (parts.length) return parts.join(" — ");
  return `Greška pri slanju porudžbine. HTTP ${status}`;
}

function getApiBaseUrl() {
  // Ako korisnik eksplicitno postavi (lokalno) – poštujemo.
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (envBase && envBase.trim()) return envBase.trim().replace(/\/+$/, "");

  // U produkciji: relative rute rade (Vercel /api/*).
  if ((import.meta as any).env?.PROD) return "";

  // U dev-u: Vite dev server nema /api rute -> gađamo produkciju da test može da radi bez 404 spama.
  return "https://padrino-pizzeria.vercel.app";
}

async function notifyTelegram(orderId: string) {
  // DEV: Vite dev server nema /api rute -> 404 spam. Preskačemo.
  if (import.meta.env.DEV) return;

  // PROD: best-effort (ne rušimo porudžbinu ako Telegram padne)
  try {
    const res = await fetch("/api/telegram-new-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      console.error("[telegram] notify failed:", res.status, j);
    }
  } catch (e) {
    console.error("[telegram] notify error:", e);
  }
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const customer_name = normalizeString(payload.customer_name);
  const customer_phone = normalizeString(payload.customer_phone);
  const customer_address = normalizeString(payload.customer_address);

  if (customer_name.length < 2) throw new Error("Neispravno ime i prezime.");
  if (customer_phone.length < 6) throw new Error("Neispravan broj telefona.");
  if (customer_address.length < 5) throw new Error("Neispravna adresa za dostavu.");

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) throw new Error("Korpa je prazna.");

  const total_eur_cents = safeInt(payload.total_price, 0);
  const total_items = safeInt(payload.total_items, 0);

  if (total_items <= 0 || total_eur_cents <= 0) {
    throw new Error("Neispravan obračun korpe.");
  }

  // Normalizujemo items (stability-first)
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

  const apiBody = {
    customer_name,
    customer_phone,
    customer_address,
    items: normalizedItems,

    total_eur_cents,
    currency: "EUR",
    status: "pending",
    fx_rsd_per_eur: null,
  };

  const base = getApiBaseUrl();
  const url = `${base}/api/create-order`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(apiBody),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(formatHttpError(res.status, json));
  }

  const orderId = String(json?.id ?? "").trim();
  if (!orderId) throw new Error("Porudžbina je poslata, ali ID nije vraćen.");

  void notifyTelegram(orderId);

  return { success: true, orderId };
}
