import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon } from "../context/CartContext";

type MenuItemData = {
  id: string;
  name: string;
  price: number;
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
    "slatko",
    "pesto",
  ];

  return keywords.some((k) => n.includes(normalizeText(k)));
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    totalItems,
    addAddonToItem,
  } = useCart();

  const isEmpty = items.length === 0;

  const [addonsCatalog, setAddonsCatalog] = useState<Omit<CartAddon, "quantity">[]>([]);
  const [saucesCatalog, setSaucesCatalog] = useState<Omit<CartAddon, "quantity">[]>([]);
  const [hasSaucesControl, setHasSaucesControl] = useState(false);
  const [openSaucesForItemId, setOpenSaucesForItemId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadCatalogs() {
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,price,category")
          .order("name", { ascending: true });

        if (!mounted || error) return;

        const rows = (data ?? []) as MenuItemData[];

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

        const nextSauces = saucesSource.map((r) => ({ id: r.id, name: r.name, price: r.price }));

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
          .map((r) => ({ id: r.id, name: r.name, price: r.price }));

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
    if (isEmpty) return;
    closeCart();
    document.getElementById("checkout")?.scrollIntoView({ behavior: "smooth" });
  };

  const getPerItemAddonsTotal = (selectedAddons: CartAddon[]) =>
    selectedAddons.reduce((sum, a) => {
      const qty = Number(a.quantity ?? 1);
      return sum + a.price * qty;
    }, 0);

  /**
   * KRITIČNO: u CartProvider-u item.price je već (basePrice + addonsTotal).
   * Zato ovde NIKAD ne smemo raditi (item.price + addonsTotal), jer bi bilo 2x.
   *
   * Pravilno:
   * lineTotal = (basePrice + addonsTotal) * quantity
   *
   * basePrice uzimamo iz item.basePrice (source-of-truth u CartProvider-u).
   * Ako basePrice nekad izostane, fallback je item.price - addonsTotal.
   */
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
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          <motion.aside
            className="fixed top-0 right-0 h-full w-full max-w-md bg-[#121212] border-l border-white/10 z-50 shadow-2xl"
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.22 }}
          >
            <div className="h-full flex flex-col">
              <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-xl">Tvoja korpa</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    {totalItems > 0 ? `${totalItems} stavki` : "Korpa je prazna"}
                  </p>
                </div>

                <button onClick={closeCart} className="text-gray-400 hover:text-white text-2xl">
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {items.map((item) => {
                  const hideAddons = isDrinkCategory(item.category ?? "");
                  const selectedAddons = item.addons ?? [];
                  const addonsTotal = hideAddons ? 0 : getPerItemAddonsTotal(selectedAddons);

                  const base =
                    typeof item.basePrice === "number" && Number.isFinite(item.basePrice)
                      ? item.basePrice
                      : Math.max(0, (item.price ?? 0) - addonsTotal);

                  const lineTotal = (base + addonsTotal) * item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/40 p-4"
                    >
                      <div className="flex items-start justify-between">
                        <p className="text-white font-semibold">{item.name}</p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-sm text-red-400"
                        >
                          Ukloni
                        </button>
                      </div>

                      {!hideAddons && (
                        <div className="mt-4">
                          <p className="text-sm text-gray-300 mb-2">Dodaci</p>

                          {hasSaucesControl && (
                            <div className="mb-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSaucesForItemId((prev) =>
                                    prev === item.id ? null : item.id
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left"
                                title="Izaberi sos"
                              >
                                <p className="text-xs text-white truncate">Sosevi</p>
                                <p className="text-[11px] text-gray-400">Klikni da izabereš sos</p>
                              </button>

                              {openSaucesForItemId === item.id && (
                                <div className="mt-2">
                                  {saucesCatalog.length === 0 ? (
                                    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                                      <p className="text-xs text-yellow-200">
                                        Nema definisanih sosova za izbor.
                                      </p>
                                      <p className="text-[11px] text-gray-400 mt-1">
                                        Rešenje: dodaj više sos stavki u Supabase (može i dalje
                                        category=&quot;dodaci&quot;), npr: &quot;BBQ sos&quot;,
                                        &quot;Kecap&quot;, &quot;Majonez&quot;… ili napravi novu
                                        kategoriju &quot;sosevi&quot; i prebaci ih tamo.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                      {saucesCatalog.map((s) => (
                                        <button
                                          key={s.id}
                                          type="button"
                                          onClick={() => addAddonToItem(item.id, s)}
                                          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left"
                                        >
                                          <p className="text-xs text-white truncate">{s.name}</p>
                                          <p className="text-[11px] text-gray-400">
                                            {s.price} RSD
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            {addonsCatalog.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => addAddonToItem(item.id, a)}
                                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left"
                              >
                                <p className="text-xs text-white truncate">{a.name}</p>
                                <p className="text-[11px] text-gray-400">{a.price} RSD</p>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decrease(item.id)}
                            className="h-9 w-9 rounded-full border border-white/10 text-white"
                          >
                            –
                          </button>
                          <span className="text-white w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => increase(item.id)}
                            className="h-9 w-9 rounded-full border border-white/10 text-white"
                          >
                            +
                          </button>
                        </div>

                        <p className="text-white font-bold">{lineTotal} RSD</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="px-6 py-5 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Ukupno</span>
                  <span className="text-white font-extrabold text-lg">
                    {derivedTotalPrice} RSD
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    onClick={handleGoToMenu}
                    className="rounded-2xl border border-white/10 bg-black/40 py-3 text-sm text-white"
                  >
                    Nazad na meni
                  </button>

                  <button
                    onClick={handleGoToCheckout}
                    disabled={isEmpty}
                    className="rounded-2xl bg-white py-3 text-sm font-bold text-black disabled:opacity-60"
                  >
                    Na checkout
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
