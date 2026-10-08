import { toSafeInt } from "./money";
import { getApiBase } from "./apiBase";
import { isRecord } from "./parsing";

type PaymentMethod = "cash" | "card";
type PaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | null;
type CreateOrderFlow = "cash" | "card_redirect" | "card_pending" | "card_paid";

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
  customer_email?: string | null;
  billing_city?: string | null;
  billing_postcode?: string | null;
  cardholder?: string | null;
  transaction_token?: string | null;

  items: OrderItemPayload[];

  // total (EUR cente)
  total_price: number;
  total_items: number;

  note?: string | null;

  // ključ zone iz DELIVERY_ZONES — server iz njega računa dostavu (B23e)
  delivery_zone?: string | null;

  // checkout state (opciono)
  payment_method?: PaymentMethod;
};

export type CreateOrderResult = {
  success: true;
  orderId: string;
  flow: CreateOrderFlow;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  redirectUrl: string | null;
};

function normalizeString(value: string) {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : "";
}

function normalizeOptionalString(value: unknown) {
  return normalizeString(String(value ?? "")) || null;
}

function safeInt(value: unknown, fallback = 0) {
  return toSafeInt(value, fallback);
}

function isValidSize(size: unknown): size is "33" | "50" {
  return size === "33" || size === "50";
}

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cash" || value === "card";
}

function isPaymentStatus(value: unknown): value is Exclude<PaymentStatus, null> {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "refunded"
  );
}

function isCreateOrderFlow(value: unknown): value is CreateOrderFlow {
  return value === "cash" || value === "card_redirect" || value === "card_pending" || value === "card_paid";
}

function formatHttpError(status: number, body: unknown) {
  const parts: string[] = [];

  if (isRecord(body)) {
    const err = body.error;
    const code = body.code;

    if (typeof err === "string" && err.trim()) parts.push(err.trim());
    if (typeof code === "string" && code.trim()) parts.push(`Kod: ${code.trim()}`);

    const requestId = body.request_id;
    if (typeof requestId === "string" && requestId.trim()) parts.push(`Request: ${requestId.trim()}`);
  }

  if (parts.length) return parts.join(" — ");
  return `Greška pri slanju porudžbine. HTTP ${status}`;
}

function getResultOrderId(body: Record<string, unknown>): string {
  const candidates = [body.orderId, body.order_id, body.id];

  for (const candidate of candidates) {
    const value = normalizeString(String(candidate ?? ""));
    if (value) return value;
  }

  return "";
}

function getResultFlow(body: Record<string, unknown>): CreateOrderFlow {
  const raw = body.flow;
  return isCreateOrderFlow(raw) ? raw : "cash";
}

function getResultPaymentMethod(body: Record<string, unknown>, fallback: PaymentMethod): PaymentMethod {
  const raw = body.payment_method ?? body.paymentMethod;
  return isPaymentMethod(raw) ? raw : fallback;
}

function getResultPaymentStatus(body: Record<string, unknown>): PaymentStatus {
  const raw = body.payment_status ?? body.paymentStatus;
  return isPaymentStatus(raw) ? raw : null;
}

function getResultRedirectUrl(body: Record<string, unknown>): string | null {
  const candidates = [body.redirectUrl, body.redirect_url];

  for (const candidate of candidates) {
    const value = normalizeString(String(candidate ?? ""));
    if (value) return value;
  }

  return null;
}

/**
 * B24: one checkout attempt = one order. Each attempt gets a random key; the
 * same order sent again (the customer taps "Poruči" after a timeout that hid a
 * response which had in fact succeeded) reuses it, and the server answers with
 * the first order instead of making a second one. Any change to the order, or
 * a success, starts a new attempt. The card token is new on every tap, so it
 * is not part of what makes two attempts "the same".
 *
 * Kept in sessionStorage as well as memory, so a customer who reloads the tab
 * mid-checkout and sends the same order again still gets the first one back.
 */
const ATTEMPT_STORAGE_KEY = "padrino:order-attempt";
let lastAttempt: { signature: string; key: string } | null = null;

function readStoredAttempt(): { signature: string; key: string } | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed) && typeof parsed.signature === "string" && typeof parsed.key === "string") {
      return { signature: parsed.signature, key: parsed.key };
    }
  } catch {
    // storage unavailable (private mode, blocked) — memory only
  }
  return null;
}

function storeAttempt(attempt: { signature: string; key: string } | null): void {
  lastAttempt = attempt;
  try {
    if (attempt) globalThis.sessionStorage?.setItem(ATTEMPT_STORAGE_KEY, JSON.stringify(attempt));
    else globalThis.sessionStorage?.removeItem(ATTEMPT_STORAGE_KEY);
  } catch {
    // storage unavailable — memory only
  }
}

function newAttemptKey(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  return `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

function attemptKeyFor(apiBody: Record<string, unknown>): string {
  const { transaction_token: _token, ...rest } = apiBody;
  void _token;
  const signature = JSON.stringify(rest);
  const known = lastAttempt ?? readStoredAttempt();
  if (known && known.signature === signature) {
    lastAttempt = known;
    return known.key;
  }
  const next = { signature, key: newAttemptKey() };
  storeAttempt(next);
  return next.key;
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResult> {
  const customer_name = normalizeString(payload.customer_name);
  const customer_phone = normalizeString(payload.customer_phone);
  const customer_address = normalizeString(payload.customer_address);
  const customer_email = normalizeOptionalString(payload.customer_email);
  const billing_city = normalizeOptionalString(payload.billing_city);
  const billing_postcode = normalizeOptionalString(payload.billing_postcode);
  const cardholder = normalizeOptionalString(payload.cardholder);
  const transaction_token = normalizeOptionalString(payload.transaction_token);
  const delivery_zone = normalizeOptionalString(payload.delivery_zone);

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

  const method: PaymentMethod = payload.payment_method ?? "cash";

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

  const apiBody: Record<string, unknown> = {
    customer_name,
    customer_phone,
    customer_address,
    items: normalizedItems,
    total_eur_cents,
    currency: "EUR",
    status: "pending",
    fx_rsd_per_eur: null,
    payment_method: method,
  };

  if (customer_email) apiBody.customer_email = customer_email;
  if (billing_city) apiBody.billing_city = billing_city;
  if (billing_postcode) apiBody.billing_postcode = billing_postcode;
  if (cardholder) apiBody.cardholder = cardholder;
  if (transaction_token) apiBody.transaction_token = transaction_token;
  if (delivery_zone) apiBody.delivery_zone = delivery_zone;
  apiBody.idempotency_key = attemptKeyFor(apiBody);

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

  const orderId = getResultOrderId(jsonBody);
  if (!orderId) {
    throw new Error("Porudžbina je poslata, ali ID nije vraćen.");
  }

  const flow = getResultFlow(jsonBody);
  const paymentMethod = getResultPaymentMethod(jsonBody, method);
  const paymentStatus = getResultPaymentStatus(jsonBody);
  const redirectUrl = getResultRedirectUrl(jsonBody);

  if (flow === "card_redirect" && !redirectUrl) {
    throw new Error("Kartično plaćanje je pokrenuto, ali redirect link nije vraćen.");
  }

  // The order exists: the next order, even an identical one, is a new attempt.
  storeAttempt(null);

  return {
    success: true,
    orderId,
    flow,
    paymentMethod,
    paymentStatus,
    redirectUrl,
  };
}