import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useCart } from "../context/useCart";
import type { CartItem, PaymentMethod } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import { createOrder, type CreateOrderPayload } from "../lib/createOrder";
import { formatBankartPaymentJsErrors } from "../lib/bankartPaymentJs";
import {
  buildImageCandidates,
  formatFeeEurShort,
  isDrinkCategory,
} from "../lib/cartDrawerHelpers";
import { CartDrawerSuccessView } from "./CartDrawerSuccessView";
import CartView from "./CartView";
import MenuItemDetailSheet from "./MenuItemDetailSheet";
import { type DeliveryZoneKey } from "../lib/config";
import { writeBankartReturnStorage } from "../lib/bankartReturnStorage";
import { trackBeginCheckout, type Ga4CartItem } from "../lib/analytics";
import { useCheckoutForm } from "../hooks/cart/useCheckoutForm";
import { useSuccessState } from "../hooks/cart/useSuccessState";
import { useDeliveryZone } from "../hooks/cart/useDeliveryZone";
import { useBankartPaymentJs } from "../hooks/cart/useBankartPaymentJs";
import CheckoutView from "./CheckoutView";

declare global {
  interface ImportMetaEnv {
    readonly VITE_CARD_PAYMENTS_ENABLED?: string;
    readonly VITE_BANKART_PAYMENTJS_ENABLED?: string;
    readonly VITE_BANKART_PAYMENTJS_PUBLIC_KEY?: string;
  }
}

type DrawerView = "cart" | "checkout" | "success";

export default function CartDrawer() {
  const {
    isOpen,
    openCart,
    closeCart,
    items,
    removeFromCart,
    increase,
    decrease,
    updateItemInCart,
    clearCart,

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

  const [view, setView] = useState<DrawerView>("cart");

  const paymentMethod: PaymentMethod = checkout?.paymentMethod ?? "cash";
  const paymentLabel = (m: PaymentMethod) => (m === "card" ? "kartica" : "gotovina");

  const {
    paymentJsRequested,
    paymentJsMissingKey,
    paymentJsReady,
    paymentJsLoading,
    paymentJsInitError,
    paymentJsControllerRef,
    resetPaymentJs,
  } = useBankartPaymentJs({ isOpen, view, paymentMethod });

  const handleSetPaymentMethod = (m: PaymentMethod) => {
    setPaymentMethod?.(m);
  };

  // (Blokirajući useEffect uklonjen)

  const {
    deliveryZoneKey,
    isZoneOpen,
    setIsZoneOpen,
    deliveryFeeOverride,
    setDeliveryFeeOverride,
    selectZone,
    zoneBtnRef,
    zonePanelRef,
    totalItems,
    subtotalCents,
    selectedDeliveryZone,
    qualifiesForFreeDelivery,
    missingToFreeDeliveryCents,
    deliveryFeeCents,
    effectiveTotalCents,
  } = useDeliveryZone(items);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const {
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
  } = useSuccessState({ openCart, setView, setSubmitError });

  // Edit-mode state (L8.4): when a cart card is clicked, the user re-opens the
  // detail sheet pre-filled. CartDrawer renders its own MenuItemDetailSheet
  // instance for this; Menu.tsx still owns the create-mode sheet.
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);

  const editingCartItem: CartItem | null = useMemo(() => {
    if (!editingCartItemId) return null;
    return items.find((i) => i.id === editingCartItemId) ?? null;
  }, [editingCartItemId, items]);

  // Build a minimal DbMenuItem-shaped object from the cart item so the sheet
  // can render image / name / description / base price without any extra DB
  // round-trip. The sheet itself loads the pizzaVariantsByBaseKey map via
  // useCatalogData and discovers 33/50 variants on its own.
  const editingItemAsDbRow = useMemo(() => {
    if (!editingCartItem) return null;
    const baseKey = editingCartItem.baseKey ?? editingCartItem.name;
    return {
      id: editingCartItem.menuItemId ?? editingCartItem.id,
      name: baseKey,
      description: editingCartItem.description ?? null,
      category: editingCartItem.category ?? "",
      image: editingCartItem.image,
      price_eur_cents: editingCartItem.basePrice ?? editingCartItem.price ?? null,
      price: null,
      is_active: true,
      sort_order: null,
    };
  }, [editingCartItem]);

  const canSubmit = items.length > 0 && subtotalCents > 0;

  const {
    name,
    phone,
    address,
    orderNote,
    customerEmail,
    billingCity,
    billingPostcode,
    cardholder,
    expMonth,
    expYear,
    setName,
    setPhone,
    setAddress,
    setOrderNote,
    setCustomerEmail,
    setCardholder,
    setExpMonth,
    setExpYear,
    handleBillingCityChange,
    handleBillingPostcodeChange,
    nameTrim,
    phoneTrim,
    addressTrim,
    customerEmailTrim,
    billingCityTrim,
    billingPostcodeTrim,
    cardholderTrim,
    expMonthTrim,
    expYearTrim,
    isNameValid,
    isPhoneValid,
    isAddressValid,
    isCustomerEmailValid,
    isCardholderValid,
    isExpMonthValid,
    isExpYearValid,
    nameError,
    phoneError,
    addressError,
    customerEmailError,
    billingCityError,
    billingPostcodeError,
    cardholderError,
    expMonthError,
    expYearError,
    deliveryZoneError,
    deliveryRulesError,
    paymentJsStateError,
    checkoutValidationHint,
    ordersOpen,
    hoursLabel,
  } = useCheckoutForm({
    submitAttempted,
    paymentMethod,
    paymentJsRequested,
    paymentJsMissingKey,
    paymentJsLoading,
    paymentJsInitError,
    paymentJsReady,
    deliveryZoneKey,
    selectedDeliveryZone,
    qualifiesForFreeDelivery,
    deliveryFeeOverride,
  });

  const canConfirmOrder =
    canSubmit &&
    ordersOpen &&
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

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
    setSubmitAttempted(false);
    setSubmitting(false);
    setSuccessCheckingPayment(false);
  };

  const handleCloseDrawer = () => {
    resetCheckout?.();
    setView("cart");
    setSubmitting(false);
    setSubmitError(null);
    setSubmitAttempted(false);
    resetSuccessState();
    setEditingCartItemId(null);
    setIsZoneOpen(false);
    resetPaymentJs();
    closeBankartReturnFlow();
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
    selectZone(key);
    setSubmitError(null);
  };

  useEffect(() => {
    if (!isOpen) {
      resetCheckout?.();
      setView("cart");
      setSubmitting(false);
      setSubmitError(null);
      setSubmitAttempted(false);
      resetSuccessState();
      setEditingCartItemId(null);
      setIsZoneOpen(false);
      resetPaymentJs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const proceedToCheckout = () => {
    createOrderSnapshot?.();
    const checkoutItems: Ga4CartItem[] = items.map((i) => ({
      item_id: i.id,
      item_name: i.name,
      price: i.price / 100,
      quantity: i.quantity,
    }));
    trackBeginCheckout(checkoutItems, effectiveTotalCents);
    setView("checkout");
    setSubmitError(null);
    setSubmitAttempted(false);
  };

  async function submitOrder() {
    setSubmitAttempted(true);

    if (!canSubmit) return;

    if (!ordersOpen) {
      setSubmitError(
        hoursLabel
          ? `Trenutno ne primamo porudžbine. Radno vrijeme: ${hoursLabel}.`
          : "Trenutno ne primamo porudžbine.",
      );
      return;
    }

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
        totalCents: nextSummary.totalCents,
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

  // Edit-mode handler (L8.4): when the detail sheet emits a new snapshot in
  // edit mode, replace the existing cart item via updateItemInCart and close
  // the sheet. Drawer stays open.
  const handleEditConfirm = (newItem: CartItem) => {
    if (!editingCartItemId) return;
    updateItemInCart(editingCartItemId, newItem);
    setEditingCartItemId(null);
  };

  // Pre-fill values for the edit sheet, derived from the cart item being
  // edited. The sheet handles initial state hydration via key remount.
  const editInitialAddons = editingCartItem?.addons ?? [];
  const editInitialNote = editingCartItem?.note ?? "";
  const editInitialQty = editingCartItem?.quantity ?? 1;
  const editInitialSize = editingCartItem?.size ?? null;

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
              <div className="flex items-center justify-between py-2.5 sm:py-3">
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
                    className="h-11 w-11 rounded-full border border-white/15 text-white/60 bg-black/40 hover:bg-white/10 hover:border-white/30 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
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
                <CheckoutView
                  effectiveTotalLabel={effectiveTotalLabel}
                  onSubmitOrder={onSubmitOrder}
                  submitOrder={submitOrder}
                  submitting={submitting}
                  submitError={submitError}
                  canConfirmOrder={canConfirmOrder}
                  ordersOpen={ordersOpen}
                  hoursLabel={hoursLabel}
                  setSubmitError={setSubmitError}
                  name={name}
                  phone={phone}
                  address={address}
                  setName={setName}
                  setPhone={setPhone}
                  setAddress={setAddress}
                  nameError={nameError}
                  phoneError={phoneError}
                  addressError={addressError}
                  isZoneOpen={isZoneOpen}
                  setIsZoneOpen={setIsZoneOpen}
                  zoneBtnRef={zoneBtnRef}
                  zonePanelRef={zonePanelRef}
                  selectedDeliveryZone={selectedDeliveryZone}
                  deliveryZoneKey={deliveryZoneKey}
                  deliveryZoneError={deliveryZoneError}
                  handleSelectZone={handleSelectZone}
                  qualifiesForFreeDelivery={qualifiesForFreeDelivery}
                  missingToFreeDeliveryCents={missingToFreeDeliveryCents}
                  setDeliveryFeeOverride={setDeliveryFeeOverride}
                  deliveryRulesError={deliveryRulesError}
                  paymentMethod={paymentMethod}
                  handleSetPaymentMethod={handleSetPaymentMethod}
                  paymentJsRequested={paymentJsRequested}
                  billingCity={billingCity}
                  billingPostcode={billingPostcode}
                  handleBillingCityChange={handleBillingCityChange}
                  handleBillingPostcodeChange={handleBillingPostcodeChange}
                  billingCityError={billingCityError}
                  billingPostcodeError={billingPostcodeError}
                  paymentJsMissingKey={paymentJsMissingKey}
                  paymentJsLoading={paymentJsLoading}
                  paymentJsInitError={paymentJsInitError}
                  paymentJsStateError={paymentJsStateError}
                  customerEmail={customerEmail}
                  cardholder={cardholder}
                  expMonth={expMonth}
                  expYear={expYear}
                  setCustomerEmail={setCustomerEmail}
                  setCardholder={setCardholder}
                  setExpMonth={setExpMonth}
                  setExpYear={setExpYear}
                  customerEmailError={customerEmailError}
                  cardholderError={cardholderError}
                  expMonthError={expMonthError}
                  expYearError={expYearError}
                  orderNote={orderNote}
                  setOrderNote={setOrderNote}
                  checkoutValidationHint={checkoutValidationHint}
                  btnGoldActiveClass={BTN_GOLD_ACTIVE}
                  btnNeutralClass={BTN_NEUTRAL}
                  btnSuccessClass={BTN_SUCCESS}
                  phoneE164={PHONE_E164}
                  phoneDisplay={PHONE_DISPLAY}
                />
              ) : null}

              {view === "cart" ? (
                <CartView
                  items={items}
                  canSubmit={canSubmit}
                  onGoToMenu={handleGoToMenu}
                  onRemoveFromCart={removeFromCart}
                  onDecreaseQty={decrease}
                  onIncreaseQty={increase}
                  onEditItem={(id) => setEditingCartItemId(id)}
                  cardClass={CARD}
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

                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>

      {/* Edit-mode detail sheet (L8.4) — rendered as a sibling so its
          z-[90] sits above the cart drawer (z-[80]). The same component is
          also used by Menu.tsx for create-mode adds. */}
      <MenuItemDetailSheet
        item={editingItemAsDbRow}
        isHalal={false}
        onClose={() => setEditingCartItemId(null)}
        onConfirm={handleEditConfirm}
        editingCartItemId={editingCartItemId ?? undefined}
        initialSize={editInitialSize}
        initialQty={editInitialQty}
        initialAddons={editInitialAddons}
        initialNote={editInitialNote}
      />
    </AnimatePresence>
  );
}