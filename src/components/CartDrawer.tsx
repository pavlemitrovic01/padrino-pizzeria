import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon, PizzaSize, PizzaVariant } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import { createOrder } from "../lib/createOrder";

type MenuItemData = {
  id: string;
  name: string;
  price_eur_cents: number | null;
  price: number | null;
  category: string;
};

type DrawerView = "cart" | "checkout" | "success";

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
  ];

  return keywords.some((k) => n.includes(normalizeText(k)));
}

function getPerItemAddonsTotal(addons: CartAddon[]) {
  return addons.reduce((sum, a) => sum + a.price * (a.quantity ?? 1), 0);
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

// ✅ tvoje realne slike u public/menu
const NAME_TO_FILE: Record<string, string> = {
  // pizze / izuzeci
  "quattro formaggi": "quattro.png",
  "don pesto": "pesto.png",
  "don pamidoro": "pomodoro.png",

  // pica
  "coca cola": "coca-cola.png",
  "coca-cola": "coca-cola.png",
  "coca zero": "coca-zero.png",
  "coca-zero": "coca-zero.png",

  // sosevi
  "garlik": "garlik.png",
  "kecap": "kecap.png",
  "kečap": "kecap.png",
  "majonez": "majonez.png",
  "pelat": "pelat.png",
  "slatko ljuti": "slatko ljuti.png",
  "ljuti sos": "ljuti sos.png",

  // dodaci
  "krofne": "krofna.png",
  "krofna": "krofna.png",
  "ivice punjene sirom": "rub.png",
  "ivice punjene sir": "rub.png",
  "punjene ivice sirom": "rub.png",
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
  const n = normalizeText(raw);
  if (!n) return [];

  const mapped = NAME_TO_FILE[n];
  if (mapped) return buildFileCandidatesFromFilename(mapped);

  const withDash = n.replaceAll(" ", "-");
  const withSpace = n;
  const noDash = withDash.replaceAll("-", "");

  const candidates = [`${withDash}.png`, `${withSpace}.png`, `${noDash}.png`];

  const djToD = withDash.replaceAll("dj", "d");
  if (djToD !== withDash) candidates.push(`${djToD}.png`);

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
  return [...uniq];
}

function SmartCartImage(props: { image?: string | null; name: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(() => buildImageCandidates(props.image ?? null, props.name), [
    props.image,
    props.name,
  ]);

  useEffect(() => setIdx(0), [props.image, props.name]);

  const src = candidates[idx] ?? null;

  if (!src) {
    return (
      <div
        className="h-16 w-16 rounded-2xl bg-white/5 ring-1 ring-white/10"
        aria-hidden="true"
      />
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
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(() => buildImageCandidates(null, props.name), [props.name]);

  useEffect(() => setIdx(0), [props.name]);

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
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    changeSize,
    addAddonToItem,
    increaseAddonQuantity,
    decreaseAddonQuantity,
    removeAddonFromItem,
    setItemNote,
    clearCart,
  } = useCart();

  const [view, setView] = useState<DrawerView>("cart");
  const [addonsCatalog, setAddonsCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);
  const [saucesCatalog, setSaucesCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);
  const [hasSaucesControl, setHasSaucesControl] = useState(false);
  const [openSaucesForItemId, setOpenSaucesForItemId] = useState<string | null>(null);

  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] = useState<PizzaVariantsMap>({});

  // Checkout state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

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

        // Pizza variants (33/50) map by base name
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

        // Addons + sauces
        const dodaciRows = rows.filter((r) => normalizeCategory(r.category) === "dodaci");
        const sauceCategoryRows = rows.filter((r) => isSauceCategory(r.category));
        const sauceFromDodaciRows = dodaciRows.filter((r) => isSauceItemName(r.name));
        const hasPlaceholder = dodaciRows.some((r) => isSaucesPlaceholder(r.name));

        const saucesSource = sauceCategoryRows.length > 0 ? sauceCategoryRows : sauceFromDodaciRows;

        const nextSauces = saucesSource.map((r) => ({
          id: r.id,
          name: r.name,
          price: toSafeInt(r.price_eur_cents, 0),
          imageKey: r.name,
        }));

        const shouldShowSaucesControl = hasPlaceholder || nextSauces.length > 0;

        const nextAddons = dodaciRows
          .filter((r) => {
            if (isSaucesPlaceholder(r.name)) return false;
            if (nextSauces.length > 0) {
              if (saucesSource === sauceFromDodaciRows && isSauceItemName(r.name)) return false;
            }
            return true;
          })
          .map((r) => ({
            id: r.id,
            name: r.name,
            price: toSafeInt(r.price_eur_cents, 0),
            imageKey: r.name,
          }));

        setSaucesCatalog(nextSauces);
        setAddonsCatalog(nextAddons);
        setHasSaucesControl(shouldShowSaucesControl);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
        setSaucesCatalog([]);
        setHasSaucesControl(false);
        setPizzaVariantsByBaseKey({});
      }
    }

    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setView("cart");
      setSubmitting(false);
      setSubmitError(null);
      setSuccessOrderId(null);
      setOpenSaucesForItemId(null);
    }
  }, [isOpen]);

  const handleGoToMenu = () => {
    closeCart();
    const el = document.getElementById("meni") || document.getElementById("menu");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalItems = useMemo(() => items.reduce((acc, i) => acc + (i.quantity || 0), 0), [items]);

  const getLineTotal = (item: any) => {
    const hideAddons = isDrinkCategory(item.category ?? "");
    const selectedAddons = item.addons ?? [];
    const addonsTotal = hideAddons ? 0 : getPerItemAddonsTotal(selectedAddons);

    const base =
      typeof item.basePrice === "number" && Number.isFinite(item.basePrice)
        ? item.basePrice
        : Math.max(0, (item.price ?? 0) - addonsTotal);

    return (base + addonsTotal) * (item.quantity || 1);
  };

  const derivedTotalPrice = useMemo(
    () => items.reduce((sum, item) => sum + getLineTotal(item), 0),
    [items]
  );

  const canSubmit = useMemo(() => {
    if (!name.trim() || !phone.trim() || !address.trim()) return false;
    if (items.length === 0) return false;
    if (totalItems <= 0) return false;
    if (derivedTotalPrice <= 0) return false;
    return true;
  }, [name, phone, address, items.length, totalItems, derivedTotalPrice]);

  async function onSubmitOrder(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    try {
      setSubmitting(true);

      const payload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),

        items: items.map((i) => ({
          cart_id: String(i.id),
          menu_item_id: (i as any).menuItemId ?? null,
          name: i.name,
          size: i.size ?? null,
          quantity: i.quantity || 1,
          base_price: typeof (i as any).basePrice === "number" ? (i as any).basePrice : null,
          price_per_item: typeof (i as any).price === "number" ? (i as any).price : 0,
          addons: Array.isArray((i as any).addons) ? (i as any).addons : [],
          note: (i as any).note ? String((i as any).note) : null,
          image: (i as any).image,
          category: (i as any).category,
        })),

        total_price: derivedTotalPrice,
        total_items: totalItems,
        note: orderNote.trim() || null,
      };

      const result = await createOrder(payload as any);

      clearCart();
      setSuccessOrderId(String(result.orderId));
      setView("success");
    } catch (err: any) {
      setSubmitError(err?.message || "Došlo je do greške pri slanju porudžbine.");
    } finally {
      setSubmitting(false);
    }
  }

  const openCheckout = () => {
    setSubmitError(null);
    setSuccessOrderId(null);
    setView("checkout");
  };

  const backToCart = () => {
    setSubmitError(null);
    setSubmitting(false);
    setView("cart");
  };

  const title = view === "cart" ? "Korpa" : view === "checkout" ? "Porudžbina" : "Uspješno";

  function AddonBubbleButton(props: {
    name: string;
    price: number;
    onClick: () => void;
    variant?: "sauce" | "addon";
  }) {
    const isSauce = props.variant === "sauce";

    return (
      <button
        className={[
          "group relative overflow-hidden",
          "rounded-2xl border border-white/12",
          "bg-black/22 hover:bg-black/28 hover:border-white/20 transition",
          "shadow-[0_12px_28px_rgba(0,0,0,0.35)]",
          "active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25",
          "px-3 py-3",
          "flex items-center justify-between gap-3",
        ].join(" ")}
        onClick={props.onClick}
      >
        {/* ambient + image-tint bg */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-black/45" />
          <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-[#f2b400]/10 blur-3xl" />
          <div className="absolute -left-8 -bottom-10 h-28 w-28 rounded-full bg-white/6 blur-3xl" />

          {/* background image (soft) */}
          <div className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-[0.16] blur-[1px] saturate-150">
            <SmartMiniAddonImage
              name={props.name}
              className="h-20 w-20 object-cover rounded-[22px] scale-[1.12]"
            />
          </div>
        </div>

        <div className="relative min-w-0">
          <div className="font-extrabold text-white truncate text-[12px] leading-tight">
            {props.name}
          </div>
          <div className="mt-0.5 text-white/65 text-[11px]">{formatEUR(props.price)}</div>
        </div>

        <div className="relative shrink-0">
          {/* bigger thumb */}
          <div className="h-12 w-12 rounded-2xl bg-white/6 ring-1 ring-white/12 overflow-hidden transition group-hover:scale-[1.02]">
            <SmartMiniAddonImage name={props.name} className="h-12 w-12 object-cover" />
          </div>

          {isSauce ? (
            <div className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-[#f2b400] text-black text-[10px] font-black flex items-center justify-center ring-2 ring-black/45 shadow-[0_10px_20px_rgba(0,0,0,0.35)]">
              S
            </div>
          ) : null}
        </div>
      </button>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={closeCart}
        >
          <motion.aside
            className={[
              "absolute right-0 top-0 h-full w-full max-w-md",
              "p-glass-strong",
              "overflow-hidden",
            ].join(" ")}
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ambience */}
            <div className="pointer-events-none absolute -top-24 -left-28 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

            {/* HEADER */}
            <div className="relative border-b border-white/10 px-5 pb-4 pt-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="p-eyebrow">PADRINO</div>
                  <h3 className="mt-2 text-xl font-extrabold text-white/92">{title}</h3>
                  {view === "cart" ? (
                    <div className="mt-1 text-xs text-white/55">
                      Stavki: <span className="text-white/80 font-semibold">{totalItems}</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {view !== "cart" ? (
                    <button
                      onClick={backToCart}
                      className="p-btn-ghost h-9 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                    >
                      Nazad
                    </button>
                  ) : null}

                  <button
                    onClick={closeCart}
                    className="p-btn-ghost h-9 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                  >
                    Zatvori
                  </button>
                </div>
              </div>
            </div>

            {/* BODY */}
            <div className="relative h-[calc(100%-78px)] overflow-y-auto px-5 pb-[170px]">
              {/* SUCCESS */}
              {view === "success" ? (
                <div className="mt-5 p-glass p-5 p-glass-hover">
                  <p className="text-white font-extrabold text-lg">Porudžbina je poslata ✅</p>
                  <p className="mt-2 text-sm text-white/70">
                    {successOrderId ? `ID porudžbine: ${successOrderId}` : "Porudžbina je evidentirana."}
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3">
                    <button onClick={handleGoToMenu} className="p-btn-gold w-full h-12 text-sm">
                      Nazad na meni
                    </button>

                    <button
                      onClick={closeCart}
                      className="p-btn-ghost w-full h-12 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                    >
                      Zatvori
                    </button>
                  </div>
                </div>
              ) : null}

              {/* CHECKOUT */}
              {view === "checkout" ? (
                <div className="mt-5 space-y-5">
                  <form onSubmit={onSubmitOrder} className="space-y-4">
                    <div className="p-glass p-4 p-glass-hover">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Ime i prezime
                        </label>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="p-input"
                          placeholder="Npr. Pavle Mitrović"
                          autoComplete="name"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Telefon</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="p-input"
                          placeholder="Npr. 06X XXX XXX"
                          autoComplete="tel"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">Adresa</label>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="p-input"
                          placeholder="Ulica i broj"
                          autoComplete="street-address"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Napomena (opciono)
                        </label>
                        <textarea
                          value={orderNote}
                          onChange={(e) => setOrderNote(e.target.value)}
                          className="p-textarea h-24"
                          placeholder="Npr. bez luka, pozvati prije dolaska…"
                        />
                      </div>
                    </div>

                    <div className="p-glass p-4 p-glass-hover">
                      <div className="flex items-center justify-between">
                        <p className="text-white/70 text-sm">Ukupno</p>
                        <p className="text-white font-extrabold text-lg">{formatEUR(derivedTotalPrice)}</p>
                      </div>

                      {submitError ? (
                        <div className="mt-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">
                          {submitError}
                        </div>
                      ) : null}

                      <button
                        type="submit"
                        disabled={!canSubmit || submitting}
                        className={[
                          "mt-4 w-full h-12",
                          "p-btn-gold",
                          !canSubmit || submitting ? "opacity-60 pointer-events-none" : "",
                        ].join(" ")}
                      >
                        {submitting ? "Šaljem…" : "Potvrdi porudžbinu"}
                      </button>

                      {!canSubmit && !submitting ? (
                        <div className="mt-2 text-xs text-white/50">
                          Popuni ime/telefon/adresu i provjeri obračun.
                        </div>
                      ) : null}
                    </div>
                  </form>
                </div>
              ) : null}

              {/* CART */}
              {view === "cart" ? (
                items.length === 0 ? (
                  <div className="mt-10 text-center">
                    <p className="text-white/70">Korpa je prazna.</p>
                    <button onClick={handleGoToMenu} className="p-btn-gold mt-4 h-11 px-5 text-sm">
                      Idi na meni
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {items.map((item) => {
                      const isDrink = isDrinkCategory((item as any).category ?? "");
                      const baseKey = (item as any).baseKey ?? item.name;

                      const variantsFromDb = pizzaVariantsByBaseKey[baseKey];
                      const canPickSize =
                        !!variantsFromDb && (!!variantsFromDb["33"] || !!variantsFromDb["50"]);

                      const addons = Array.isArray((item as any).addons) ? (item as any).addons : [];
                      const hasAddons = !isDrink && addons.length > 0;

                      const hideAddons = isDrink;
                      const addonsTotal = hideAddons ? 0 : getPerItemAddonsTotal(addons);

                      const base =
                        typeof (item as any).basePrice === "number" &&
                        Number.isFinite((item as any).basePrice)
                          ? (item as any).basePrice
                          : Math.max(0, (item as any).price - addonsTotal);

                      return (
                        <div key={item.id} className="p-glass p-4 p-glass-hover">
                          <div className="flex gap-3">
                            <SmartCartImage image={(item as any).image} name={item.name} alt={item.name} />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-white font-extrabold leading-tight truncate">
                                    {item.name}
                                  </p>

                                  <div className="mt-1 text-xs text-white/60">
                                    {(item as any).size ? (
                                      <span className="text-white/70 font-semibold">{(item as any).size} cm</span>
                                    ) : null}
                                    {(item as any).size ? <span className="mx-2 text-white/25">•</span> : null}
                                    <span>
                                      Osnova: <span className="text-white/80 font-semibold">{formatEUR(base)}</span>
                                    </span>
                                    {!hideAddons && addonsTotal > 0 ? (
                                      <>
                                        <span className="mx-2 text-white/25">•</span>
                                        <span>
                                          Dodaci:{" "}
                                          <span className="text-white/80 font-semibold">
                                            {formatEUR(addonsTotal)}
                                          </span>
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>

                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="p-btn-ghost h-8 px-3 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                >
                                  Ukloni
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    className="h-9 w-9 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                                    onClick={() => decrease(item.id)}
                                    aria-label="Smanji"
                                  >
                                    −
                                  </button>
                                  <span className="text-white/85 text-sm font-extrabold w-6 text-center">
                                    {(item as any).quantity}
                                  </span>
                                  <button
                                    className="h-9 w-9 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                                    onClick={() => increase(item.id)}
                                    aria-label="Povećaj"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-sm font-extrabold text-white">
                                  {formatEUR(getLineTotal(item))}
                                </div>
                              </div>

                              {canPickSize ? (
                                <div className="mt-3 flex items-center gap-2">
                                  <button
                                    className={[
                                      "h-9 px-4 rounded-full text-xs font-extrabold border transition",
                                      (item as any).size === "33"
                                        ? "bg-[#f2b400] text-black border-[#f2b400]"
                                        : "bg-white/10 text-white/85 border-white/10 hover:bg-white/15",
                                    ].join(" ")}
                                    onClick={() => {
                                      const next = variantsFromDb?.["33"];
                                      if (!next) return;
                                      changeSize(item.id, "33", next);
                                    }}
                                  >
                                    33 cm
                                  </button>

                                  <button
                                    className={[
                                      "h-9 px-4 rounded-full text-xs font-extrabold border transition",
                                      (item as any).size === "50"
                                        ? "bg-[#f2b400] text-black border-[#f2b400]"
                                        : "bg-white/10 text-white/85 border-white/10 hover:bg-white/15",
                                    ].join(" ")}
                                    onClick={() => {
                                      const next = variantsFromDb?.["50"];
                                      if (!next) return;
                                      changeSize(item.id, "50", next);
                                    }}
                                  >
                                    50 cm
                                  </button>
                                </div>
                              ) : null}

                              {!isDrink ? (
                                <div className="mt-4 space-y-3">
                                  {hasSaucesControl ? (
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-xs font-extrabold text-white/80">Sosevi</p>
                                      <button
                                        className="p-btn-ghost h-9 px-4 text-xs font-extrabold"
                                        onClick={() =>
                                          setOpenSaucesForItemId(openSaucesForItemId === item.id ? null : item.id)
                                        }
                                      >
                                        {openSaucesForItemId === item.id ? "Zatvori" : "Dodaj soseve"}
                                      </button>
                                    </div>
                                  ) : null}

                                  {openSaucesForItemId === item.id && saucesCatalog.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-2">
                                      {saucesCatalog.map((a) => (
                                        <AddonBubbleButton
                                          key={a.id}
                                          name={a.name}
                                          price={a.price}
                                          variant="sauce"
                                          onClick={() => addAddonToItem(item.id, a as any)}
                                        />
                                      ))}
                                    </div>
                                  ) : null}

                                  {addonsCatalog.length > 0 ? (
                                    <div>
                                      <p className="text-xs font-extrabold text-white/80 mb-2">Dodaci</p>
                                      <div className="grid grid-cols-2 gap-2">
                                        {addonsCatalog.map((a) => (
                                          <AddonBubbleButton
                                            key={a.id}
                                            name={a.name}
                                            price={a.price}
                                            variant="addon"
                                            onClick={() => addAddonToItem(item.id, a as any)}
                                          />
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  {hasAddons ? (
                                    <div className="pt-1">
                                      <p className="text-xs font-extrabold text-white/80 mb-2">Izabrano</p>
                                      <div className="space-y-2">
                                        {addons.map((a: any) => (
                                          <div
                                            key={a.id}
                                            className="group relative overflow-hidden flex items-center justify-between gap-2 rounded-2xl border border-white/12 bg-black/22 px-3 py-2"
                                          >
                                            {/* soft bg image */}
                                            <div className="pointer-events-none absolute inset-0">
                                              <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-black/45" />
                                              <div className="absolute -right-4 top-1/2 -translate-y-1/2 opacity-[0.14] blur-[1px] saturate-150">
                                                <SmartMiniAddonImage
                                                  name={a.name}
                                                  className="h-20 w-20 object-cover rounded-[22px] scale-[1.12]"
                                                />
                                              </div>
                                            </div>

                                            <div className="relative min-w-0 flex items-center gap-3">
                                              <div className="h-12 w-12 rounded-2xl bg-white/6 ring-1 ring-white/12 overflow-hidden shrink-0">
                                                <SmartMiniAddonImage name={a.name} className="h-12 w-12 object-cover" />
                                              </div>

                                              <div className="min-w-0">
                                                <div className="text-[12px] font-extrabold text-white truncate">
                                                  {a.name}
                                                </div>
                                                <div className="text-[11px] text-white/65">
                                                  {formatEUR(a.price)} × {a.quantity}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="relative flex items-center gap-1">
                                              <button
                                                className="h-8 w-8 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                                                onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                                aria-label="Smanji dodatak"
                                              >
                                                −
                                              </button>
                                              <button
                                                className="h-8 w-8 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                                                onClick={() => increaseAddonQuantity(item.id, a.id)}
                                                aria-label="Povećaj dodatak"
                                              >
                                                +
                                              </button>
                                              <button
                                                className="h-8 w-8 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                                                onClick={() => removeAddonFromItem(item.id, a.id)}
                                                aria-label="Ukloni dodatak"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="pt-1">
                                    <p className="text-xs font-extrabold text-white/80 mb-2">Napomena za stavku</p>
                                    <textarea
                                      value={(item as any).note ?? ""}
                                      onChange={(e) => setItemNote(item.id, e.target.value)}
                                      className="w-full rounded-2xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 focus:ring-2 focus:ring-[#f2b400]/35"
                                      placeholder="Npr. bez luka, dobro zapečeno..."
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : null}
            </div>

            {/* FOOTER CTA */}
            {view === "cart" ? (
              <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/35 backdrop-blur-md px-5 pb-[max(18px,env(safe-area-inset-bottom))] pt-4">
                <div className="flex items-center justify-between">
                  <p className="text-white/70 text-sm">Ukupno</p>
                  <p className="text-white font-extrabold text-lg">{formatEUR(derivedTotalPrice)}</p>
                </div>

                {/* ✅ ovde je fix: openCheckout se koristi */}
                <button onClick={openCheckout} className="p-btn-gold mt-3 w-full h-12 text-sm">
                  Poruči
                </button>

                <button
                  onClick={handleGoToMenu}
                  className="p-btn-ghost mt-2 w-full h-12 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                >
                  Nazad na meni
                </button>
              </div>
            ) : null}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
