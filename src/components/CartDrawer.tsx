import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon } from "../context/CartContext";
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
  const n = typeof row.price_eur_cents === "number" ? row.price_eur_cents : Number(row.price_eur_cents);
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
  const [openSaucesForItemId, setOpenSaucesForItemId] = useState<string | null>(null);

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

        // 1) Sve iz "dodaci"
        const dodaciRows = rows.filter((r) => normalizeCategory(r.category) === "dodaci");

        // 2) Ako ikad uvedeš posebnu kategoriju za soseve (opcioni upgrade)
        const sauceCategoryRows = rows.filter((r) => isSauceCategory(r.category));

        // 3) Ako su sosevi i dalje u "dodaci", prepoznaj po imenu
        const sauceFromDodaciRows = dodaciRows.filter((r) => isSauceItemName(r.name));

        // 4) Placeholder "Sosevi" (postojeća stavka u "dodaci")
        const hasPlaceholder = dodaciRows.some((r) => isSaucesPlaceholder(r.name));

        // 5) Finalni katalog soseva: prvo kategorija (ako postoji), inače iz "dodaci"
        const saucesSource = sauceCategoryRows.length > 0 ? sauceCategoryRows : sauceFromDodaciRows;

        const nextSauces = saucesSource.map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0) }));

        const shouldShowSaucesControl = hasPlaceholder || nextSauces.length > 0;

        // 6) Addons grid: svi dodaci, ali bez placeholdera i (ako treba) bez sos stavki
        const nextAddons = dodaciRows
          .filter((r) => {
            if (isSaucesPlaceholder(r.name)) return false;

            if (nextSauces.length > 0) {
              if (saucesSource === sauceFromDodaciRows && isSauceItemName(r.name)) return false;
            }

            return true;
          })
          .map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0) }));

        setSaucesCatalog(nextSauces);
        setAddonsCatalog(nextAddons);
        setHasSaucesControl(shouldShowSaucesControl);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
        setSaucesCatalog([]);
        setHasSaucesControl(false);
      }
    }

    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGoToMenu = () => {
    closeCart();
    document.getElementById("menu")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleGoToCheckout = () => {
    closeCart();
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
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
                <div className="mt-6 space-y-4">
                  {items.map((item) => {
                    const isDrink = isDrinkCategory(item.category ?? "");
                    const addons = item.addons ?? [];
                    const addonsTotal = isDrink ? 0 : getPerItemAddonsTotal(addons);

                    const base =
                      typeof item.basePrice === "number" && Number.isFinite(item.basePrice)
                        ? item.basePrice
                        : Math.max(0, (item.price ?? 0) - addonsTotal);

                    const lineTotal = (base + addonsTotal) * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/5 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className="h-16 w-16 overflow-hidden rounded-xl bg-black/30 shrink-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-white font-semibold truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-400 mt-1">
                                  {item.category}
                                </p>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white hover:border-white/20"
                              >
                                Ukloni
                              </button>
                            </div>

                            {/* Size picker samo za pice */}
                            {item.variants && item.size && (
                              <div className="mt-3 flex items-center gap-2">
                                <button
                                  className={`rounded-full px-3 py-1 text-xs font-semibold border ${
                                    item.size === "33"
                                      ? "bg-yellow-500 text-black border-yellow-500"
                                      : "bg-transparent text-white/80 border-white/15 hover:border-white/25"
                                  }`}
                                  onClick={() => {
                                    const next = item.variants?.["33"];
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
                                    const next = item.variants?.["50"];
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
                                {hasSaucesControl && (
                                  <div>
                                    <button
                                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-yellow-500/30"
                                      onClick={() =>
                                        setOpenSaucesForItemId((prev) =>
                                          prev === item.id ? null : item.id
                                        )
                                      }
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-sm font-semibold text-white">
                                          Sosevi
                                        </span>
                                        <span className="text-xs text-white/70">
                                          {openSaucesForItemId === item.id ? "Zatvori" : "Dodaj"}
                                        </span>
                                      </div>
                                    </button>

                                    {openSaucesForItemId === item.id && (
                                      <div className="mt-3 grid grid-cols-2 gap-2">
                                        {saucesCatalog.map((s) => (
                                          <button
                                            key={s.id}
                                            onClick={() =>
                                              addAddonToItem(item.id, {
                                                id: s.id,
                                                name: s.name,
                                                price: s.price,
                                              })
                                            }
                                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-yellow-500/30"
                                          >
                                            <p className="text-xs text-white truncate">{s.name}</p>
                                            <p className="text-[11px] text-gray-400">
                                              {formatEUR(s.price)}
                                            </p>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {addonsCatalog.length > 0 && (
                                  <div>
                                    <p className="text-xs text-white/70 mb-2">Dodaci</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      {addonsCatalog.map((a) => (
                                        <button
                                          key={a.id}
                                          onClick={() =>
                                            addAddonToItem(item.id, {
                                              id: a.id,
                                              name: a.name,
                                              price: a.price,
                                            })
                                          }
                                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left hover:border-yellow-500/30"
                                        >
                                          <p className="text-xs text-white truncate">{a.name}</p>
                                          <p className="text-[11px] text-gray-400">{formatEUR(a.price)}</p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {addons.length > 0 && (
                                  <div className="pt-1">
                                    <p className="text-xs text-white/70 mb-2">U korpi</p>
                                    <div className="space-y-2">
                                      {addons.map((a) => (
                                        <div
                                          key={a.id}
                                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                                        >
                                          <div className="min-w-0">
                                            <p className="text-xs text-white truncate">{a.name}</p>
                                            <p className="text-[11px] text-gray-400">
                                              {a.quantity} × {formatEUR(a.price)}
                                            </p>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                              className="h-7 w-7 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/20"
                                            >
                                              -
                                            </button>
                                            <button
                                              onClick={() => increaseAddonQuantity(item.id, a.id)}
                                              className="h-7 w-7 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/20"
                                            >
                                              +
                                            </button>
                                            <button
                                              onClick={() => removeAddonFromItem(item.id, a.id)}
                                              className="h-7 w-7 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/20"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Note */}
                            <div className="mt-4">
                              <textarea
                                value={item.note ?? ""}
                                onChange={(e) => setItemNote(item.id, e.target.value)}
                                placeholder="Napomena (opciono)"
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-yellow-500/30"
                                rows={2}
                              />
                            </div>

                            {/* Quantity + line total */}
                            <div className="mt-4 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => decrease(item.id)}
                                  className="h-8 w-8 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/20"
                                >
                                  -
                                </button>
                                <span className="text-white font-semibold w-6 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => increase(item.id)}
                                  className="h-8 w-8 rounded-full border border-white/10 text-white/80 hover:text-white hover:border-white/20"
                                >
                                  +
                                </button>
                              </div>

                              <p className="text-white font-bold">{formatEUR(lineTotal)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400 text-sm">Ukupno</span>
                    <span className="text-white font-extrabold text-lg">
                      {formatEUR(derivedTotalPrice)}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      onClick={handleGoToMenu}
                      className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:border-white/20"
                    >
                      Nazad na meni
                    </button>
                    <button
                      onClick={handleGoToCheckout}
                      className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-400"
                    >
                      Poruči
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
