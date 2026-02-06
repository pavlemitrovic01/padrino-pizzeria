import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon, PizzaSize, PizzaVariant } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";

type MenuItemData = {
  id: string;
  name: string;
  // EUR cente (int) iz baze
  price_eur_cents: number | null;
  // legacy (ne koristimo za račun)
  price: number | null;
  category: string;
};

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function normalizeCategory(value: string) {
  return normalizeText(value);
}

function isDrinkCategory(category: string) {
  const c = normalizeCategory(category);
  // "Pića" -> "pica" nakon normalizacije
  return (
    c.includes("pica") || // Pića
    c.includes("pice") || // fallback ako negdje već postoji bez dijakritike
    c.includes("napici") || // sigurnosno (ako koristiš "Napitci/Napici")
    c.includes("napitci")
  );
}

function isSauceCategory(category: string) {
  const c = normalizeCategory(category);
  return c === "sosevi" || c === "sosovi" || c === "sos";
}

function hasEurPrice(row: MenuItemData) {
  const n =
    typeof row.price_eur_cents === "number"
      ? row.price_eur_cents
      : Number(row.price_eur_cents);
  return Number.isFinite(n);
}

/**
 * Placeholder stavka (ono što trenutno imaš u bazi kao "Sosevi" u kategoriji "dodaci")
 * NE SME direktno da se dodaje u korpu, već služi kao dugme koje otvara izbor.
 */
function isSaucesPlaceholder(name: string) {
  const n = normalizeText(name);
  return n === "sosevi" || n === "sosovi" || n === "sos";
}

/**
 * Prepoznavanje "pravih" sos stavki kad su i one u category="dodaci".
 * Radi preko imena (najstabilnije bez promene šeme).
 */
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
  // dovoljno stabilno: u tvojoj bazi pice imaju "33 cm" / "50 cm" u name-u
  return nm.includes("33 cm") || nm.includes("50 cm") || cat.includes("pizza");
}

type PizzaVariantsMap = Record<string, Partial<Record<PizzaSize, PizzaVariant>>>;

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
  } = useCart();

  const [addonsCatalog, setAddonsCatalog] = useState<
    { id: string; name: string; price: number }[]
  >([]);
  const [saucesCatalog, setSaucesCatalog] = useState<
    { id: string; name: string; price: number }[]
  >([]);
  const [hasSaucesControl, setHasSaucesControl] = useState(false);
  const [openSaucesForItemId, setOpenSaucesForItemId] = useState<string | null>(
    null
  );

  // ✅ NOVO: mapa 33/50 varijanti po bazičnom imenu pice (bez "33 cm"/"50 cm")
  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] =
    useState<PizzaVariantsMap>({});

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

        // ✅ 0) Izgradi mapu pizza varijanti (33/50) iz baze
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

        // 1) Sve iz "dodaci"
        const dodaciRows = rows.filter(
          (r) => normalizeCategory(r.category) === "dodaci"
        );

        // 2) Ako ikad uvedeš posebnu kategoriju za soseve (opcioni upgrade)
        const sauceCategoryRows = rows.filter((r) => isSauceCategory(r.category));

        // 3) Ako su sosevi i dalje u "dodaci", prepoznaj po imenu
        const sauceFromDodaciRows = dodaciRows.filter((r) =>
          isSauceItemName(r.name)
        );

        // 4) Placeholder "Sosevi" (postojeća stavka u "dodaci")
        const hasPlaceholder = dodaciRows.some((r) => isSaucesPlaceholder(r.name));

        // 5) Finalni katalog soseva: prvo kategorija (ako postoji), inače iz "dodaci"
        const saucesSource =
          sauceCategoryRows.length > 0 ? sauceCategoryRows : sauceFromDodaciRows;

        const nextSauces = saucesSource.map((r) => ({
          id: r.id,
          name: r.name,
          price: toSafeInt(r.price_eur_cents, 0),
        }));

        const shouldShowSaucesControl = hasPlaceholder || nextSauces.length > 0;

        // 6) Addons grid: svi dodaci, ali bez placeholdera i (ako treba) bez sos stavki
        const nextAddons = dodaciRows
          .filter((r) => {
            if (isSaucesPlaceholder(r.name)) return false;

            if (nextSauces.length > 0) {
              if (saucesSource === sauceFromDodaciRows && isSauceItemName(r.name))
                return false;
            }

            return true;
          })
          .map((r) => ({
            id: r.id,
            name: r.name,
            price: toSafeInt(r.price_eur_cents, 0),
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

  const handleGoToMenu = () => {
    closeCart();

    // ✅ Primarni ID u projektu je "meni" (Menu.tsx)
    const el =
      document.getElementById("meni") || document.getElementById("menu");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const handleGoToCheckout = () => {
    closeCart();

    // ✅ Checkout nema stabilan id u layout-u, ali je dole na stranici
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const derivedTotalPrice = useMemo(() => {
    return items.reduce((sum, item) => {
      const hideAddons = isDrinkCategory(item.category ?? "");
      const selectedAddons = item.addons ?? [];
      const addonsTotal = hideAddons ? 0 : getPerItemAddonsTotal(selectedAddons);

      const base =
        typeof item.basePrice === "number" && Number.isFinite(item.basePrice)
          ? item.basePrice
          : Math.max(0, (item.price ?? 0) - addonsTotal);

      const lineTotal = (base + addonsTotal) * item.quantity;
      return sum + lineTotal;
    }, 0);
  }, [items]);

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
            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#0b0b0b] border-l border-white/10 p-5 overflow-y-auto"
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-extrabold text-white">Korpa</h3>
              <button
                onClick={closeCart}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-white/80 hover:text-white hover:border-white/20"
              >
                Zatvori
              </button>
            </div>

            {items.length === 0 ? (
              <div className="mt-10 text-center">
                <p className="text-white/70">Korpa je prazna.</p>
                <button
                  onClick={handleGoToMenu}
                  className="mt-4 rounded-full bg-yellow-500 px-5 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
                >
                  Idi na meni
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  {items.map((item) => {
                    const isDrink = isDrinkCategory(item.category ?? "");
                    const baseKey = item.baseKey ?? item.name;

                    // ✅ varijante iz baze (33/50) po bazičnom imenu
                    const variantsFromDb = pizzaVariantsByBaseKey[baseKey];
                    const canPickSize =
                      !!variantsFromDb && (!!variantsFromDb["33"] || !!variantsFromDb["50"]);

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex gap-3">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-16 w-16 rounded-xl object-cover border border-white/10"
                          />

                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-white font-semibold leading-tight">
                                  {item.name}
                                </p>
                                <p className="text-white/60 text-xs">
                                  {formatEUR(item.price)}
                                </p>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-xs text-white/60 hover:text-white"
                              >
                                Ukloni
                              </button>
                            </div>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/80 hover:border-white/25"
                                onClick={() => decrease(item.id)}
                              >
                                -
                              </button>
                              <span className="text-white/80 text-sm">
                                {item.quantity}
                              </span>
                              <button
                                className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/80 hover:border-white/25"
                                onClick={() => increase(item.id)}
                              >
                                +
                              </button>
                            </div>

                            {/* ✅ Size picker za pice: sada radi iz baze (name: 33/50 cm) */}
                            {canPickSize && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                    item.size === "33"
                                      ? "bg-yellow-500 text-black border-yellow-500"
                                      : "bg-transparent text-white/80 border-white/15 hover:border-white/25"
                                  }`}
                                  onClick={() => {
                                    const next = variantsFromDb?.["33"];
                                    if (!next) return;
                                    changeSize(item.id, "33", next);
                                  }}
                                >
                                  33 cm
                                </button>

                                <button
                                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                    item.size === "50"
                                      ? "bg-yellow-500 text-black border-yellow-500"
                                      : "bg-transparent text-white/80 border-white/15 hover:border-white/25"
                                  }`}
                                  onClick={() => {
                                    const next = variantsFromDb?.["50"];
                                    if (!next) return;
                                    changeSize(item.id, "50", next);
                                  }}
                                >
                                  50 cm
                                </button>
                              </div>
                            )}

                            {/* Addons / sosevi */}
                            {!isDrink && (
                              <div className="mt-4 space-y-3">
                                {/* Sosevi control */}
                                {hasSaucesControl && (
                                  <div className="flex items-center justify-between gap-3">
                                    <p className="text-xs font-semibold text-white/80">
                                      Sosevi
                                    </p>
                                    <button
                                      className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-white/80 hover:border-white/25"
                                      onClick={() =>
                                        setOpenSaucesForItemId(
                                          openSaucesForItemId === item.id ? null : item.id
                                        )
                                      }
                                    >
                                      {openSaucesForItemId === item.id
                                        ? "Zatvori"
                                        : "Dodaj soseve"}
                                    </button>
                                  </div>
                                )}

                                {openSaucesForItemId === item.id && saucesCatalog.length > 0 && (
                                  <div className="grid grid-cols-2 gap-2">
                                    {saucesCatalog.map((a) => (
                                      <button
                                        key={a.id}
                                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80 hover:border-white/20"
                                        onClick={() => addAddonToItem(item.id, a)}
                                      >
                                        <div className="font-semibold text-white">{a.name}</div>
                                        <div className="text-white/60">{formatEUR(a.price)}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Addons grid */}
                                {addonsCatalog.length > 0 && (
                                  <div>
                                    <p className="text-xs font-semibold text-white/80 mb-2">
                                      Dodaci
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {addonsCatalog.map((a) => (
                                        <button
                                          key={a.id}
                                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/80 hover:border-white/20"
                                          onClick={() => addAddonToItem(item.id, a)}
                                        >
                                          <div className="font-semibold text-white">{a.name}</div>
                                          <div className="text-white/60">{formatEUR(a.price)}</div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Selected addons list */}
                                {Array.isArray(item.addons) && item.addons.length > 0 && (
                                  <div className="pt-2">
                                    <p className="text-xs font-semibold text-white/80 mb-2">
                                      Izabrano
                                    </p>
                                    <div className="space-y-2">
                                      {item.addons.map((a) => (
                                        <div
                                          key={a.id}
                                          className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <div className="text-xs font-semibold text-white truncate">
                                              {a.name}
                                            </div>
                                            <div className="text-[11px] text-white/60">
                                              {formatEUR(a.price)} × {a.quantity}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-1">
                                            <button
                                              className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 hover:border-white/25"
                                              onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                            >
                                              -
                                            </button>
                                            <button
                                              className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 hover:border-white/25"
                                              onClick={() => increaseAddonQuantity(item.id, a.id)}
                                            >
                                              +
                                            </button>
                                            <button
                                              className="rounded-full border border-white/15 px-2 py-1 text-xs text-white/80 hover:border-white/25"
                                              onClick={() => removeAddonFromItem(item.id, a.id)}
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Note */}
                                <div className="pt-2">
                                  <p className="text-xs font-semibold text-white/80 mb-2">
                                    Napomena
                                  </p>
                                  <textarea
                                    value={item.note ?? ""}
                                    onChange={(e) => setItemNote(item.id, e.target.value)}
                                    className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20"
                                    placeholder="Npr. bez luka, dobro zapečeno..."
                                    rows={2}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-white/70 text-sm">Ukupno</p>
                    <p className="text-white font-extrabold text-lg">
                      {formatEUR(derivedTotalPrice)}
                    </p>
                  </div>

                  <button
                    onClick={handleGoToCheckout}
                    className="mt-4 w-full rounded-full bg-yellow-500 px-5 py-3 text-sm font-extrabold text-black hover:bg-yellow-400"
                  >
                    Poruči
                  </button>

                  <button
                    onClick={handleGoToMenu}
                    className="mt-3 w-full rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 hover:border-white/25 hover:text-white"
                  >
                    Nazad na meni
                  </button>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
