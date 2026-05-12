import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type PaymentMethod = "cash" | "card";
type Json = Record<string, unknown>;

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

const BANKART_FALLBACK_EMAIL = "padrinobudva@gmail.com";
const BANKART_FALLBACK_CITY = "Budva";
const BANKART_FALLBACK_POSTCODE = "85310";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

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

function setCors(req: ReqLike, res: ResLike) {
  const origin = headerStringCI(req, "origin");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res: ResLike, status: number, body: Json) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function getFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return "";
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const SERVICE_ROLE =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

const supabase = buildSupabaseAdmin();

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
 * NOVO: “META” item koji frontend šalje kao “pravi item”
 * (cart_id/meta, category/meta, name/META), ima note, ali nema menu_item_id
 */
function looksLikeCartMetaItem(v: unknown) {
  if (!isPlainObject(v)) return false;

  const cartId = toTrimmedString(v.cart_id);
  const name = toTrimmedString(v.name);
  const category = toTrimmedString(v.category);

  if (cartId.toLowerCase() === "meta") return true;
  if (category.toLowerCase() === "meta") return true;
  if (name.toUpperCase() === "META") return true;

  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  const p = v.price_per_item ?? v.pricePerItem;
  if (!menuItemId && typeof p === "number" && p === 0) return true;

  return false;
}

function looksLikeRealItemButInvalid(v: unknown) {
  if (!isPlainObject(v)) return false;
  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  const name = toTrimmedString(v.name);
  const qty = v.quantity;

  const hasItemish = !!name || typeof qty === "number" || !!menuItemId;
  if (!hasItemish) return false;

  if (looksLikeLegacyMetaItem(v) || looksLikeCartMetaItem(v)) return false;

  return !menuItemId;
}

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

type Zone = {
  id: string;
  name: string;
  fee_eur: number;
  polygon: number[][];
};

type PricingRow = {
  id: string;
  price_eur_cents: number;
};

async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("delivery_zones").select("id,name,fee_eur,polygon");
  if (error) throw new Error(`DB: zones fetch failed (${error.message})`);

  const zones: Zone[] = [];
  for (const row of Array.isArray(data) ? data : []) {
    const id = toTrimmedString((row as Record<string, unknown>).id);
    const name = toTrimmedString((row as Record<string, unknown>).name);
    const fee = safeNumber((row as Record<string, unknown>).fee_eur, 0);

    const polygonRaw = (row as Record<string, unknown>).polygon;
    const polygon: number[][] = Array.isArray(polygonRaw)
      ? (polygonRaw as unknown[]).map((pt) => {
          if (!Array.isArray(pt) || pt.length < 2) return [0, 0];
          return [safeNumber(pt[0], 0), safeNumber(pt[1], 0)];
        })
      : [];

    if (!id || !name || polygon.length < 3) continue;
    zones.push({ id, name, fee_eur: fee, polygon });
  }

  return zones;
}

function isPointInPolygon(point: [number, number], polygon: number[][]) {
  const x = point[0];
  const y = point[1];

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

type LatLng = { lat: number; lng: number };

function parseLatLngFromBody(body: Record<string, unknown>): LatLng | null {
  const lat = body.lat ?? body.latitude ?? body.customer_lat ?? body.customerLat;
  const lng = body.lng ?? body.longitude ?? body.customer_lng ?? body.customerLng;

  const la = safeNumber(lat, Number.NaN);
  const lo = safeNumber(lng, Number.NaN);

  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;

  return { lat: la, lng: lo };
}

function appendMetaLine(existing: string, line: string): string {
  const e = existing.trim();
  const l = line.trim();
  if (!l) return e;
  if (!e) return l;

  const existingLines = e.split(/\r?\n/).map((s) => s.trim());
  if (existingLines.some((x) => normalizeText(x) === normalizeText(l))) return e;

  return `${e}\n${l}`;
}

function withPaymentInMetaItems(rawItems: unknown[], payment: PaymentMethod): unknown[] {
  const line = `Plaćanje: ${payment === "cash" ? "Gotovina" : "Kartica"}`;
  const items = Array.isArray(rawItems) ? [...rawItems] : [];

  const idx = items.findIndex((it) => isPlainObject(it) && (looksLikeLegacyMetaItem(it) || looksLikeCartMetaItem(it)));
  if (idx === -1) return items;

  const meta = items[idx];
  if (!isPlainObject(meta)) return items;

  const existing = toTrimmedString(meta.order_note) || toTrimmedString(meta.note);
  const merged = appendMetaLine(existing, line);

  items[idx] = { ...meta, order_note: merged, note: merged };
  return items;
}

async function fetchMenuPricesCents(ids: string[]): Promise<Map<string, number>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return new Map();

  const { data, error } = await supabase
    .from("menu_items")
    .select("id,price_eur_cents")
    .eq("is_active", true)
    .in("id", uniq);

  if (error) throw new Error(`DB: pricing fetch failed (${error.message})`);

  const m = new Map<string, number>();
  for (const row of Array.isArray(data) ? data : []) {
    const r = row as unknown as PricingRow;
    const id = toTrimmedString((r as unknown as Record<string, unknown>).id);
    const p = safeInt((r as unknown as Record<string, unknown>).price_eur_cents, 0);
    if (id && p > 0) m.set(id, p);
  }
  return m;
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

function getDeliveryFeeCentsFromMeta(
  items: unknown[],
  zones: Zone[],
  point: LatLng | null,
): { feeCents: number; zoneName: string } {
  if (point) {
    const pt: [number, number] = [point.lng, point.lat];
    for (const z of zones) {
      if (isPointInPolygon(pt, z.polygon)) {
        return { feeCents: Math.round(z.fee_eur * 100), zoneName: z.name };
      }
    }
  }

  let metaNote = "";
  for (const it of items) {
    if (!isPlainObject(it)) continue;
    if (!looksLikeLegacyMetaItem(it) && !looksLikeCartMetaItem(it)) continue;

    const n = toTrimmedString(it.order_note) || toTrimmedString(it.note);
    if (n) metaNote = n;
    break;
  }

  const lines = metaNote.split(/\r?\n/).map((s) => s.trim());
  let feeEur: number | null = null;
  let zoneName = "";

  for (const line of lines) {
    if (!zoneName) {
      const mz = line.match(/Zona\s*:?\s*([^,\n\r]+)/i);
      if (mz && typeof mz[1] === "string") zoneName = mz[1].trim();
    }

    if (feeEur == null) {
      const mf = line.match(/Dostava\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i);
      if (mf && typeof mf[1] === "string") {
        const v = Number(mf[1].replace(",", "."));
        if (Number.isFinite(v) && v >= 0) feeEur = v;
      }
    }
  }

  if (feeEur != null) return { feeCents: Math.round(feeEur * 100), zoneName };
  return { feeCents: 0, zoneName };
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

function resolvePublicBaseUrl(req: ReqLike): string {
  const envSite =
    getEnv("PUBLIC_SITE_URL") || getEnv("SITE_URL") || getEnv("APP_URL") || getEnv("NEXT_PUBLIC_SITE_URL");
  if (envSite) return envSite.replace(/\/+$/, "");

  const origin = headerStringCI(req, "origin");
  if (origin) return origin.replace(/\/+$/, "");

  const proto = headerStringCI(req, "x-forwarded-proto") || "https";
  const host = headerStringCI(req, "x-forwarded-host") || headerStringCI(req, "host");
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return "https://padrinobudva.com";
}

function buildTelegramPayload(req: ReqLike, orderId: string) {
  const url = resolvePublicBaseUrl(req);
  return { order_id: orderId, notify_url: `${url}/api/telegram-new-order` };
}

async function bestEffortTelegramNotify(req: ReqLike, orderId: string) {
  const url = buildTelegramPayload(req, orderId).notify_url;

  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-telegram-secret"] = secret;

  const controller = new AbortController();
  const timeoutMs = 12000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId }),
      signal: controller.signal,
    });
  } catch {
    // best effort
  } finally {
    clearTimeout(t);
  }
}

async function bestEffortPaymentsCreateSession(orderId: string, paymentMethod: PaymentMethod) {
  const projectRef = getEnv("SUPABASE_PROJECT_REF");
  const anon = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY");
  const token = getEnv("PAYMENTS_EDGE_TOKEN");
  if (!projectRef || !anon) return;

  const url = `https://${projectRef}.supabase.co/functions/v1/payments-create-session`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${anon}`,
  };
  if (token) headers["x-padrino-token"] = token;

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod }),
    });
  } catch {
    // best effort
  }
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
  const base = resolvePublicBaseUrl(req);
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
    description: `Padrino Budva order ${orderId}`.slice(0, 255),
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

async function startBankartDebit(req: ReqLike, orderId: string, requestBody: BankartDebitRequest) {
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

    await bestEffortTelegramNotify(req, orderId);

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

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

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

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

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
      if (looksLikeRealItemButInvalid(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    if (payment_method === "card") {
      getBankartConfig();
    }

    const itemsForInsert = withPaymentInMetaItems(rawItems, payment_method);

    const calcItems = itemsForInsert.filter((it): it is Record<string, unknown> => {
      if (!isPlainObject(it)) return false;
      if (looksLikeLegacyMetaItem(it) || looksLikeCartMetaItem(it)) return false;

      const q = it.quantity;
      const p = it.price_per_item ?? it.pricePerItem;
      return typeof q === "number" && typeof p === "number";
    });

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

    const priceMap = await fetchMenuPricesCents(idsToFetch);
    const missingIds = findMissingMenuItemIds(idsToFetch, priceMap);

    if (missingIds.length > 0) {
      return json(res, 400, { ok: false, error: "Inactive or invalid menu item" });
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

    const point = parseLatLngFromBody(body);

    let zones: Zone[] = [];
    if (point) {
      try {
        zones = await fetchZones();
      } catch {
        zones = [];
      }
    }

    const delivery = getDeliveryFeeCentsFromMeta(itemsForInsert, zones, point);

    const computedTotalCents = subtotal_eur_cents + Math.max(0, delivery.feeCents);
    const bodyTotalCents = safeTotalCentsFromBody(body);

    if (bodyTotalCents > 0 && Math.abs(bodyTotalCents - computedTotalCents) > 1) {
      return json(res, 400, { ok: false, error: "Total mismatch" });
    }

    const insertRow: Record<string, unknown> = {
      customer_name,
      customer_phone,
      customer_address,
      items: itemsForInsert,
      status: payment_method === "card" ? "pending" : status,
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

    const { data: inserted, error: insErr } = await supabase
      .from("orders")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      console.error("[create-order] DB insert failed:", insErr);
      return json(res, 500, { ok: false, error: clientSafeError(insErr, "order_create") });
    }

    const orderId = toTrimmedString(inserted.id);

    if (payment_method === "cash") {
      await bestEffortTelegramNotify(req, orderId);
      void bestEffortPaymentsCreateSession(orderId, payment_method);

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

    const bankart = await startBankartDebit(req, orderId, bankartRequest);

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