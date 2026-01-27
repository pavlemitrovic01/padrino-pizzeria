import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseclient";
import { useCart } from "../context/useCart";
import type { CartAddon, PizzaSize } from "../context/CartContext";

type MenuItemData = {
  id: string;
  name: string;
  price: number;
  category: string;
};

type SaucePickerState = {
  cartItemId: string;
  baseAddon: Omit<CartAddon, "quantity">;
} | null;

function normalizeCategory(value: string) {
  return value
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function isSauceAddonName(name: string) {
  const n = name.toLowerCase();
  return n.includes("sos") || n.includes("sosevi");
}

const SAUCE_OPTIONS = ["Bijeli luk", "BBQ", "Ljuti", "Paradajz", "Slatko-ljuti"];

function formatAddonChip(a: CartAddon) {
  const qty = Number(a.quantity ?? 1);
  return qty > 1 ? `${a.name} ×${qty}` : a.name;
}

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    totalPrice,
    totalItems,

    changeSize,
    addAddonToItem,
    increaseAddonQuantity,
    decreaseAddonQuantity,
    removeAddonFromItem,
    setItemNote,
  } = useCart();

  const isEmpty = items.length === 0;

  const [addonsCatalog, setAddonsCatalog] = useState<Omit<CartAddon, "quantity">[]>([]);
  const [addonsLoading, setAddonsLoading] = useState(false);

  const [saucePicker, setSaucePicker] = useState<SaucePickerState>(null);

  useEffect(() => {
    let mounted = true;

    async function loadAddons() {
      setAddonsLoading(true);

      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,price,category")
          .order("name", { ascending: true });

        if (!mounted) return;

        if (error) {
          console.error("Greška pri učitavanju dodataka:", error);
          setAddonsCatalog([]);
          setAddonsLoading(false);
          return;
        }

        const rows = (data ?? []) as MenuItemData[];
        const onlyAddons = rows
          .filter((r) => normalizeCategory(r.category) === "dodaci")
          .map((r) => ({ id: r.id, name: r.name, price: r.price }));

        setAddonsCatalog(onlyAddons);
        setAddonsLoading(false);
      } catch (err: unknown) {
        if (!mounted) return;
        console.error("Greška pri učitavanju dodataka:", err);
        setAddonsCatalog([]);
        setAddonsLoading(false);
      }
    }

    void loadAddons();

    return () => {
      mounted = false;
    };
  }, []);

  const handleGoToMenu = () => {
    setSaucePicker(null);
    closeCart();
    const el = document.getElementById("menu");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const handleGoToCheckout = () => {
    if (isEmpty) return;
    setSaucePicker(null);
    closeCart();
    const el = document.getElementById("checkout");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  const isPizzaItem = (category: string, name: string, hasVariants: boolean) => {
    if (hasVariants) return true;

    const c = normalizeCategory(category);
    return (
      c.includes("pizza") ||
      /33\s*cm|50\s*cm/i.test(name) ||
      category === "Pizza 33 cm" ||
      category === "Pizza 50 cm"
    );
  };

  const handleSizeChange = (id: string, size: PizzaSize) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const next = item.variants?.[size];
    if (!next) {
      window.alert("Ne možemo promijeniti veličinu jer nijesu dostupne cijene za tu varijantu.");
      return;
    }

    changeSize(id, size, next);
  };



  const addSauceToItem = (
    cartItemId: string,
    baseAddon: Omit<CartAddon, "quantity">,
    sauceName: string
  ) => {
    const sauceAddon: Omit<CartAddon, "quantity"> = {
      id: `${baseAddon.id}:${sauceName}`,
      name: `Sos: ${sauceName}`,
      price: baseAddon.price,
    };

    addAddonToItem(cartItemId, sauceAddon);
  };

  const getPerItemAddonsTotal = (selectedAddons: CartAddon[]) =>
    selectedAddons.reduce((sum, a) => {
      const qty = Number(a.quantity ?? 1);
      return sum + a.price * qty;
    }, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              setSaucePicker(null);
              closeCart();
            }}
          />

          {/* MODAL: izbor sosa */}
          <AnimatePresence>
            {saucePicker && (
              <motion.div
                className="fixed inset-0 z-[60] flex items-center justify-center px-5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSaucePicker(null)}
              >
                <motion.div
                  className="w-full max-w-sm rounded-2xl bg-[#141414] border border-white/10 shadow-2xl p-5"
                  initial={{ scale: 0.96, y: 8, opacity: 0 }}
                  animate={{ scale: 1, y: 0, opacity: 1 }}
                  exit={{ scale: 0.98, y: 8, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={(e) => e.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                  aria-label="Izbor sosa"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-white font-bold text-lg">Izaberi sos</h4>
                      <p className="text-xs text-gray-400 mt-1">
                        Cijena: {saucePicker.baseAddon.price} RSD
                      </p>
                    </div>

                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setSaucePicker(null)}
                      className="text-gray-400 hover:text-white text-xl"
                      aria-label="Zatvori izbor sosa"
                      type="button"
                    >
                      ✕
                    </motion.button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {SAUCE_OPTIONS.map((s) => (
                      <motion.button
                        key={s}
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => {
                          addSauceToItem(saucePicker.cartItemId, saucePicker.baseAddon, s);
                          setSaucePicker(null);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-[#1b1b1b] border border-white/5 hover:border-yellow-500/30 transition"
                        type="button"
                      >
                        <span className="text-gray-200 font-semibold">{s}</span>
                        <span className="text-yellow-400 font-bold text-sm">+</span>
                      </motion.button>
                    ))}
                  </div>

                  <p className="text-[11px] text-gray-500 mt-3">
                    Ako želiš više istih sosova, izaberi isti sos više puta ili mu povećaj količinu u korpi.
                  </p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.aside
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#121212] z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            role="dialog"
            aria-modal="true"
            aria-label="Korpa"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <div>
                <h3 className="text-xl font-bold text-white">Tvoja porudžbina</h3>
                <p className="text-xs text-gray-400 mt-1">
                  {totalItems > 0 ? `${totalItems} stavki u korpi` : "Korpa je prazna"}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => {
                  setSaucePicker(null);
                  closeCart();
                }}
                className="text-gray-400 hover:text-white text-xl"
                aria-label="Zatvori korpu"
                type="button"
              >
                ✕
              </motion.button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <AnimatePresence mode="popLayout">
                {isEmpty ? (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="text-center mt-16 space-y-4"
                  >
                    <p className="text-gray-400">Korpa je trenutno prazna.</p>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      whileHover={{ scale: 1.02 }}
                      onClick={handleGoToMenu}
                      className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition"
                      type="button"
                    >
                      Pogledaj meni
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="items"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    {items.map((item) => {
                      const has33 = !!item.variants?.["33"];
                      const has50 = !!item.variants?.["50"];
                      const pizza = isPizzaItem(item.category, item.name, has33 || has50);

                      const currentSize: PizzaSize | null =
                        (item.size as PizzaSize | null) ?? (has33 ? "33" : has50 ? "50" : null);

                      const selectedAddons = item.addons ?? [];
                      const perItemAddonsTotal = getPerItemAddonsTotal(selectedAddons);
                      // Calculate base price for display
                      const basePriceForDisplay =
                        Math.max(
                          0,
                          typeof item.basePrice === "number"
                            ? item.basePrice
                            : item.price - perItemAddonsTotal
                        );
                      // Correct item total: (base + addons) * quantity = item.price * item.quantity
                      const itemTotal = item.price * item.quantity;

                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 40 }}
                          transition={{ duration: 0.22 }}
                          className="flex gap-4 bg-[#1b1b1b] rounded-2xl p-4 border border-white/5"
                        >
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-black/20 flex-shrink-0">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h4 className="text-white font-semibold truncate">{item.name}</h4>

                                {pizza && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-gray-400">Veličina:</span>

                                    <motion.button
                                      whileTap={has33 ? { scale: 0.95 } : undefined}
                                      onClick={has33 ? () => handleSizeChange(item.id, "33") : undefined}
                                      disabled={!has33}
                                      className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${
                                        currentSize === "33"
                                          ? "bg-yellow-500 text-black border-yellow-500"
                                          : has33
                                          ? "bg-transparent text-gray-200 border-gray-600 hover:border-gray-400"
                                          : "bg-transparent text-gray-500 border-gray-800 cursor-not-allowed opacity-60"
                                      }`}
                                      type="button"
                                    >
                                      33 cm
                                    </motion.button>

                                    <motion.button
                                      whileTap={has50 ? { scale: 0.95 } : undefined}
                                      onClick={has50 ? () => handleSizeChange(item.id, "50") : undefined}
                                      disabled={!has50}
                                      className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${
                                        currentSize === "50"
                                          ? "bg-yellow-500 text-black border-yellow-500"
                                          : has50
                                          ? "bg-transparent text-gray-200 border-gray-600 hover:border-gray-400"
                                          : "bg-transparent text-gray-500 border-gray-800 cursor-not-allowed opacity-60"
                                      }`}
                                      type="button"
                                    >
                                      50 cm
                                    </motion.button>
                                  </div>
                                )}

                                <div className="mt-2 space-y-1">
                                  <p className="text-[12px] text-gray-400">
                                    Osnovna cijena: {" "}
                                    <span className="text-gray-200 font-semibold">{basePriceForDisplay} RSD</span>
                                  </p>

                                  {perItemAddonsTotal > 0 && (
                                    <p className="text-[12px] text-gray-400">
                                      Dodaci (po stavci): {" "}
                                      <span className="text-gray-200 font-semibold">
                                        {perItemAddonsTotal} RSD
                                      </span>
                                    </p>
                                  )}

                                  <p className="text-sm text-gray-200 font-semibold">
                                    Ukupno za stavku: {itemTotal} RSD
                                  </p>
                                </div>


                                {pizza && (
                                  <div className="mt-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs text-gray-400">Dodaci:</p>
                                      {addonsLoading ? (
                                        <span className="text-[11px] text-gray-500">Učitavam…</span>
                                      ) : (
                                        <span className="text-[11px] text-gray-600">Klikni + da dodaš</span>
                                      )}
                                    </div>

                                    {selectedAddons.length === 0 ? (
                                      <p className="text-[11px] text-gray-500 mt-1">Nema dodataka.</p>
                                    ) : (
                                      <div className="mt-2 space-y-2">
                                        {selectedAddons.map((a) => (
                                          <div
                                            key={a.id}
                                            className="rounded-xl border border-white/5 bg-[#161616] px-3 py-2"
                                          >
                                            {/* ✅ bolji raspored: naziv ne “puca”, subtotal se vidi */}
                                            <div className="flex items-start justify-between gap-3">
                                              <div className="min-w-0 flex-1">
                                                <p className="text-sm text-gray-200 font-semibold leading-snug break-words">
                                                  ⭐ {a.name}
                                                </p>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                  {a.price} RSD × {a.quantity} ={" "}
                                                  <span className="text-gray-300 font-semibold">
                                                    {a.price * a.quantity} RSD
                                                  </span>
                                                </p>
                                              </div>

                                              <div className="flex items-center gap-2 flex-shrink-0">
                                                <motion.button
                                                  whileTap={{ scale: 0.9 }}
                                                  onClick={() => decreaseAddonQuantity(item.id, a.id)}
                                                  className="w-8 h-8 rounded-full bg-gray-700/80 text-white hover:bg-gray-700 transition"
                                                  aria-label="Smanji dodatak"
                                                  type="button"
                                                >
                                                  −
                                                </motion.button>

                                                <span className="min-w-[34px] text-center text-xs font-bold text-gray-200">
                                                  {a.quantity}
                                                </span>

                                                <motion.button
                                                  whileTap={{ scale: 0.9 }}
                                                  onClick={() => increaseAddonQuantity(item.id, a.id)}
                                                  className="w-8 h-8 rounded-full bg-gray-700/80 text-white hover:bg-gray-700 transition"
                                                  aria-label="Povećaj dodatak"
                                                  type="button"
                                                >
                                                  +
                                                </motion.button>

                                                <motion.button
                                                  whileTap={{ scale: 0.9 }}
                                                  onClick={() => removeAddonFromItem(item.id, a.id)}
                                                  className="w-8 h-8 rounded-full bg-transparent border border-white/10 text-gray-300 hover:text-red-300 hover:border-red-500/30 transition"
                                                  aria-label="Ukloni dodatak"
                                                  type="button"
                                                >
                                                  ✕
                                                </motion.button>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    <div className="mt-3">
                                      <label className="block text-[11px] text-gray-400 mb-1">
                                        Napomena (npr. bez pečuraka, bez luka, bez maslina…)
                                      </label>
                                      <textarea
                                        value={item.note ?? ""}
                                        onChange={(e) => setItemNote(item.id, e.target.value)}
                                        placeholder="Npr. bez pečuraka, bez luka, bez maslina, jače pečeno…"
                                        rows={2}
                                        className="w-full resize-none rounded-lg bg-[#121212] border border-white/10 px-3 py-2 text-xs text-gray-200 placeholder:text-gray-500 focus:outline-none focus:border-yellow-500/60"
                                      />
                                    </div>

                                    {!addonsLoading && addonsCatalog.length > 0 && (
                                      <div className="mt-3 border-t border-white/5 pt-3">
                                        <p className="text-[11px] text-gray-500 mb-2">Dodaj dodatak:</p>

                                        <div className="space-y-2">
                                          {addonsCatalog.slice(0, 8).map((a) => {
                                            const isSauceBase = isSauceAddonName(a.name);

                                            return (
                                              <div key={a.id} className="flex items-center justify-between gap-3">
                                                <span className="text-xs text-gray-300 break-words">
                                                  {a.name}
                                                </span>

                                                <div className="flex items-center gap-2 flex-shrink-0">
                                                  <span className="text-[11px] text-gray-400">{a.price} RSD</span>

                                                  <motion.button
                                                    whileTap={{ scale: 0.92 }}
                                                    onClick={() => {
                                                      if (isSauceBase) {
                                                        setSaucePicker({ cartItemId: item.id, baseAddon: a });
                                                        return;
                                                      }
                                                      addAddonToItem(item.id, a);
                                                    }}
                                                    className="text-xs font-semibold px-2 py-1 rounded-full border transition border-gray-600 text-gray-200 hover:border-gray-400"
                                                    type="button"
                                                  >
                                                    +
                                                  </motion.button>
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>

                                        {addonsCatalog.length > 8 && (
                                          <p className="text-[11px] text-gray-600 mt-2">Ima još dodataka u meniju.</p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => removeFromCart(item.id)}
                                className="text-gray-500 hover:text-red-400 transition"
                                aria-label="Ukloni stavku"
                                type="button"
                              >
                                ✕
                              </motion.button>
                            </div>

                            <div className="flex items-center justify-between mt-4">
                              <div className="flex items-center gap-2">
                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => decrease(item.id)}
                                  className="w-9 h-9 rounded-full bg-gray-700/80 text-white hover:bg-gray-700 transition"
                                  aria-label="Smanji količinu"
                                  type="button"
                                >
                                  −
                                </motion.button>

                                <motion.span
                                  key={`${item.id}-${item.quantity}`}
                                  initial={{ scale: 0.9, opacity: 0.6 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{ duration: 0.15 }}
                                  className="text-white w-8 text-center font-semibold"
                                >
                                  {item.quantity}
                                </motion.span>

                                <motion.button
                                  whileTap={{ scale: 0.9 }}
                                  onClick={() => increase(item.id)}
                                  className="w-9 h-9 rounded-full bg-gray-700/80 text-white hover:bg-gray-700 transition"
                                  aria-label="Povećaj količinu"
                                  type="button"
                                >
                                  +
                                </motion.button>
                              </div>

                              <p className="text-sm text-gray-200 font-semibold">{itemTotal} RSD</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="px-6 py-4 border-t border-gray-700">
              <div className="flex justify-between text-white font-bold mb-4">
                <span>Ukupno</span>
                <span>{totalPrice} RSD</span>
              </div>

              <motion.button
                whileTap={!isEmpty ? { scale: 0.98 } : undefined}
                onClick={!isEmpty ? handleGoToCheckout : undefined}
                disabled={isEmpty}
                className={`w-full py-3 rounded-full font-semibold transition ${
                  isEmpty
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed opacity-70"
                    : "bg-yellow-500 text-black hover:bg-yellow-400"
                }`}
                type="button"
              >
                Nastavi sa porudžbinom
              </motion.button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
