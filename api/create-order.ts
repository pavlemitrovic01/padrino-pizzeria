import crypto from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolvePublicBaseUrl } from "./_shared/public-url.js";
import { isPlainObject, normalizeText, safeInt, safeNumber } from "./_shared/parsing.js";
import { isWithinBusinessHours, nowMinutesInPodgorica } from "./_shared/business-hours.js";
import { crustSizeForItem, stuffedCrustSizeOf } from "./_shared/stuffed-crust.js";
import { displayNameOfMenuRow, pizzaSizeOfName } from "./_shared/menu-display.js";
import {
  deliveryFeeCents,
  findDeliveryZone,
  findDeliveryZoneByLabel,
  formatDeliveryFee,
  type DeliveryZone,
} from "./_shared/delivery-zones.js";
import { applyCors } from "./_shared/cors.js";
import { notifyNewOrder } from "./_shared/telegram.js";
import {
  BANKART_FALLBACK_EMAIL,
  BANKART_FALLBACK_CITY,
  BANKART_FALLBACK_POSTCODE,
  BANKART_DESCRIPTION_PREFIX,
} from "./_shared/config.js";
import { buildSupabaseAdmin, getEnv, getFirstEnv } from "./_shared/env.js";
import { json } from "./_shared/http.js";

type PaymentMethod = "cash" | "card";

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  body?: unknown;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

type BankartConfig = {
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  sharedSecret: string;
  language: string;
};

type BankartDebitRequest = {
  merchantTransactionId: string;
  amount: string;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  errorUrl: string;
  callbackUrl: string;
  description: string;
  language: string;
  merchantMetaData: string;
  extraData: Record<string, string>;
  transactionToken?: string;
  customer?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    billingAddress1?: string;
    billingCity?: string;
    billingPostcode?: string;
    billingCountry?: string;
    billingPhone?: string;
    shippingFirstName?: string;
    shippingLastName?: string;
    shippingAddress1?: string;
    shippingCountry?: string;
    shippingPhone?: string;
    ipAddress?: string;
  };
};

type BankartDebitResponse = {
  success?: unknown;
  uuid?: unknown;
  purchaseId?: unknown;
  returnType?: unknown;
  redirectUrl?: unknown;
  paymentMethod?: unknown;
  errors?: unknown;
  extraData?: unknown;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function headerStringCI(req: ReqLike, key: string): string {
  return (
    headerString(req, key) ||
    headerString(req, key.toLowerCase()) ||
    headerString(req, key.toUpperCase())
  );
}

const supabase = buildSupabaseAdmin("create-order");

/**
 * Legacy meta zapis koji frontend ubacuje u items[0]:
 * { total_items: number, order_note?: string }
 */
function looksLikeLegacyMetaItem(v: unknown) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;

  const allowed = new Set(["total_items", "order_note", "note"]);
  const itemish = ["quantity", "price_per_item", "name", "menu_item_id", "cart_id", "menuItemId"];
  if (itemish.some((k) => k in v)) return false;

  return keys.every((k) => allowed.has(k));
}

/**
 * A row the kitchen never sees. Telegram (api/telegram-new-order.ts) and the
 * admin panel (src/lib/adminOrdersLib.ts) both hide the rows whose cart_id,
 * name or category is "meta" and list the others, so the server prices every
 * other row (B23c). The frontend's own meta row is
 * { cart_id: "meta", name: "META", category: "meta", note }; legacy meta rows
 * ({ total_items, order_note }) carry no item at all.
 */
function isMetaRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (looksLikeLegacyMetaItem(v)) return true;
  return [v.cart_id, v.name, v.category].some((x) => normalizeText(toTrimmedString(x)) === "meta");
}

// Far above any real order (prod max: 6 of an item, 10 of an addon) and low
// enough that no quantity × price can overflow the total (a non-finite total
// is stored as NULL and Telegram shows "Ukupno: 0,00 €").
const MAX_LINE_QUANTITY = 99;

function isLineQuantity(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_LINE_QUANTITY;
}

/**
 * B23c: a row that is not meta is food the kitchen will make, so the server
 * must be able to price it exactly: a cart_id (Telegram lists only rows that
 * have one), a menu_item_id, a whole quantity 1–99, and addons that each have
 * an id and a whole quantity 1–99. The kitchen prints max(1, quantity) and
 * lists every addon object, so anything looser (no price, quantity −1 or 0, an
 * addon without id) was stored and made but never charged.
 */
function isPriceableItemRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!toTrimmedString(v.cart_id)) return false;

  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  if (!menuItemId || !isLineQuantity(v.quantity)) return false;

  if (v.addons === undefined || v.addons === null) return true;
  if (!Array.isArray(v.addons)) return false;
  return v.addons.every(
    (a) => isPlainObject(a) && toTrimmedString(a.id) !== "" && isLineQuantity(a.quantity),
  );
}

type PricingRow = {
  id: string;
  name: string;
  price_eur_cents: number;
};

function metaNoteOf(meta: Record<string, unknown>): string {
  return toTrimmedString(meta.order_note) || toTrimmedString(meta.note);
}

// The two lines the cart writes into its note (CartDrawer): the payment and
// "Zona: <label>, Dostava: <fee>".
const CART_PAYMENT_LINE = /^pla[cć]anje\s*:\s*(gotovina|kartica)\s*$/i;
const CART_ZONE_LINE = /^zona\s*:\s*([^,]*),\s*dostava\s*:.*$/i;

/**
 * The zone label from the cart's "Zona: …, Dostava: …" line. Only for carts
 * loaded before B23e, which send no `delivery_zone` key; the label picks the
 * zone, the fee still comes from the server's table.
 */
function zoneLabelFromNote(items: unknown[]): string {
  const meta = items.find((it) => isMetaRow(it));
  if (!isPlainObject(meta)) return "";
  for (const line of metaNoteOf(meta).split(/\r?\n/)) {
    const m = line.trim().match(CART_ZONE_LINE);
    if (m) return m[1].trim();
  }
  return "";
}

/**
 * B23e: Telegram reads the order's payment, zone and delivery fee from the
 * first note lines that carry them ("Plaćanje: …", "Zona: …", "Dostava: …";
 * api/telegram-new-order.ts parseMetaFromNote). The customer's own text used to
 * come first, so a note typed as "Plaćanje: Kartica" on a cash order told the
 * driver it was paid. The server now stores a single meta row whose note starts
 * with those lines, written from what it charged. Lines in the cart's own
 * format are dropped (a copy of the server's, or a lie); any other text follows
 * as the customer's note — Telegram reads only the first payment/zone/fee
 * lines, so a "Dostava: 0" typed there shows as a note, never as the fee.
 */
function withServerMetaRow(items: unknown[], serverLines: string[]): unknown[] {
  const meta = items.find((it) => isMetaRow(it));
  const customerLines = isPlainObject(meta)
    ? metaNoteOf(meta)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !CART_PAYMENT_LINE.test(line) && !CART_ZONE_LINE.test(line))
    : [];
  const note = [...serverLines, ...customerLines].join("\n");

  const metaRow = {
    cart_id: "meta",
    menu_item_id: null,
    name: "META",
    size: null,
    quantity: 1,
    base_price: null,
    price_per_item: 0,
    addons: [],
    note,
    order_note: note,
    image: "",
    category: "meta",
  };
  return [metaRow, ...items.filter((it) => !isMetaRow(it))];
}

type MenuRows = {
  prices: Map<string, number>;
  // Row names, for the stuffed-crust size check (B23b).
  names: Map<string, string>;
};

async function fetchMenuRows(ids: string[]): Promise<MenuRows> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return { prices: new Map(), names: new Map() };

  const { data, error } = await supabase
    .from("menu_items")
    .select("id,name,price_eur_cents")
    .eq("is_active", true)
    .in("id", uniq);

  if (error) throw new Error(`DB: pricing fetch failed (${error.message})`);

  const prices = new Map<string, number>();
  const names = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    const r = row as unknown as PricingRow;
    const id = toTrimmedString((r as unknown as Record<string, unknown>).id);
    const p = safeInt((r as unknown as Record<string, unknown>).price_eur_cents, 0);
    // Include every active row so the existence check (findMissingMenuItemIds)
    // recognizes free addons (price 0, e.g. ketchup/mayo). Price stays accurate
    // (0 for free items); sumAddonsCents already ignores non-positive prices.
    if (id) {
      prices.set(id, p > 0 ? p : 0);
      names.set(id, toTrimmedString((r as unknown as Record<string, unknown>).name));
    }
  }
  return { prices, names };
}

/**
 * B23b: the first addon that is the stuffed crust of the other pizza size
 * (e.g. the 2 € 33 cm crust on a 50 cm pizza), or null. Both sizes come from
 * menu row names — never from the `size` field the client sends.
 *
 * A crust row ordered as an item of its own is refused too: the kitchen lists
 * it as a separate line it could put on any pizza, and the cart never sends it
 * that way (prod: 0 such rows).
 */
function findCrustSizeMismatch(
  items: Record<string, unknown>[],
  names: Map<string, string>,
): { menuItemId: string; addonId: string } | null {
  for (const item of items) {
    const menuItemId = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);
    const itemName = names.get(menuItemId) ?? "";
    if (stuffedCrustSizeOf(itemName) !== null) return { menuItemId, addonId: "" };
    const fits = crustSizeForItem(itemName);

    const addons = Array.isArray(item.addons) ? item.addons : [];
    for (const a of addons) {
      if (!isPlainObject(a)) continue;
      const addonId = toTrimmedString(a.id);
      const crust = stuffedCrustSizeOf(names.get(addonId) ?? "");
      if (crust !== null && crust !== fits) return { menuItemId, addonId };
    }
  }
  return null;
}

function sumAddonsCents(addons: unknown, priceMap: Map<string, number>) {
  const list = Array.isArray(addons) ? addons : [];
  let total = 0;

  for (const a of list) {
    if (!isPlainObject(a)) continue;
    const addonId = toTrimmedString(a.id);
    const q = safeInt(a.quantity, 1);
    if (!addonId || q <= 0) continue;

    const cents = priceMap.get(addonId) ?? 0;
    if (cents > 0) total += q * cents;
  }

  return total;
}

function findMissingMenuItemIds(ids: string[], priceMap: Map<string, number>): string[] {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  return uniq.filter((id) => !priceMap.has(id));
}

/**
 * B23d: Telegram prints each row's name, size and addon names as stored, and
 * the admin panel its price_per_item and addon prices — while the server
 * charges by id. So the server stores what it charged: those fields come from
 * the menu rows. An honest cart already sends exactly this ("Diavolo" + "50"
 * for the row "Diavolo 50 cm", Telegram: "1x Diavolo (50)"), so the kitchen
 * reads the same. Meta rows, and each row's cart_id, quantity, note, image and
 * category, stay as sent.
 */
function withMenuRowDisplay(
  items: unknown[],
  prices: Map<string, number>,
  names: Map<string, string>,
): unknown[] {
  return items.map((it) => {
    if (!isPlainObject(it) || isMetaRow(it)) return it;

    const menuItemId = toTrimmedString(it.menu_item_id) || toTrimmedString(it.menuItemId);
    const rowName = names.get(menuItemId) ?? "";
    const basePrice = prices.get(menuItemId) ?? 0;

    const addons = Array.isArray(it.addons)
      ? it.addons.map((a) => {
          if (!isPlainObject(a)) return a;
          const addonId = toTrimmedString(a.id);
          return { ...a, name: names.get(addonId) ?? "", price: prices.get(addonId) ?? 0 };
        })
      : it.addons;

    return {
      ...it,
      name: displayNameOfMenuRow(rowName),
      size: pizzaSizeOfName(rowName),
      base_price: basePrice,
      price_per_item: basePrice + sumAddonsCents(addons, prices),
      addons,
    };
  });
}

function safeTotalCentsFromBody(body: Record<string, unknown>): number {
  const cents = body.total_eur_cents ?? body.totalEurCents;
  const asCents = safeInt(cents, -1);
  if (asCents >= 0) return asCents;

  const price = body.total_price ?? body.totalPrice;
  const n = safeNumber(price, Number.NaN);
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 100);

  return 0;
}

function getBankartConfig(): BankartConfig {
  const baseUrl = getFirstEnv("BANKART_API_BASE_URL", "NLB_API_BASE_URL") || "https://gateway.bankart.si/api/v3";
  const apiKey = getFirstEnv("BANKART_API_KEY", "NLB_API_KEY");
  const username = getFirstEnv("BANKART_API_USERNAME", "BANKART_API_USER", "NLB_API_USERNAME", "NLB_API_USER");
  const password = getFirstEnv("BANKART_API_PASSWORD", "NLB_API_PASSWORD");
  const sharedSecret = getFirstEnv("BANKART_SHARED_SECRET", "NLB_SHARED_SECRET");
  const language = (getFirstEnv("BANKART_LANGUAGE", "NLB_LANGUAGE") || "en").toLowerCase();

  if (!apiKey || !username || !password || !sharedSecret) {
    throw new Error("Missing Bankart env: API key / username / password / shared secret");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    username,
    password,
    sharedSecret,
    language: language.length === 2 ? language : "en",
  };
}

function normalizeBankartApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.replace(/\/api\/v3$/i, "");
}

function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName || "Kupac", lastName: "" };
  }

  const firstName = parts.shift() ?? fullName;
  return { firstName, lastName: parts.join(" ") };
}

function getClientIp(req: ReqLike): string {
  const forwarded = headerStringCI(req, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first;
  }

  return headerStringCI(req, "x-real-ip");
}

let ratelimitInstance: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  if (!ratelimitInstance) {
    ratelimitInstance = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(10, "60 s"),
      analytics: false,
    });
  }
  return ratelimitInstance;
}

function centsToAmountString(cents: number): string {
  const normalized = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0;
  return (normalized / 100).toFixed(2);
}

function createBankartSignature(
  sharedSecret: string,
  method: string,
  contentType: string,
  dateHeader: string,
  requestUri: string,
  bodyText: string,
): string {
  const bodyHash = crypto.createHash("sha512").update(bodyText, "utf8").digest("hex");
  const message = [method.toUpperCase(), bodyHash, contentType, dateHeader, requestUri].join("\n");
  return crypto.createHmac("sha512", sharedSecret).update(message, "utf8").digest("base64");
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function safeBankartErrorMessage(body: unknown, status: number, fallback: string): string {
  if (isPlainObject(body)) {
    const topError = toTrimmedString(body.errorMessage) || toTrimmedString(body.message);
    if (topError) return topError;

    const errors = Array.isArray(body.errors) ? body.errors : [];
    const first = errors[0];
    if (isPlainObject(first)) {
      const parts = [
        toTrimmedString(first.errorMessage),
        toTrimmedString(first.adapterMessage),
        toTrimmedString(first.errorCode),
        toTrimmedString(first.adapterCode),
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(" | ");
    }
  }

  return `${fallback} (HTTP ${status})`;
}

/**
 * Sanitizes errors returned to the browser client. Never relays raw
 * Bankart/network/DB error text — those go to server logs only.
 *
 * NOTE: kind="payment_init" routing in the handler depends on the substring
 * "bankart" in err.message. All current Bankart throw sites in startBankartDebit
 * use a "Bankart" prefix (verified 2026-05-12, lines 758/770/791/796/810/818/833/
 * 838/853). If a future refactor drops the prefix, replace this heuristic with
 * a custom BankartInitError class (B11.1).
 */
export function clientSafeError(
  _err: unknown,
  kind: "order_create" | "payment_init",
): string {
  if (kind === "order_create") {
    return "Greška pri kreiranju porudžbine. Pokušajte ponovo.";
  }
  return "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.";
}

function bankartMetaSnapshot(input: {
  phase: string;
  requestBody?: BankartDebitRequest;
  responseBody?: unknown;
  responseStatus?: number;
  message?: string;
}): Record<string, unknown> {
  const out: Record<string, unknown> = { phase: input.phase };
  if (typeof input.responseStatus === "number") out.responseStatus = input.responseStatus;
  if (input.message) out.message = input.message;
  if (input.requestBody) out.request = input.requestBody;
  if (input.responseBody !== undefined) out.response = input.responseBody;
  return out;
}

async function updateOrderPaymentState(
  orderId: string,
  values: {
    status?: string;
    payment_status?: string | null;
    payment_reference?: string | null;
    payment_meta?: Record<string, unknown> | null;
  },
) {
  const patch: Record<string, unknown> = {};

  if (typeof values.status === "string") patch.status = values.status;
  if (values.payment_status !== undefined) patch.payment_status = values.payment_status;
  if (values.payment_reference !== undefined) patch.payment_reference = values.payment_reference;
  if (values.payment_meta !== undefined) patch.payment_meta = values.payment_meta;

  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from("orders").update(patch).eq("id", orderId);
  if (error) {
    throw new Error(`DB payment update failed (${error.message})`);
  }
}

function buildBankartUrls(req: ReqLike, orderId: string) {
  const base = resolvePublicBaseUrl(req.headers);
  const encoded = encodeURIComponent(orderId);

  return {
    successUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=success`,
    cancelUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=cancel`,
    errorUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=error`,
    callbackUrl: `${base}/api/bankart-callback`,
  };
}

function buildBankartDebitRequest(
  req: ReqLike,
  orderId: string,
  input: {
    amountCents: number;
    currency: string;
    customerName: string;
    bankartCustomerName?: string;
    customerPhone: string;
    customerAddress: string;
    customerEmail?: string | null;
    billingCity?: string | null;
    billingPostcode?: string | null;
    transactionToken?: string | null;
  },
): BankartDebitRequest {
  const urls = buildBankartUrls(req, orderId);
  const bankartCustomerName = toTrimmedString(input.bankartCustomerName) || input.customerName;
  const { firstName, lastName } = splitCustomerName(bankartCustomerName);
  const clientIp = getClientIp(req);
  const config = getBankartConfig();
  const customerEmail = toTrimmedString(input.customerEmail) || BANKART_FALLBACK_EMAIL;
  const billingCity = toTrimmedString(input.billingCity) || BANKART_FALLBACK_CITY;
  const billingPostcode = toTrimmedString(input.billingPostcode) || BANKART_FALLBACK_POSTCODE;
  const transactionToken = toTrimmedString(input.transactionToken);

  const requestBody: BankartDebitRequest = {
    merchantTransactionId: orderId,
    amount: centsToAmountString(input.amountCents),
    currency: input.currency || "EUR",
    successUrl: urls.successUrl,
    cancelUrl: urls.cancelUrl,
    errorUrl: urls.errorUrl,
    callbackUrl: urls.callbackUrl,
    description: `${BANKART_DESCRIPTION_PREFIX} ${orderId}`.slice(0, 255),
    language: config.language,
    merchantMetaData: orderId.slice(0, 255),
    extraData: {
      source: "padrino-web",
      orderId,
      paymentMethod: "card",
      integration: transactionToken ? "payment_js" : "redirect",
    },
    customer: {
      firstName: firstName.slice(0, 50),
      lastName: lastName.slice(0, 50),
      email: customerEmail.slice(0, 100),
      billingAddress1: input.customerAddress.slice(0, 50),
      billingCity: billingCity.slice(0, 50),
      billingPostcode: billingPostcode.slice(0, 16),
      billingCountry: "ME",
      billingPhone: input.customerPhone.slice(0, 20),
      shippingFirstName: firstName.slice(0, 50),
      shippingLastName: lastName.slice(0, 50),
      shippingAddress1: input.customerAddress.slice(0, 50),
      shippingCountry: "ME",
      shippingPhone: input.customerPhone.slice(0, 20),
      ipAddress: clientIp || undefined,
    },
  };

  if (transactionToken) {
    requestBody.transactionToken = transactionToken;
  }

  return requestBody;
}

async function startBankartDebit(orderId: string, requestBody: BankartDebitRequest) {
  const config = getBankartConfig();
  const requestUri = `/api/v3/transaction/${encodeURIComponent(config.apiKey)}/debit`;
  const url = `${normalizeBankartApiBaseUrl(config.baseUrl)}${requestUri}`;
  const contentType = "application/json; charset=utf-8";
  const dateHeader = new Date().toUTCString();
  const bodyText = JSON.stringify(requestBody);
  const signature = createBankartSignature(
    config.sharedSecret,
    "POST",
    contentType,
    dateHeader,
    requestUri,
    bodyText,
  );

  const auth = Buffer.from(`${config.username}:${config.password}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Basic ${auth}`,
        "content-type": contentType,
        date: dateHeader,
        "x-date": dateHeader,
        "x-signature": signature,
      },
      body: bodyText,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? `Bankart init network error (${err.message})` : "Bankart init network error";

    await updateOrderPaymentState(orderId, {
      status: "cancelled",
      payment_status: "failed",
      payment_meta: bankartMetaSnapshot({
        phase: "init_network_error",
        requestBody,
        message,
      }),
    });

    throw new Error(message);
  }

  const responseText = await response.text();
  const responseBody = safeJsonParse(responseText);

  if (!response.ok) {
    const message = safeBankartErrorMessage(responseBody, response.status, "Bankart init failed");

    await updateOrderPaymentState(orderId, {
      status: "cancelled",
      payment_status: "failed",
      payment_meta: bankartMetaSnapshot({
        phase: "init_http_error",
        requestBody,
        responseBody,
        responseStatus: response.status,
        message,
      }),
    });

    throw new Error(message);
  }

  const bankart = isPlainObject(responseBody) ? (responseBody as BankartDebitResponse) : null;
  if (!bankart) {
    const message = "Bankart init failed: invalid JSON response";

    await updateOrderPaymentState(orderId, {
      status: "cancelled",
      payment_status: "failed",
      payment_meta: bankartMetaSnapshot({
        phase: "init_invalid_json",
        requestBody,
        responseBody,
        responseStatus: response.status,
        message,
      }),
    });

    throw new Error(message);
  }

  const transactionUuid = toTrimmedString(bankart.uuid);
  const returnType = toTrimmedString(bankart.returnType).toUpperCase();
  const redirectUrl = toTrimmedString(bankart.redirectUrl);

  if (bankart.success !== true || returnType === "ERROR") {
    const message = safeBankartErrorMessage(bankart, response.status, "Bankart rejected transaction");

    await updateOrderPaymentState(orderId, {
      status: "cancelled",
      payment_status: "failed",
      payment_reference: transactionUuid || null,
      payment_meta: bankartMetaSnapshot({
        phase: "init_error",
        requestBody,
        responseBody: bankart,
        responseStatus: response.status,
        message,
      }),
    });

    throw new Error(message);
  }

  if (returnType === "REDIRECT") {
    if (!redirectUrl) {
      const message = "Bankart init failed: missing redirect URL";

      await updateOrderPaymentState(orderId, {
        status: "cancelled",
        payment_status: "failed",
        payment_reference: transactionUuid || null,
        payment_meta: bankartMetaSnapshot({
          phase: "init_missing_redirect",
          requestBody,
          responseBody: bankart,
          responseStatus: response.status,
          message,
        }),
      });

      throw new Error(message);
    }

    await updateOrderPaymentState(orderId, {
      payment_status: "pending",
      payment_reference: transactionUuid || null,
      payment_meta: bankartMetaSnapshot({
        phase: "redirect",
        requestBody,
        responseBody: bankart,
        responseStatus: response.status,
      }),
    });

    return {
      flow: "card_redirect" as const,
      redirectUrl,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  if (returnType === "PENDING") {
    await updateOrderPaymentState(orderId, {
      payment_status: "pending",
      payment_reference: transactionUuid || null,
      payment_meta: bankartMetaSnapshot({
        phase: "pending",
        requestBody,
        responseBody: bankart,
        responseStatus: response.status,
      }),
    });

    return {
      flow: "card_pending" as const,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  if (returnType === "FINISHED") {
    await updateOrderPaymentState(orderId, {
      payment_status: "paid",
      payment_reference: transactionUuid || null,
      payment_meta: bankartMetaSnapshot({
        phase: "finished",
        requestBody,
        responseBody: bankart,
        responseStatus: response.status,
      }),
    });

    await notifyNewOrder(supabase, orderId);

    return {
      flow: "card_paid" as const,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  await updateOrderPaymentState(orderId, {
    payment_status: "pending",
    payment_reference: transactionUuid || null,
    payment_meta: bankartMetaSnapshot({
      phase: "other_return_type",
      requestBody,
      responseBody: bankart,
      responseStatus: response.status,
      message: `Unhandled returnType: ${returnType || "UNKNOWN"}`,
    }),
  });

  return {
    flow: "card_pending" as const,
    bankartUuid: transactionUuid,
    bankartPurchaseId: toTrimmedString(bankart.purchaseId),
    bankartReturnType: returnType || "UNKNOWN",
  };
}

/**
 * B24: one checkout attempt = one order. The cart sends a random key per
 * attempt (src/lib/createOrder.ts) and reuses it when it resends the same
 * order — e.g. after a timeout hid a response that had in fact succeeded — so
 * the retry gets the first order back instead of a second one in the kitchen.
 * Stored in the unique `orders.idempotency_key` (migration
 * 20261009120000_orders_idempotency_key.sql).
 */
function idempotencyKeyFrom(body: Record<string, unknown>): string | null {
  const key = toTrimmedString(body.idempotency_key);
  return /^[A-Za-z0-9_-]{16,100}$/.test(key) ? key : null;
}

type ExistingOrder = {
  id: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_meta: unknown;
};

async function findOrderByIdempotencyKey(key: string): Promise<ExistingOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,payment_method,payment_status,payment_meta")
    .eq("idempotency_key", key);
  // An error here (e.g. the column is not migrated yet) means "no earlier
  // attempt known" — never a reason to refuse the order.
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  const id = toTrimmedString(row.id);
  if (!id) return null;
  return {
    id,
    payment_method: toTrimmedString(row.payment_method) || null,
    payment_status: toTrimmedString(row.payment_status) || null,
    payment_meta: row.payment_meta,
  };
}

function isUnknownIdempotencyColumn(err: { code?: unknown; message?: unknown } | null): boolean {
  if (!err) return false;
  const code = toTrimmedString(err.code);
  const message = toTrimmedString(err.message);
  return (code === "PGRST204" || code === "42703") && message.includes("idempotency_key");
}

/** The response the first attempt gave (or would give now), for a repeated key. */
function replayExistingOrder(res: ResLike, existing: ExistingOrder) {
  const id = existing.id;
  const base = { ok: true, id, order_id: id, orderId: id, replayed: true };

  if (existing.payment_method !== "card") return json(res, 200, { ...base, flow: "cash" });

  if (existing.payment_status === "paid") {
    return json(res, 200, { ...base, payment_method: "card", payment_status: "paid", flow: "card_paid" });
  }

  const meta = isPlainObject(existing.payment_meta) ? existing.payment_meta : {};
  const response = isPlainObject(meta.response) ? meta.response : {};
  const redirectUrl = meta.phase === "redirect" ? toTrimmedString(response.redirectUrl) : "";
  return json(res, 200, {
    ...base,
    payment_method: "card",
    payment_status: "pending",
    flow: redirectUrl ? "card_redirect" : "card_pending",
    redirect_url: redirectUrl || null,
    redirectUrl: redirectUrl || null,
  });
}

/**
 * Fail-open by design: an unset or unreadable business-hours config must
 * never block a real order. Only an explicitly configured + parseable
 * window (both columns set) can produce `open: false`.
 */
async function checkOrdersOpen(): Promise<{ open: boolean; hoursDisplay: string }> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("orders_open_time, orders_close_time, hours_display")
      .eq("id", 1)
      .single();

    if (error) {
      console.warn("[create-order] business-hours read failed, allowing order:", error);
      return { open: true, hoursDisplay: "" };
    }
    if (!isPlainObject(data)) return { open: true, hoursDisplay: "" };

    const open = isWithinBusinessHours(
      data.orders_open_time,
      data.orders_close_time,
      nowMinutesInPodgorica(),
    );
    return { open, hoursDisplay: toTrimmedString(data.hours_display) };
  } catch (err) {
    console.warn("[create-order] business-hours check threw, allowing order:", err);
    return { open: true, hoursDisplay: "" };
  }
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "POST" });

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const ratelimit = getRatelimit();
  if (!ratelimit) {
    console.warn("[create-order] Rate limiting not active: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set");
  } else {
    try {
      const ip = getClientIp(req);
      const result = await ratelimit.limit(ip);
      if (!result.success) {
        const retryAfter = result.reset && Number.isFinite(result.reset)
          ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
          : 60;
        res.status(429);
        res.setHeader("Retry-After", String(retryAfter));
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(
          JSON.stringify({
            ok: false,
            error: `Previše zahteva. Pokušajte ponovo za ${retryAfter} sekundi.`,
          }),
        );
        return;
      }
    } catch (err) {
      console.warn("[create-order] Rate limit check failed, allowing request:", err);
    }
  }

  try {
    const body = isPlainObject(req.body) ? req.body : {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);
    const customer_email = toTrimmedString(body.customer_email) || BANKART_FALLBACK_EMAIL;
    const billing_city = toTrimmedString(body.billing_city) || BANKART_FALLBACK_CITY;
    const billing_postcode = toTrimmedString(body.billing_postcode) || BANKART_FALLBACK_POSTCODE;
    const cardholder = toTrimmedString(body.cardholder);
    const transaction_token = toTrimmedString(body.transaction_token);

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    // B23e: status and currency are the server's, whatever the request says
    // (a cash order sent as "done" used to be stored as done).
    const currency = "EUR";

    const pmRaw = toTrimmedString(body.payment_method) || toTrimmedString(body.paymentMethod);
    if (pmRaw && pmRaw !== "cash" && pmRaw !== "card") {
      return json(res, 400, { ok: false, error: "Invalid payment_method" });
    }
    const payment_method: PaymentMethod = pmRaw === "card" ? "card" : "cash";

    if (
      customer_name.length < 2 ||
      customer_phone.length < 6 ||
      customer_address.length < 5 ||
      rawItems.length === 0
    ) {
      return json(res, 400, { ok: false, error: "Invalid payload" });
    }

    for (const it of rawItems) {
      if (!isMetaRow(it) && !isPriceableItemRow(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    const zoneKey = toTrimmedString(body.delivery_zone);
    const zone: DeliveryZone | null = zoneKey
      ? findDeliveryZone(zoneKey)
      : findDeliveryZoneByLabel(zoneLabelFromNote(rawItems));
    if (!zone) {
      return json(res, 400, {
        ok: false,
        code: "invalid_delivery_zone",
        error: "Izaberi zonu dostave i pokušaj ponovo.",
      });
    }

    const hours = await checkOrdersOpen();
    if (!hours.open) {
      const suffix = hours.hoursDisplay ? ` Radno vrijeme: ${hours.hoursDisplay}.` : "";
      return json(res, 409, {
        ok: false,
        code: "outside_business_hours",
        error: `Trenutno ne primamo porudžbine.${suffix}`,
      });
    }

    if (payment_method === "card") {
      getBankartConfig();
    }

    // Every row that is not meta is priced from menu_items — price_per_item is
    // the client's own figure and never decides whether a row is charged.
    const calcItems = rawItems.filter(
      (it): it is Record<string, unknown> => isPlainObject(it) && !isMetaRow(it),
    );

    if (calcItems.length === 0) {
      return json(res, 400, { ok: false, error: "Invalid item structure" });
    }

    const idsToFetch: string[] = [];
    for (const it of calcItems) {
      const menu_item_id = toTrimmedString(it.menu_item_id) || toTrimmedString(it.menuItemId);
      if (menu_item_id) idsToFetch.push(menu_item_id);

      const addons = Array.isArray(it.addons) ? it.addons : [];
      for (const a of addons) {
        if (!isPlainObject(a)) continue;
        const addonId = toTrimmedString(a.id);
        if (addonId) idsToFetch.push(addonId);
      }
    }

    const { prices: priceMap, names: menuNames } = await fetchMenuRows(idsToFetch);
    const missingIds = findMissingMenuItemIds(idsToFetch, priceMap);

    if (missingIds.length > 0) {
      return json(res, 400, { ok: false, error: "Inactive or invalid menu item" });
    }

    const crustMismatch = findCrustSizeMismatch(calcItems, menuNames);
    if (crustMismatch) {
      console.warn("[create-order] stuffed crust does not match pizza size:", crustMismatch);
      return json(res, 400, {
        ok: false,
        code: "crust_size_mismatch",
        error: "Punjene ivice ne odgovaraju veličini pice. Ukloni ih iz korpe i dodaj ponovo.",
      });
    }

    let subtotal_eur_cents = 0;

    for (const item of calcItems) {
      const q = safeInt(item.quantity, 1);
      const id = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);
      const baseCents = id ? priceMap.get(id) ?? 0 : 0;
      const addonsCents = sumAddonsCents(item.addons, priceMap);

      subtotal_eur_cents += q * baseCents + q * addonsCents;
    }

    if (subtotal_eur_cents <= 0) {
      return json(res, 400, { ok: false, error: "Invalid calculated subtotal" });
    }

    // B23e: the fee comes from the server's zone table and the subtotal it
    // priced — never from the client's note.
    const feeCents = deliveryFeeCents(zone, subtotal_eur_cents);
    const computedTotalCents = subtotal_eur_cents + feeCents;
    // A non-finite total is stored as NULL (Telegram: "Ukupno: 0,00 €").
    if (!Number.isSafeInteger(computedTotalCents)) {
      return json(res, 400, { ok: false, error: "Invalid calculated total" });
    }
    const bodyTotalCents = safeTotalCentsFromBody(body);

    if (bodyTotalCents > 0 && Math.abs(bodyTotalCents - computedTotalCents) > 1) {
      return json(res, 400, { ok: false, error: "Total mismatch" });
    }

    const insertRow: Record<string, unknown> = {
      customer_name,
      customer_phone,
      customer_address,
      items: withServerMetaRow(withMenuRowDisplay(rawItems, priceMap, menuNames), [
        `Plaćanje: ${payment_method === "cash" ? "Gotovina" : "Kartica"}`,
        `Zona: ${zone.label}, Dostava: ${formatDeliveryFee(feeCents)}`,
      ]),
      status: "pending",
      currency,
      total_eur_cents: computedTotalCents,
      payment_method,
      payment_status: payment_method === "card" ? "pending" : null,
      payment_provider: payment_method === "card" ? "bankart" : null,
      payment_reference: null,
      payment_meta:
        payment_method === "card"
          ? bankartMetaSnapshot({
              phase: "order_created",
              message: transaction_token
                ? "Order created before Bankart payment.js debit init"
                : "Order created before Bankart redirect init",
            })
          : null,
    };

    // B24: a repeated attempt gets its first order back. A card attempt whose
    // payment already failed is not repeated — the retry is a new order.
    let idempotencyKey = idempotencyKeyFrom(body);
    if (idempotencyKey) {
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing && !(existing.payment_method === "card" && existing.payment_status === "failed")) {
        return replayExistingOrder(res, existing);
      }
      if (existing) idempotencyKey = null;
    }
    if (idempotencyKey) insertRow.idempotency_key = idempotencyKey;

    let { data: inserted, error: insErr } = await supabase
      .from("orders")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr && idempotencyKey && toTrimmedString(insErr.code) === "23505") {
      // Two identical attempts raced; the other one inserted first.
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing) return replayExistingOrder(res, existing);
    }

    if (insErr && isUnknownIdempotencyColumn(insErr)) {
      // Code deployed before its migration: take the order without the key.
      console.warn("[create-order] orders.idempotency_key missing — apply migration 20261009120000");
      delete insertRow.idempotency_key;
      ({ data: inserted, error: insErr } = await supabase.from("orders").insert(insertRow).select("id").single());
    }

    if (insErr || !inserted?.id) {
      console.error("[create-order] DB insert failed:", insErr);
      return json(res, 500, { ok: false, error: clientSafeError(insErr, "order_create") });
    }

    const orderId = toTrimmedString(inserted.id);

    if (payment_method === "cash") {
      await notifyNewOrder(supabase, orderId);

      return json(res, 200, {
        ok: true,
        id: orderId,
        order_id: orderId,
        orderId,
        flow: "cash",
      });
    }

    const bankartRequest = buildBankartDebitRequest(req, orderId, {
      amountCents: computedTotalCents,
      currency,
      customerName: customer_name,
      bankartCustomerName: cardholder || customer_name,
      customerPhone: customer_phone,
      customerAddress: customer_address,
      customerEmail: customer_email,
      billingCity: billing_city,
      billingPostcode: billing_postcode,
      transactionToken: transaction_token || null,
    });

    const bankart = await startBankartDebit(orderId, bankartRequest);

    return json(res, 200, {
      ok: true,
      id: orderId,
      order_id: orderId,
      orderId,
      payment_method,
      payment_status: bankart.flow === "card_paid" ? "paid" : "pending",
      flow: bankart.flow,
      redirect_url: "redirectUrl" in bankart ? bankart.redirectUrl : null,
      redirectUrl: "redirectUrl" in bankart ? bankart.redirectUrl : null,
      bankart_uuid: bankart.bankartUuid,
      bankart_purchase_id: bankart.bankartPurchaseId,
      bankart_return_type: bankart.bankartReturnType,
    });
  } catch (err: unknown) {
    console.error("[create-order] order creation failed:", err);
    const kind: "order_create" | "payment_init" =
      err instanceof Error && err.message.toLowerCase().includes("bankart")
        ? "payment_init"
        : "order_create";
    return json(res, 500, { ok: false, error: clientSafeError(err, kind) });
  }
}