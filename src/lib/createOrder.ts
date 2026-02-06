import { toSafeInt } from "./money";
import { getApiBase } from "./apiBase";

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

function formatHttpError(status: number, body: any) {
  const parts: string[] = [];
  if (body?.error) parts.push(String(body.error));
  if (body?.code) parts.push(`Kod: ${String(body.code)}`);
  if (parts.length) return parts.join(" — ");
  return `Greška pri slanju porudžbine. HTTP ${status}`;
}

async function notifyTelegramBestEffort(orderId: string) {
  // DEV: ne šaljemo da ne spamuje (i da ne pravi šum dok testiraš lokalno)
  if ((import.meta as any).env?.DEV) return;

  try {
    const res = await fetch("/api/telegram-new-order", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      // eslint-disable-next-line no-console
      console.error("[telegram] notify failed:", res.status, j);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[telegram] notify error:", e);
  }
}

export async function createOrder(payload: CreateOrderPayload) {
  // ✅ Strict-validacija inputa (fail-fast)
  const customer_name = normalizeString(payload.customer_name);
  const customer_phone = normalizeString(payload.customer_phone);
  const customer_address = normalizeString(payload.customer_address);

  if (!customer_name || !customer_phone || !customer_address) {
    throw new Error("Unesite ime, telefon i adresu.");
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error("Korpa je prazna.");
  }

  const normalizedItems: OrderItemPayload[] = payload.items.map((it) => {
    const cart_id = normalizeString(String(it.cart_id ?? ""));
    const name = normalizeString(String(it.name ?? ""));
    const image = normalizeString(String(it.image ?? ""));
    const category = normalizeString(String(it.category ?? ""));

    if (!cart_id || !name || !image || !category) {
      throw new Error("Invalid item structure");
    }

    const quantity = safeInt(it.quantity, 1);
    if (quantity <= 0) throw new Error("Invalid item structure");

    const size = it.size === null ? null : isValidSize(it.size) ? it.size : null;

    const menu_item_id =
      it.menu_item_id === null ? null : normalizeString(String(it.menu_item_id ?? "")) || null;

    const base_price =
      it.base_price === null || it.base_price === undefined ? null : safeInt(it.base_price, 0);

    const price_per_item = safeInt(it.price_per_item, 0);
    if (price_per_item <= 0) throw new Error("Invalid item structure");

    const note = it.note ? normalizeString(String(it.note)) : null;

    const addonsRaw = Array.isArray(it.addons) ? it.addons : [];
    const addons: OrderItemAddonPayload[] = addonsRaw.map((a) => {
      const id = normalizeString(String(a.id ?? ""));
      const aname = normalizeString(String(a.name ?? ""));
      const price = safeInt((a as any).price, 0);
      const aq = safeInt((a as any).quantity, 1);

      if (!id || !aname || price < 0 || aq <= 0) {
        throw new Error("Invalid item structure");
      }

      return { id, name: aname, price, quantity: aq };
    });

    return {
      cart_id,
      menu_item_id,
      name,
      size,
      quantity,
      base_price,
      price_per_item,
      addons,
      note,
      image,
      category,
    };
  });

  const total_eur_cents = safeInt(payload.total_price, 0);
  const total_items = safeInt(payload.total_items, 0);

  if (total_eur_cents <= 0 || total_items <= 0) {
    throw new Error("Invalid total");
  }

  // meta-stavka na početak (kompatibilno sa backendom ako očekuje)
  const meta = {
    cart_id: "meta",
    menu_item_id: null,
    name: "META",
    size: null,
    quantity: 1,
    base_price: null,
    price_per_item: 0,
    addons: [],
    note: payload.note ?? null,
    image: "",
    category: "meta",
  } as unknown as OrderItemPayload;

  // ubaci meta samo ako ima napomene
  const hasMetaNote = typeof payload.note === "string" && payload.note.trim().length > 0;
  if (hasMetaNote) normalizedItems.unshift(meta);

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

  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}/create-order`;

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

  void notifyTelegramBestEffort(orderId);

  return { success: true, orderId };
}
