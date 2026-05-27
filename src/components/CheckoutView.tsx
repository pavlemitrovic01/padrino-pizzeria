import React, { type FormEvent } from "react";
import type { PaymentMethod } from "../context/CartContext";
import type { DeliveryZone, DeliveryZoneKey } from "../lib/config";
import { DELIVERY_ZONES } from "../lib/config";
import { formatEUR } from "../lib/money";
import { formatFeeEurShort } from "../lib/cartDrawerHelpers";
import {
  BANKART_PAYMENTJS_NUMBER_DIV_ID,
  BANKART_PAYMENTJS_CVV_DIV_ID,
  BANKART_PAYMENTJS_POLISH_CSS,
} from "../hooks/cart/useBankartPaymentJs";
import CheckoutForm from "./CheckoutForm";
import BillingFields from "./BillingFields";
import CardFields from "./CardFields";

type Props = {
  // totals
  effectiveTotalLabel: string;
  // form submit
  onSubmitOrder: (e: FormEvent<HTMLFormElement>) => void;
  submitOrder: () => Promise<void> | void;
  submitting: boolean;
  submitError: string | null;
  canConfirmOrder: boolean;
  setSubmitError: (v: string | null) => void;
  // checkout fields
  name: string;
  phone: string;
  address: string;
  setName: (v: string) => void;
  setPhone: (v: string) => void;
  setAddress: (v: string) => void;
  nameError: string | null;
  phoneError: string | null;
  addressError: string | null;
  // zone picker
  isZoneOpen: boolean;
  setIsZoneOpen: React.Dispatch<React.SetStateAction<boolean>>;
  zoneBtnRef: React.RefObject<HTMLButtonElement | null>;
  zonePanelRef: React.RefObject<HTMLDivElement | null>;
  selectedDeliveryZone: DeliveryZone | null;
  deliveryZoneKey: DeliveryZoneKey | "";
  deliveryZoneError: string | null;
  handleSelectZone: (key: DeliveryZoneKey) => void;
  qualifiesForFreeDelivery: boolean;
  missingToFreeDeliveryCents: number;
  setDeliveryFeeOverride: React.Dispatch<React.SetStateAction<boolean>>;
  deliveryRulesError: string | null;
  // payment toggle
  paymentMethod: PaymentMethod;
  handleSetPaymentMethod: (m: PaymentMethod) => void;
  paymentJsRequested: boolean;
  // billing fields
  billingCity: string;
  billingPostcode: string;
  handleBillingCityChange: (v: string) => void;
  handleBillingPostcodeChange: (v: string) => void;
  billingCityError: string | null;
  billingPostcodeError: string | null;
  // card fields
  paymentJsMissingKey: boolean;
  paymentJsLoading: boolean;
  paymentJsInitError: string | null;
  paymentJsStateError: string | null;
  customerEmail: string;
  cardholder: string;
  expMonth: string;
  expYear: string;
  setCustomerEmail: (v: string) => void;
  setCardholder: (v: string) => void;
  setExpMonth: (v: string) => void;
  setExpYear: (v: string) => void;
  customerEmailError: string | null;
  cardholderError: string | null;
  expMonthError: string | null;
  expYearError: string | null;
  // note + validation
  orderNote: string;
  setOrderNote: (v: string) => void;
  checkoutValidationHint: string | null;
  // style constants from CartDrawer
  btnGoldActiveClass: string;
  btnNeutralClass: string;
  btnSuccessClass: string;
  phoneE164: string;
  phoneDisplay: string;
};

export default function CheckoutView({
  effectiveTotalLabel,
  onSubmitOrder,
  submitOrder,
  submitting,
  submitError,
  canConfirmOrder,
  setSubmitError,
  name,
  phone,
  address,
  setName,
  setPhone,
  setAddress,
  nameError,
  phoneError,
  addressError,
  isZoneOpen,
  setIsZoneOpen,
  zoneBtnRef,
  zonePanelRef,
  selectedDeliveryZone,
  deliveryZoneKey,
  deliveryZoneError,
  handleSelectZone,
  qualifiesForFreeDelivery,
  missingToFreeDeliveryCents,
  setDeliveryFeeOverride,
  deliveryRulesError,
  paymentMethod,
  handleSetPaymentMethod,
  paymentJsRequested,
  billingCity,
  billingPostcode,
  handleBillingCityChange,
  handleBillingPostcodeChange,
  billingCityError,
  billingPostcodeError,
  paymentJsMissingKey,
  paymentJsLoading,
  paymentJsInitError,
  paymentJsStateError,
  customerEmail,
  cardholder,
  expMonth,
  expYear,
  setCustomerEmail,
  setCardholder,
  setExpMonth,
  setExpYear,
  customerEmailError,
  cardholderError,
  expMonthError,
  expYearError,
  orderNote,
  setOrderNote,
  checkoutValidationHint,
  btnGoldActiveClass,
  btnNeutralClass,
  btnSuccessClass,
  phoneE164,
  phoneDisplay,
}: Props) {
  return (
    <div className="mt-3 space-y-4 sm:mt-4">
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
                href={`tel:${phoneE164}`}
                className="mt-2 inline-flex items-center justify-center rounded-full bg-[#f2b400] px-4 py-2 text-sm font-extrabold text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_25px_rgba(242,180,0,0.45)] active:scale-[0.98] transition"
              >
                Pozovi {phoneDisplay}
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
                className={[paymentMethod === "cash" ? btnGoldActiveClass : btnNeutralClass, "h-11 w-full text-sm font-extrabold"].join(" ")}
              >
                Gotovina
              </button>

              <button
                type="button"
                onClick={() => handleSetPaymentMethod("card")}
                className={[
                  paymentMethod === "card" ? btnGoldActiveClass : btnNeutralClass,
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
              className={[btnNeutralClass, "w-full h-12 text-sm font-extrabold border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:scale-100"].join(" ")}
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
            btnSuccessClass,
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
  );
}
