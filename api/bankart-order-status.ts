import { isPlainObject, safeNumber } from "./_shared/parsing.js";
import { amountMismatchNote, bankartAmountMatches, debitTransition } from "./_shared/payment-status.js";
import { notifyNewOrder } from "./_shared/telegram.js";
import { applyCors } from "./_shared/cors.js";
import { buildSupabaseAdmin, getFirstEnv } from "./_shared/env.js";
import { json } from "./_shared/http.js";

type Json = Record<string, unknown>;
type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  url?: string;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

type OrderRow = {
  id: string;
  status: string | null;
  total_eur_cents: number | null;
  currency: string | null;
  payment_method: string | null;
  payment_status: string | null;
  payment_provider: string | null;
  payment_reference: string | null;
  payment_meta: unknown;
};

type BankartStatusResponse = {
  success?: unknown;
  transactionStatus?: unknown;
  uuid?: unknown;
  referenceUuid?: unknown;
  merchantTransactionId?: unknown;
  purchaseId?: unknown;
  transactionType?: unknown;
  paymentMethod?: unknown;
  amount?: unknown;
  currency?: unknown;
  errors?: unknown;
  errorMessage?: unknown;
  errorCode?: unknown;
  extraData?: unknown;
  returnData?: unknown;
  chargebackData?: unknown;
  chargebackReversalData?: unknown;
  customer?: unknown;
  merchantMetaData?: unknown;
};

type BankartConfig = {
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

const supabase = buildSupabaseAdmin("bankart-order-status");

function getQueryParam(req: ReqLike, key: string): string {
  try {
    const url = new URL(req.url || "/api/bankart-order-status", "http://localhost");
    return toTrimmedString(url.searchParams.get(key));
  } catch {
    return "";
  }
}

function getBankartConfig(): BankartConfig {
  const baseUrl = getFirstEnv("BANKART_API_BASE_URL", "NLB_API_BASE_URL") || "https://gateway.bankart.si/api/v3";
  const apiKey = getFirstEnv("BANKART_API_KEY", "NLB_API_KEY");
  const username = getFirstEnv("BANKART_API_USERNAME", "BANKART_API_USER", "NLB_API_USERNAME", "NLB_API_USER");
  const password = getFirstEnv("BANKART_API_PASSWORD", "NLB_API_PASSWORD");

  if (!apiKey) {
    throw new Error("Missing Bankart env: API key");
  }

  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey,
    username,
    password,
  };
}

async function fetchOrderById(orderId: string): Promise<OrderRow | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,status,total_eur_cents,currency,payment_method,payment_status,payment_provider,payment_reference,payment_meta")
    .eq("id", orderId)
    .maybeSingle();

  if (error) {
    throw new Error(`DB read failed (${error.message})`);
  }

  return data ? (data as OrderRow) : null;
}

function isFinalPaymentStatus(value: string | null | undefined): boolean {
  return value === "paid" || value === "failed" || value === "cancelled" || value === "refunded";
}

/** Skip Bankart fetch only for truly terminal statuses. Paid orders can become refunded. */
function shouldSkipStatusRefreshForPaymentStatus(status: string | null | undefined): boolean {
  return status === "failed" || status === "cancelled" || status === "refunded";
}

function getStatusRefreshMinIntervalMs(): number {
  const seconds = safeNumber(getFirstEnv("BANKART_STATUS_MIN_INTERVAL_SECONDS") || "15", 15);
  const normalizedSeconds = Math.max(12, Math.trunc(seconds));
  return normalizedSeconds * 1000;
}

function getLastStatusCheckedAt(paymentMeta: unknown): number | null {
  if (!isPlainObject(paymentMeta)) return null;
  const statusCheck = paymentMeta.last_status_check;
  if (!isPlainObject(statusCheck)) return null;

  const checkedAt = toTrimmedString(statusCheck.checked_at);
  if (!checkedAt) return null;

  const parsed = Date.parse(checkedAt);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldFetchBankartStatus(order: OrderRow): boolean {
  if (order.payment_method !== "card") return false;
  if (shouldSkipStatusRefreshForPaymentStatus(order.payment_status)) return false;

  const lastCheckedAt = getLastStatusCheckedAt(order.payment_meta);
  if (lastCheckedAt == null) return true;

  const ageMs = Date.now() - lastCheckedAt;
  return ageMs >= getStatusRefreshMinIntervalMs();
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
        toTrimmedString(first.errorMessage) || toTrimmedString(first.message),
        toTrimmedString(first.adapterMessage),
        toTrimmedString(first.errorCode) || toTrimmedString(first.code),
        toTrimmedString(first.adapterCode),
      ].filter(Boolean);
      if (parts.length > 0) return parts.join(" | ");
    }
  }

  return `${fallback} (HTTP ${status})`;
}

async function fetchBankartStatusByMerchantTransactionId(orderId: string): Promise<BankartStatusResponse> {
  const config = getBankartConfig();
  const requestUri = `/status/${encodeURIComponent(config.apiKey)}/getByMerchantTransactionId/${encodeURIComponent(orderId)}`;
  const url = `${config.baseUrl}${requestUri}`;

  const headers: Record<string, string> = {
    accept: "application/json",
  };

  if (config.username && config.password) {
    headers.authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
  });

  const responseText = await response.text();
  const responseBody = safeJsonParse(responseText);

  if (!response.ok) {
    throw new Error(safeBankartErrorMessage(responseBody, response.status, "Bankart status lookup failed"));
  }

  if (!isPlainObject(responseBody)) {
    throw new Error("Bankart status lookup failed: invalid JSON response");
  }

  return responseBody as BankartStatusResponse;
}

function buildStatusSnapshot(statusBody: BankartStatusResponse): Json {
  return {
    checked_at: new Date().toISOString(),
    success: statusBody.success,
    transactionStatus: statusBody.transactionStatus,
    transactionType: statusBody.transactionType,
    uuid: statusBody.uuid,
    referenceUuid: statusBody.referenceUuid,
    merchantTransactionId: statusBody.merchantTransactionId,
    purchaseId: statusBody.purchaseId,
    paymentMethod: statusBody.paymentMethod,
    amount: statusBody.amount,
    currency: statusBody.currency,
    merchantMetaData: statusBody.merchantMetaData,
    extraData: statusBody.extraData,
    returnData: statusBody.returnData,
    customer: statusBody.customer,
    errors: statusBody.errors,
    errorMessage: statusBody.errorMessage,
    errorCode: statusBody.errorCode,
    chargebackData: statusBody.chargebackData,
    chargebackReversalData: statusBody.chargebackReversalData,
  };
}

function mergePaymentMeta(existing: unknown, statusSnapshot: Json): Json {
  const base = isPlainObject(existing) ? { ...existing } : {};
  return {
    ...base,
    last_status_check: statusSnapshot,
  };
}

async function applyBankartStatusToOrder(
  order: OrderRow,
  statusBody: BankartStatusResponse,
): Promise<OrderRow> {
  const transactionStatus = toTrimmedString(statusBody.transactionStatus).toUpperCase();
  const transactionType = toTrimmedString(statusBody.transactionType).toUpperCase();
  const uuid = toTrimmedString(statusBody.uuid);
  const mergedMeta = mergePaymentMeta(order.payment_meta, buildStatusSnapshot(statusBody));

  const patch: Record<string, unknown> = {
    payment_provider: "bankart",
    payment_reference: uuid || order.payment_reference,
    payment_meta: mergedMeta,
  };

  let nextStatus = order.status;
  let nextPaymentStatus = order.payment_status;
  let shouldNotifyTelegram = false;

  if (transactionType === "REFUND") {
    if (transactionStatus === "SUCCESS") {
      nextPaymentStatus = "refunded";
    }
  } else if (transactionType === "CHARGEBACK") {
    if (transactionStatus === "SUCCESS") {
      nextPaymentStatus = "refunded";
    }
  } else if (transactionType === "CHARGEBACK-REVERSAL") {
    if (transactionStatus === "SUCCESS") {
      if (order.payment_status !== "paid") shouldNotifyTelegram = true;
      nextPaymentStatus = "paid";
    }
  } else if (transactionStatus === "SUCCESS" && !bankartAmountMatches(order, statusBody)) {
    // B24: an amount the server did not charge is never marked paid.
    console.error("[bankart-order-status] amount/currency mismatch, not marking paid", {
      orderId: order.id,
      amount: statusBody.amount,
      currency: statusBody.currency,
    });
    patch.payment_meta = { ...mergedMeta, amount_check: amountMismatchNote(statusBody) };
  } else if (transactionStatus === "SUCCESS" || transactionStatus === "ERROR" || transactionStatus === "PENDING") {
    // B24: status only moves forward — a stale PENDING/ERROR never un-pays.
    const t = debitTransition(
      order.payment_status,
      transactionStatus === "SUCCESS" ? "ok" : transactionStatus === "ERROR" ? "error" : "pending",
    );
    nextPaymentStatus = t.paymentStatus;
    if (t.cancel) nextStatus = "cancelled";
    if (t.reopen && order.status === "cancelled") nextStatus = "pending";
    shouldNotifyTelegram = t.becamePaid;
  }

  if (nextStatus !== order.status) patch.status = nextStatus;
  if (nextPaymentStatus !== order.payment_status) patch.payment_status = nextPaymentStatus;

  const shouldUpdateDb = Object.keys(patch).length > 0;
  if (shouldUpdateDb) {
    const { error } = await supabase.from("orders").update(patch).eq("id", order.id);
    if (error) {
      throw new Error(`DB payment update failed (${error.message})`);
    }
  }

  if (shouldNotifyTelegram) {
    await notifyNewOrder(supabase, order.id);
  }

  return {
    ...order,
    status: typeof nextStatus === "string" ? nextStatus : order.status,
    payment_status: typeof nextPaymentStatus === "string" ? nextPaymentStatus : order.payment_status,
    payment_provider: "bankart",
    payment_reference: uuid || order.payment_reference,
    payment_meta: mergedMeta,
  };
}

function getStatusSource(order: OrderRow, usedBankart: boolean): string {
  if (order.payment_method !== "card") return "db_cash";
  return usedBankart ? "bankart" : "db";
}

function buildResponseBody(
  order: OrderRow,
  input: {
    source: string;
    refreshed: boolean;
    lookupError?: string;
    bankartStatus?: BankartStatusResponse | null;
  },
): Json {
  const transactionStatus = toTrimmedString(input.bankartStatus?.transactionStatus);
  const transactionType = toTrimmedString(input.bankartStatus?.transactionType);

  return {
    ok: true,
    id: order.id,
    order_id: order.id,
    orderId: order.id,
    status: order.status,
    payment_method: order.payment_method,
    payment_status: order.payment_status,
    payment_provider: order.payment_provider,
    payment_reference: order.payment_reference,
    final: order.payment_method === "cash" ? true : isFinalPaymentStatus(order.payment_status),
    source: input.source,
    refreshed: input.refreshed,
    retry_after_seconds:
      order.payment_method === "card" && !isFinalPaymentStatus(order.payment_status)
        ? Math.max(12, Math.trunc(getStatusRefreshMinIntervalMs() / 1000))
        : 0,
    bankart_transaction_status: transactionStatus || null,
    bankart_transaction_type: transactionType || null,
    lookup_error: input.lookupError || null,
  };
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "GET" });

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const orderId =
      getQueryParam(req, "id") ||
      getQueryParam(req, "order_id") ||
      getQueryParam(req, "orderId");

    if (!orderId) {
      return json(res, 400, { ok: false, error: "Missing order id" });
    }

    let order = await fetchOrderById(orderId);
    if (!order) {
      return json(res, 404, { ok: false, error: "Order not found" });
    }

    if (order.payment_method !== "card") {
      return json(res, 200, buildResponseBody(order, { source: "db_cash", refreshed: false }));
    }

    if (shouldSkipStatusRefreshForPaymentStatus(order.payment_status)) {
      return json(res, 200, buildResponseBody(order, { source: "db", refreshed: false }));
    }

    if (!shouldFetchBankartStatus(order)) {
      return json(res, 200, buildResponseBody(order, { source: "db", refreshed: false }));
    }

    let bankartStatus: BankartStatusResponse | null = null;
    let lookupError = "";

    try {
      bankartStatus = await fetchBankartStatusByMerchantTransactionId(order.id);

      if (bankartStatus.success === true) {
        order = await applyBankartStatusToOrder(order, bankartStatus);
      } else {
        const mergedMeta = mergePaymentMeta(order.payment_meta, buildStatusSnapshot(bankartStatus));
        const { error } = await supabase
          .from("orders")
          .update({ payment_meta: mergedMeta })
          .eq("id", order.id);

        if (error) {
          throw new Error(`DB payment update failed (${error.message})`);
        }

        order = { ...order, payment_meta: mergedMeta };
        lookupError = "Bankart status lookup returned unsuccessful result";
      }
    } catch (err: unknown) {
      // L5: the raw Bankart/DB message is logged, never sent to the browser.
      console.error("[bankart-order-status] status lookup failed:", err);
      lookupError = "Bankart status lookup failed";
    }

    return json(
      res,
      200,
      buildResponseBody(order, {
        source: getStatusSource(order, bankartStatus !== null),
        refreshed: true,
        lookupError: lookupError || undefined,
        bankartStatus,
      }),
    );
  } catch (err: unknown) {
    console.error("[bankart-order-status] failed:", err);
    return json(res, 500, { ok: false, error: "Provera plaćanja trenutno nije moguća. Pokušajte ponovo." });
  }
}