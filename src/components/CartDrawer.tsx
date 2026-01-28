import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";
import { useCart } from "../context/useCart";
import type { CartAddon } from "../context/CartContext";

type MenuItemData = {
  id: string;
  name: string;
  price: number;
  category: string;
};

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
    addAddonToItem,
  } = useCart();

  const isEmpty = items.length === 0;

  const [addonsCatalog, setAddonsCatalog] = useState<
    Omit<CartAddon, "quantity">[]
  >([]);

  useEffect(() => {
    let mounted = true;

    async function loadAddons() {
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,price,category")
          .order("name", { ascending: true });

        if (!mounted || error) return;

        const rows = (data ?? []) as MenuItemData[];
        const onlyAddons = rows
          .filter((r) => normalizeCategory(r.category) === "dodaci")
          .map((r) => ({ id: r.id, name: r.name, price: r.price }));

        setAddonsCatalog(onlyAddons);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
      }
    }

    void loadAddons();
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

                <button
                  onClick={closeCart}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                {items.map((item) => {
                  const hideAddons = isDrinkCategory(item.category ?? "");
                  const selectedAddons = item.addons ?? [];
                  const perItemAddonsTotal = hideAddons
                    ? 0
                    : getPerItemAddonsTotal(selectedAddons);

                  const lineTotal =
                    (item.price + perItemAddonsTotal) * item.quantity;

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

                          <div className="grid grid-cols-2 gap-2">
                            {addonsCatalog.map((a) => (
                              <button
                                key={a.id}
                                type="button"
                                onClick={() => addAddonToItem(item.id, a)}
                                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-left"
                              >
                                <p className="text-xs text-white truncate">
                                  {a.name}
                                </p>
                                <p className="text-[11px] text-gray-400">
                                  {a.price} RSD
                                </p>
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
                          <span className="text-white w-8 text-center">
                            {item.quantity}
                          </span>
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
                    {totalPrice} RSD
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
