import crypto from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";

type JsonRecord = Record<string, unknown>;

type BankartCallbackBody = {
  result?: unknown;
  uuid?: unknown;
  merchantTransactionId?: unknown;
  purchaseId?: unknown;
  transactionType?: unknown;
  paymentMethod?: unknown;
  amount?: unknown;
  currency?: unknown;
  merchantMetaData?: unknown;
  message?: unknown;
  code?: unknown;
  adapterMessage?: unknown;
  adapterCode?: unknown;
  extraData?: unknown;
  returnData?: unknown;
  customer?: unknown;
  notificationSource?: unknown;
  originalAmount?: unknown;
  originalCurrency?: unknown;
  chargebackData?: unknown;
  chargebackReversalData?: unknown;
  referenceUuid?: unknown;
};

type OrderRow = {
  id: string;
  status: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_meta: unknown;
};

export type ReqLike = IncomingMessage & {
  url?: string;
};

type ResLike = ServerResponse<IncomingMessage>;

export const config = {
  api: {
    bodyParser: false,
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function safeNumber(v: unknown, fallback = Number.NaN): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/bankart-callback" } },
  });
}

const supabase = buildSupabaseAdmin();

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key.toLowerCase()];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function sendText(res: ResLike, status: number, body: string) {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

async function readRawBody(req: ReqLike): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });

    req.on("error", (err: Error) => {
      reject(err);
    });
  });
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function resolvePublicBaseUrl(req: ReqLike): string {
  const envSite =
    getEnv("PUBLIC_SITE_URL") || getEnv("SITE_URL") || getEnv("APP_URL") || getEnv("NEXT_PUBLIC_SITE_URL");
  if (envSite) return envSite.replace(/\/+$/, "");

  const proto = headerString(req, "x-forwarded-proto") || "https";
  const host = headerString(req, "x-forwarded-host") || headerString(req, "host");
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

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
    clearTimeout(timeout);
  }
}

function getRequestUri(req: ReqLike): string {
  const rawUrl = toTrimmedString(req.url);
  if (!rawUrl) return "/api/bankart-callback";
  if (rawUrl.startsWith("/")) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/api/bankart-callback";
  }
}

export function createBankartSignature(
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

export function safeEqualSignature(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function isDateFresh(dateHeader: string): boolean {
  const maxSkewSeconds = safeNumber(getFirstEnv("BANKART_CALLBACK_MAX_SKEW_SECONDS"), 300);
  const parsed = Date.parse(dateHeader);
  if (!Number.isFinite(parsed)) return false;

  const now = Date.now();
  const diffMs = Math.abs(now - parsed);
  return diffMs <= Math.max(30, Math.trunc(maxSkewSeconds)) * 1000;
}

export function verifyBankartCallbackSignature(req: ReqLike, rawBody: string): { ok: boolean; reason?: string } {
  const sharedSecret = getFirstEnv("BANKART_SHARED_SECRET", "NLB_SHARED_SECRET");
  if (!sharedSecret) return { ok: false, reason: "Missing shared secret env" };

  const providedSignature = headerString(req, "x-signature");
  if (!providedSignature) return { ok: false, reason: "Missing x-signature header" };

  const dateHeader = headerString(req, "x-date") || headerString(req, "date");
  if (!dateHeader) return { ok: false, reason: "Missing date header" };
  if (!isDateFresh(dateHeader)) return { ok: false, reason: "Date header outside allowed skew" };

  const contentType = headerString(req, "content-type") || "application/json";
  const requestUri = getRequestUri(req);

  const expectedSignature = createBankartSignature(
    sharedSecret,
    req.method || "POST",
    contentType,
    dateHeader,
    requestUri,
    rawBody,
  );

  if (!safeEqualSignature(providedSignature, expectedSignature)) {
    return { ok: false, reason: "Invalid callback signature" };
  }

  return { ok: true };
}

async function findOrderForCallback(callback: BankartCallbackBody): Promise<OrderRow | null> {
  const merchantTransactionId = toTrimmedString(callback.merchantTransactionId);
  const merchantMetaData = toTrimmedString(callback.merchantMetaData);
  const uuid = toTrimmedString(callback.uuid);

  const candidates = [merchantTransactionId, merchantMetaData].filter(Boolean);

  for (const candidate of candidates) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
      .eq("id", candidate)
      .maybeSingle();

    if (!error && data) {
      return data as OrderRow;
    }
  }

  if (uuid) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
      .eq("payment_reference", uuid)
      .maybeSingle();

    if (!error && data) {
      return data as OrderRow;
    }
  }

  const referenceUuid = toTrimmedString(callback.referenceUuid);
  if (referenceUuid && referenceUuid !== uuid) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
      .eq("payment_reference", referenceUuid)
      .maybeSingle();

    if (!error && data) {
      return data as OrderRow;
    }
  }

  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const embeddedUuid = merchantTransactionId.match(uuidPattern)?.[0];
  if (embeddedUuid && embeddedUuid !== merchantTransactionId) {
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
      .eq("id", embeddedUuid)
      .maybeSingle();

    if (!error && data) {
      return data as OrderRow;
    }
  }

  const purchaseId = toTrimmedString(callback.purchaseId);
  const dashIdx = purchaseId.indexOf("-");
  if (dashIdx > 0) {
    const purchaseIdSuffix = purchaseId.substring(dashIdx + 1);
    if (purchaseIdSuffix && purchaseIdSuffix !== uuid) {
      const { data, error } = await supabase
        .from("orders")
        .select("id,status,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
        .eq("payment_reference", purchaseIdSuffix)
        .maybeSingle();

      if (!error && data) {
        return data as OrderRow;
      }
    }
  }

  return null;
}

function callbackSnapshot(callback: BankartCallbackBody, rawBody: string): JsonRecord {
  return {
    received_at: new Date().toISOString(),
    result: callback.result,
    uuid: callback.uuid,
    merchantTransactionId: callback.merchantTransactionId,
    purchaseId: callback.purchaseId,
    transactionType: callback.transactionType,
    paymentMethod: callback.paymentMethod,
    amount: callback.amount,
    currency: callback.currency,
    notificationSource: callback.notificationSource,
    message: callback.message,
    code: callback.code,
    adapterMessage: callback.adapterMessage,
    adapterCode: callback.adapterCode,
    merchantMetaData: callback.merchantMetaData,
    extraData: callback.extraData,
    returnData: callback.returnData,
    customer: callback.customer,
    chargebackData: callback.chargebackData,
    chargebackReversalData: callback.chargebackReversalData,
    raw_body: rawBody,
  };
}

function mergePaymentMeta(existing: unknown, snapshot: JsonRecord): JsonRecord {
  const base = isPlainObject(existing) ? { ...existing } : {};
  return {
    ...base,
    last_callback: snapshot,
  };
}

async function updateOrderAfterCallback(
  order: OrderRow,
  callback: BankartCallbackBody,
  rawBody: string,
): Promise<{ shouldNotifyTelegram: boolean }> {
  const result = toTrimmedString(callback.result).toUpperCase();
  const transactionType = toTrimmedString(callback.transactionType).toUpperCase();
  const uuid = toTrimmedString(callback.uuid);
  const snapshot = callbackSnapshot(callback, rawBody);

  const patch: Record<string, unknown> = {
    payment_provider: "bankart",
    payment_reference: uuid || order.payment_reference,
    payment_meta: mergePaymentMeta(order.payment_meta, snapshot),
  };

  let shouldNotifyTelegram = false;

  if (transactionType === "DEBIT") {
    if (result === "OK") {
      patch.payment_status = "paid";
      if (order.payment_status !== "paid") {
        shouldNotifyTelegram = true;
      }
    } else if (result === "ERROR") {
      patch.payment_status = "failed";
      patch.status = "cancelled";
    } else if (result === "PENDING") {
      patch.payment_status = "pending";
    }
  } else if (transactionType === "REFUND") {
    if (result === "OK") {
      patch.payment_status = "refunded";
    } else if (result === "ERROR") {
      patch.payment_status = order.payment_status || "paid";
    }
  } else if (transactionType === "CHARGEBACK") {
    if (result === "OK") {
      patch.payment_status = "refunded";
    }
  } else if (transactionType === "CHARGEBACK-REVERSAL") {
    if (result === "OK") {
      patch.payment_status = "paid";
    }
  } else {
    if (result === "ERROR" && order.payment_status === "pending") {
      patch.payment_status = "failed";
      patch.status = "cancelled";
    }
  }

  const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
  if (error) {
    throw new Error(`DB update failed (${error.message})`);
  }

  return { shouldNotifyTelegram };
}

export default async function handler(req: ReqLike, res: ResLike) {
  if (req.method !== "POST") {
    return sendText(res, 405, "Method not allowed");
  }

  try {
    const rawBody = await readRawBody(req);
    if (!rawBody.trim()) {
      return sendText(res, 400, "Missing body");
    }

    const verification = verifyBankartCallbackSignature(req, rawBody);
    if (!verification.ok) {
      return sendText(res, 400, verification.reason || "Invalid signature");
    }

    const parsed = safeJsonParse(rawBody);
    if (!isPlainObject(parsed)) {
      return sendText(res, 400, "Invalid JSON");
    }

    const callback = parsed as BankartCallbackBody;
    const order = await findOrderForCallback(callback);

    if (!order) {
      return sendText(res, 200, "OK");
    }

    const { shouldNotifyTelegram } = await updateOrderAfterCallback(order, callback, rawBody);

    if (shouldNotifyTelegram) {
      await bestEffortTelegramNotify(req, order.id);
    }

    return sendText(res, 200, "OK");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown callback error";
    return sendText(res, 500, message);
  }
}