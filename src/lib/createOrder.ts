import { toSafeInt } from "./money";
import { getApiBase } from "./apiBase";

type PaymentMethod = "cash" | "card";

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

  // checkout state (opciono)
  payment_method?: PaymentMethod;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function formatHttpError(status: number, body: unknown) {
  const parts: string[] = [];

  if (isRecord(body)) {
    const err = body.error;
    const code = body.code;

    if (typeof err === "string" && err.trim()) parts.push(err.trim());
    if (typeof code === "string" && code.trim()) parts.push(`Kod: ${code.trim()}`);

    // server / edge hardening često vraća request_id — korisno za debugging
    const requestId = body.request_id;
    if (typeof requestId === "string" && requestId.trim()) parts.push(`Request: ${requestId.trim()}`);
  }

  if (parts.length) return parts.join(" — ");
  return `Greška pri slanju porudžbine. HTTP ${status}`;
}

export async function createOrder(payload: CreateOrderPayload) {
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
    // real item mora imati pozitivnu cenu po stavci
    if (price_per_item <= 0) throw new Error("Invalid item structure");

    const note = it.note ? normalizeString(String(it.note)) : null;

    const addonsRaw: OrderItemAddonPayload[] = Array.isArray(it.addons) ? it.addons : [];
    const addons: OrderItemAddonPayload[] = addonsRaw.map((a) => {
      const id = normalizeString(String(a.id ?? ""));
      const aname = normalizeString(String(a.name ?? ""));
      const price = safeInt(a.price, 0);
      const aq = safeInt(a.quantity, 1);

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

  // ✅ payment method (server će dalje best-effort zvati payments-create-session)
  const method: PaymentMethod = payload.payment_method ?? "cash";

  // META (za zonu/dostavu/payment note)
  const hasMetaNote = typeof payload.note === "string" && payload.note.trim().length > 0;
  if (hasMetaNote) {
    const meta: OrderItemPayload = {
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
    };

    normalizedItems.unshift(meta);
  }

  const apiBody = {
    customer_name,
    customer_phone,
    customer_address,
    items: normalizedItems,
    total_eur_cents,
    currency: "EUR",
    status: "pending",
    fx_rsd_per_eur: null,

    // ✅ NOVO: šaljemo serveru da zna koji payments flow da pokuša (cash/card)
    payment_method: method,
  };

  const base = getApiBase().replace(/\/+$/, "");
  const url = `${base}/create-order`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(apiBody),
  });

  const jsonBody: unknown = await res.json().catch(() => null);

  if (!res.ok || !isRecord(jsonBody) || jsonBody.ok !== true) {
    throw new Error(formatHttpError(res.status, jsonBody));
  }

  const orderId = normalizeString(String(jsonBody.id ?? ""));
  if (!orderId) throw new Error("Porudžbina je poslata, ali ID nije vraćen.");

  // ✅ NEMA više browser poziva ka payments-create-session niti telegram notify.
  // Server (/api/create-order) radi best-effort za oba.

  return { success: true, orderId };
}