import { useEffect, useRef } from "react";
import { useCart } from "../context/useCart";
import type { CartItem } from "../types/menu";
import Checkout from "./Checkout";

export default function Cart() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
  } = useCart();

  const cartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex justify-end"
      onClick={closeCart}
    >
      <div
        ref={cartRef}
        onClick={(e) => e.stopPropagation()}
        className="
          w-full max-w-md h-full
          bg-zinc-900 text-white
          p-6
          overflow-y-auto
          cart-slide-in
        "
      >
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-serif">Porudžbina</h2>
          <button
            onClick={closeCart}
            className="text-zinc-400 hover:text-white text-xl"
            aria-label="Zatvori"
          >
            ✕
          </button>
        </div>

        {/* EMPTY STATE */}
        {items.length === 0 ? (
          <div className="mt-20 text-center text-zinc-400">
            <p className="text-lg mb-2">Korpa je prazna</p>
            <p className="text-sm">Dodajte nešto iz menija 🍕</p>
          </div>
        ) : (
          <>
            {/* ITEMS */}
            <div className="space-y-4">
              {items.map((item: CartItem) => (
                <div
                  key={item.id}
                  className="
                    flex justify-between items-center
                    border-b border-white/10
                    pb-4
                  "
                >
                  <div>
                    <p className="font-serif text-lg">{item.name}</p>
                    <span className="text-sm text-zinc-400">
                      {item.price} RSD
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => decrease(item.id)}
                      className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700"
                    >
                      −
                    </button>

                    <span className="min-w-[24px] text-center">
                      {item.quantity}
                    </span>

                    <button
                      onClick={() => increase(item.id)}
                      className="w-9 h-9 rounded-full bg-zinc-800 hover:bg-zinc-700"
                    >
                      +
                    </button>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-500 ml-2"
                      aria-label="Ukloni"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* CHECKOUT */}
            <Checkout />
          </>
        )}
      </div>
    </div>
  );
}


























