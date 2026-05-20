import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  createBankartPaymentJs,
  type BankartPaymentJsController,
} from "../../lib/bankartPaymentJs";
import { envFlagEnabled } from "../../lib/cartDrawerHelpers";
import type { PaymentMethod } from "../../context/CartContext";

export const BANKART_PAYMENTJS_NUMBER_DIV_ID = "bankart-paymentjs-number";
export const BANKART_PAYMENTJS_CVV_DIV_ID = "bankart-paymentjs-cvv";
export const BANKART_PAYMENTJS_POLISH_CSS = `
  #${BANKART_PAYMENTJS_NUMBER_DIV_ID},
  #${BANKART_PAYMENTJS_CVV_DIV_ID} {
    width: 100%;
  }

  #${BANKART_PAYMENTJS_NUMBER_DIV_ID} iframe,
  #${BANKART_PAYMENTJS_CVV_DIV_ID} iframe {
    display: block !important;
    width: 100% !important;
    min-height: 56px !important;
    height: 56px !important;
    border: 0 !important;
    border-radius: 16px !important;
    background: #151214 !important;
    box-shadow: none !important;
    overflow: hidden !important;
  }
`;

type UseBankartPaymentJsArgs = {
  isOpen: boolean;
  view: "cart" | "checkout" | "success";
  paymentMethod: PaymentMethod;
};

type UseBankartPaymentJsReturn = {
  paymentJsRequested: boolean;
  paymentJsMissingKey: boolean;
  paymentJsReady: boolean;
  paymentJsLoading: boolean;
  paymentJsInitError: string | null;
  paymentJsControllerRef: RefObject<BankartPaymentJsController | null>;
  resetPaymentJs: () => void;
};

export function useBankartPaymentJs({
  isOpen,
  view,
  paymentMethod,
}: UseBankartPaymentJsArgs): UseBankartPaymentJsReturn {
  const paymentJsPublicKey = String(
    (import.meta.env as { VITE_BANKART_PAYMENTJS_PUBLIC_KEY?: string }).VITE_BANKART_PAYMENTJS_PUBLIC_KEY ?? ""
  ).trim();
  const paymentJsFeatureEnabled = envFlagEnabled(
    (import.meta.env as { VITE_BANKART_PAYMENTJS_ENABLED?: string }).VITE_BANKART_PAYMENTJS_ENABLED
  );
  const paymentJsRequested = paymentMethod === "card" && paymentJsFeatureEnabled && !!paymentJsPublicKey;
  const paymentJsMissingKey = paymentMethod === "card" && paymentJsFeatureEnabled && !paymentJsPublicKey;

  const paymentJsControllerRef = useRef<BankartPaymentJsController | null>(null);
  const [paymentJsReady, setPaymentJsReady] = useState(false);
  const [paymentJsLoading, setPaymentJsLoading] = useState(false);
  const [paymentJsInitError, setPaymentJsInitError] = useState<string | null>(null);

  const resetPaymentJs = () => {
    paymentJsControllerRef.current?.dispose();
    paymentJsControllerRef.current = null;
    setPaymentJsReady(false);
    setPaymentJsLoading(false);
    setPaymentJsInitError(null);
  };

  useEffect(() => {
    const shouldInit = isOpen && view === "checkout" && paymentMethod === "card" && paymentJsFeatureEnabled && !!paymentJsPublicKey;

    if (!shouldInit) {
      paymentJsControllerRef.current?.dispose();
      paymentJsControllerRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPaymentJsReady(false);
      setPaymentJsLoading(false);
      setPaymentJsInitError(null);
      return;
    }

    let active = true;

    paymentJsControllerRef.current?.dispose();
    paymentJsControllerRef.current = null;
    setPaymentJsReady(false);
    setPaymentJsLoading(true);
    setPaymentJsInitError(null);

    void createBankartPaymentJs({
      publicIntegrationKey: paymentJsPublicKey,
      numberDivId: BANKART_PAYMENTJS_NUMBER_DIV_ID,
      cvvDivId: BANKART_PAYMENTJS_CVV_DIV_ID,
    })
      .then((controller) => {
        if (!active) {
          controller.dispose();
          return;
        }

        paymentJsControllerRef.current = controller;

        const numberBaseStyle = {
          width: "100%",
          height: "56px",
          color: "#f8fafc",
          "font-size": "17px",
          "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
          "font-weight": "600",
          "line-height": "56px",
          "letter-spacing": "0.02em",
          background: "#151214",
          "background-color": "#151214",
          border: "1px solid rgba(255,255,255,0.08)",
          "border-radius": "16px",
          "box-sizing": "border-box",
          padding: "0 16px",
          margin: "0",
          outline: "none",
          "box-shadow": "none",
        } as const;

        const numberFocusStyle = {
          ...numberBaseStyle,
          border: "1px solid rgba(242,180,0,0.45)",
          "box-shadow": "0 0 0 3px rgba(242,180,0,0.10)",
        } as const;

        const cvvBaseStyle = {
          width: "100%",
          height: "56px",
          color: "#f8fafc",
          "font-size": "17px",
          "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
          "font-weight": "600",
          "line-height": "56px",
          "letter-spacing": "0.06em",
          background: "#151214",
          "background-color": "#151214",
          border: "1px solid rgba(255,255,255,0.08)",
          "border-radius": "16px",
          "box-sizing": "border-box",
          padding: "0 16px",
          margin: "0",
          outline: "none",
          "box-shadow": "none",
        } as const;

        const cvvFocusStyle = {
          ...cvvBaseStyle,
          border: "1px solid rgba(242,180,0,0.45)",
          "box-shadow": "0 0 0 3px rgba(242,180,0,0.10)",
        } as const;

        controller.setNumberStyle(numberBaseStyle);
        controller.setCvvStyle(cvvBaseStyle);

        controller.numberOn("focus", () => {
          controller.setNumberStyle(numberFocusStyle);
        });
        controller.numberOn("blur", () => {
          controller.setNumberStyle(numberBaseStyle);
        });
        controller.cvvOn("focus", () => {
          controller.setCvvStyle(cvvFocusStyle);
        });
        controller.cvvOn("blur", () => {
          controller.setCvvStyle(cvvBaseStyle);
        });
        setPaymentJsReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setPaymentJsInitError(error instanceof Error ? error.message : "Greška pri učitavanju kartičnih polja.");
      })
      .finally(() => {
        if (!active) return;
        setPaymentJsLoading(false);
      });

    return () => {
      active = false;
      paymentJsControllerRef.current?.dispose();
      paymentJsControllerRef.current = null;
      setPaymentJsReady(false);
    };
  }, [isOpen, view, paymentMethod, paymentJsFeatureEnabled, paymentJsPublicKey]);

  return {
    paymentJsRequested,
    paymentJsMissingKey,
    paymentJsReady,
    paymentJsLoading,
    paymentJsInitError,
    paymentJsControllerRef,
    resetPaymentJs,
  };
}
