/**
 * Bankart card debit for api/create-order.ts: config, the signed debit
 * request, and the order's payment state after Bankart answers. Moved out of
 * create-order.ts in B26.
 *
 * Every error thrown here starts with "Bankart" — create-order's catch routes
 * on that substring to the payment-init message (clientSafeError).
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

export async function updateOrderPaymentState(
  supabase: SupabaseClient,
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

    await updateOrderPaymentState(supabase, orderId, {
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

    await updateOrderPaymentState(supabase, orderId, {
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

    await updateOrderPaymentState(supabase, orderId, {
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

    await updateOrderPaymentState(supabase, orderId, {
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

      await updateOrderPaymentState(supabase, orderId, {
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

    await updateOrderPaymentState(supabase, orderId, {
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
    await updateOrderPaymentState(supabase, orderId, {
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
    await updateOrderPaymentState(supabase, orderId, {
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

  await updateOrderPaymentState(supabase, orderId, {
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
