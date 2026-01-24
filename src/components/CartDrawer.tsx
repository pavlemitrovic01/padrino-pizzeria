import { useCart } from "../context/CartContext";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    totalPrice,
  } = useCart();

  if (!isOpen) return null;

  return (
    <aside className="fixed right-0 top-0 h-full w-96 bg-white shadow-lg p-6">
      <h2 className="text-xl font-bold mb-4">Vaša korpa</h2>

      {items.length === 0 && <p>Korpa je prazna.</p>}

      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="border-b pb-3">
            <div className="flex justify-between">
              <span>{item.name}</span>
              <span>{item.price} RSD</span>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => decrease(item.id)}>-</button>
              <span>{item.quantity}</span>
              <button onClick={() => increase(item.id)}>+</button>
              <button
                onClick={() => removeFromCart(item.id)}
                className="ml-auto text-red-600"
              >
                X
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 font-bold">
        Ukupno: {totalPrice} RSD
      </div>

      <button
        onClick={closeCart}
        className="w-full mt-4 bg-black text-white py-2 rounded"
      >
        Zatvori
      </button>
    </aside>
  );
}







