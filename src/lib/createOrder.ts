import { supabase } from "./supabaseClient";

export type OrderItemAddonPayload = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type OrderItemPayload = {
  cart_id: string;
  menu_item_id: string | null;
  name: string;
  size: "33" | "50" | null;
  quantity: number;

  // osnovna cijena bez dodataka
  base_price: number | null;

  // cijena jedne stavke sa dodacima (bez množ. quantity)
  price_per_item: number;

  addons: OrderItemAddonPayload[];

  // napomena po stavci
  note: string | null;

  image: string;
  category: string;
};

export type CreateOrderPayload = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;

  items: OrderItemPayload[];

  total_price: number;
  total_items: number;

  // globalna napomena porudžbine (opciono)
  note?: string | null;
};

function normalizeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function safeNumber(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
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

export async function createOrder(payload: CreateOrderPayload) {
  const customer_name = normalizeString(payload.customer_name);
  const customer_phone = normalizeString(payload.customer_phone);
  const customer_address = normalizeString(payload.customer_address);

  if (customer_name.length < 2) throw new Error("Neispravno ime i prezime.");
  if (customer_phone.length < 6) throw new Error("Neispravan broj telefona.");
  if (customer_address.length < 5) throw new Error("Neispravna adresa za dostavu.");

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) throw new Error("Korpa je prazna.");

  const total_price = safeNumber(payload.total_price);
  const total_items = safeNumber(payload.total_items);

  if (total_items <= 0 || total_price <= 0) {
    throw new Error("Neispravan obračun korpe.");
  }

  // normalizacija stavki (bez mijenjanja poslovne logike)
  const normalizedItems: any[] = items.map((i) => ({
    cart_id: String(i.cart_id),
    menu_item_id: i.menu_item_id ?? null,
    name: String(i.name ?? ""),
    size: isValidSize(i.size) ? i.size : null,
    quantity: safeNumber(i.quantity),

    base_price:
      typeof i.base_price === "number" && Number.isFinite(i.base_price)
        ? i.base_price
        : null,

    price_per_item: safeNumber(i.price_per_item),

    addons: Array.isArray(i.addons)
      ? i.addons.map((a: any) => ({
          id: String(a.id),
          name: String(a.name),
          price: safeNumber(a.price),
          quantity: safeNumber(a.quantity),
        }))
      : [],

    note: i.note ? String(i.note).trim() || null : null,

    image: String(i.image ?? ""),
    category: String(i.category ?? ""),
  }));

  // ✅ META zapis (jer u tabeli nema total_items kolone)
  // i globalna napomena ide ovdje (da bude dostupna adminu)
  const order_note = payload.note ? payload.note.trim() || null : null;

  const meta: Record<string, any> = {
    total_items,
  };

  if (order_note) meta.order_note = order_note;

  // meta na početak (stabilno i lako za čitanje u adminu)
  normalizedItems.unshift(meta);

  // ✅ U TVOJOJ TABELI POSTOJI: customer_name/phone/address, items, total_price, status
  const row = {
    customer_name,
    customer_phone,
    customer_address,
    items: normalizedItems,
    total_price,
    status: "pending",
  };

  const { error } = await supabase.from("orders").insert([row]);

  if (error) throw new Error(formatSupabaseError(error));

  return { success: true };
}
