import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.ts";
import {
  toSiteSettingsCheckoutDefaults,
  formatFeeEurShort,
} from "../../lib/cartDrawerHelpers";
import { isWithinBusinessHours, nowMinutesInPodgorica } from "../../lib/businessHours";
import {
  DEFAULT_BILLING_CITY,
  DEFAULT_BILLING_POSTCODE,
  type DeliveryZone,
  type DeliveryZoneKey,
} from "../../lib/config";
import type { PaymentMethod } from "../../context/CartContext";

const ORDERS_OPEN_RECHECK_MS = 30_000;

export type UseCheckoutFormParams = {
  submitAttempted: boolean;
  paymentMethod: PaymentMethod;
  paymentJsRequested: boolean;
  paymentJsMissingKey: boolean;
  paymentJsLoading: boolean;
  paymentJsInitError: string | null;
  paymentJsReady: boolean;
  deliveryZoneKey: DeliveryZoneKey | "";
  selectedDeliveryZone: DeliveryZone | null;
  qualifiesForFreeDelivery: boolean;
  deliveryFeeOverride: boolean;
};

export function useCheckoutForm(params: UseCheckoutFormParams) {
  const {
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
  } = params;

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

  const [ordersOpenTime, setOrdersOpenTime] = useState<string | null>(null);
  const [ordersCloseTime, setOrdersCloseTime] = useState<string | null>(null);
  const [hoursLabel, setHoursLabel] = useState("");
  const [nowTick, setNowTick] = useState(() => Date.now());

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

  const billingCityTouchedRef = useRef(false);
  const billingPostcodeTouchedRef = useRef(false);

  const handleBillingCityChange = (value: string) => {
    billingCityTouchedRef.current = true;
    setBillingCity(value);
  };

  const handleBillingPostcodeChange = (value: string) => {
    billingPostcodeTouchedRef.current = true;
    setBillingPostcode(value);
  };

  useEffect(() => {
    let active = true;

    const loadCheckoutDefaults = async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("default_city, default_postcode, orders_open_time, orders_close_time, hours_display")
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

      const raw = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
      setOrdersOpenTime(typeof raw.orders_open_time === "string" ? raw.orders_open_time : null);
      setOrdersCloseTime(typeof raw.orders_close_time === "string" ? raw.orders_close_time : null);
      setHoursLabel(typeof raw.hours_display === "string" ? raw.hours_display.trim() : "");
    };

    void loadCheckoutDefaults();

    return () => {
      active = false;
    };
  }, []);

  // Re-derives ordersOpen periodically so a checkout left open across the
  // closing boundary reflects it — the server re-checks at submit time
  // regardless, this is UX only.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), ORDERS_OPEN_RECHECK_MS);
    return () => clearInterval(id);
  }, []);

  const ordersOpen = useMemo(
    () => isWithinBusinessHours(ordersOpenTime, ordersCloseTime, nowMinutesInPodgorica(new Date(nowTick))),
    [ordersOpenTime, ordersCloseTime, nowTick],
  );

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

  return {
    // field values
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
    // setters
    setName,
    setPhone,
    setAddress,
    setOrderNote,
    setCustomerEmail,
    setCardholder,
    setExpMonth,
    setExpYear,
    // billing handlers (touched refs internal)
    handleBillingCityChange,
    handleBillingPostcodeChange,
    // trims
    nameTrim,
    phoneTrim,
    addressTrim,
    customerEmailTrim,
    billingCityTrim,
    billingPostcodeTrim,
    cardholderTrim,
    expMonthTrim,
    expYearTrim,
    // validity
    isNameValid,
    isPhoneValid,
    isAddressValid,
    isCustomerEmailValid,
    isCardholderValid,
    isExpMonthValid,
    isExpYearValid,
    // errors
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
    // aggregate hint
    invalidFieldLabels,
    checkoutValidationHint,
    // business hours gate (B19) — UX lock only, server is the real gate
    ordersOpen,
    hoursLabel,
  };
}
