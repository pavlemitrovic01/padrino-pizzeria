/**
 * Card payment status transitions shared by api/bankart-callback.ts and
 * api/bankart-order-status.ts (B24, audit #8).
 *
 * Status only moves forward: a late DEBIT PENDING or ERROR (Bankart can send
 * callbacks out of order, and the status poll can race the callback) must
 * never turn a paid order back into pending / failed — the kitchen already
 * has it. And an order is only marked paid when the amount Bankart reports is
 * the amount the server charged.
 */

import { isPlainObject } from "./parsing.js";

export type DebitOutcome = "ok" | "error" | "pending";

export type DebitTransition = {
  paymentStatus: string;
  /** The order becomes paid now — notify the kitchen. */
  becamePaid: boolean;
  /** Cancel the order (payment failed while it was still pending). */
  cancel: boolean;
  /**
   * Un-cancel: a payment that had failed now succeeded, and the order was
   * cancelled only because of that failure.
   */
  reopen: boolean;
};

export function debitTransition(current: string | null | undefined, outcome: DebitOutcome): DebitTransition {
  const cur = current || "pending";
  const stay: DebitTransition = { paymentStatus: cur, becamePaid: false, cancel: false, reopen: false };

  if (outcome === "ok") {
    if (cur === "pending") return { ...stay, paymentStatus: "paid", becamePaid: true };
    if (cur === "failed") return { ...stay, paymentStatus: "paid", becamePaid: true, reopen: true };
    return stay; // paid stays paid, refunded stays refunded
  }
  if (outcome === "error") {
    if (cur === "pending") return { ...stay, paymentStatus: "failed", cancel: true };
    return stay;
  }
  return stay; // PENDING never moves a status
}

function amountToCents(amount: unknown): number | null {
  if (typeof amount === "number") return Number.isFinite(amount) ? Math.round(amount * 100) : null;
  if (typeof amount !== "string" || !amount.trim()) return null;
  const n = Number(amount.trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * Whether Bankart's reported amount/currency fit the order. A field Bankart
 * did not send is not held against the payment (the callback and status
 * payloads normally carry both); a field it did send must match.
 */
export function bankartAmountMatches(
  order: { total_eur_cents?: unknown; currency?: unknown },
  reported: { amount?: unknown; currency?: unknown },
): boolean {
  if (reported.amount !== undefined && reported.amount !== null && reported.amount !== "") {
    const cents = amountToCents(reported.amount);
    const expected = typeof order.total_eur_cents === "number" ? order.total_eur_cents : Number(order.total_eur_cents);
    if (cents === null || !Number.isFinite(expected) || cents !== Math.trunc(expected)) return false;
  }
  if (typeof reported.currency === "string" && reported.currency.trim()) {
    const orderCurrency = typeof order.currency === "string" && order.currency.trim() ? order.currency.trim() : "EUR";
    if (reported.currency.trim().toUpperCase() !== orderCurrency.toUpperCase()) return false;
  }
  return true;
}

export function amountMismatchNote(reported: { amount?: unknown; currency?: unknown }): Record<string, unknown> {
  return {
    amount_mismatch: true,
    reported_amount: isPlainObject(reported) ? reported.amount ?? null : null,
    reported_currency: isPlainObject(reported) ? reported.currency ?? null : null,
    flagged_at: new Date().toISOString(),
  };
}
