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

type BankartOrderPaymentStatus = "pending" | "paid" | "failed" | "cancelled" | "refunded" | null;

type BankartOrderStatusResponse = {
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

type BankartReturnStorage = {
  orderId: string;
  totalCents: number;
  zoneLabel: string;
  feeCents: number;
  paymentMethod: PaymentMethod;
};

/** -------------------- DELIVERY ZONES -------------------- */
type DeliveryZoneKey =
  | "budva"
  | "becici"
  | "rafailovici"
  | "przno"
  | "sveti-stefan"
  | "seoce"
  | "jaz"
  | "lastva";

type DeliveryZone = {
  key: DeliveryZoneKey;
  label: string;
  minCents: number;
  feeCents: number;
};

const DELIVERY_ZONES: DeliveryZone[] = [
  { key: "budva", label: "Budva", minCents: 0, feeCents: 0 },
  { key: "becici", label: "Bečići", minCents: 1500, feeCents: 300 },
  { key: "rafailovici", label: "Rafailovići", minCents: 2000, feeCents: 500 },
  { key: "przno", label: "Pržno", minCents: 2500, feeCents: 500 },
  { key: "sveti-stefan", label: "Sveti Stefan", minCents: 2500, feeCents: 500 },
  { key: "seoce", label: "Seoce", minCents: 2000, feeCents: 500 },
  { key: "jaz", label: "Jaz", minCents: 2500, feeCents: 500 },
  { key: "lastva", label: "Lastva", minCents: 3000, feeCents: 500 },
];

function formatFeeEurShort(cents: number) {
  const n = Number(cents);
  const v = Number.isFinite(n) ? Math.round(n / 100) : 0;
  return `${v}€`;
}

const BANKART_RETURN_STORAGE_KEY = "padrino:bankart:return";
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
    background: transparent !important;
    box-shadow: none !important;
    overflow: hidden !important;
  }
`;

function envFlagEnabled(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

function isPaymentStatusValue(value: unknown): value is Exclude<BankartOrderPaymentStatus, null> {
  return (
    value === "pending" ||
    value === "paid" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "refunded"
  );
}

function isFinalPaymentStatusValue(value: BankartOrderPaymentStatus): boolean {
  return value === "paid" || value === "failed" || value === "cancelled" || value === "refunded";
}

function getBankartReturnParams() {
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

function readBankartReturnStorage(): BankartReturnStorage | null {
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

function writeBankartReturnStorage(value: BankartReturnStorage) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(BANKART_RETURN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function clearBankartReturnStorage() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(BANKART_RETURN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function cleanBankartReturnUrl() {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname || "/";
  if (currentPath !== "/checkout/success") return;
  try {
    window.history.replaceState({}, document.title, "/");
  } catch {
    // ignore
  }
}
/** --------------------------------------------------------- */

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCategory(value: string) {
  return normalizeText(value);
}

function isDrinkCategory(category: string) {
  const c = normalizeCategory(category);
  return c.includes("pica") || c.includes("pice") || c.includes("napici") || c.includes("napitci");
}

function isSauceCategory(category: string) {
  const c = normalizeCategory(category);
  return c === "sosevi" || c === "sosovi" || c === "sos";
}

function hasEurPrice(row: MenuItemData) {
  const n =
    typeof row.price_eur_cents === "number" ? row.price_eur_cents : Number(row.price_eur_cents);
  return Number.isFinite(n);
}

function isSaucesPlaceholder(name: string) {
  const n = normalizeText(name);
  return n === "sosevi" || n === "sosovi" || n === "sos";
}

function isSauceItemName(name: string) {
  const n = normalizeText(name);
  if (!n) return false;
  if (isSaucesPlaceholder(n)) return false;
  if (n.includes("sos")) return true;

  const keywords = [
    "bbq",
    "barbecue",
    "ketchup",
    "kecap",
    "kečap",
    "majonez",
    "mayonnaise",
    "tartar",
    "tzatziki",
    "beli luk",
    "garlic",
    "ljuti",
    "chili",
    "čili",
    "sriracha",
    "sweet chili",
    "slatko ljuti",
    "pavlaka",
    "pelat",
    "garlik",
  ];

  return keywords.some((k) => n.includes(normalizeText(k)));
}

/** -------------------- STUFFED CRUST (UI PRICE) -------------------- */
function normalizeAddonName(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

function isStuffedCrustAddonName(addonName: string) {
  const n = normalizeAddonName(addonName);
  if (!n) return false;

  if (n.includes("ivice punjene")) return true;
  if (n.includes("punjene ivice")) return true;
  if (n.includes("ivica punjena")) return true;
  if (n.includes("punjena ivica")) return true;

  if (n === "rub") return true;

  return false;
}

function stuffedCrustPriceForSize(size: PizzaSize | string | number | null | undefined): number {
  const s = String(size ?? "").toLowerCase();
  return s.includes("50") ? 400 : 200;
}
/** ------------------------------------------------------------------ */

function parsePizzaSizeFromName(name: string): PizzaSize | null {
  const t = normalizeText(name);
  if (/\b50\s*cm\b/.test(t)) return "50";
  if (/\b33\s*cm\b/.test(t)) return "33";
  return null;
}

function stripPizzaSizeFromName(name: string): string {
  return String(name ?? "")
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPizzaRow(row: MenuItemData): boolean {
  const cat = normalizeCategory(row.category ?? "");
  const nm = normalizeText(row.name ?? "");
  return nm.includes("33 cm") || nm.includes("50 cm") || cat.includes("pizza");
}

type PizzaVariantsMap = Record<string, Partial<Record<PizzaSize, PizzaVariant>>>;

/** -------------------- IMAGE HELPERS -------------------- */
function stripSizeFromAnyName(name: string) {
  return String(name ?? "")
    .replace(/\b(33|50)\s*cm\b/gi, "")
    .replace(/\b(33|50)cm\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

const NAME_TO_FILE: Record<string, string> = {
  // pizze / izuzeci
  "quattro formaggi": "quattro.webp",
  "don pesto": "pesto.webp",
  "don pamidoro": "pomodoro.webp",

  // sosevi
  garlik: "garlik.webp",
  kecap: "kecap.webp",
  "kečap": "kecap.webp",
  majonez: "majonez.webp",
  pelat: "pelat.webp",
  "slatko ljuti": "slatko ljuti.webp",
  "ljuti sos": "ljuti sos.webp",
  bbq: "bbq.webp",

  // dodaci
  krofne: "krofna.webp",
  krofna: "krofna.webp",
  "ivice punjene sirom": "rub.webp",
  "ivice punjene sir": "rub.webp",
  "punjene ivice sirom": "rub.webp",

  // pića
  "coca cola": "coca-cola.webp",
  "coca-cola": "coca-cola.webp",
  "coca cola zero": "coca-zero.webp",
  "coca zero": "coca-zero.webp",
  "coca-cola zero": "coca-zero.webp",
  fanta: "fanta.webp",
  sprite: "sprite.webp",
  heineken: "heineken.webp",
  jabuka: "jabuka.webp",
  narandza: "narandza.webp",
  "naranđa": "narandza.webp",
  knjaz: "knjaz.webp",
  "knjaz milos": "knjaz.webp",
  "knjaz miloš": "knjaz.webp",
  montenegro: "montenegro.webp",

  // spec slučajevi (brend + ukus)
  "bravo jabuka": "jabuka.webp",
  "bravo narandza": "narandza.webp",
  "bravo naranđa": "narandza.webp",
  "knjaz kisela": "knjaz.webp",
  "knjaz kisela voda": "knjaz.webp",
  "rosa voda": "rosa.webp",
  rosa: "rosa.webp",
};

function buildFileCandidatesFromFilename(file: string): string[] {
  const f = String(file ?? "").trim();
  if (!f) return [];

  const lower = f.toLowerCase();

  const encodedFile = encodeURIComponent(f).replaceAll("%2F", "/");
  const encodedLower = encodeURIComponent(lower).replaceAll("%2F", "/");

  const spaceTo20 = f.replaceAll(" ", "%20");
  const spaceTo20Lower = lower.replaceAll(" ", "%20");

  const uniq = new Set<string>([
    `/menu/${f}`,
    `/menu/${lower}`,
    `/menu/${encodedFile}`,
    `/menu/${encodedLower}`,
    `/menu/${spaceTo20}`,
    `/menu/${spaceTo20Lower}`,
  ]);

  return [...uniq];
}

function buildFileCandidatesFromName(name: string): string[] {
  const raw = stripSizeFromAnyName(name);

  const cleanedRaw = String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:l|ml|cl)\b/gi, " ")
    .replace(/\b(0\.?33|0\.?5|0\.?25)\b/gi, " ")
    .replace(/[^a-zA-Z0-9čćšžđČĆŠŽĐ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const n = normalizeText(cleanedRaw);
  if (!n) return [];

  const direct = NAME_TO_FILE[n] ?? NAME_TO_FILE[n.replaceAll("-", " ")];
  if (direct) return buildFileCandidatesFromFilename(direct);

  if (n.startsWith("bravo ")) {
    const withoutBrand = n.replace(/^bravo\s+/, "");
    const mapped = NAME_TO_FILE[withoutBrand] ?? NAME_TO_FILE[withoutBrand.replaceAll("-", " ")];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  if (n.startsWith("knjaz ")) {
    const mapped = NAME_TO_FILE["knjaz"];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  if (n.startsWith("rosa ")) {
    const mapped = NAME_TO_FILE["rosa voda"] ?? NAME_TO_FILE["rosa"];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  const withDash = n.replaceAll(" ", "-");
  const withSpace = n;
  const noDash = withDash.replaceAll("-", "");

  const candidates = [`${withDash}.webp`, `${withSpace}.webp`, `${noDash}.webp`];

  const djToD = withDash.replaceAll("dj", "d");
  if (djToD !== withDash) candidates.push(`${djToD}.webp`);

  const uniq = new Set<string>();
  for (const file of candidates) {
    for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }
  return [...uniq];
}

function buildImageCandidates(image: string | null | undefined, name: string): string[] {
  const uniq = new Set<string>();

  const raw = String(image ?? "").trim();
  if (raw) {
    uniq.add(raw);
    try {
      uniq.add(encodeURI(raw));
    } catch {
      // ignore
    }
  }

  if (raw && !raw.startsWith("/menu/")) {
    const parts = raw.split("/").filter(Boolean);
    const file = parts.length ? parts[parts.length - 1] : "";
    if (file) for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }

  for (const c of buildFileCandidatesFromName(name)) uniq.add(c);

  uniq.add("/menu/padrino.webp");
  uniq.add("/menu/padrino.png");

  return [...uniq];
}

function SmartCartImage(props: { image?: string | null; name: string; alt: string }) {
  const resetKey = useMemo(() => `${props.image ?? ""}__${props.name ?? ""}`, [
    props.image,
    props.name,
  ]);
  return <SmartCartImageInner key={resetKey} {...props} />;
}

function SmartCartImageInner(props: { image?: string | null; name: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(
    () => buildImageCandidates(props.image ?? null, props.name),
    [props.image, props.name]
  );

  const src = candidates[idx] ?? null;

  if (!src) {
    return (
      <div className="h-16 w-16 rounded-2xl bg-white/5 ring-1 ring-white/10" aria-hidden="true" />
    );
  }

  return (
    <img
      src={src}
      alt={props.alt}
      className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/10"
      loading="lazy"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
    />
  );
}

function SmartMiniAddonImage(props: { name: string; className?: string }) {
  return <SmartMiniAddonImageInner key={props.name} {...props} />;
}

function SmartMiniAddonImageInner(props: { name: string; className?: string }) {
  const [idx, setIdx] = useState(0);

  const candidates = useMemo(() => {
    const fromName = buildImageCandidates(null, props.name);
    const uniq = new Set<string>(fromName);
    uniq.add("/menu/padrino.webp");
    uniq.add("/menu/padrino.png");
    return [...uniq];
  }, [props.name]);

  const src = candidates[idx] ?? null;
  if (!src) return null;

  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      className={props.className ?? "h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"}
      loading="lazy"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
    />
  );
}
/** -------------------------------------------------------------------------- */

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
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.07] text-white/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-white/[0.11] hover:border-white/15 transition-all duration-200";
  const BTN_DANGER =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] hover:bg-red-500/10 hover:border-red-400/20 hover:text-white transition-all duration-200";
  const BTN_SUCCESS =
    "inline-flex items-center justify-center rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_35px_rgba(242,180,0,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 ease-out";
  const BTN_GOLD_ACTIVE =
    "inline-flex items-center justify-center rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_25px_rgba(242,180,0,0.45)] transition";

  const PHONE_DISPLAY = "+382 67 603 780";
  const PHONE_E164 = "+38267603780";

  const CARD =
    "relative overflow-hidden rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.09),rgba(255,255,255,0.03)_40%,rgba(255,255,255,0.02)_70%)] p-4 sm:p-5 shadow-[0_18px_45px_rgba(0,0,0,0.22)] backdrop-blur-xl ring-1 ring-white/5 transition-all duration-200 hover:border-white/15 hover:ring-white/10 md:hover:-translate-y-[1px] active:translate-y-0";
  const ROW =
    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-all duration-200 hover:bg-white/7 hover:border-white/15 hover:ring-1 hover:ring-white/10";

  const [view, setView] = useState<DrawerView>("cart");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [billingCity, setBillingCity] = useState("Budva");
  const [billingPostcode, setBillingPostcode] = useState("85310");
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
  const [paymentJsReady, setPaymentJsReady] = useState(false);
  const [paymentJsLoading, setPaymentJsLoading] = useState(false);
  const [paymentJsInitError, setPaymentJsInitError] = useState<string | null>(null);

  const handleSetPaymentMethod = (m: PaymentMethod) => {
    setPaymentMethod?.(m);
  };


  // (Blokirajući useEffect uklonjen)

  const [deliveryZoneKey, setDeliveryZoneKey] = useState<DeliveryZoneKey | "">("");
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState(false);

  const [isZoneOpen, setIsZoneOpen] = useState(false);
  const zoneBtnRef = useRef<HTMLButtonElement | null>(null);
  const zonePanelRef = useRef<HTMLDivElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
        controller.setNumberStyle({
          width: "100%",
          height: "24px",
          color: "#f8fafc",
          "font-size": "16px",
          "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
          "font-weight": "600",
          "line-height": "24px",
          "letter-spacing": "0.01em",
          "background-color": "transparent",
          border: "0",
          padding: "0",
          margin: "0",
        });
        controller.setCvvStyle({
          width: "100%",
          height: "24px",
          color: "#f8fafc",
          "font-size": "16px",
          "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
          "font-weight": "600",
          "line-height": "24px",
          "letter-spacing": "0.02em",
          "background-color": "transparent",
          border: "0",
          padding: "0",
          margin: "0",
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

  const drinksScrollRef = useRef<HTMLDivElement | null>(null);
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

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
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

  const restoreDrinksScroll = (top: number) => {
    requestAnimationFrame(() => {
      const el1 = drinksScrollRef.current;
      if (!el1) return;
      el1.scrollTop = top;

      requestAnimationFrame(() => {
        const el2 = drinksScrollRef.current;
        if (!el2) return;
        el2.scrollTop = top;
      });
    });
  };

  const addDrinkToCart = (d: { id: string; name: string; price: number; imageKey: string; category: string }) => {
    const el = drinksScrollRef.current;
    const top = el?.scrollTop ?? 0;

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

    restoreDrinksScroll(top);
  };

  useEffect(() => {
    if (!isOpen) {
      resetCheckout?.();
      setView("cart");
      setSubmitting(false);
      setSubmitError(null);
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
          .select("id,name,price,price_eur_cents,category")
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
  };

  async function submitOrder() {
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
        <button type="button" aria-label="Close cart" className="absolute inset-0 bg-black/70" onClick={handleCloseDrawer} />

        <motion.div
          className="absolute right-0 top-0 h-full w-full max-w-[520px] overflow-hidden border-l border-white/10 bg-black/60 backdrop-blur-xl"
          initial={{ x: 60 }}
          animate={{ x: 0 }}
          exit={{ x: 60 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img src="/sections/menu.webp" alt="" className="h-full w-full object-cover opacity-85" draggable={false} loading="eager" decoding="async" />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/50" />
          </div>

          <div className="relative h-full flex flex-col z-10">
            <div className="border-b border-white/10 bg-black/30 px-4 sm:px-5">
              <div className="flex items-center justify-between py-4">
                <div className="min-w-0">
                  <div className="p-eyebrow">KORPA</div>
                  <div className="text-white/90 font-extrabold">
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

            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4">
              {view === "success" ? (
                <div className="mt-5 p-glass p-5 p-glass-hover relative overflow-hidden">
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#f2b400]/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#f2b400]/10 blur-3xl" />

                  <button
                    type="button"
                    onClick={handleCloseDrawer}
                    aria-label="Zatvori"
                    className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full border border-[#f2b400]/25 bg-black/35 text-[#f2b400] hover:bg-black/45 hover:border-[#f2b400]/35 transition flex items-center justify-center"
                  >
                    <span className="text-[18px] leading-none">×</span>
                  </button>

                  <div className="flex justify-center">
                    <div className="relative mt-1 mb-4">
                      <div className="absolute inset-0 rounded-full bg-[#f2b400]/35 blur-xl" aria-hidden="true" />
                      <div className="relative h-16 w-16 rounded-full bg-[#f2b400]/20 ring-1 ring-[#f2b400]/35 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-[#f2b400] text-black flex items-center justify-center shadow-[0_18px_60px_rgba(242,180,0,0.25)]">
                          {successCheckingPayment ? (
                            <span className="inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-black/30 border-t-black" />
                          ) : successPaymentMethod === "card" && successPaymentStatus !== "paid" ? (
                            <span className="text-[24px] font-black leading-none">!</span>
                          ) : (
                            <span className="text-[26px] font-black leading-none">✓</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-white/95 font-extrabold text-[22px] text-center leading-tight">{successTitle}</p>
                  <div className="mt-1 text-sm font-semibold text-white/70 text-center">{successSubtitle}</div>

                  {successStatusNote ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-center text-sm text-white/75">
                      {successStatusNote}
                    </div>
                  ) : null}

                  {successOrderId ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/70">ID porudžbine:</div>

                        <div className="min-w-0 flex items-center gap-2">
                          <div className="truncate font-mono text-[12px] text-white/85">{successOrderId}</div>

                          <button
                            type="button"
                            onClick={copySuccessOrderId}
                            className="shrink-0 h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                            aria-label="Kopiraj ID porudžbine"
                            title="Kopiraj"
                          >
                            {successCopied ? (
                              <span className="text-[14px] text-[#f2b400] font-black">✓</span>
                            ) : (
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/80">
                                <path
                                  d="M9 9V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                                <path
                                  d="M13 15v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/65 text-center">Porudžbina je evidentirana.</p>
                  )}

                  {successSummary ? (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/70">Ukupno</div>
                        <div className="text-sm font-extrabold text-white/90">{formatEUR(successSummary.totalCents)}</div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/70">Zona</div>
                        <div className="text-sm font-extrabold text-white/85">{successSummary.zoneLabel}</div>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold text-white/70">Dostava</div>
                        <div className="text-sm font-extrabold text-white/85">{formatFeeEurShort(successSummary.feeCents)}</div>
                      </div>

                      <div className="mt-3 h-px bg-white/10" />
                      <div className="mt-3 text-xs text-white/65">Plaćanje: {paymentLabel(successPaymentMethod)}</div>
                    </div>
                  ) : null}

                  <div className="mt-5 grid grid-cols-1 gap-3">
                    <button
                      onClick={handleGoToMenu}
                      className="w-full h-12 text-sm font-extrabold rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_35px_rgba(242,180,0,0.55)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:hover:scale-100"
                    >
                      Nazad na meni
                    </button>

                    <button
                      type="button"
                      onClick={handleCloseDrawer}
                      className="w-full h-12 text-sm font-extrabold rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/85 transition"
                    >
                      Zatvori
                    </button>
                  </div>
                </div>
              ) : null}

              {view === "checkout" ? (
                <div className="mt-5 space-y-5">
                  <form onSubmit={onSubmitOrder} className="space-y-4">
                    <div className="p-glass p-4 p-glass-hover">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">Ime i prezime</label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !name.trim() ? "border-red-500 focus:border-red-500" : "",
                            submitError && name.trim() ? "border-emerald-500 focus:border-emerald-500" : "",
                          ].join(" ")}
                          placeholder="Npr. Petar Petrovic"
                          autoComplete="name"
                        />
                        {submitError && !name.trim() && <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>}
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Telefon</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !phone.trim() ? "border-red-500 focus:border-red-500" : "",
                            submitError && phone.trim() ? "border-emerald-500 focus:border-emerald-500" : "",
                          ].join(" ")}
                          placeholder="+382..."
                          autoComplete="tel"
                        />
                        {submitError && !phone.trim() && <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>}
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Adresa</label>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !address.trim() ? "border-red-500 focus:border-red-500" : "",
                            submitError && address.trim() ? "border-emerald-500 focus:border-emerald-500" : "",
                          ].join(" ")}
                          placeholder="Ulica i broj"
                          autoComplete="street-address"
                        />
                        {submitError && !address.trim() && <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>}
                      </div>

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
                              submitError && !deliveryZoneKey ? "border-red-500 focus:border-red-500" : "",
                              submitError && deliveryZoneKey ? "border-emerald-500 focus:border-emerald-500" : "",
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

                        {submitError && !deliveryZoneKey ? <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div> : null}

                        {deliveryZoneKey && selectedDeliveryZone ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
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
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Način plaćanja</label>

                        <div className="grid grid-cols-2 gap-2">
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
                          <div className="mt-4 space-y-4 rounded-[28px] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_42%,rgba(255,255,255,0.02)_72%)] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.22)] backdrop-blur-xl">
                            <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-extrabold text-white/90">Sigurna Bankart polja</div>
                                  <div className="mt-1 text-xs leading-relaxed text-white/60">
                                    {paymentJsRequested
                                      ? "Kupac ostaje na sajtu, a broj kartice i CVV se unose kroz zaštićena Bankart polja."
                                      : paymentJsMissingKey
                                        ? "Payment.js je uključen, ali nedostaje public integration key — koristiće se fallback redirect tek kada key bude dodat."
                                        : "Trenutno je aktivan fallback redirect flow. Payment.js će se koristiti kada bude uključen u env-u."}
                                  </div>
                                </div>

                                <div className="shrink-0 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.18em] text-emerald-200">
                                  Bankart
                                </div>
                              </div>
                            </div>

                            {paymentJsRequested ? (
                              <>
                                <style>{BANKART_PAYMENTJS_POLISH_CSS}</style>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/80">Email</label>
                                    <input
                                      value={customerEmail}
                                      onChange={(e) => setCustomerEmail(e.target.value)}
                                      type="email"
                                      autoComplete="email"
                                      className="p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                      placeholder="npr. ime@domen.com"
                                    />
                                    {submitError && !isCustomerEmailValid ? <div className="mt-1 text-xs font-medium text-red-300">Unesi ispravan email.</div> : null}
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/80">Vlasnik kartice</label>
                                    <input
                                      value={cardholder}
                                      onChange={(e) => setCardholder(e.target.value)}
                                      autoComplete="cc-name"
                                      className="p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                      placeholder="Ime i prezime sa kartice"
                                    />
                                  </div>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/80">Grad</label>
                                    <input
                                      value={billingCity}
                                      onChange={(e) => setBillingCity(e.target.value)}
                                      className="p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                      placeholder="Budva"
                                    />
                                  </div>
                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/80">Poštanski broj</label>
                                    <input
                                      value={billingPostcode}
                                      onChange={(e) => setBillingPostcode(e.target.value)}
                                      inputMode="numeric"
                                      className="p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                      placeholder="85310"
                                    />
                                  </div>
                                </div>

                                <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                                  <div className="mb-3 flex items-center justify-between gap-3">
                                    <div className="text-sm font-extrabold text-white/90">Detalji kartice</div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Secure entry</div>
                                  </div>

                                  <div>
                                    <label className="mb-2 block text-sm font-semibold text-white/80">Broj kartice</label>
                                    <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[#f2b400]/40 focus-within:ring-2 focus-within:ring-[#f2b400]/20">
                                      <div id={BANKART_PAYMENTJS_NUMBER_DIV_ID} className="w-full" />
                                    </div>
                                  </div>

                                  <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_140px]">
                                    <div>
                                      <label className="mb-2 block text-sm font-semibold text-white/80">Mesec</label>
                                      <input
                                        value={expMonth}
                                        onChange={(e) => setExpMonth(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                                        inputMode="numeric"
                                        autoComplete="cc-exp-month"
                                        className="p-input border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                        placeholder="MM"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-2 block text-sm font-semibold text-white/80">Godina</label>
                                      <input
                                        value={expYear}
                                        onChange={(e) => setExpYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                                        inputMode="numeric"
                                        autoComplete="cc-exp-year"
                                        className="p-input border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                        placeholder="YY ili YYYY"
                                      />
                                    </div>
                                    <div>
                                      <label className="mb-2 block text-sm font-semibold text-white/80">CVV</label>
                                      <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[#f2b400]/40 focus-within:ring-2 focus-within:ring-[#f2b400]/20">
                                        <div id={BANKART_PAYMENTJS_CVV_DIV_ID} className="w-full" />
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-white/55">
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Bankart iframe polja</span>
                                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Broj kartice i CVV se ne čuvaju u našem frontend-u</span>
                                </div>

                                {paymentJsLoading ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">Učitavam sigurna Bankart polja…</div> : null}
                                {paymentJsInitError ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{paymentJsInitError}</div> : null}
                              </>
                            ) : null}
                          </div>
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
                      disabled={submitting || !canConfirmOrder}
                      className={[BTN_SUCCESS, "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100 inline-flex items-center justify-center gap-2"].join(" ")}
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
                <div className="space-y-4">
                  {!canSubmit ? (
                    <div className="p-glass p-5 p-glass-hover">
                      <div className="text-white/90 font-extrabold text-lg">Korpa je prazna</div>
                      <div className="mt-2 text-sm text-white/70">Dodaj nešto iz menija da nastaviš.</div>
                      <div className="mt-4">
                        <button type="button" onClick={handleGoToMenu} className={[BTN_SUCCESS, "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100"].join(" ")}>
                          Idi na meni
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {canSubmit ? (
                    <div className="space-y-3">
                      {items.map((it) => {
                        const drink = isDrinkCategory(it.category ?? "");
                        const addons = drink ? [] : (it.addons ?? []);

                        const addonsTotalCents = addons.reduce((s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1), 0);
                        const baseCents = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
                        const perItemCents = baseCents + addonsTotalCents;
                        const lineTotalCents = perItemCents * (it.quantity ?? 1);

                        const isPizza = normalizeCategory(it.category ?? "").includes("pizza");
                        const sauceAddons = (addons ?? []).filter((a) => sauceIdSet.has(a.id));
                        const regularAddons = (addons ?? []).filter((a) => !sauceIdSet.has(a.id));

                        return (
                          <div key={it.id} className={CARD}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-start gap-3">
                                <SmartCartImage image={it.image} name={it.name} alt={it.name} />

                                <div className="min-w-0">
                                  <div className="text-white/90 font-extrabold leading-tight">{it.name}</div>

                                  {it.size ? (
                                    <div className="mt-1 text-xs text-white/60">
                                      Veličina: <span className="text-white/80 font-semibold">{it.size} cm</span>
                                    </div>
                                  ) : null}

                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                                      {formatEUR(perItemCents)} / kom
                                    </div>
                                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                                      Ukupno: {formatEUR(lineTotalCents)}
                                    </div>
                                  </div>

                                  {isPizza ? (
                                    <div className="mt-3 flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setPizzaSizeSafe(it.id, it.name, "33")}
                                        className={[BTN_NEUTRAL, "h-10 px-4 text-sm font-extrabold", it.size === "33" ? "bg-white/12 border-white/20" : ""].join(" ")}
                                      >
                                        33 cm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPizzaSizeSafe(it.id, it.name, "50")}
                                        className={[BTN_NEUTRAL, "h-10 px-4 text-sm font-extrabold", it.size === "50" ? "bg-white/12 border-white/20" : ""].join(" ")}
                                      >
                                        50 cm
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <button type="button" onClick={() => removeFromCart(it.id)} className={[BTN_DANGER, "h-10 w-10 shrink-0 text-lg leading-none"].join(" ")} aria-label="Ukloni" title="Ukloni">
                                ×
                              </button>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Količina</div>
                                <div className="mt-0.5 text-sm font-extrabold text-white/85">Izmeni broj komada</div>
                              </div>

                              <div className="grid w-[138px] grid-cols-3 gap-2">
                                <button type="button" onClick={() => decrease(it.id)} className={[BTN_NEUTRAL, "h-11 text-lg font-extrabold"].join(" ")}>
                                  −
                                </button>
                                <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center text-white/90 font-extrabold">{it.quantity ?? 1}</div>
                                <button type="button" onClick={() => increase(it.id)} className={[BTN_NEUTRAL, "h-11 text-lg font-extrabold"].join(" ")}>
                                  +
                                </button>
                              </div>
                            </div>

                            {!drink ? (
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-extrabold text-white/85">Dodaci</div>
                                  <div className="text-xs text-white/55">Klikni da dodaš ili ukloniš</div>
                                </div>

                                <div className="space-y-2">
                                  {addonsCatalog.map((a) => {
                                    const existing = (regularAddons ?? []).find((x) => x.id === a.id);
                                    const qty = existing?.quantity ?? 0;
                                    const isActive = qty > 0;

                                    const displayPrice = isStuffedCrustAddonName(a.name) ? stuffedCrustPriceForSize(it.size ?? null) : a.price;

                                    return (
                                      <div key={a.id} className={ROW}>
                                        <div className="flex items-center gap-3 min-w-0">
                                          <SmartMiniAddonImage name={a.name} />

                                          <div className="min-w-0">
                                            <div className="text-white/90 font-extrabold leading-tight">{a.name}</div>
                                            <div className="text-xs text-white/60">
                                              {formatEUR(isActive ? toSafeInt(existing?.price, displayPrice) : displayPrice)}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {isActive ? (
                                            <>
                                              <button type="button" onClick={() => decreaseAddonQuantity(it.id, a.id)} className={[BTN_NEUTRAL, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                                −
                                              </button>
                                              <div className="w-7 text-center text-white/85 font-extrabold">{qty}</div>
                                              <button type="button" onClick={() => increaseAddonQuantity(it.id, a.id)} className={[BTN_NEUTRAL, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                                +
                                              </button>
                                              <button type="button" onClick={() => removeAddonFromItem(it.id, a.id)} className={[BTN_DANGER, "h-9 px-3 text-sm font-extrabold"].join(" ")}>
                                                Ukloni
                                              </button>
                                            </>
                                          ) : (
                                            <button type="button" onClick={() => addAddonToItem(it.id, { id: a.id, name: a.name, price: displayPrice })} className="p-btn-gold h-10 px-4 text-sm">
                                              Dodaj
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() => setOpenSaucesForItemId((prev) => (prev === it.id ? null : it.id))}
                                    className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
                                  >
                                    <span>Sosevi</span>
                                    <span className="text-white/60 text-xs">{openSaucesForItemId === it.id ? "Zatvori" : "Otvori"}</span>
                                  </button>

                                  {openSaucesForItemId === it.id ? (
                                    <div className="mt-3 space-y-2">
                                      {saucesCatalog.length ? (
                                        <div className="space-y-2">
                                          {saucesCatalog.map((s) => {
                                            const existing = (sauceAddons ?? []).find((x) => x.id === s.id);
                                            const qty = existing?.quantity ?? 0;
                                            const isActive = qty > 0;

                                            return (
                                              <div key={s.id} className={ROW}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                  <SmartMiniAddonImage name={s.name} />
                                                  <div className="min-w-0">
                                                    <div className="text-white/90 font-extrabold leading-tight">{s.name}</div>
                                                    <div className="text-xs text-white/60">{formatEUR(s.price)}</div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {isActive ? (
                                                    <>
                                                      <button type="button" onClick={() => decreaseAddonQuantity(it.id, s.id)} className={[BTN_NEUTRAL, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                                        −
                                                      </button>
                                                      <div className="w-7 text-center text-white/85 font-extrabold">{qty}</div>
                                                      <button type="button" onClick={() => increaseAddonQuantity(it.id, s.id)} className={[BTN_NEUTRAL, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                                        +
                                                      </button>
                                                      <button type="button" onClick={() => removeAddonFromItem(it.id, s.id)} className={[BTN_DANGER, "h-9 px-3 text-sm font-extrabold"].join(" ")}>
                                                        Ukloni
                                                      </button>
                                                    </>
                                                  ) : (
                                                    <button type="button" onClick={() => addAddonToItem(it.id, { id: s.id, name: s.name, price: s.price })} className="p-btn-gold h-10 px-4 text-sm">
                                                      Dodaj
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-white/60">Nema dostupnih soseva.</div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                {items.length === 1 ? (
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      onClick={() => setOpenDrinksForItemId((prev) => (prev === it.id ? null : it.id))}
                                      className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
                                    >
                                      <span>Piće</span>
                                      <span className="text-white/60 text-xs">{openDrinksForItemId === it.id ? "Zatvori" : "Otvori"}</span>
                                    </button>

                                    {openDrinksForItemId === it.id ? (
                                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/15">
                                        <div ref={drinksScrollRef} className="max-h-[300px] overflow-y-auto overscroll-contain p-3 space-y-2">
                                          {drinksCatalog.length ? (
                                            <>
                                              {drinksCatalog.map((d) => (
                                                <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                                  <div className="flex items-center gap-3 min-w-0">
                                                    <SmartMiniAddonImage name={d.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
                                                    <div className="min-w-0">
                                                      <div className="text-white/90 font-extrabold leading-tight">{d.name}</div>
                                                      <div className="text-xs text-white/60">{formatEUR(d.price)}</div>
                                                    </div>
                                                  </div>

                                                  <button
                                                    type="button"
                                                    onMouseDown={(e) => e.preventDefault()}
                                                    onClick={(e) => {
                                                      (e.currentTarget as HTMLButtonElement).blur();
                                                      addDrinkToCart(d);
                                                    }}
                                                    className="p-btn-gold h-10 px-4 text-sm"
                                                  >
                                                    Dodaj
                                                  </button>
                                                </div>
                                              ))}
                                            </>
                                          ) : (
                                            <div className="text-sm text-white/60">Nema dostupnih pića.</div>
                                          )}
                                        </div>
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}

                                <div className="mt-4">
                                  <label className="mb-2 block text-sm font-semibold text-white/80">Napomena za stavku (opciono)</label>
                                  <textarea
                                    value={it.note ?? ""}
                                    onChange={(e) => setItemNote(it.id, e.target.value)}
                                    className="p-input min-h-[70px] resize-none border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                                    placeholder="Npr. bez luka..."
                                  />
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}

                      {items.length > 1 ? (
                        <div className={CARD}>
                          <button
                            type="button"
                            onClick={() => setOpenDrinksForItemId((prev) => (prev === "__catalog__" ? null : "__catalog__"))}
                            className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
                          >
                            <span>Piće</span>
                            <span className="text-white/60 text-xs">{openDrinksForItemId === "__catalog__" ? "Zatvori" : "Otvori"}</span>
                          </button>

                          {openDrinksForItemId === "__catalog__" ? (
                            <div className="mt-3 rounded-2xl border border-white/10 bg-black/15">
                              <div ref={drinksScrollRef} className="max-h-[300px] overflow-y-auto overscroll-contain p-3 space-y-2">
                                {drinksCatalog.length ? (
                                  <>
                                    {drinksCatalog.map((d) => (
                                      <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                        <div className="flex items-center gap-3 min-w-0">
                                          <SmartMiniAddonImage name={d.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
                                          <div className="min-w-0">
                                            <div className="text-white/90 font-extrabold leading-tight">{d.name}</div>
                                            <div className="text-xs text-white/60">{formatEUR(d.price)}</div>
                                          </div>
                                        </div>

                                        <button
                                          type="button"
                                          onMouseDown={(e) => e.preventDefault()}
                                          onClick={(e) => {
                                            (e.currentTarget as HTMLButtonElement).blur();
                                            addDrinkToCart(d);
                                          }}
                                          className="p-btn-gold h-10 px-4 text-sm"
                                        >
                                          Dodaj
                                        </button>
                                      </div>
                                    ))}
                                  </>
                                ) : (
                                  <div className="text-sm text-white/60">Nema dostupnih pića.</div>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="h-3" />
                </div>
              ) : null}
            </div>

            {view === "cart" && canSubmit ? (
              <div className="border-t border-white/10 bg-black/30 px-4 sm:px-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div className="py-3">
                  <div className="p-glass p-4 p-glass-hover">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="p-eyebrow">UKUPNO</div>
                        <div className="mt-1 text-white text-2xl font-extrabold tracking-tight">{subtotalLabel}</div>
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

                    <button type="button" onClick={handleGoToMenu} className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold"].join(" ")}>
                      Nazad na meni
                    </button>
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