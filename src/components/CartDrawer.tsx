import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { PizzaSize, PizzaVariant, PaymentMethod } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import { createOrder, type CreateOrderPayload } from "../lib/createOrder";
import {
  createBankartPaymentJs,
  formatBankartPaymentJsErrors,
  type BankartPaymentJsController,
} from "../lib/bankartPaymentJs";
import {
  buildImageCandidates,
  envFlagEnabled,
  formatFeeEurShort,
  hasEurPrice,
  isDrinkCategory,
  isPizzaRow,
  isSauceCategory,
  isSauceItemName,
  isSaucesPlaceholder,
  normalizeCategory,
  parsePizzaSizeFromName,
  stripPizzaSizeFromName,
  toSiteSettingsCheckoutDefaults,
} from "../lib/cartDrawerHelpers";
import { CartDrawerSuccessView } from "./CartDrawerSuccessView";
import CheckoutForm from "./CheckoutForm";
import BillingFields from "./BillingFields";
import CardFields from "./CardFields";
import CartView from "./CartView";
import {
  DELIVERY_ZONES,
  DEFAULT_BILLING_CITY,
  DEFAULT_BILLING_POSTCODE,
  type DeliveryZoneKey,
} from "../lib/config";
import {
  type BankartOrderPaymentStatus,
  type BankartOrderStatusResponse,
  isPaymentStatusValue,
  isFinalPaymentStatusValue,
  getBankartReturnParams,
  readBankartReturnStorage,
  writeBankartReturnStorage,
  clearBankartReturnStorage,
  cleanBankartReturnUrl,
} from "../lib/bankartReturnStorage";

declare global {
  interface ImportMetaEnv {
    readonly VITE_CARD_PAYMENTS_ENABLED?: string;
    readonly VITE_BANKART_PAYMENTJS_ENABLED?: string;
    readonly VITE_BANKART_PAYMENTJS_PUBLIC_KEY?: string;
  }
}

type MenuItemData = {
  id: string;
  name: string;
  price_eur_cents: number | null;
  price: number | null;
  category: string;
};

type DrawerView = "cart" | "checkout" | "success";

const BANKART_PAYMENTJS_NUMBER_DIV_ID = "bankart-paymentjs-number";
const BANKART_PAYMENTJS_CVV_DIV_ID = "bankart-paymentjs-cvv";
const BANKART_PAYMENTJS_POLISH_CSS = `
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

type PizzaVariantsMap = Record<string, Partial<Record<PizzaSize, PizzaVariant>>>;

export default function CartDrawer() {
  const {
    isOpen,
    openCart,
    closeCart,
    items,
    removeFromCart,
    increase,
    decrease,
    changeSize,
    addAddonToItem,
    removeAddonFromItem,
    increaseAddonQuantity,
    decreaseAddonQuantity,
    clearCart,
    setItemNote,
    addToCart,

    checkout,
    setPaymentMethod,
    createOrderSnapshot,
    resetCheckout,
  } = useCart();

  const BTN_NEUTRAL =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_10px_26px_rgba(0,0,0,0.18)] hover:bg-white/[0.1] hover:border-white/15 hover:text-white transition-all duration-200";
  const BTN_DANGER =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-red-500/10 hover:border-red-400/20 hover:text-white transition-all duration-200";
  const BTN_SUCCESS =
    "inline-flex items-center justify-center rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_16px_44px_rgba(242,180,0,0.24)] hover:shadow-[0_22px_54px_rgba(242,180,0,0.34)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out";
  const BTN_GOLD_ACTIVE =
    "inline-flex items-center justify-center rounded-full border border-[#f2b400]/20 bg-[#f2b400] text-black shadow-[0_14px_38px_rgba(242,180,0,0.22)] hover:brightness-110 transition-all duration-200";

  const PHONE_DISPLAY = "+382 67 603 780";
  const PHONE_E164 = "+38267603780";

  const CARD =
    "relative overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.035)_28%,rgba(255,255,255,0.02)_100%)] p-4 sm:p-5 shadow-[0_24px_60px_rgba(0,0,0,0.24)] backdrop-blur-xl ring-1 ring-white/5 transition-all duration-200 hover:border-white/15 hover:ring-white/10 md:hover:-translate-y-[1px] active:translate-y-0";
  const ROW =
    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:bg-white/[0.08] hover:border-white/15 hover:ring-1 hover:ring-white/10";

  const [view, setView] = useState<DrawerView>("cart");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [billingCity, setBillingCity] = useState(DEFAULT_BILLING_CITY);
  const [billingPostcode, setBillingPostcode] = useState(DEFAULT_BILLING_POSTCODE);
  const [cardholder, setCardholder] = useState("");
  const [expMonth, setExpMonth] = useState("");
  const [expYear, setExpYear] = useState("");

  const nameTrim = name.trim();
  const phoneTrim = phone.trim();
  const addressTrim = address.trim();
  const customerEmailTrim = customerEmail.trim();
  const billingCityTrim = billingCity.trim();
  const billingPostcodeTrim = billingPostcode.trim();
  const cardholderTrim = cardholder.trim();
  const expMonthTrim = expMonth.trim();
  const expYearTrim = expYear.trim();

  const isNameValid = useMemo(() => {
    if (!nameTrim) return false;
    if (nameTrim.length < 2) return false;
    if (/[0-9]/.test(nameTrim)) return false;
    return /^[\p{L}][\p{L}\s.'-]*$/u.test(nameTrim);
  }, [nameTrim]);

  const isPhoneValid = useMemo(() => {
    if (!phoneTrim) return false;
    if (!/^[0-9+()\-\s]+$/.test(phoneTrim)) return false;
    const digits = (phoneTrim.match(/[0-9]/g) ?? []).length;
    return digits >= 6;
  }, [phoneTrim]);

  const isAddressValid = useMemo(() => {
    if (!addressTrim) return false;
    return addressTrim.length >= 5;
  }, [addressTrim]);

  const isCustomerEmailValid = useMemo(() => {
    if (!customerEmailTrim) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmailTrim);
  }, [customerEmailTrim]);

  const isCardholderValid = useMemo(() => {
    return cardholderTrim.length >= 2;
  }, [cardholderTrim]);

  const isExpMonthValid = useMemo(() => {
    if (!expMonthTrim) return false;
    return /^(0?[1-9]|1[0-2])$/.test(expMonthTrim);
  }, [expMonthTrim]);

  const isExpYearValid = useMemo(() => {
    if (!expYearTrim) return false;
    return /^\d{2,4}$/.test(expYearTrim);
  }, [expYearTrim]);

  const paymentMethod: PaymentMethod = checkout?.paymentMethod ?? "cash";
  const [successPaymentMethod, setSuccessPaymentMethod] = useState<PaymentMethod>("cash");
  const paymentLabel = (m: PaymentMethod) => (m === "card" ? "kartica" : "gotovina");

  const paymentJsPublicKey = String(import.meta.env.VITE_BANKART_PAYMENTJS_PUBLIC_KEY ?? "").trim();
  const paymentJsFeatureEnabled = envFlagEnabled(import.meta.env.VITE_BANKART_PAYMENTJS_ENABLED);
  const paymentJsRequested = paymentMethod === "card" && paymentJsFeatureEnabled && !!paymentJsPublicKey;
  const paymentJsMissingKey = paymentMethod === "card" && paymentJsFeatureEnabled && !paymentJsPublicKey;
  const paymentJsControllerRef = useRef<BankartPaymentJsController | null>(null);
  const billingCityTouchedRef = useRef(false);
  const billingPostcodeTouchedRef = useRef(false);
  const [paymentJsReady, setPaymentJsReady] = useState(false);
  const [paymentJsLoading, setPaymentJsLoading] = useState(false);
  const [paymentJsInitError, setPaymentJsInitError] = useState<string | null>(null);

  const handleSetPaymentMethod = (m: PaymentMethod) => {
    setPaymentMethod?.(m);
  };

  const handleBillingCityChange = (value: string) => {
    billingCityTouchedRef.current = true;
    setBillingCity(value);
  };

  const handleBillingPostcodeChange = (value: string) => {
    billingPostcodeTouchedRef.current = true;
    setBillingPostcode(value);
  };

  // (Blokirajući useEffect uklonjen)

  const [deliveryZoneKey, setDeliveryZoneKey] = useState<DeliveryZoneKey | "">("");
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState(false);

  const [isZoneOpen, setIsZoneOpen] = useState(false);
  const zoneBtnRef = useRef<HTMLButtonElement | null>(null);
  const zonePanelRef = useRef<HTMLDivElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);
  const [successPaymentStatus, setSuccessPaymentStatus] = useState<BankartOrderPaymentStatus>(null);
  const [successTitle, setSuccessTitle] = useState("Porudžbina je poslata");
  const [successSubtitle, setSuccessSubtitle] = useState("Hvala na poverenju <3");
  const [successStatusNote, setSuccessStatusNote] = useState<string | null>(null);
  const [successCheckingPayment, setSuccessCheckingPayment] = useState(false);

  const [successCopied, setSuccessCopied] = useState(false);
  const successCopiedTimerRef = useRef<number | null>(null);

  const [successSummary, setSuccessSummary] = useState<
    | {
        totalCents: number;
        zoneLabel: string;
        feeCents: number;
      }
    | null
  >(null);

  useEffect(() => {
    setSuccessCopied(false);
  }, [successOrderId]);

  useEffect(() => {
    return () => {
      if (successCopiedTimerRef.current) window.clearTimeout(successCopiedTimerRef.current);
      if (bankartStatusTimerRef.current) window.clearTimeout(bankartStatusTimerRef.current);
      paymentJsControllerRef.current?.dispose();
      paymentJsControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCheckoutDefaults = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("default_city, default_postcode")
        .eq("id", 1)
        .maybeSingle();

      if (!active || error) return;

      const defaults = toSiteSettingsCheckoutDefaults(data);

      if (!billingCityTouchedRef.current) {
        setBillingCity(defaults.default_city);
      }

      if (!billingPostcodeTouchedRef.current) {
        setBillingPostcode(defaults.default_postcode);
      }
    };

    void loadCheckoutDefaults();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const shouldInit = isOpen && view === "checkout" && paymentMethod === "card" && paymentJsFeatureEnabled && !!paymentJsPublicKey;

    if (!shouldInit) {
      paymentJsControllerRef.current?.dispose();
      paymentJsControllerRef.current = null;
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

  function applySuccessUiState(input: {
    paymentMethod: PaymentMethod;
    paymentStatus: BankartOrderPaymentStatus;
    orderId: string | null;
    checking: boolean;
    bankartHint?: string | null;
    lookupError?: string | null;
  }) {
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

  const [addonsCatalog, setAddonsCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);

  const [saucesCatalog, setSaucesCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);

  const [drinksCatalog, setDrinksCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string; category: string }[]
  >([]);

  const [openSaucesForItemId, setOpenSaucesForItemId] = useState<string | null>(null);
  const [openDrinksForItemId, setOpenDrinksForItemId] = useState<string | null>(null);

  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] = useState<PizzaVariantsMap>({});

  const bankartReturnHandledRef = useRef(false);
  const bankartStatusTimerRef = useRef<number | null>(null);

  const sauceIdSet = useMemo(() => {
    return new Set<string>((saucesCatalog ?? []).map((s) => s.id));
  }, [saucesCatalog]);

  const setPizzaSizeSafe = (itemId: string, itemName: string, nextSize: PizzaSize) => {
    const baseKey = stripPizzaSizeFromName(itemName);
    const variants = pizzaVariantsByBaseKey[baseKey];
    const next = variants?.[nextSize];
    if (!next) return;
    changeSize(itemId, nextSize, next);
  };

  const totalItems = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity ?? 0), 0);
  }, [items]);

  const subtotalCents = useMemo(() => {
    let total = 0;

    for (const it of items) {
      const qty = it.quantity ?? 0;
      if (qty <= 0) continue;

      const drink = isDrinkCategory(it.category ?? "");
      const addons = drink ? [] : (it.addons ?? []);
      const addonsTotalCents = addons.reduce(
        (s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1),
        0
      );

      const baseCents = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
      const perItemCents = baseCents + addonsTotalCents;

      total += perItemCents * qty;
    }

    return total;
  }, [items]);

  const canSubmit = items.length > 0 && subtotalCents > 0;

  const selectedDeliveryZone = useMemo(() => {
    if (!deliveryZoneKey) return null;
    return DELIVERY_ZONES.find((z) => z.key === deliveryZoneKey) ?? null;
  }, [deliveryZoneKey]);

  const qualifiesForFreeDelivery = useMemo(() => {
    if (!selectedDeliveryZone) return false;
    if (selectedDeliveryZone.feeCents <= 0) return true;
    if (selectedDeliveryZone.minCents <= 0) return true;
    return subtotalCents >= selectedDeliveryZone.minCents;
  }, [selectedDeliveryZone, subtotalCents]);

  const missingToFreeDeliveryCents = useMemo(() => {
    if (!selectedDeliveryZone) return 0;
    if (selectedDeliveryZone.feeCents <= 0) return 0;
    if (selectedDeliveryZone.minCents <= 0) return 0;
    return Math.max(selectedDeliveryZone.minCents - subtotalCents, 0);
  }, [selectedDeliveryZone, subtotalCents]);

  const deliveryFeeCents = useMemo(() => {
    if (!selectedDeliveryZone) return 0;
    if (selectedDeliveryZone.feeCents <= 0) return 0;
    if (qualifiesForFreeDelivery) return 0;
    return deliveryFeeOverride ? selectedDeliveryZone.feeCents : 0;
  }, [selectedDeliveryZone, qualifiesForFreeDelivery, deliveryFeeOverride]);

  const effectiveTotalCents = subtotalCents + deliveryFeeCents;

  const canConfirmOrder =
    canSubmit &&
    isNameValid &&
    isPhoneValid &&
    isAddressValid &&
    !!selectedDeliveryZone &&
    (selectedDeliveryZone.feeCents <= 0 || qualifiesForFreeDelivery || deliveryFeeOverride) &&
    (!paymentJsRequested ||
      (isCustomerEmailValid &&
        !!billingCityTrim &&
        !!billingPostcodeTrim &&
        isCardholderValid &&
        isExpMonthValid &&
        isExpYearValid &&
        paymentJsReady &&
        !paymentJsLoading &&
        !paymentJsInitError));

  const shouldValidateName = submitAttempted || nameTrim.length > 0;
  const shouldValidatePhone = submitAttempted || phoneTrim.length > 0;
  const shouldValidateAddress = submitAttempted || addressTrim.length > 0;
  const shouldValidateDeliveryZone = submitAttempted || !!deliveryZoneKey;
  const shouldValidateDeliveryRules = submitAttempted || !!deliveryZoneKey;
  const shouldValidateCustomerEmail = paymentJsRequested && (submitAttempted || customerEmailTrim.length > 0);
  const shouldValidateBillingCity = paymentJsRequested && (submitAttempted || billingCityTrim.length > 0);
  const shouldValidateBillingPostcode = paymentJsRequested && (submitAttempted || billingPostcodeTrim.length > 0);
  const shouldValidateCardholder = paymentJsRequested && (submitAttempted || cardholderTrim.length > 0);
  const shouldValidateExpMonth = paymentJsRequested && (submitAttempted || expMonthTrim.length > 0);
  const shouldValidateExpYear = paymentJsRequested && (submitAttempted || expYearTrim.length > 0);
  const shouldValidatePaymentJsState = paymentMethod === "card" && (submitAttempted || paymentJsRequested);

  const nameError = !shouldValidateName
    ? null
    : !nameTrim
      ? "Unesi ime i prezime."
      : !isNameValid
        ? "Unesi ime i prezime bez brojeva."
        : null;

  const phoneError = !shouldValidatePhone
    ? null
    : !phoneTrim
      ? "Unesi broj telefona."
      : !isPhoneValid
        ? "Unesi ispravan broj telefona."
        : null;

  const addressError = !shouldValidateAddress
    ? null
    : !addressTrim
      ? "Unesi adresu dostave."
      : !isAddressValid
        ? "Adresa mora imati najmanje 5 karaktera."
        : null;

  const deliveryZoneError = !shouldValidateDeliveryZone
    ? null
    : !selectedDeliveryZone
      ? "Izaberi zonu dostave."
      : null;

  const deliveryRulesError = !shouldValidateDeliveryRules
    ? null
    : selectedDeliveryZone && selectedDeliveryZone.feeCents > 0 && !qualifiesForFreeDelivery && !deliveryFeeOverride
      ? `Dopuni korpu do minimuma ili klikni "Doplati ${formatFeeEurShort(selectedDeliveryZone.feeCents)} za dostavu".`
      : null;

  const customerEmailError = !shouldValidateCustomerEmail
    ? null
    : !customerEmailTrim
      ? "Unesi email za kartično plaćanje."
      : !isCustomerEmailValid
        ? "Unesi ispravan email."
        : null;

  const billingCityError = !shouldValidateBillingCity
    ? null
    : !billingCityTrim
      ? "Unesi grad."
      : null;

  const billingPostcodeError = !shouldValidateBillingPostcode
    ? null
    : !billingPostcodeTrim
      ? "Unesi poštanski broj."
      : null;

  const cardholderError = !shouldValidateCardholder
    ? null
    : !cardholderTrim
      ? "Unesi ime vlasnika kartice."
      : !isCardholderValid
        ? "Ime vlasnika kartice je prekratko."
        : null;

  const expMonthError = !shouldValidateExpMonth
    ? null
    : !expMonthTrim
      ? "Unesi mesec isteka."
      : !isExpMonthValid
        ? "Mesec mora biti od 01 do 12."
        : null;

  const expYearError = !shouldValidateExpYear
    ? null
    : !expYearTrim
      ? "Unesi godinu isteka."
      : !isExpYearValid
        ? "Godina mora imati 2 ili 4 cifre."
        : null;

  const paymentJsStateError = !shouldValidatePaymentJsState
    ? null
    : paymentJsMissingKey
      ? "Kartično plaćanje trenutno nije dostupno. Pokušaj kasnije ili izaberi gotovinu."
      : paymentJsLoading
        ? "Sigurna Bankart polja se još učitavaju. Sačekaj trenutak."
        : paymentJsInitError
          ? paymentJsInitError
          : paymentJsRequested && !paymentJsReady
            ? "Sačekaj da se učitaju sigurna Bankart polja."
            : null;

  const invalidFieldLabels = [
    [nameError, "ime i prezime"],
    [phoneError, "telefon"],
    [addressError, "adresa"],
    [deliveryZoneError, "zona dostave"],
    [deliveryRulesError, "dostava"],
    [customerEmailError, "email"],
    [billingCityError, "grad"],
    [billingPostcodeError, "poštanski broj"],
    [cardholderError, "vlasnik kartice"],
    [expMonthError, "mesec isteka"],
    [expYearError, "godina isteka"],
    [paymentJsStateError, "kartična polja"],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[0]))
    .map((entry) => entry[1]);

  const shouldShowValidationHint =
    invalidFieldLabels.length > 0 &&
    (
      submitAttempted ||
      nameTrim.length > 0 ||
      phoneTrim.length > 0 ||
      addressTrim.length > 0 ||
      !!deliveryZoneKey ||
      (paymentJsRequested &&
        (
          customerEmailTrim.length > 0 ||
          billingCityTrim.length > 0 ||
          billingPostcodeTrim.length > 0 ||
          cardholderTrim.length > 0 ||
          expMonthTrim.length > 0 ||
          expYearTrim.length > 0
        ))
    );

  const checkoutValidationHint = !shouldShowValidationHint
    ? null
    : invalidFieldLabels.length <= 3
      ? `Proveri: ${invalidFieldLabels.join(", ")}.`
      : "Proveri označena polja pre slanja porudžbine.";

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
    setSubmitAttempted(false);
    setSubmitting(false);
    setSuccessCheckingPayment(false);
  };

  const resetSuccessState = () => {
    setSuccessOrderId(null);
    setSuccessSummary(null);
    setSuccessPaymentStatus(null);
    setSuccessTitle("Porudžbina je poslata");
    setSuccessSubtitle("Hvala na poverenju <3");
    setSuccessStatusNote(null);
    setSuccessCheckingPayment(false);
  };

  const handleCloseDrawer = () => {
    resetCheckout?.();
    setView("cart");
    setSubmitting(false);
    setSubmitError(null);
    setSubmitAttempted(false);
    resetSuccessState();
    setOpenSaucesForItemId(null);
    setOpenDrinksForItemId(null);
    setIsZoneOpen(false);
    paymentJsControllerRef.current?.dispose();
    paymentJsControllerRef.current = null;
    setPaymentJsReady(false);
    setPaymentJsLoading(false);
    setPaymentJsInitError(null);
    if (bankartStatusTimerRef.current) {
      window.clearTimeout(bankartStatusTimerRef.current);
      bankartStatusTimerRef.current = null;
    }
    clearBankartReturnStorage();
    cleanBankartReturnUrl();
    closeCart();
  };

  const handleGoToMenu = () => {
    handleCloseDrawer();

    const hero = document.getElementById("top") || document.getElementById("hero");
    if (hero) {
      hero.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectZone = (key: DeliveryZoneKey) => {
    setDeliveryZoneKey(key);
    setIsZoneOpen(false);
    setSubmitError(null);
    zoneBtnRef.current?.focus();
  };

  const addDrinkToCart = (d: { id: string; name: string; price: number; imageKey: string; category: string }) => {
    addToCart({
      id: `${d.id}-${Date.now()}`,
      name: d.name,
      price: d.price,
      image: buildImageCandidates(null, d.imageKey)[0] ?? "/menu/padrino.webp",
      description: "",
      category: d.category,
      quantity: 1,
      size: null,
      baseKey: d.name,
      menuItemId: d.id,
    });
  };

  useEffect(() => {
    if (!isOpen) {
      resetCheckout?.();
      setView("cart");
      setSubmitting(false);
      setSubmitError(null);
      setSubmitAttempted(false);
      resetSuccessState();
      setOpenSaucesForItemId(null);
      setOpenDrinksForItemId(null);
      setIsZoneOpen(false);
      paymentJsControllerRef.current?.dispose();
      paymentJsControllerRef.current = null;
      setPaymentJsReady(false);
      setPaymentJsLoading(false);
      setPaymentJsInitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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
  }, [openCart]);

  useEffect(() => {
    setDeliveryFeeOverride(false);
  }, [deliveryZoneKey]);

  useEffect(() => {
    if (qualifiesForFreeDelivery) setDeliveryFeeOverride(false);
  }, [qualifiesForFreeDelivery]);

  useEffect(() => {
    if (!isZoneOpen) return;

    const onPointerDown = (ev: MouseEvent) => {
      const t = ev.target as Node | null;
      if (!t) return;

      const btn = zoneBtnRef.current;
      const panel = zonePanelRef.current;

      if (btn && btn.contains(t)) return;
      if (panel && panel.contains(t)) return;

      setIsZoneOpen(false);
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      setIsZoneOpen(false);
      zoneBtnRef.current?.focus();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isZoneOpen]);

  useEffect(() => {
    let mounted = true;

    async function loadCatalogs() {
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,price,price_eur_cents,category,is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!mounted || error) return;

        const rows = ((data ?? []) as MenuItemData[]).filter(hasEurPrice);

        const nextPizzaVariants: PizzaVariantsMap = {};
        for (const r of rows) {
          if (!isPizzaRow(r)) continue;

          const size = parsePizzaSizeFromName(r.name);
          if (!size) continue;

          const baseKey = stripPizzaSizeFromName(r.name);
          if (!baseKey) continue;

          const variant: PizzaVariant = {
            menuItemId: r.id,
            price: toSafeInt(r.price_eur_cents, 0),
            category: r.category ?? "",
          };

          if (!nextPizzaVariants[baseKey]) nextPizzaVariants[baseKey] = {};
          nextPizzaVariants[baseKey][size] = variant;
        }
        setPizzaVariantsByBaseKey(nextPizzaVariants);

        const addonRows = rows.filter((r) => normalizeCategory(r.category ?? "") === "dodaci");
        const sauceRows = rows.filter((r) => isSauceCategory(r.category ?? "") || isSauceItemName(r.name));

        const nextAddons = addonRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0), imageKey: r.name }));

        const nextSauces = sauceRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0), imageKey: r.name }));

        const drinkRows = rows.filter((r) => isDrinkCategory(r.category ?? ""));
        const nextDrinks = drinkRows.map((r) => ({
          id: r.id,
          name: r.name,
          price: toSafeInt(r.price_eur_cents, 0),
          imageKey: r.name,
          category: r.category ?? "",
        }));

        setDrinksCatalog(nextDrinks);
        setSaucesCatalog(nextSauces);
        setAddonsCatalog(nextAddons);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
        setSaucesCatalog([]);
        setDrinksCatalog([]);
        setOpenDrinksForItemId(null);
        setPizzaVariantsByBaseKey({});
      }
    }

    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []);

  const proceedToCheckout = () => {
    createOrderSnapshot?.();
    setView("checkout");
    setSubmitError(null);
    setSubmitAttempted(false);
  };

  async function submitOrder() {
    setSubmitAttempted(true);

    if (!canSubmit) return;

    if (!nameTrim || !phoneTrim || !addressTrim) {
      setSubmitError("Popuni sva obavezna polja pre potvrde porudžbine.");
      return;
    }
    if (!isNameValid) {
      setSubmitError("Unesi ispravno ime i prezime (bez brojeva).");
      return;
    }
    if (!isPhoneValid) {
      setSubmitError("Unesi ispravan broj telefona (samo brojevi, +, razmak ili -).");
      return;
    }
    if (!isAddressValid) {
      setSubmitError("Unesi ispravnu adresu (minimum 5 karaktera).");
      return;
    }

    if (!selectedDeliveryZone) {
      setSubmitError("Izaberi zonu dostave ili pozovi nas za lokacije van liste.");
      return;
    }

    if (selectedDeliveryZone.feeCents > 0 && !qualifiesForFreeDelivery && !deliveryFeeOverride) {
      setSubmitError('Za izabranu zonu moraš ili dopuniti korpu do minimuma, ili kliknuti "Doplati" za dostavu.');
      return;
    }

    if (paymentMethod === "card" && paymentJsRequested) {
      if (!isCustomerEmailValid) {
        setSubmitError("Unesi ispravan email za kartično plaćanje.");
        return;
      }
      if (!billingCityTrim || !billingPostcodeTrim) {
        setSubmitError("Unesi grad i poštanski broj za kartično plaćanje.");
        return;
      }
      if (!isCardholderValid) {
        setSubmitError("Unesi ime vlasnika kartice.");
        return;
      }
      if (!isExpMonthValid || !isExpYearValid) {
        setSubmitError("Unesi ispravan mesec i godinu isteka kartice.");
        return;
      }
      if (paymentJsMissingKey) {
        setSubmitError("Bankart payment.js public key nije podešen.");
        return;
      }
      if (paymentJsLoading || !paymentJsReady || !paymentJsControllerRef.current) {
        setSubmitError("Kartična polja se još učitavaju. Sačekaj trenutak i pokušaj ponovo.");
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateOrderPayload = {
        customer_name: nameTrim,
        customer_phone: phoneTrim,
        customer_address: addressTrim,
        customer_email: paymentJsRequested ? customerEmailTrim : null,
        billing_city: paymentJsRequested ? billingCityTrim : null,
        billing_postcode: paymentJsRequested ? billingPostcodeTrim : null,
        cardholder: paymentJsRequested ? cardholderTrim : null,
        total_price: effectiveTotalCents,
        total_items: totalItems,
        note: (() => {
          const base = orderNote.trim();
          const paymentLine = `Plaćanje: ${paymentLabel(paymentMethod)}`;
          const deliveryLine = `Zona: ${selectedDeliveryZone.label}, Dostava: ${formatFeeEurShort(deliveryFeeCents)}`;
          const parts = [base, paymentLine, deliveryLine].filter((x) => String(x ?? "").trim());
          const merged = parts.join("\n").trim();
          return merged ? merged : null;
        })(),
        payment_method: paymentMethod,
        items: items.map((it) => {
          const drink = isDrinkCategory(it.category ?? "");
          const addons = drink ? [] : (it.addons ?? []);

          const addonsTotal = addons.reduce((s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1), 0);
          const basePrice = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
          const pricePerItem = basePrice + addonsTotal;

          const rawSize = it.size ?? null;
          const size: "33" | "50" | null = rawSize === "33" || rawSize === "50" ? rawSize : null;

          const image = String(it.image ?? "").trim() || buildImageCandidates(null, it.name)[0] || "/menu/padrino.webp";

          return {
            cart_id: it.id,
            menu_item_id: it.menuItemId ?? null,
            name: it.name,
            size,
            quantity: toSafeInt(it.quantity, 1),
            base_price: basePrice,
            price_per_item: pricePerItem,
            addons: addons.map((a) => ({
              id: a.id,
              name: a.name,
              price: toSafeInt(a.price, 0),
              quantity: a.quantity ?? 1,
            })),
            note: it.note ?? null,
            image,
            category: it.category ?? "",
          };
        }),
      };

      if (paymentMethod === "card" && paymentJsRequested) {
        const controller = paymentJsControllerRef.current;
        if (!controller) {
          throw new Error("Kartična polja nisu spremna. Osvježi checkout i pokušaj ponovo.");
        }

        const tokenizeResult = await controller.tokenize({
          card_holder: cardholderTrim,
          month: expMonthTrim.padStart(2, "0"),
          year: expYearTrim,
          email: customerEmailTrim || undefined,
        });

        payload.transaction_token = tokenizeResult.token;
      }

      setSuccessPaymentMethod(paymentMethod);

      const res = await createOrder(payload);
      const nextSummary = {
        totalCents: effectiveTotalCents,
        zoneLabel: selectedDeliveryZone.label,
        feeCents: deliveryFeeCents,
      };

      if (res.flow === "card_redirect" && res.redirectUrl) {
        writeBankartReturnStorage({
          orderId: res.orderId,
          totalCents: nextSummary.totalCents,
          zoneLabel: nextSummary.zoneLabel,
          feeCents: nextSummary.feeCents,
          paymentMethod: paymentMethod,
        });

        window.location.assign(res.redirectUrl);
        return;
      }

      setSuccessSummary(nextSummary);
      applySuccessUiState({
        paymentMethod,
        paymentStatus: paymentMethod === "card" ? res.paymentStatus : null,
        orderId: res.orderId ?? null,
        checking: false,
      });

      clearCart();
      resetCheckout?.();
      setSubmitAttempted(false);
      setView("success");
    } catch (err: unknown) {
      if (Array.isArray(err)) {
        setSubmitError(formatBankartPaymentJsErrors(err));
      } else {
        setSubmitError(err instanceof Error ? err.message : "Došlo je do greške.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function onSubmitOrder(e: FormEvent) {
    e.preventDefault();
    void submitOrder();
  }

  if (!isOpen) return null;

  const subtotalLabel = formatEUR(subtotalCents);
  const effectiveTotalLabel = formatEUR(effectiveTotalCents);

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-[80]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button type="button" aria-label="Close cart" className="absolute inset-0 bg-black/75 backdrop-blur-[2px]" onClick={handleCloseDrawer} />

        <motion.div
          className="absolute right-0 top-0 h-full w-full max-w-[560px] overflow-hidden border-l border-white/10 bg-black/55 shadow-[-24px_0_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
          initial={{ x: 60 }}
          animate={{ x: 0 }}
          exit={{ x: 60 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img src="/sections/menu.webp" alt="" className="h-full w-full object-cover opacity-90" draggable={false} loading="eager" decoding="async" />
            <div className="absolute inset-0 bg-black/48" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(242,180,0,0.08),transparent_34%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/34 to-black/60" />
          </div>

          <div className="relative z-10 flex h-full flex-col">
            <div className="border-b border-white/10 bg-black/25 px-4 sm:px-5 backdrop-blur-xl">
              <div className="flex items-center justify-between py-4 sm:py-5">
                <div className="min-w-0">
                  <div className="p-eyebrow">KORPA</div>
                  <div className="mt-1 text-[1.05rem] font-black tracking-[-0.02em] text-white/95 sm:text-[1.12rem]">
                    {view === "checkout" ? "Plaćanje" : view === "success" ? "Porudžbina" : "Vaša porudžbina"}
                  </div>
                  <div className="mt-1 text-xs text-white/60">Stavki: {totalItems}</div>
                </div>

                <div className="flex items-center gap-2">
                  {view !== "cart" ? (
                    <button
                      onClick={backToCart}
                      className={[
                        BTN_NEUTRAL,
                        "h-10 sm:h-9 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-white/25 backdrop-blur-md bg-white/10",
                      ].join(" ")}
                    >
                      Nazad
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    aria-label="Zatvori korpu"
                    className="h-11 w-11 rounded-full border border-red-500/40 text-red-400 bg-black/40 hover:bg-red-500/15 hover:border-red-400 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  >
                    <span className="text-[20px] leading-none">×</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5">
              {view === "success" ? (
                <CartDrawerSuccessView
                  title={successTitle}
                  subtitle={successSubtitle}
                  statusNote={successStatusNote}
                  orderId={successOrderId}
                  copied={successCopied}
                  checking={successCheckingPayment}
                  paymentMethod={successPaymentMethod}
                  paymentStatus={successPaymentStatus}
                  summary={successSummary}
                  onClose={handleCloseDrawer}
                  onGoToMenu={handleGoToMenu}
                  onCopyOrderId={copySuccessOrderId}
                />
              ) : null}

              {view === "checkout" ? (
                <div className="mt-3 space-y-4 sm:mt-4">
                  <div className="p-glass p-4 p-glass-hover">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="p-eyebrow">PREGLED</div>
                        <div className="mt-1 text-base font-black tracking-[-0.02em] text-white/95">Spremno za potvrdu porudžbine</div>
                        <div className="mt-1 text-sm text-white/65">Provjeri podatke ispod, izaberi zonu i način plaćanja.</div>
                      </div>
                      <div className="shrink-0 rounded-full border border-[#f2b400]/20 bg-[#f2b400]/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#f2b400]">{totalItems} stavki</div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <div className="text-[11px] font-semibold text-white/55">SUBTOTAL</div>
                        <div className="mt-1 font-extrabold text-white/92">{subtotalLabel}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <div className="text-[11px] font-semibold text-white/55">DOSTAVA</div>
                        <div className="mt-1 font-extrabold text-white/92">{formatFeeEurShort(deliveryFeeCents)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
                        <div className="text-[11px] font-semibold text-white/55">UKUPNO</div>
                        <div className="mt-1 font-extrabold text-white/92">{effectiveTotalLabel}</div>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={onSubmitOrder} className="space-y-4">
                    <div className="p-glass p-4 p-glass-hover sm:p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="p-eyebrow">KONTAKT I DOSTAVA</div>
                          <div className="mt-1 text-base font-black tracking-[-0.02em] text-white/95">Unos podataka za dostavu</div>
                        </div>
                        <div className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white/55 sm:inline-flex">Checkout</div>
                      </div>

                      <CheckoutForm
                        name={name}
                        phone={phone}
                        address={address}
                        onNameChange={setName}
                        onPhoneChange={setPhone}
                        onAddressChange={setAddress}
                        nameError={nameError}
                        phoneError={phoneError}
                        addressError={addressError}
                      />

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Zona dostave</label>

                        <div className="relative">
                          <button
                            type="button"
                            ref={zoneBtnRef}
                            onClick={() => setIsZoneOpen((v) => !v)}
                            aria-haspopup="listbox"
                            aria-expanded={isZoneOpen}
                            className={[
                              "p-input w-full text-left border border-white/10 bg-black/20 text-white/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/20 focus:border-[#f2b400]/40 transition flex items-center justify-between gap-3",
                              deliveryZoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
                            ].join(" ")}
                          >
                            <span className="min-w-0 truncate">
                              {deliveryZoneKey && selectedDeliveryZone ? selectedDeliveryZone.label : "Izaberi zonu..."}
                            </span>
                            <span aria-hidden="true" className={["shrink-0 text-white/60 transition-transform duration-200", isZoneOpen ? "rotate-180" : ""].join(" ")}>
                              ▼
                            </span>
                          </button>

                          {isZoneOpen ? (
                            <div
                              ref={zonePanelRef}
                              role="listbox"
                              className="absolute z-[90] mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl shadow-xl"
                            >
                              <div className="max-h-64 overflow-y-auto overscroll-contain p-1">
                                {DELIVERY_ZONES.map((z) => {
                                  const selected = z.key === deliveryZoneKey;
                                  return (
                                    <button
                                      key={z.key}
                                      type="button"
                                      role="option"
                                      aria-selected={selected}
                                      onClick={() => handleSelectZone(z.key)}
                                      className={[
                                        "w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-extrabold transition",
                                        selected ? "bg-white/10 ring-1 ring-[#f2b400]/25 text-white" : "text-white/85 hover:bg-white/10",
                                      ].join(" ")}
                                    >
                                      <span className="truncate">{z.label}</span>
                                      {selected ? <span className="shrink-0 text-[#f2b400] text-base leading-none">✓</span> : null}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="mt-1 text-xs text-white/60">
                          Ako tvoje lokacije nema na listi — online porudžbina nije dostupna. Pozovi nas.
                        </div>

                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-xs font-semibold text-white/70">Za porudžbine van zone dostave pozvati na broj</div>
                          <a
                            href={`tel:${PHONE_E164}`}
                            className="mt-2 inline-flex items-center justify-center rounded-full bg-[#f2b400] px-4 py-2 text-sm font-extrabold text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_25px_rgba(242,180,0,0.45)] active:scale-[0.98] transition"
                          >
                            Pozovi {PHONE_DISPLAY}
                          </a>
                        </div>

                        {deliveryZoneError ? <div className="mt-1 text-xs font-medium text-red-300">{deliveryZoneError}</div> : null}

                        {deliveryZoneKey && selectedDeliveryZone ? (
                          <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-white/90">Pravila dostave</div>
                                {selectedDeliveryZone.feeCents <= 0 || selectedDeliveryZone.minCents <= 0 ? (
                                  <div className="mt-1 text-xs text-white/70">Dostava je besplatna za ovu zonu.</div>
                                ) : (
                                  <div className="mt-1 text-xs text-white/70">Besplatna dostava od {formatEUR(selectedDeliveryZone.minCents)}</div>
                                )}
                              </div>

                              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-white/80">
                                {qualifiesForFreeDelivery ? "Besplatna" : "Po pravilima"}
                              </div>
                            </div>

                            {selectedDeliveryZone.feeCents > 0 && !qualifiesForFreeDelivery ? (
                              <div className="mt-3">
                                <div className="text-sm font-semibold text-white/85">
                                  Nedostaje još {formatEUR(missingToFreeDeliveryCents)} do besplatne dostave
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setDeliveryFeeOverride(true);
                                    setSubmitError(null);
                                  }}
                                  className="mt-3 h-11 w-full text-sm font-extrabold rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_35px_rgba(242,180,0,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 ease-out"
                                >
                                  Doplati {formatFeeEurShort(selectedDeliveryZone.feeCents)} za dostavu
                                </button>

                                <div className="mt-2 text-xs text-white/60">Ili dodaj još u korpu da bi dostava postala besplatna.</div>
                              </div>
                            ) : null}

                            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">SUBTOTAL</div>
                                <div className="mt-0.5 font-extrabold text-white/90">{subtotalLabel}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">DOSTAVA</div>
                                <div className="mt-0.5 font-extrabold text-white/90">{formatFeeEurShort(deliveryFeeCents)}</div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">UKUPNO</div>
                                <div className="mt-0.5 font-extrabold text-white/90">{effectiveTotalLabel}</div>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {deliveryRulesError ? <div className="mt-3 text-xs font-medium text-red-300">{deliveryRulesError}</div> : null}
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Način plaćanja</label>

                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleSetPaymentMethod("cash")}
                            className={[paymentMethod === "cash" ? BTN_GOLD_ACTIVE : BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold"].join(" ")}
                          >
                            Gotovina
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSetPaymentMethod("card")}
                            className={[
                              paymentMethod === "card" ? BTN_GOLD_ACTIVE : BTN_NEUTRAL,
                              "h-11 w-full text-sm font-extrabold"
                            ].join(" ")}
                          >
                            Kartica
                          </button>
                        </div>

                        <div className="mt-2 text-xs text-white/60">
                          {paymentJsRequested
                            ? "Kartica ostaje u checkoutu — broj kartice i CVV unosiš kroz sigurna Bankart polja."
                            : "Kartično plaćanje vodi na sigurnu Bankart stranicu za unos kartice."}
                        </div>

                        {paymentMethod === "card" ? (
                          <>
                            <BillingFields
                              paymentJsRequested={paymentJsRequested}
                              billingCity={billingCity}
                              billingPostcode={billingPostcode}
                              onBillingCityChange={handleBillingCityChange}
                              onBillingPostcodeChange={handleBillingPostcodeChange}
                              billingCityError={billingCityError}
                              billingPostcodeError={billingPostcodeError}
                            />

                            <CardFields
                              paymentJsRequested={paymentJsRequested}
                              paymentJsMissingKey={paymentJsMissingKey}
                              paymentJsLoading={paymentJsLoading}
                              paymentJsInitError={paymentJsInitError}
                              paymentJsStateError={paymentJsStateError}
                              customerEmail={customerEmail}
                              cardholder={cardholder}
                              expMonth={expMonth}
                              expYear={expYear}
                              onCustomerEmailChange={(v) => setCustomerEmail(v)}
                              onCardholderChange={(v) => setCardholder(v)}
                              onExpMonthChange={(v) => setExpMonth(v)}
                              onExpYearChange={(v) => setExpYear(v)}
                              customerEmailError={customerEmailError}
                              cardholderError={cardholderError}
                              expMonthError={expMonthError}
                              expYearError={expYearError}
                              numberDivId={BANKART_PAYMENTJS_NUMBER_DIV_ID}
                              cvvDivId={BANKART_PAYMENTJS_CVV_DIV_ID}
                              polishCss={BANKART_PAYMENTJS_POLISH_CSS}
                            />
                          </>
                        ) : null}
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Napomena (opciono)</label>
                        <textarea
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          className="p-input min-h-[90px] resize-none border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                          placeholder="Npr. pozovi kad si ispred..."
                        />
                      </div>
                    </div>

                    {checkoutValidationHint ? (
                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                        {checkoutValidationHint}
                      </div>
                    ) : null}

                    {submitError ? (
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{submitError}</div>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void submitOrder()}
                          className={[BTN_NEUTRAL, "w-full h-12 text-sm font-extrabold border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:scale-100"].join(" ")}
                        >
                          Pokušaj ponovo
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting}
                      aria-disabled={submitting || !canConfirmOrder}
                      className={[
                        BTN_SUCCESS,
                        "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100 inline-flex items-center justify-center gap-2",
                        !submitting && !canConfirmOrder ? "ring-1 ring-[#f2b400]/15" : "",
                      ].join(" ")}
                    >
                      {submitting ? (
                        <>
                          <span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                          Šaljem...
                        </>
                      ) : (
                        `Potvrdi porudžbinu • ${effectiveTotalLabel}`
                      )}
                    </button>
                  </form>
                </div>
              ) : null}

              {view === "cart" ? (
                <CartView
                  items={items}
                  canSubmit={canSubmit}
                  openSaucesForItemId={openSaucesForItemId}
                  openDrinksForItemId={openDrinksForItemId}
                  onGoToMenu={handleGoToMenu}
                  onRemoveFromCart={removeFromCart}
                  onSetPizzaSize={setPizzaSizeSafe}
                  onDecreaseQty={decrease}
                  onIncreaseQty={increase}
                  onAddAddonToItem={addAddonToItem}
                  onRemoveAddonFromItem={removeAddonFromItem}
                  onIncreaseAddonQuantity={increaseAddonQuantity}
                  onDecreaseAddonQuantity={decreaseAddonQuantity}
                  onSetItemNote={setItemNote}
                  onAddDrinkToCart={addDrinkToCart}
                  onToggleSauces={(id) => setOpenSaucesForItemId((prev) => (prev === id ? null : id))}
                  onToggleDrinks={(id) => setOpenDrinksForItemId((prev) => (prev === id ? null : id))}
                  addonsCatalog={addonsCatalog}
                  saucesCatalog={saucesCatalog}
                  drinksCatalog={drinksCatalog}
                  sauceIdSet={sauceIdSet}
                  cardClass={CARD}
                  rowClass={ROW}
                  btnNeutralClass={BTN_NEUTRAL}
                  btnDangerClass={BTN_DANGER}
                  btnSuccessClass={BTN_SUCCESS}
                />
              ) : null}
            </div>

            {view === "cart" && canSubmit ? (
              <div className="border-t border-white/10 bg-black/25 px-4 sm:px-5 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div className="py-3 sm:py-4">
                  <div className="p-glass p-4 p-glass-hover">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="p-eyebrow">UKUPNO</div>
                        <div className="mt-1 text-2xl font-black tracking-[-0.03em] text-white">{subtotalLabel}</div>
                        <div className="mt-1 text-xs text-white/60">{totalItems} stavki spremno za checkout</div>
                      </div>

                      <button
                        type="button"
                        onClick={proceedToCheckout}
                        disabled={!canSubmit}
                        className={[BTN_SUCCESS, "h-11 px-6 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100"].join(" ")}
                      >
                        Poruči
                      </button>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <button type="button" onClick={handleGoToMenu} className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold"].join(" ")}>
                        Nazad na meni
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}