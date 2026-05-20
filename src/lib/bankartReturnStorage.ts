import type { PaymentMethod } from "../context/CartContext";
import { toSafeInt } from "./money";

export type BankartOrderPaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | null;

export type BankartOrderStatusResponse = {
  ok?: boolean;
  id?: unknown;
  order_id?: unknown;
  orderId?: unknown;
  status?: unknown;
  payment_method?: unknown;
  payment_status?: unknown;
  payment_provider?: unknown;
  payment_reference?: unknown;
  final?: unknown;
  source?: unknown;
  refreshed?: unknown;
  retry_after_seconds?: unknown;
  bankart_transaction_status?: unknown;
  bankart_transaction_type?: unknown;
  lookup_error?: unknown;
};

export type BankartReturnStorage = {
  orderId: string;
  totalCents: number;
  zoneLabel: string;
  feeCents: number;
  paymentMethod: PaymentMethod;
};

export const BANKART_RETURN_STORAGE_KEY = "padrino:bankart:return";

export function isPaymentStatusValue(value: unknown): value is Exclude<BankartOrderPaymentStatus, null> {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "refunded"
  );
}

export function isFinalPaymentStatusValue(value: BankartOrderPaymentStatus): boolean {
  return value === "paid" || value === "failed" || value === "cancelled" || value === "refunded";
}

export function getBankartReturnParams() {
  if (typeof window === "undefined") {
    return {
      isBankartReturn: false,
      orderId: "",
      bankart: "",
      payment: "",
      path: "",
    };
  }

  const path = window.location.pathname || "";
  const params = new URLSearchParams(window.location.search);
  const payment = params.get("payment")?.trim() ?? "";
  const bankart = params.get("bankart")?.trim() ?? "";
  const orderId = params.get("id")?.trim() ?? params.get("order_id")?.trim() ?? params.get("orderId")?.trim() ?? "";

  return {
    isBankartReturn: path === "/checkout/success" && payment === "card" && !!orderId,
    orderId,
    bankart,
    payment,
    path,
  };
}

export function readBankartReturnStorage(): BankartReturnStorage | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(BANKART_RETURN_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const rec = parsed as Record<string, unknown>;
    const orderId = typeof rec.orderId === "string" ? rec.orderId.trim() : "";
    const zoneLabel = typeof rec.zoneLabel === "string" ? rec.zoneLabel.trim() : "";
    const paymentMethod = rec.paymentMethod === "card" ? "card" : rec.paymentMethod === "cash" ? "cash" : "card";
    const totalCents = toSafeInt(rec.totalCents, 0);
    const feeCents = toSafeInt(rec.feeCents, 0);

    if (!orderId) return null;

    return {
      orderId,
      totalCents,
      zoneLabel,
      feeCents,
      paymentMethod,
    };
  } catch {
    return null;
  }
}

export function writeBankartReturnStorage(value: BankartReturnStorage) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BANKART_RETURN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearBankartReturnStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BANKART_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function cleanBankartReturnUrl() {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname || "/";
  if (currentPath !== "/checkout/success") return;
  try {
    window.history.replaceState({}, document.title, "/");
  } catch {
    // ignore
  }
}
