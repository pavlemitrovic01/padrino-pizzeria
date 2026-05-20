import { useEffect, useRef, useState } from "react";
import type { PaymentMethod } from "../../context/CartContext";
import { toSafeInt } from "../../lib/money";
import {
  type BankartOrderPaymentStatus,
  type BankartOrderStatusResponse,
  isPaymentStatusValue,
  isFinalPaymentStatusValue,
  getBankartReturnParams,
  readBankartReturnStorage,
  clearBankartReturnStorage,
  cleanBankartReturnUrl,
} from "../../lib/bankartReturnStorage";

type SuccessSummary = {
  totalCents: number;
  zoneLabel: string;
  feeCents: number;
};

type DrawerView = "cart" | "checkout" | "success";

type ApplySuccessUiStateInput = {
  paymentMethod: PaymentMethod;
  paymentStatus: BankartOrderPaymentStatus;
  orderId: string | null;
  checking: boolean;
  bankartHint?: string | null;
  lookupError?: string | null;
};

type UseSuccessStateArgs = {
  openCart: () => void;
  setView: (v: DrawerView) => void;
  setSubmitError: (e: string | null) => void;
};

type UseSuccessStateReturn = {
  successPaymentMethod: PaymentMethod;
  successOrderId: string | null;
  successPaymentStatus: BankartOrderPaymentStatus;
  successTitle: string;
  successSubtitle: string;
  successStatusNote: string | null;
  successCheckingPayment: boolean;
  successCopied: boolean;
  successSummary: SuccessSummary | null;
  setSuccessPaymentMethod: (m: PaymentMethod) => void;
  setSuccessSummary: (s: SuccessSummary | null) => void;
  setSuccessCheckingPayment: (b: boolean) => void;
  applySuccessUiState: (input: ApplySuccessUiStateInput) => void;
  resetSuccessState: () => void;
  copySuccessOrderId: () => Promise<void>;
  closeBankartReturnFlow: () => void;
};

async function fetchBankartOrderStatus(orderId: string): Promise<BankartOrderStatusResponse> {
  const url = `/api/bankart-order-status?id=${encodeURIComponent(orderId)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
  });

  const body = (await res.json().catch(() => null)) as unknown;
  if (!res.ok || !body || typeof body !== "object") {
    throw new Error("Status kartičnog plaćanja trenutno nije dostupan.");
  }

  return body as BankartOrderStatusResponse;
}

export function useSuccessState({
  openCart,
  setView,
  setSubmitError,
}: UseSuccessStateArgs): UseSuccessStateReturn {
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<PaymentMethod>("cash");
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successPaymentStatus, setSuccessPaymentStatus] = useState<BankartOrderPaymentStatus>(null);
  const [successTitle, setSuccessTitle] = useState("Porudžbina je poslata");
  const [successSubtitle, setSuccessSubtitle] = useState("Hvala na poverenju <3");
  const [successStatusNote, setSuccessStatusNote] = useState<string | null>(null);
  const [successCheckingPayment, setSuccessCheckingPayment] = useState(false);

  const [successCopied, setSuccessCopied] = useState(false);
  const successCopiedTimerRef = useRef<number | null>(null);

  const [successSummary, setSuccessSummary] = useState<SuccessSummary | null>(null);

  const bankartReturnHandledRef = useRef(false);
  const bankartStatusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSuccessCopied(false);
  }, [successOrderId]);

  useEffect(() => {
    return () => {
      if (successCopiedTimerRef.current) window.clearTimeout(successCopiedTimerRef.current);
      if (bankartStatusTimerRef.current) window.clearTimeout(bankartStatusTimerRef.current);
    };
  }, []);

  async function copySuccessOrderId() {
    if (!successOrderId) return;

    try {
      await navigator.clipboard.writeText(successOrderId);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = successOrderId;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } finally {
        document.body.removeChild(ta);
      }
    }

    setSuccessCopied(true);
    if (successCopiedTimerRef.current) window.clearTimeout(successCopiedTimerRef.current);
    successCopiedTimerRef.current = window.setTimeout(() => setSuccessCopied(false), 1400);
  }

  function applySuccessUiState(input: ApplySuccessUiStateInput) {
    const bankartHint = String(input.bankartHint ?? "").trim().toLowerCase();
    const lookupError = String(input.lookupError ?? "").trim();

    setSuccessPaymentMethod(input.paymentMethod);
    setSuccessPaymentStatus(input.paymentStatus);
    setSuccessOrderId(input.orderId);
    setSuccessCheckingPayment(input.checking);

    if (input.paymentMethod !== "card") {
      setSuccessTitle("Porudžbina je poslata");
      setSuccessSubtitle("Hvala na poverenju <3");
      setSuccessStatusNote(null);
      return;
    }

    if (input.checking || input.paymentStatus === "pending") {
      setSuccessTitle("Provjeravamo uplatu");
      setSuccessSubtitle("Sačekaj trenutak dok potvrdimo status kartičnog plaćanja.");
      setSuccessStatusNote(lookupError || "Status se osvežava automatski.");
      return;
    }

    if (input.paymentStatus === "paid") {
      setSuccessTitle("Uplata je uspješna");
      setSuccessSubtitle("Porudžbina je potvrđena i prosleđena kuhinji.");
      setSuccessStatusNote(null);
      return;
    }

    if (input.paymentStatus === "cancelled") {
      setSuccessTitle("Plaćanje je otkazano");
      setSuccessSubtitle("Kartično plaćanje nije završeno.");
      setSuccessStatusNote(lookupError || (bankartHint === "cancel" ? "Možeš pokušati ponovo ili izabrati gotovinu." : null));
      return;
    }

    if (input.paymentStatus === "failed") {
      setSuccessTitle("Plaćanje nije uspjelo");
      setSuccessSubtitle("Transakcija nije potvrđena od strane Bankarta.");
      setSuccessStatusNote(lookupError || "Pokušaj ponovo ili izaberi gotovinu.");
      return;
    }

    if (input.paymentStatus === "refunded") {
      setSuccessTitle("Uplata je refundirana");
      setSuccessSubtitle("Transakcija je evidentirana kao refundirana.");
      setSuccessStatusNote(null);
      return;
    }

    setSuccessTitle("Provjeravamo uplatu");
    setSuccessSubtitle("Sačekaj trenutak dok potvrdimo status kartičnog plaćanja.");
    setSuccessStatusNote(lookupError || null);
  }

  const resetSuccessState = () => {
    setSuccessOrderId(null);
    setSuccessSummary(null);
    setSuccessPaymentStatus(null);
    setSuccessTitle("Porudžbina je poslata");
    setSuccessSubtitle("Hvala na poverenju <3");
    setSuccessStatusNote(null);
    setSuccessCheckingPayment(false);
  };

  const closeBankartReturnFlow = () => {
    if (bankartStatusTimerRef.current) {
      window.clearTimeout(bankartStatusTimerRef.current);
      bankartStatusTimerRef.current = null;
    }
    clearBankartReturnStorage();
    cleanBankartReturnUrl();
  };

  useEffect(() => {
    const bankartReturn = getBankartReturnParams();
    if (!bankartReturn.isBankartReturn) return;
    if (bankartReturnHandledRef.current) return;

    bankartReturnHandledRef.current = true;

    const stored = readBankartReturnStorage();
    if (stored && stored.orderId === bankartReturn.orderId) {
      setSuccessSummary({
        totalCents: stored.totalCents,
        zoneLabel: stored.zoneLabel,
        feeCents: stored.feeCents,
      });
      setSuccessPaymentMethod(stored.paymentMethod);
    } else {
      setSuccessPaymentMethod("card");
    }

    setSubmitError(null);
    setView("success");
    openCart();
    applySuccessUiState({
      paymentMethod: "card",
      paymentStatus: "pending",
      orderId: bankartReturn.orderId,
      checking: true,
      bankartHint: bankartReturn.bankart,
    });

    let active = true;

    const poll = async (attempt: number) => {
      if (!active) return;
      try {
        const body = await fetchBankartOrderStatus(bankartReturn.orderId);

        const nextPaymentStatus = isPaymentStatusValue(body.payment_status) ? body.payment_status : "pending";
        const retryAfterSeconds = Math.max(4, toSafeInt(body.retry_after_seconds, 12));
        const lookupError = typeof body.lookup_error === "string" ? body.lookup_error.trim() : "";

        applySuccessUiState({
          paymentMethod: "card",
          paymentStatus: nextPaymentStatus,
          orderId: bankartReturn.orderId,
          checking: !isFinalPaymentStatusValue(nextPaymentStatus),
          bankartHint: bankartReturn.bankart,
          lookupError: lookupError || null,
        });

        if (nextPaymentStatus === "paid") {
          clearBankartReturnStorage();
          cleanBankartReturnUrl();
          return;
        }

        if (isFinalPaymentStatusValue(nextPaymentStatus)) {
          cleanBankartReturnUrl();
          return;
        }

        if (attempt >= 6) {
          applySuccessUiState({
            paymentMethod: "card",
            paymentStatus: nextPaymentStatus,
            orderId: bankartReturn.orderId,
            checking: false,
            bankartHint: bankartReturn.bankart,
            lookupError: lookupError || "Potvrda uplate kasni. Sačekaj još malo ili nas pozovi ako se status ne promeni.",
          });
          cleanBankartReturnUrl();
          return;
        }

        bankartStatusTimerRef.current = window.setTimeout(() => {
          void poll(attempt + 1);
        }, retryAfterSeconds * 1000);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Status kartičnog plaćanja trenutno nije dostupan.";

        if (attempt >= 2) {
          applySuccessUiState({
            paymentMethod: "card",
            paymentStatus: "pending",
            orderId: bankartReturn.orderId,
            checking: false,
            bankartHint: bankartReturn.bankart,
            lookupError: message,
          });
          cleanBankartReturnUrl();
          return;
        }

        bankartStatusTimerRef.current = window.setTimeout(() => {
          void poll(attempt + 1);
        }, 4000);
      }
    };

    void poll(0);

    return () => {
      active = false;
      if (bankartStatusTimerRef.current) {
        window.clearTimeout(bankartStatusTimerRef.current);
        bankartStatusTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCart]);

  return {
    successPaymentMethod,
    successOrderId,
    successPaymentStatus,
    successTitle,
    successSubtitle,
    successStatusNote,
    successCheckingPayment,
    successCopied,
    successSummary,
    setSuccessPaymentMethod,
    setSuccessSummary,
    setSuccessCheckingPayment,
    applySuccessUiState,
    resetSuccessState,
    copySuccessOrderId,
    closeBankartReturnFlow,
  };
}
