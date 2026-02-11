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
  "quattro formaggi": "quattro.webp",
  "don pesto": "pesto.webp",
  "don pamidoro": "pomodoro.webp",

  // pica
  "coca cola": "coca-cola.webp",
  "coca-cola": "coca-cola.webp",
  "coca zero": "coca-zero.webp",
  "coca-zero": "coca-zero.webp",

  // sosevi
  "garlik": "garlik.webp",
  "kecap": "kecap.webp",
  "kečap": "kecap.webp",
  "majonez": "majonez.webp",
  "pelat": "pelat.webp",
  "slatko ljuti": "slatko ljuti.webp",
  "ljuti sos": "ljuti sos.webp",

  // dodaci
  "krofne": "krofna.webp",
  "krofna": "krofna.webp",
  "ivice punjene sirom": "rub.webp",
  "ivice punjene sir": "rub.webp",
  "punjene ivice sirom": "rub.webp",
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
  return [...uniq];
}

function SmartCartImage(props: { image: string; name: string; alt: string }) {
  const [idx, setIdx] = useState(0);
  const candidates = useMemo(
    () => buildImageCandidates(props.image, props.name),
    [props.image, props.name]
  );

  useEffect(() => setIdx(0), [props.image, props.name]);

  const src = candidates[idx] ?? null;

  return (
    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/10 bg-white/5">
      {src ? (
        <img
          src={src}
          alt={props.alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
        />
      ) : (
        <div className="h-full w-full" />
      )}
    </div>
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
    addToCart,
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

  const [drinksCatalog, setDrinksCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string; category: string }[]
  >([]);
  const [hasDrinksControl, setHasDrinksControl] = useState(false);
  const [openDrinks, setOpenDrinks] = useState(false);

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

        // Drinks (pića) — dostupno samo u korpi (ne u meniju)
        const drinkRows = rows.filter((r) => isDrinkCategory(r.category ?? ""));
        const nextDrinks = drinkRows.map((r) => ({
          id: r.id,
          name: r.name,
          price: toSafeInt(r.price_eur_cents, 0),
          imageKey: r.name,
          category: r.category ?? "",
        }));

        setDrinksCatalog(nextDrinks);
        setHasDrinksControl(nextDrinks.length > 0);

        setSaucesCatalog(nextSauces);
        setAddonsCatalog(nextAddons);
        setHasSaucesControl(shouldShowSaucesControl);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
        setSaucesCatalog([]);
        setHasSaucesControl(false);
        setDrinksCatalog([]);
        setHasDrinksControl(false);
        setOpenDrinks(false);
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
      setOpenDrinks(false);
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
          category: i.category,
          quantity: i.quantity,
          size: (i as any).size ?? null,
          base_price: (i as any).basePrice ?? i.price,
          note: (i as any).note ?? "",
          addons: Array.isArray((i as any).addons)
            ? (i as any).addons.map((a: any) => ({
                id: a.id,
                name: a.name,
                price: a.price,
                quantity: a.quantity,
              }))
            : [],
        })),

        total_eur_cents: derivedTotalPrice,
        note: orderNote.trim(),
      };

      const { orderId } = await createOrder(payload);

      setSuccessOrderId(orderId);
      setView("success");
      clearCart();
    } catch (err: any) {
      setSubmitError(err?.message ?? "Greška pri slanju porudžbine.");
    } finally {
      setSubmitting(false);
    }
  }

  const title = view === "cart" ? "Korpa" : view === "checkout" ? "Porudžbina" : "Uspješno";

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
  };

  const goToCheckout = () => {
    setSubmitError(null);
    setView("checkout");
  };

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
            <div className="pointer-events-none absolute -top-24 -left-28 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-40 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

            <div className="relative border-b border-white/10 px-4 sm:px-5 pb-3 sm:pb-4 pt-4 sm:pt-5">
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
                      className="p-btn-ghost h-10 sm:h-9 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                    >
                      Nazad
                    </button>
                  ) : null}

                  <button
                    onClick={closeCart}
                    className="p-btn-ghost h-10 sm:h-9 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                  >
                    Zatvori
                  </button>
                </div>
              </div>
            </div>

            <div className="relative h-[calc(100%-78px)] overflow-y-auto px-4 sm:px-5 pb-[210px]">
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
                    {/* Pića (samo u korpi) */}
                    {hasDrinksControl ? (
                      <div className="p-glass p-4 p-glass-hover">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="p-eyebrow">DODAJ</div>
                            <div className="mt-1 text-white/90 font-extrabold">Piće</div>
                            <div className="mt-1 text-xs text-white/55">
                              Sokovi i napici su dostupni samo u korpi.
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setOpenDrinks((v) => !v)}
                            className="p-btn-ghost h-10 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                          >
                            {openDrinks ? "Zatvori" : "Dodaj piće"}
                          </button>
                        </div>

                        {openDrinks && drinksCatalog.length > 0 ? (
                          <div className="mt-4 grid grid-cols-1 gap-3">
                            {drinksCatalog.map((d) => (
                              <div
                                key={d.id}
                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <SmartMiniAddonImage name={d.imageKey} />
                                  <div className="min-w-0">
                                    <div className="text-sm font-extrabold text-white/90 truncate">
                                      {d.name}
                                    </div>
                                    <div className="text-xs text-white/55">
                                      {formatEUR(d.price)}
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    addToCart(
                                      {
                                        id: d.id,
                                        name: d.name,
                                        price: d.price,
                                        image: "",
                                        description: "",
                                        category: d.category,
                                        quantity: 1,
                                        size: null,
                                        baseKey: d.name,
                                        menuItemId: d.id,
                                        basePrice: d.price,
                                        addons: [],
                                        note: "",
                                      },
                                      { openCart: false }
                                    )
                                  }
                                  className="p-btn-gold h-10 px-4 text-sm"
                                >
                                  Dodaj
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

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
                                  <p className="mt-1 text-xs text-white/55">
                                    {formatEUR(base)}{" "}
                                    {hasAddons ? (
                                      <span className="text-white/35">
                                        + {formatEUR(addonsTotal)} dodaci
                                      </span>
                                    ) : null}
                                  </p>
                                </div>

                                <button
                                  onClick={() => removeFromCart(item.id)}
                                  className="p-btn-ghost h-10 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                >
                                  Ukloni
                                </button>
                              </div>

                              <div className="mt-3 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => decrease(item.id)}
                                    className="p-btn-ghost h-10 w-10 text-lg font-black focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                  >
                                    −
                                  </button>
                                  <div className="w-10 text-center text-white/90 font-extrabold">
                                    {item.quantity}
                                  </div>
                                  <button
                                    onClick={() => increase(item.id)}
                                    className="p-btn-ghost h-10 w-10 text-lg font-black focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="text-white/90 font-extrabold">
                                  {formatEUR(getLineTotal(item))}
                                </div>
                              </div>

                              {canPickSize ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {variantsFromDb?.["33"] ? (
                                    <button
                                      onClick={() => changeSize(item.id, "33", variantsFromDb["33"] as PizzaVariant)}
                                      className={[
                                        "h-10 px-4 rounded-full border",
                                        (item as any).size === "33"
                                          ? "border-[#f2b400]/45 bg-[#f2b400]/10 text-white"
                                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                                        "transition text-sm font-extrabold",
                                      ].join(" ")}
                                    >
                                      33 cm
                                    </button>
                                  ) : null}

                                  {variantsFromDb?.["50"] ? (
                                    <button
                                      onClick={() => changeSize(item.id, "50", variantsFromDb["50"] as PizzaVariant)}
                                      className={[
                                        "h-10 px-4 rounded-full border",
                                        (item as any).size === "50"
                                          ? "border-[#f2b400]/45 bg-[#f2b400]/10 text-white"
                                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                                        "transition text-sm font-extrabold",
                                      ].join(" ")}
                                    >
                                      50 cm
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}

                              {!isDrink ? (
                                <div className="mt-4">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                                      Dodaci
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setOpenSaucesForItemId(openSaucesForItemId === item.id ? null : item.id)}
                                      className="p-btn-ghost h-9 px-4 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                    >
                                      {openSaucesForItemId === item.id ? "Zatvori" : "Dodaj soseve"}
                                    </button>
                                  </div>

                                  {openSaucesForItemId === item.id && saucesCatalog.length > 0 ? (
                                    <div className="mt-3 grid grid-cols-1 gap-2">
                                      {saucesCatalog.map((a) => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() =>
                                            addAddonToItem(item.id, {
                                              id: a.id,
                                              name: a.name,
                                              price: a.price,
                                            })
                                          }
                                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 hover:bg-black/35 transition"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <SmartMiniAddonImage name={a.imageKey} />
                                            <div className="min-w-0 text-left">
                                              <div className="text-sm font-extrabold text-white/90 truncate">
                                                {a.name}
                                              </div>
                                              <div className="text-xs text-white/55">
                                                {formatEUR(a.price)}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="text-xs font-extrabold text-[#f2b400]">
                                            + Dodaj
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}

                                  {addonsCatalog.length > 0 ? (
                                    <div className="mt-3 grid grid-cols-1 gap-2">
                                      {addonsCatalog.map((a) => (
                                        <button
                                          key={a.id}
                                          type="button"
                                          onClick={() =>
                                            addAddonToItem(item.id, {
                                              id: a.id,
                                              name: a.name,
                                              price: a.price,
                                            })
                                          }
                                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2 hover:bg-black/35 transition"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <SmartMiniAddonImage name={a.imageKey} />
                                            <div className="min-w-0 text-left">
                                              <div className="text-sm font-extrabold text-white/90 truncate">
                                                {a.name}
                                              </div>
                                              <div className="text-xs text-white/55">
                                                {formatEUR(a.price)}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="text-xs font-extrabold text-[#f2b400]">
                                            + Dodaj
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  ) : null}

                                  {hasAddons ? (
                                    <div className="mt-4 space-y-2">
                                      {addons.map((a: any) => (
                                        <div
                                          key={a.id}
                                          className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                                        >
                                          <div className="flex items-center gap-3 min-w-0">
                                            <SmartMiniAddonImage name={a.name} />
                                            <div className="min-w-0">
                                              <div className="text-sm font-extrabold text-white/90 truncate">
                                                {a.name}
                                              </div>
                                              <div className="text-xs text-white/55">
                                                {formatEUR(a.price)} × {a.quantity ?? 1}
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                              className="p-btn-ghost h-9 w-9 text-lg font-black focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                            >
                                              −
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => increaseAddonQuantity(item.id, a.id)}
                                              className="p-btn-ghost h-9 w-9 text-lg font-black focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                            >
                                              +
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => removeAddonFromItem(item.id, a.id)}
                                              className="p-btn-ghost h-9 px-3 text-xs font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                            >
                                              Ukloni
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  <div className="mt-4">
                                    <label className="text-xs uppercase tracking-[0.22em] text-white/45">
                                      Napomena (za ovu pizzu)
                                    </label>
                                    <textarea
                                      value={(item as any).note ?? ""}
                                      onChange={(e) => setItemNote(item.id, e.target.value)}
                                      className="p-textarea mt-2 h-20"
                                      placeholder="Npr. bez luka, extra pečeno…"
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

            <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4 sm:p-5 bg-black/50 backdrop-blur-md">
              {view === "cart" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white/70 text-sm">Ukupno</p>
                    <p className="text-white font-extrabold text-lg">{formatEUR(derivedTotalPrice)}</p>
                  </div>

                  <button onClick={goToCheckout} className="p-btn-gold w-full h-12 text-sm">
                    Nastavi na porudžbinu
                  </button>

                  <button
                    onClick={handleGoToMenu}
                    className="p-btn-ghost w-full h-12 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                  >
                    Nazad na meni
                  </button>
                </div>
              ) : null}

              {view === "checkout" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-white/70 text-sm">Ukupno</p>
                    <p className="text-white font-extrabold text-lg">{formatEUR(derivedTotalPrice)}</p>
                  </div>

                  <button
                    onClick={backToCart}
                    className="p-btn-ghost w-full h-12 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                  >
                    Nazad na korpu
                  </button>
                </div>
              ) : null}

              {view === "success" ? (
                <div className="space-y-3">
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
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
