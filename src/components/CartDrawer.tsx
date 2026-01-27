import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "../context/useCart";

export default function CartDrawer() {
  const {
    items,
    totalPrice,
    increase,
    decrease,
    removeFromCart
  } = useCart();

  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Trigger dugme (ako već postoji negdje drugo, ovo neće smetati) */}
      <button
        onClick={() => setIsOpen(true)}
        className="hidden"
        aria-hidden
      />

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="fixed right-0 top-0 z-50 h-full w-full max-w-md bg-black text-white shadow-xl"
          >
            <div className="flex h-full flex-col">
              <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
                <h2 className="text-lg font-bold">Tvoja korpa</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  Zatvori
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {items.length === 0 && (
                  <p className="text-sm text-gray-400 text-center">
                    Korpa je prazna.
                  </p>
                )}

                {items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="font-semibold">{item.name}</p>

                        {item.addons && item.addons.length > 0 && (
                          <ul className="mt-1 text-sm text-gray-400 space-y-0.5">
                            {item.addons.map((addon) => (
                              <li key={addon.id}>
                                + {addon.name} ({addon.price} RSD)
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-sm text-red-400"
                      >
                        Ukloni
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decrease(item.id)}
                          className="h-8 w-8 rounded-full border border-white/20"
                        >
                          –
                        </button>
                        <span className="w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => increase(item.id)}
                          className="h-8 w-8 rounded-full border border-white/20"
                        >
                          +
                        </button>
                      </div>

                      <span className="font-semibold">
                        {item.price * item.quantity} RSD
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <footer className="border-t border-white/10 px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-gray-400">Ukupno</span>
                  <span className="text-lg font-bold">
                    {totalPrice} RSD
                  </span>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="w-full rounded-xl bg-white py-3 font-bold text-black"
                >
                  Nastavi poručivanje
                </button>
              </footer>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
