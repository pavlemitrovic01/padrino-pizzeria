import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon, PizzaSize, PizzaVariant } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import { createOrder, type CreateOrderPayload } from "../lib/createOrder";

type MenuItemData = {
  id: string;
  name: string;
  price_eur_cents: number | null;
  price: number | null;
  category: string;
};

type DrawerView = "cart" | "checkout" | "success";

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
  "garlik": "garlik.webp",
  "kecap": "kecap.webp",
  "kečap": "kecap.webp",
  "majonez": "majonez.webp",
  "pelat": "pelat.webp",
  "slatko ljuti": "slatko ljuti.webp",
  "ljuti sos": "ljuti sos.webp",
  "bbq": "bbq.webp",

  // dodaci
  "krofne": "krofna.webp",
  "krofna": "krofna.webp",
  "ivice punjene sirom": "rub.webp",
  "ivice punjene sir": "rub.webp",
  "punjene ivice sirom": "rub.webp",

  // pića
  "coca cola": "coca-cola.webp",
  "coca-cola": "coca-cola.webp",
  "coca cola zero": "coca-zero.webp",
  "coca zero": "coca-zero.webp",
  "coca-cola zero": "coca-zero.webp",
  "fanta": "fanta.webp",
  "sprite": "sprite.webp",
  "heineken": "heineken.webp",
  "jabuka": "jabuka.webp",
  "narandza": "narandza.webp",
  "naranđa": "narandza.webp",
  "knjaz": "knjaz.webp",
  "knjaz milos": "knjaz.webp",
  "knjaz miloš": "knjaz.webp",
  "montenegro": "montenegro.webp",

  // spec slučajevi (brend + ukus)
  "bravo jabuka": "jabuka.webp",
  "bravo narandza": "narandza.webp",
  "bravo naranđa": "narandza.webp",
  "knjaz kisela": "knjaz.webp",
  "knjaz kisela voda": "knjaz.webp",
  "rosa voda": "rosa.webp",
  "rosa": "rosa.webp",
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
  // ESLint: react-hooks/set-state-in-effect
  // Reset idx by remounting inner component when key changes, not by setState in effect.
  const resetKey = useMemo(() => `${props.image ?? ""}__${props.name ?? ""}`, [props.image, props.name]);
  return <SmartCartImageInner key={resetKey} {...props} />;
}

function SmartCartImageInner(props: { image?: string | null; name: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(() => buildImageCandidates(props.image ?? null, props.name), [props.image, props.name]);

  const src = candidates[idx] ?? null;

  if (!src) {
    return <div className="h-16 w-16 rounded-2xl bg-white/5 ring-1 ring-white/10" aria-hidden="true" />;
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
  // ESLint: react-hooks/set-state-in-effect
  // Reset idx by remounting inner component when key changes.
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
  } = useCart();

  // Action color system (premium, consistent)
  const BTN_NEUTRAL =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/85 transition";
  const BTN_DANGER =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/75 hover:text-white transition";
  const BTN_SUCCESS =
    "inline-flex items-center justify-center rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_35px_rgba(242,180,0,0.55)] hover:scale-[1.03] active:scale-[0.98] transition-all duration-200 ease-out";

  // Contact (used for "van zone" call-to-order note)
  const PHONE_DISPLAY = "+382 67 603 780";
  const PHONE_E164 = "+38267603780";

  // Phase 2: subtle card polish (no layout changes, only cosmetics)
  const CARD =
    "p-glass p-4 sm:p-5 p-glass-hover ring-1 ring-white/5 transition-all duration-200 hover:bg-white/7 hover:ring-white/10 md:hover:-translate-y-[1px] active:translate-y-0";
  const ROW =
    "flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5 transition-all duration-200 hover:bg-white/7 hover:border-white/15 hover:ring-1 hover:ring-white/10";

  const [view, setView] = useState<DrawerView>("cart");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");

  const nameTrim = name.trim();
  const phoneTrim = phone.trim();
  const addressTrim = address.trim();

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


  // Delivery zone (required in checkout; no default)
  const [deliveryZoneKey, setDeliveryZoneKey] = useState<DeliveryZoneKey | "">("");
  const [deliveryFeeOverride, setDeliveryFeeOverride] = useState(false);

  // Custom dropdown (premium) state/refs
  const [isZoneOpen, setIsZoneOpen] = useState(false);
  const zoneBtnRef = useRef<HTMLButtonElement | null>(null);
  const zonePanelRef = useRef<HTMLDivElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

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
    // reset "copied" indicator when a new order id is set
    setSuccessCopied(false);
  }, [successOrderId]);

  useEffect(() => {
    return () => {
      if (successCopiedTimerRef.current) window.clearTimeout(successCopiedTimerRef.current);
    };
  }, []);

  async function copySuccessOrderId() {
    if (!successOrderId) return;

    try {
      await navigator.clipboard.writeText(successOrderId);
    } catch {
      // Fallback for older browsers / insecure contexts
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

  // Re-use this state for drinks catalog accordion (no new state).
  const [openDrinksForItemId, setOpenDrinksForItemId] = useState<string | null>(null);

  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] = useState<PizzaVariantsMap>({});

  const drinksScrollRef = useRef<HTMLDivElement | null>(null);

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

    // Below minimum: fee is applied only after explicit confirmation ("Doplati")
    return deliveryFeeOverride ? selectedDeliveryZone.feeCents : 0;
  }, [selectedDeliveryZone, qualifiesForFreeDelivery, deliveryFeeOverride]);

  const effectiveTotalCents = subtotalCents + deliveryFeeCents;

  const canConfirmOrder =
    canSubmit &&
    isNameValid &&
    isPhoneValid &&
    isAddressValid &&
    !!selectedDeliveryZone &&
    (selectedDeliveryZone.feeCents <= 0 || qualifiesForFreeDelivery || deliveryFeeOverride);

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
    setSubmitting(false);
  };

  const handleGoToMenu = () => {
    closeCart();

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

  const addDrinkToCart = (d: {
    id: string;
    name: string;
    price: number;
    imageKey: string;
    category: string;
  }) => {
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
      setView("cart");
      setSubmitting(false);
      setSubmitError(null);
      setSuccessOrderId(null);
      setSuccessSummary(null);
      setOpenSaucesForItemId(null);
      setOpenDrinksForItemId(null);
      setIsZoneOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // Changing zone resets the "pay delivery" choice.
    setDeliveryFeeOverride(false);
  }, [deliveryZoneKey]);

  useEffect(() => {
    // If the cart reaches the minimum, delivery becomes free automatically.
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
        const sauceRows = rows.filter(
          (r) => isSauceCategory(r.category ?? "") || isSauceItemName(r.name)
        );

        const nextAddons = addonRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({
            id: r.id,
            name: r.name,
            price: toSafeInt(r.price_eur_cents, 0),
            imageKey: r.name,
          }));

        const nextSauces = sauceRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({
            id: r.id,
            name: r.name,
            price: toSafeInt(r.price_eur_cents, 0),
            imageKey: r.name,
          }));

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
      setSubmitError(
        'Za izabranu zonu moraš ili dopuniti korpu do minimuma, ili kliknuti "Doplati" za dostavu.'
      );
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateOrderPayload = {
        customer_name: nameTrim,
        customer_phone: phoneTrim,
        customer_address: addressTrim,
        total_price: effectiveTotalCents,
        total_items: totalItems,
        note: (() => {
          const base = orderNote.trim();
          const deliveryLine = `Zona: ${selectedDeliveryZone.label}, Dostava: ${formatFeeEurShort(deliveryFeeCents)}`;
          const merged = base ? `${base}\n${deliveryLine}` : deliveryLine;
          return merged.trim() ? merged : null;
        })(),
        items: items.map((it) => {
          const drink = isDrinkCategory(it.category ?? "");
          const addons = drink ? [] : (it.addons ?? []);

          const addonsTotal = addons.reduce(
            (s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1),
            0
          );

          const basePrice = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
          const pricePerItem = basePrice + addonsTotal;

          const rawSize = it.size ?? null;
          const size: "33" | "50" | null = rawSize === "33" || rawSize === "50" ? rawSize : null;

          const image =
            String(it.image ?? "").trim() ||
            buildImageCandidates(null, it.name)[0] ||
            "/menu/padrino.webp";

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

      const res = await createOrder(payload);
      setSuccessSummary({ totalCents: effectiveTotalCents, zoneLabel: selectedDeliveryZone.label, feeCents: deliveryFeeCents });
      setSuccessOrderId(res.orderId ?? null);

      clearCart();
      setView("success");
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Došlo je do greške.");
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
      <motion.div
        className="fixed inset-0 z-[80]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button
          type="button"
          aria-label="Close cart"
          className="absolute inset-0 bg-black/70"
          onClick={closeCart}
        />

        <motion.div
          className="absolute right-0 top-0 h-full w-full max-w-[520px] overflow-hidden border-l border-white/10 bg-black/60 backdrop-blur-xl"
          initial={{ x: 60 }}
          animate={{ x: 0 }}
          exit={{ x: 60 }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
        >
          {/* Background image and overlays, applies to whole panel */}
          <div className="absolute inset-0 z-0 pointer-events-none">
            <img
              src="/sections/menu.webp"
              alt=""
              className="h-full w-full object-cover opacity-85"
              draggable={false}
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/50" />
          </div>
          <div className="relative h-full flex flex-col z-10">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/30 px-4 sm:px-5">
              <div className="flex items-center justify-between py-4">
                <div className="min-w-0">
                  <div className="p-eyebrow">KORPA</div>
                  <div className="text-white/90 font-extrabold">
                    {view === "checkout"
                      ? "Plaćanje"
                      : view === "success"
                        ? "Porudžbina"
                        : "Vaša porudžbina"}
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
                    onClick={closeCart}
                    aria-label="Zatvori korpu"
                    className="h-11 w-11 rounded-full border border-red-500/40 text-red-400 bg-black/40 hover:bg-red-500/15 hover:border-red-400 hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center"
                  >
                    <span className="text-[20px] leading-none">×</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 sm:px-5 py-4">
              {view === "success" ? (
                <div className="mt-5 p-glass p-5 p-glass-hover relative overflow-hidden">
                  {/* subtle golden glow */}
                  <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#f2b400]/20 blur-3xl" />
                  <div className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#f2b400]/10 blur-3xl" />

                  {/* in-card close (matches success mock) */}
                  <button
                    type="button"
                    onClick={closeCart}
                    aria-label="Zatvori"
                    className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full border border-[#f2b400]/25 bg-black/35 text-[#f2b400] hover:bg-black/45 hover:border-[#f2b400]/35 transition flex items-center justify-center"
                  >
                    <span className="text-[18px] leading-none">×</span>
                  </button>

                  {/* check badge */}
                  <div className="flex justify-center">
                    <div className="relative mt-1 mb-4">
                      <div className="absolute inset-0 rounded-full bg-[#f2b400]/35 blur-xl" aria-hidden="true" />
                      <div className="relative h-16 w-16 rounded-full bg-[#f2b400]/20 ring-1 ring-[#f2b400]/35 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full bg-[#f2b400] text-black flex items-center justify-center shadow-[0_18px_60px_rgba(242,180,0,0.25)]">
                          <span className="text-[26px] font-black leading-none">✓</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <p className="text-white/95 font-extrabold text-[22px] text-center leading-tight">
                    Porudžbina je poslata
                  </p>
                  <div className="mt-1 text-sm font-semibold text-white/70 text-center">Hvala na poverenju &lt;3</div>

                  {/* Order ID row */}
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
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className="text-white/80"
                              >
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

                  {/* Summary */}
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
                      <div className="mt-3 text-xs text-white/65">Plaćanje: gotovina (kartice uskoro).</div>
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
                      onClick={closeCart}
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
                      {/* Ime i prezime */}
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Ime i prezime
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !name.trim() ? "border-red-500 focus:border-red-500" : "",
                            submitError && name.trim()
                              ? "border-emerald-500 focus:border-emerald-500"
                              : "",
                          ].join(" ")}
                          placeholder="Npr. Pavle Mitrović"
                          autoComplete="name"
                        />
                        {submitError && !name.trim() && (
                          <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>
                        )}
                      </div>

                      {/* Telefon */}
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Telefon
                        </label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !phone.trim() ? "border-red-500 focus:border-red-500" : "",
                            submitError && phone.trim()
                              ? "border-emerald-500 focus:border-emerald-500"
                              : "",
                          ].join(" ")}
                          placeholder="+382..."
                          autoComplete="tel"
                        />
                        {submitError && !phone.trim() && (
                          <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>
                        )}
                      </div>

                      {/* Adresa */}
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Adresa
                        </label>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className={[
                            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                            submitError && !address.trim()
                              ? "border-red-500 focus:border-red-500"
                              : "",
                            submitError && address.trim()
                              ? "border-emerald-500 focus:border-emerald-500"
                              : "",
                          ].join(" ")}
                          placeholder="Ulica i broj"
                          autoComplete="street-address"
                        />
                        {submitError && !address.trim() && (
                          <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>
                        )}
                      </div>

                      {/* Zona dostave */}
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Zona dostave
                        </label>

                        <div className="relative">
                          <button
                            type="button"
                            ref={zoneBtnRef}
                            onClick={() => setIsZoneOpen((v) => !v)}
                            aria-haspopup="listbox"
                            aria-expanded={isZoneOpen}
                            className={[
                              "p-input w-full text-left border border-white/10 bg-black/20 text-white/90 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/20 focus:border-[#f2b400]/40 transition flex items-center justify-between gap-3",
                              submitError && !deliveryZoneKey
                                ? "border-red-500 focus:border-red-500"
                                : "",
                              submitError && deliveryZoneKey
                                ? "border-emerald-500 focus:border-emerald-500"
                                : "",
                            ].join(" ")}
                          >
                            <span className="min-w-0 truncate">
                              {deliveryZoneKey && selectedDeliveryZone
                                ? selectedDeliveryZone.label
                                : "Izaberi zonu..."}
                            </span>
                            <span
                              aria-hidden="true"
                              className={[
                                "shrink-0 text-white/60 transition-transform duration-200",
                                isZoneOpen ? "rotate-180" : "",
                              ].join(" ")}
                            >
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
                                        selected
                                          ? "bg-white/10 ring-1 ring-[#f2b400]/25 text-white"
                                          : "text-white/85 hover:bg-white/10",
                                      ].join(" ")}
                                    >
                                      <span className="truncate">{z.label}</span>
                                      {selected ? (
                                        <span className="shrink-0 text-[#f2b400] text-base leading-none">
                                          ✓
                                        </span>
                                      ) : null}
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

                        {/* Van zone: call-to-order note (premium) */}
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <div className="text-xs font-semibold text-white/70">
                            Za porudžbine van zone dostave pozvati na broj
                          </div>
                          <a
                            href={`tel:${PHONE_E164}`}
                            className="mt-2 inline-flex items-center justify-center rounded-full bg-[#f2b400] px-4 py-2 text-sm font-extrabold text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_25px_rgba(242,180,0,0.45)] active:scale-[0.98] transition"
                          >
                            Pozovi {PHONE_DISPLAY}
                          </a>
                        </div>

                        {submitError && !deliveryZoneKey ? (
                          <div className="mt-1 text-xs font-medium text-red-300">Obavezno polje</div>
                        ) : null}

                        {deliveryZoneKey && selectedDeliveryZone ? (
                          <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-white/90">
                                  Pravila dostave
                                </div>
                                {selectedDeliveryZone.feeCents <= 0 ||
                                selectedDeliveryZone.minCents <= 0 ? (
                                  <div className="mt-1 text-xs text-white/70">
                                    Dostava je besplatna za ovu zonu.
                                  </div>
                                ) : (
                                  <div className="mt-1 text-xs text-white/70">
                                    Besplatna dostava od {formatEUR(selectedDeliveryZone.minCents)}
                                  </div>
                                )}
                              </div>

                              <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold text-white/80">
                                {qualifiesForFreeDelivery ? "Besplatna" : "Po pravilima"}
                              </div>
                            </div>

                            {selectedDeliveryZone.feeCents > 0 && !qualifiesForFreeDelivery ? (
                              <div className="mt-3">
                                <div className="text-sm font-semibold text-white/85">
                                  Nedostaje još {formatEUR(missingToFreeDeliveryCents)} do besplatne
                                  dostave
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

                                <div className="mt-2 text-xs text-white/60">
                                  Ili dodaj još u korpu da bi dostava postala besplatna.
                                </div>
                              </div>
                            ) : null}

                            <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">
                                  SUBTOTAL
                                </div>
                                <div className="mt-0.5 font-extrabold text-white/90">
                                  {subtotalLabel}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">
                                  DOSTAVA
                                </div>
                                <div className="mt-0.5 font-extrabold text-white/90">
                                  {formatFeeEurShort(deliveryFeeCents)}
                                </div>
                              </div>
                              <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                <div className="text-[11px] font-semibold text-white/60">
                                  UKUPNO
                                </div>
                                <div className="mt-0.5 font-extrabold text-white/90">
                                  {effectiveTotalLabel}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {/* Napomena */}
                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Napomena (opciono)
                        </label>
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
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                          {submitError}
                        </div>
                        <button
                          type="button"
                          disabled={submitting}
                          onClick={() => void submitOrder()}
                          className={[
                            BTN_NEUTRAL,
                            "w-full h-12 text-sm font-extrabold border-white/15 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:hover:bg-white/5 disabled:hover:scale-100",
                          ].join(" ")}
                        >
                          Pokušaj ponovo
                        </button>
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting || !canConfirmOrder}
                      className={[
                        BTN_SUCCESS,
                        "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100 inline-flex items-center justify-center gap-2",
                      ].join(" ")}
                    >
                      {submitting ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="h-4 w-4 rounded-full border-2 border-black/30 border-t-black animate-spin"
                          />
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
                      <div className="mt-2 text-sm text-white/70">
                        Dodaj nešto iz menija da nastaviš.
                      </div>
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={handleGoToMenu}
                          className={[
                            BTN_SUCCESS,
                            "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100",
                          ].join(" ")}
                        >
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

                        const addonsTotalCents = addons.reduce(
                          (s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1),
                          0
                        );

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
                                  <div className="text-white/90 font-extrabold leading-tight">
                                    {it.name}
                                  </div>

                                  {it.size ? (
                                    <div className="mt-1 text-xs text-white/60">
                                      Veličina:{" "}
                                      <span className="text-white/80 font-semibold">{it.size} cm</span>
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
                                        className={[
                                          BTN_NEUTRAL,
                                          "h-10 px-4 text-sm font-extrabold",
                                          it.size === "33" ? "bg-white/12 border-white/20" : "",
                                        ].join(" ")}
                                      >
                                        33 cm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setPizzaSizeSafe(it.id, it.name, "50")}
                                        className={[
                                          BTN_NEUTRAL,
                                          "h-10 px-4 text-sm font-extrabold",
                                          it.size === "50" ? "bg-white/12 border-white/20" : "",
                                        ].join(" ")}
                                      >
                                        50 cm
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeFromCart(it.id)}
                                className={[
                                  BTN_DANGER,
                                  "h-10 w-10 shrink-0 text-lg leading-none",
                                ].join(" ")}
                                aria-label="Ukloni"
                                title="Ukloni"
                              >
                                ×
                              </button>
                            </div>

                            <div className="mt-4 grid grid-cols-3 items-center gap-2">
                              <button
                                type="button"
                                onClick={() => decrease(it.id)}
                                className={[BTN_NEUTRAL, "h-10 text-lg font-extrabold"].join(" ")}
                              >
                                −
                              </button>
                              <div className="text-center text-white/85 font-extrabold">
                                {it.quantity ?? 1}
                              </div>
                              <button
                                type="button"
                                onClick={() => increase(it.id)}
                                className={[BTN_NEUTRAL, "h-10 text-lg font-extrabold"].join(" ")}
                              >
                                +
                              </button>
                            </div>

                            {/* Addons & Sauces only for non-drinks */}
                            {!drink ? (
                              <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-extrabold text-white/85">Dodaci</div>
                                  <div className="text-xs text-white/55">
                                    Klikni da dodaš ili ukloniš
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  {addonsCatalog.map((a) => {
                                    const existing = (regularAddons ?? []).find((x) => x.id === a.id);
                                    const qty = existing?.quantity ?? 0;
                                    const isActive = qty > 0;

                                    return (
                                      <div key={a.id} className={ROW}>
                                        <div className="flex items-center gap-3 min-w-0">
                                          <SmartMiniAddonImage name={a.name} />

                                          <div className="min-w-0">
                                            <div className="text-white/90 font-extrabold leading-tight">
                                              {a.name}
                                            </div>
                                            <div className="text-xs text-white/60">
                                              {formatEUR(a.price)}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {isActive ? (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => decreaseAddonQuantity(it.id, a.id)}
                                                className={[
                                                  BTN_NEUTRAL,
                                                  "h-9 w-9 text-lg font-extrabold",
                                                ].join(" ")}
                                              >
                                                −
                                              </button>
                                              <div className="w-7 text-center text-white/85 font-extrabold">
                                                {qty}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => increaseAddonQuantity(it.id, a.id)}
                                                className={[
                                                  BTN_NEUTRAL,
                                                  "h-9 w-9 text-lg font-extrabold",
                                                ].join(" ")}
                                              >
                                                +
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => removeAddonFromItem(it.id, a.id)}
                                                className={[
                                                  BTN_DANGER,
                                                  "h-9 px-3 text-sm font-extrabold",
                                                ].join(" ")}
                                              >
                                                Ukloni
                                              </button>
                                            </>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                addAddonToItem(it.id, {
                                                  id: a.id,
                                                  name: a.name,
                                                  price: a.price,
} as CartAddon)
                                              }
                                              className="p-btn-gold h-10 px-4 text-sm"
                                            >
                                              Dodaj
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* Sosevi */}
                                <div className="mt-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenSaucesForItemId((prev) => (prev === it.id ? null : it.id))
                                    }
                                    className={[
                                      BTN_NEUTRAL,
                                      "h-11 w-full text-sm font-extrabold justify-between px-4",
                                    ].join(" ")}
                                  >
                                    <span>Sosevi</span>
                                    <span className="text-white/60 text-xs">
                                      {openSaucesForItemId === it.id ? "Zatvori" : "Otvori"}
                                    </span>
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
                                                    <div className="text-white/90 font-extrabold leading-tight">
                                                      {s.name}
                                                    </div>
                                                    <div className="text-xs text-white/60">
                                                      {formatEUR(s.price)}
                                                    </div>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                  {isActive ? (
                                                    <>
                                                      <button
                                                        type="button"
                                                        onClick={() => decreaseAddonQuantity(it.id, s.id)}
                                                        className={[
                                                          BTN_NEUTRAL,
                                                          "h-9 w-9 text-lg font-extrabold",
                                                        ].join(" ")}
                                                      >
                                                        −
                                                      </button>
                                                      <div className="w-7 text-center text-white/85 font-extrabold">
                                                        {qty}
                                                      </div>
                                                      <button
                                                        type="button"
                                                        onClick={() => increaseAddonQuantity(it.id, s.id)}
                                                        className={[
                                                          BTN_NEUTRAL,
                                                          "h-9 w-9 text-lg font-extrabold",
                                                        ].join(" ")}
                                                      >
                                                        +
                                                      </button>
                                                      <button
                                                        type="button"
                                                        onClick={() => removeAddonFromItem(it.id, s.id)}
                                                        className={[
                                                          BTN_DANGER,
                                                          "h-9 px-3 text-sm font-extrabold",
                                                        ].join(" ")}
                                                      >
                                                        Ukloni
                                                      </button>
                                                    </>
                                                  ) : (
                                                    <button
                                                      type="button"
                                                      onClick={() =>
                                                        addAddonToItem(it.id, {
                                                          id: s.id,
                                                          name: s.name,
                                                          price: s.price,
} as CartAddon)
                                                      }
                                                      className="p-btn-gold h-10 px-4 text-sm"
                                                    >
                                                      Dodaj
                                                    </button>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-sm text-white/60">
                                          Nema dostupnih soseva.
                                        </div>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Napomena po stavci */}
                                <div className="mt-4">
                                  <label className="mb-2 block text-sm font-semibold text-white/80">
                                    Napomena za stavku (opciono)
                                  </label>
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

                      {/* ✅ PIĆE SEKCIJA (VRAĆENO) */}
                      <div className={CARD}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpenDrinksForItemId((prev) =>
                              prev === "__catalog__" ? null : "__catalog__"
                            )
                          }
                          className={[
                            BTN_NEUTRAL,
                            "h-11 w-full text-sm font-extrabold justify-between px-4",
                          ].join(" ")}
                        >
                          <span>Piće</span>
                          <span className="text-white/60 text-xs">
                            {openDrinksForItemId === "__catalog__" ? "Zatvori" : "Otvori"}
                          </span>
                        </button>

                        {openDrinksForItemId === "__catalog__" ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/15">
                            <div
                              ref={drinksScrollRef}
                              className="max-h-[300px] overflow-y-auto overscroll-contain p-3 space-y-2"
                            >
                              {drinksCatalog.length ? (
                                <>
                                  {drinksCatalog.map((d) => (
                                    <div
                                      key={d.id}
                                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2"
                                    >
                                      <div className="flex items-center gap-3 min-w-0">
                                        <SmartMiniAddonImage
                                          name={d.name}
                                          className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10"
                                        />
                                        <div className="min-w-0">
                                          <div className="text-white/90 font-extrabold leading-tight">
                                            {d.name}
                                          </div>
                                          <div className="text-xs text-white/60">
                                            {formatEUR(d.price)}
                                          </div>
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
                    </div>
                  ) : null}

                  <div className="h-3" />
                </div>
              ) : null}
            </div>

            {/* Locked footer */}
            {view === "cart" && canSubmit ? (
              <div
                className="border-t border-white/10 bg-black/30 px-4 sm:px-5"
                style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
              >
                <div className="py-3">
                  <div className="p-glass p-4 p-glass-hover">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="p-eyebrow">UKUPNO</div>
                        <div className="mt-1 text-white text-2xl font-extrabold tracking-tight">
                          {subtotalLabel}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setView("checkout")}
                        disabled={!canSubmit}
                        className={[
                          BTN_SUCCESS,
                          "h-11 px-6 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100",
                        ].join(" ")}
                      >
                        Poruči
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoToMenu}
                      className={[BTN_NEUTRAL, "h-11 w-full text-sm font-extrabold"].join(" ")}
                    >
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