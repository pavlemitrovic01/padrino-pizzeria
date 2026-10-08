/**
 * Bankart card debit for api/create-order.ts: config, the signed debit
 * request, and the order's payment state after Bankart answers. Moved out of
 * create-order.ts in B26.
 *
 * Every error thrown here is a BankartInitError, so create-order answers with
 * the card-payment message (clientSafeError "payment_init") — including a
 * decline, whose text is Bankart's own and need not contain "Bankart".
 */

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlainObject } from "./parsing.js";
import { getFirstEnv } from "./env.js";
import { notifyNewOrder } from "./telegram.js";
import {
  BANKART_FALLBACK_EMAIL,
  BANKART_FALLBACK_CITY,
  BANKART_FALLBACK_POSTCODE,
  BANKART_DESCRIPTION_PREFIX,
} from "./config.js";

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Card payment could not be started (config, network, Bankart refusal, DB). */
export class BankartInitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BankartInitError";
  }
}

export type BankartConfig = {
  baseUrl: string;
  apiKey: string;
  username: string;
  password: string;
  sharedSecret: string;
  language: string;
};

export type BankartDebitRequest = {
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

export type BankartDebitResponse = {
  success?: unknown;
  uuid?: unknown;
  purchaseId?: unknown;
  returnType?: unknown;
  redirectUrl?: unknown;
  paymentMethod?: unknown;
  errors?: unknown;
  extraData?: unknown;
};

export function getBankartConfig(): BankartConfig {
  const baseUrl = getFirstEnv("BANKART_API_BASE_URL", "NLB_API_BASE_URL") || "https://gateway.bankart.si/api/v3";
  const apiKey = getFirstEnv("BANKART_API_KEY", "NLB_API_KEY");
  const username = getFirstEnv("BANKART_API_USERNAME", "BANKART_API_USER", "NLB_API_USERNAME", "NLB_API_USER");
  const password = getFirstEnv("BANKART_API_PASSWORD", "NLB_API_PASSWORD");
  const sharedSecret = getFirstEnv("BANKART_SHARED_SECRET", "NLB_SHARED_SECRET");
  const language = (getFirstEnv("BANKART_LANGUAGE", "NLB_LANGUAGE") || "en").toLowerCase();

  if (!apiKey || !username || !password || !sharedSecret) {
    throw new BankartInitError("Missing Bankart env: API key / username / password / shared secret");
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

export function normalizeBankartApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.replace(/\/api\/v3$/i, "");
}

export function splitCustomerName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: fullName || "Kupac", lastName: "" };
  }

  const firstName = parts.shift() ?? fullName;
  return { firstName, lastName: parts.join(" ") };
}

export function centsToAmountString(cents: number): string {
  const normalized = Number.isFinite(cents) ? Math.max(0, Math.trunc(cents)) : 0;
  return (normalized / 100).toFixed(2);
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

export function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function safeBankartErrorMessage(body: unknown, status: number, fallback: string): string {
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

export function bankartMetaSnapshot(input: {
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

/**
 * Writes the debit's outcome — only while the order is still pending (B24
 * review): the Bankart callback or status poll can settle the order while this
 * request is still waiting on Bankart, and a late write here must not turn
 * their "paid" back into "pending" or overwrite their payment_meta. Returns
 * whether the row was still pending (and so was written).
 */
export async function updateOrderPaymentState(
  supabase: SupabaseClient,
  orderId: string,
  values: {
    status?: string;
    payment_status?: string | null;
    payment_reference?: string | null;
    payment_meta?: Record<string, unknown> | null;
  },
): Promise<boolean> {
  const patch: Record<string, unknown> = {};

  if (typeof values.status === "string") patch.status = values.status;
  if (values.payment_status !== undefined) patch.payment_status = values.payment_status;
  if (values.payment_reference !== undefined) patch.payment_reference = values.payment_reference;
  if (values.payment_meta !== undefined) patch.payment_meta = values.payment_meta;

  if (Object.keys(patch).length === 0) return false;

  const { data, error } = await supabase
    .from("orders")
    .update(patch)
    .eq("id", orderId)
    .eq("payment_status", "pending")
    .select("id");
  if (error) {
    throw new BankartInitError(`Bankart: DB payment update failed (${error.message})`);
  }
  return Array.isArray(data) && data.length > 0;
}

export function buildBankartDebitRequest(
  orderId: string,
  input: {
    urls: { successUrl: string; cancelUrl: string; errorUrl: string; callbackUrl: string };
    clientIp: string;
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
  const urls = input.urls;
  const bankartCustomerName = toTrimmedString(input.bankartCustomerName) || input.customerName;
  const { firstName, lastName } = splitCustomerName(bankartCustomerName);
  const clientIp = input.clientIp;
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

export async function startBankartDebit(supabase: SupabaseClient, orderId: string, requestBody: BankartDebitRequest) {
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

  /** Bankart refused or answered nonsense: the payment did not happen. */
  async function failed(
    message: string,
    snapshot: { phase: string; responseBody?: unknown; responseStatus?: number },
    paymentReference?: string | null,
  ): Promise<BankartInitError> {
    await updateOrderPaymentState(supabase, orderId, {
      status: "cancelled",
      payment_status: "failed",
      ...(paymentReference !== undefined ? { payment_reference: paymentReference } : {}),
      payment_meta: bankartMetaSnapshot({ ...snapshot, requestBody, message }),
    });
    return new BankartInitError(message);
  }

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

    // B24 review: the request may have reached Bankart (a reset or timeout
    // after it processed the debit), so the outcome is unknown — the order
    // stays pending for the callback or the status poll to settle, instead of
    // "failed", which would let a retry charge the card a second time.
    await updateOrderPaymentState(supabase, orderId, {
      payment_meta: bankartMetaSnapshot({ phase: "init_network_error", requestBody, message }),
    });

    throw new BankartInitError(message);
  }

  const responseText = await response.text();
  const responseBody = safeJsonParse(responseText);

  if (!response.ok) {
    const message = safeBankartErrorMessage(responseBody, response.status, "Bankart init failed");
    throw await failed(message, { phase: "init_http_error", responseBody, responseStatus: response.status });
  }

  const bankart = isPlainObject(responseBody) ? (responseBody as BankartDebitResponse) : null;
  if (!bankart) {
    throw await failed("Bankart init failed: invalid JSON response", {
      phase: "init_invalid_json",
      responseBody,
      responseStatus: response.status,
    });
  }

  const transactionUuid = toTrimmedString(bankart.uuid);
  const returnType = toTrimmedString(bankart.returnType).toUpperCase();
  const redirectUrl = toTrimmedString(bankart.redirectUrl);
  const settled = (phase: string, extra: Record<string, unknown> = {}) => ({
    payment_reference: transactionUuid || null,
    payment_meta: bankartMetaSnapshot({ phase, requestBody, responseBody: bankart, responseStatus: response.status, ...extra }),
  });

  if (bankart.success !== true || returnType === "ERROR") {
    const message = safeBankartErrorMessage(bankart, response.status, "Bankart rejected transaction");
    throw await failed(
      message,
      { phase: "init_error", responseBody: bankart, responseStatus: response.status },
      transactionUuid || null,
    );
  }

  if (returnType === "REDIRECT") {
    if (!redirectUrl) {
      throw await failed(
        "Bankart init failed: missing redirect URL",
        { phase: "init_missing_redirect", responseBody: bankart, responseStatus: response.status },
        transactionUuid || null,
      );
    }

    await updateOrderPaymentState(supabase, orderId, settled("redirect"));

    return {
      flow: "card_redirect" as const,
      redirectUrl,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  if (returnType === "PENDING") {
    await updateOrderPaymentState(supabase, orderId, settled("pending"));

    return {
      flow: "card_pending" as const,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  if (returnType === "FINISHED") {
    const wrote = await updateOrderPaymentState(supabase, orderId, { payment_status: "paid", ...settled("finished") });
    // Not written = the callback/poll already settled it (and notified if paid).
    if (wrote) await notifyNewOrder(supabase, orderId);

    return {
      flow: "card_paid" as const,
      bankartUuid: transactionUuid,
      bankartPurchaseId: toTrimmedString(bankart.purchaseId),
      bankartReturnType: returnType,
    };
  }

  await updateOrderPaymentState(
    supabase,
    orderId,
    settled("other_return_type", { message: `Unhandled returnType: ${returnType || "UNKNOWN"}` }),
  );

  return {
    flow: "card_pending" as const,
    bankartUuid: transactionUuid,
    bankartPurchaseId: toTrimmedString(bankart.purchaseId),
    bankartReturnType: returnType || "UNKNOWN",
  };
}
