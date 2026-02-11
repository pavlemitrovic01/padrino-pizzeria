import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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

  // FIX: brend + ukus (Bravo ...)
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
    .replace(/\b\d+(?:[\.,]\d+)?\s*(?:l|ml|cl)\b/gi, " ")
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

  // sigurni fallback
  uniq.add("/menu/padrino.webp");
  uniq.add("/menu/padrino.png");

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
  const [idx, setIdx] = useState(0);

  const candidates = useMemo(() => {
    const fromName = buildImageCandidates(null, props.name);
    const uniq = new Set<string>(fromName);
    uniq.add("/menu/padrino.webp");
    uniq.add("/menu/padrino.png");
    return [...uniq];
  }, [props.name]);

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
    isOpen,
    items,
    closeCart,
    removeFromCart,
    increaseQty,
    decreaseQty,
    addAddonToItem,
    removeAddonFromItem,
    increaseAddonQuantity,
    decreaseAddonQuantity,
    clearCart,
    setItemNote,
    setItemSize,
    addToCart,
  } = useCart();

  const [view, setView] = useState<DrawerView>("cart");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successOrderId, setSuccessOrderId] = useState<string | null>(null);

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
  const [openDrinks, setOpenDrinks] = useState(false);

  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] = useState<PizzaVariantsMap>({});

  const totalItems = useMemo(() => {
    return items.reduce((sum, it) => sum + (it.quantity ?? 0), 0);
  }, [items]);

  const subtotalCents = useMemo(() => {
    let total = 0;

    for (const it of items) {
      const qty = it.quantity ?? 0;
      if (qty <= 0) continue;

      const isDrink = isDrinkCategory(it.category ?? "");
      const addons = isDrink ? [] : (it.addons ?? []);
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

  const backToCart = () => {
    setView("cart");
    setSubmitError(null);
    setSubmitting(false);
  };

  const handleGoToMenu = () => {
    closeCart();
    const el = document.getElementById("meni") || document.getElementById("menu");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

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

        // Addons + Sauces
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

        // Drinks (pića) — dostupno samo u korpi
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
        setOpenDrinks(false);
        setPizzaVariantsByBaseKey({});
      }
    }

    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmitOrder(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreateOrderPayload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        total_price: subtotalCents,
        total_items: totalItems,
        note: orderNote.trim() || null,
        items: items.map((it) => {
          const isDrink = isDrinkCategory(it.category ?? "");
          const addons = isDrink ? [] : (it.addons ?? []);

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
      setSuccessOrderId(res.orderId ?? null);

      clearCart();
      setView("success");
    } catch (err: any) {
      setSubmitError(String(err?.message ?? "Došlo je do greške."));
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const subtotalLabel = formatEUR(subtotalCents);

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
          <div className="relative h-full">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-white/10 bg-black/30 px-4 sm:px-5">
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
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Telefon
                        </label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="p-input"
                          placeholder="+382..."
                          autoComplete="tel"
                        />
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm font-semibold text-white/80">
                          Adresa
                        </label>
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
                          className="p-input min-h-[90px] resize-none"
                          placeholder="Npr. pozovi kad si ispred..."
                        />
                      </div>
                    </div>

                    {submitError ? (
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                        {submitError}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={submitting || !canSubmit}
                      className="p-btn-gold w-full h-12 text-sm disabled:opacity-50"
                    >
                      {submitting ? "Šaljem..." : `Potvrdi porudžbinu • ${subtotalLabel}`}
                    </button>
                  </form>
                </div>
              ) : null}

              {view === "cart" ? (
                <div className="mt-5 space-y-4">
                  {items.length === 0 ? (
                    <div className="p-glass p-5 p-glass-hover text-center">
                      <p className="text-white font-extrabold text-lg">Korpa je prazna</p>
                      <p className="mt-2 text-sm text-white/70">
                        Dodaj picu iz menija, pa se vrati ovdje.
                      </p>

                      <button onClick={handleGoToMenu} className="mt-5 p-btn-gold w-full h-12 text-sm">
                        Nazad na meni
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item) => {
                        const hideAddons = isDrinkCategory(item.category ?? "");
                        const lineTotal =
                          (toSafeInt(item.basePrice, toSafeInt(item.price, 0)) +
                            (hideAddons ? 0 : toSafeInt(getPerItemAddonsTotal(item.addons ?? []) * 100, 0))) *
                          (item.quantity ?? 1);

                        return (
                          <div key={item.id} className="p-glass p-4 p-glass-hover">
                            <div className="flex gap-3">
                              <SmartCartImage image={item.image} name={item.name} alt={item.name} />

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-white font-extrabold">{item.name}</div>
                                    <div className="mt-1 text-sm text-white/70">
                                      {formatEUR(lineTotal)}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(item.id)}
                                    className="p-btn-ghost h-9 px-3 text-xs font-extrabold"
                                  >
                                    Ukloni
                                  </button>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => decreaseQty(item.id)}
                                      className="p-btn-ghost h-9 w-9 text-sm font-extrabold"
                                    >
                                      –
                                    </button>
                                    <div className="min-w-[28px] text-center text-sm font-extrabold text-white/85">
                                      {item.quantity ?? 1}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => increaseQty(item.id)}
                                      className="p-btn-ghost h-9 w-9 text-sm font-extrabold"
                                    >
                                      +
                                    </button>
                                  </div>

                                  {item.size ? (
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setItemSize(item.id, "33")}
                                        className={
                                          item.size === "33"
                                            ? "p-btn-gold h-9 px-3 text-xs font-extrabold"
                                            : "p-btn-ghost h-9 px-3 text-xs font-extrabold"
                                        }
                                      >
                                        33cm
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setItemSize(item.id, "50")}
                                        className={
                                          item.size === "50"
                                            ? "p-btn-gold h-9 px-3 text-xs font-extrabold"
                                            : "p-btn-ghost h-9 px-3 text-xs font-extrabold"
                                        }
                                      >
                                        50cm
                                      </button>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="mt-3">
                                  <textarea
                                    value={item.note ?? ""}
                                    onChange={(e) => setItemNote(item.id, e.target.value)}
                                    className="p-input min-h-[70px] resize-none"
                                    placeholder="Napomena (npr. bez maslina)"
                                  />
                                </div>

                                {!hideAddons ? (
                                  <>
                                    {item.addons?.length ? (
                                      <div className="mt-3 space-y-2">
                                        {item.addons.map((a: CartAddon) => (
                                          <div
                                            key={a.id}
                                            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                                          >
                                            <div className="min-w-0">
                                              <div className="truncate text-xs font-extrabold text-white/80">
                                                {a.name}
                                              </div>
                                              <div className="text-[11px] text-white/50">
                                                {formatEUR(toSafeInt(a.price, 0))}
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                                className="p-btn-ghost h-8 w-8 text-sm font-extrabold"
                                              >
                                                –
                                              </button>
                                              <div className="min-w-[22px] text-center text-xs font-extrabold text-white/80">
                                                {a.quantity ?? 1}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => increaseAddonQuantity(item.id, a.id)}
                                                className="p-btn-ghost h-8 w-8 text-sm font-extrabold"
                                              >
                                                +
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => removeAddonFromItem(item.id, a.id)}
                                                className="p-btn-ghost h-8 px-2 text-[11px] font-extrabold"
                                              >
                                                X
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : null}

                                    {addonsCatalog.length > 0 ? (
                                      <div className="mt-4">
                                        <div className="p-eyebrow">DODACI</div>
                                        <div className="mt-3 grid grid-cols-1 gap-3">
                                          {addonsCatalog.map((a) => (
                                            <div
                                              key={a.id}
                                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                                            >
                                              <div className="flex items-center gap-3 min-w-0">
                                                <SmartMiniAddonImage name={a.imageKey} />
                                                <div className="min-w-0">
                                                  <div className="truncate text-sm font-extrabold text-white/90">
                                                    {a.name}
                                                  </div>
                                                  <div className="text-xs text-white/55">
                                                    {formatEUR(a.price)}
                                                  </div>
                                                </div>
                                              </div>

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  addAddonToItem(item.id, {
                                                    id: a.id,
                                                    name: a.name,
                                                    price: a.price,
                                                    quantity: 1,
                                                  })
                                                }
                                                className="p-btn-ghost h-9 px-3 text-xs font-extrabold"
                                              >
                                                Dodaj
                                              </button>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : null}

                                    {saucesCatalog.length > 0 ? (
                                      <div className="mt-4">
                                        <div className="flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <div className="p-eyebrow">DODAJ</div>
                                            <div className="mt-1 text-white/90 font-extrabold">Sosevi</div>
                                          </div>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              setOpenSaucesForItemId((v) => (v === item.id ? null : item.id))
                                            }
                                            className="p-btn-ghost h-10 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
                                          >
                                            {openSaucesForItemId === item.id ? "Zatvori" : "Dodaj soseve"}
                                          </button>
                                        </div>

                                        {openSaucesForItemId === item.id ? (
                                          <div className="mt-4 grid grid-cols-1 gap-3">
                                            {saucesCatalog.map((s) => (
                                              <div
                                                key={s.id}
                                                className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                                              >
                                                <div className="flex items-center gap-3 min-w-0">
                                                  <SmartMiniAddonImage name={s.imageKey} />
                                                  <div className="min-w-0">
                                                    <div className="truncate text-sm font-extrabold text-white/90">
                                                      {s.name}
                                                    </div>
                                                    <div className="text-xs text-white/55">
                                                      {formatEUR(s.price)}
                                                    </div>
                                                  </div>
                                                </div>

                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    addAddonToItem(item.id, {
                                                      id: s.id,
                                                      name: s.name,
                                                      price: s.price,
                                                      quantity: 1,
                                                    })
                                                  }
                                                  className="p-btn-ghost h-9 px-3 text-xs font-extrabold"
                                                >
                                                  Dodaj
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Bottom bar */}
            {view === "cart" && items.length > 0 ? (
              <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-black/40 backdrop-blur-xl px-4 sm:px-5 py-4">
                {/* Drinks */}
                {drinksCatalog.length > 0 ? (
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

                    {openDrinks ? (
                      // ✅ SCROLL unutar liste pića (da ne moraš skrolovati cijelu korpu)
                      <div
                        className="mt-4 max-h-[50vh] overflow-y-auto overscroll-contain pr-1 touch-pan-y"
                        style={{ WebkitOverflowScrolling: "touch" }}
                      >
                        <div className="grid grid-cols-1 gap-3">
                          {drinksCatalog.map((d) => (
                            <div
                              key={d.id}
                              className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <SmartMiniAddonImage name={d.imageKey} />
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-extrabold text-white/90">
                                    {d.name}
                                  </div>
                                  <div className="text-xs text-white/55">{formatEUR(d.price)}</div>
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
                                      image:
                                        buildImageCandidates(null, d.imageKey)[0] ?? "/menu/padrino.webp",
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
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 p-glass p-4 p-glass-hover">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="p-eyebrow">UKUPNO</div>
                      <div className="mt-1 text-white/90 text-xl font-extrabold">{subtotalLabel}</div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setView("checkout")}
                      disabled={!canSubmit}
                      className="p-btn-gold h-11 px-5 text-sm font-extrabold disabled:opacity-50"
                    >
                      Nastavi
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoToMenu}
                    className="mt-3 p-btn-ghost h-11 w-full text-sm font-extrabold"
                  >
                    Nazad na meni
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
