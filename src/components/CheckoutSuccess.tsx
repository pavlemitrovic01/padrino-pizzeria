import { useCart } from "../context/useCart";


export default function CheckoutSuccess() {
  const { clearCart } = useCart();


  return (
    <div className="p-6 text-center space-y-4">
      <h1 className="text-2xl font-bold">
        Porudžbina je uspešno poslata 🎉
      </h1>

      <p>Hvala na porudžbini!</p>

      <button
        onClick={clearCart}

       className="mt-4 px-4 py-2 bg-black text-white rounded"
      >
        Nazad na meni
      </button>
    </div>
  );
}




