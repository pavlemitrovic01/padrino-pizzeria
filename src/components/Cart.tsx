import { useCart } from "../context/CartContext";

export default function Cart() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
  } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex justify-end">
      <div className="bg-white w-96 p-6 space-y-4">
        <h2 className="text-xl font-bold">Korpa</h2>

        {items.length === 0 && <p>Korpa je prazna.</p>}

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

        <button
          onClick={closeCart}
          className="w-full bg-black text-white py-2 rounded"
        >
          Zatvori
        </button>
      </div>
    </div>
  );
}



























