import { useState } from "react";
import { useCart } from "../context/useCart";
import type { CartItem } from "../types/menu";
import Checkout from "./Checkout";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    totalPrice
  } = useCart();

  const [step, setStep] = useState<"cart" | "checkout" | "success">("cart");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50">
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white flex flex-col">
        {/* HEADER */}
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">Korpa</h2>
          <button onClick={closeCart} className="text-xl">✕</button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-4">
          {step === "cart" && (
            <>
              {items.length === 0 ? (
                <p className="text-center text-gray-500">
                  Korpa je prazna
                </p>
              ) : (
                <div className="space-y-4">
                  {items.map((item: CartItem) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center border-b pb-3"
                    >
                      <div>
                        <div className="font-semibold">{item.name}</div>
                        <div className="text-sm text-gray-500">
                          {item.price} RSD
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decrease(item.id)}
                          className="px-2 border rounded"
                        >
                          −
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          onClick={() => increase(item.id)}
                          className="px-2 border rounded"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="text-red-500 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === "checkout" && (
            <Checkout
              onSuccess={() => {
                setStep("success");
                setTimeout(() => {
                  closeCart();
                  setStep("cart");
                }, 2000);
              }}
            />
          )}

          {step === "success" && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <h3 className="text-2xl font-bold mb-2">
                Porudžbina poslata 🍕
              </h3>
              <p className="text-gray-600">
                Hvala! Javljamo se uskoro.
              </p>
            </div>
          )}
        </div>

        {/* FOOTER */}
        {step === "cart" && items.length > 0 && (
          <div className="border-t p-4">
            <div className="flex justify-between font-bold mb-3">
              <span>Ukupno</span>
              <span>{totalPrice} RSD</span>
            </div>

            <button
              onClick={() => setStep("checkout")}
              className="w-full bg-black text-white py-2 rounded"
            >
              Poruči
            </button>
          </div>
        )}
      </div>
    </div>
  );
}






