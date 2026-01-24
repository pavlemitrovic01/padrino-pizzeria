import { useState } from "react";
import { createOrder } from "../lib/createOrder";
import { useCart } from "../context/useCart";

export default function Checkout() {
  const { items, totalPrice, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await createOrder({
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        items,
        total_price: totalPrice,
      });

      clearCart();
      setSuccess(true);
    } catch (err) {
      setError("Greška pri slanju narudžbe.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl font-bold mb-2">
          Narudžba je poslana 🎉
        </h2>
        <p>Hvala! Kontaktirat ćemo vas uskoro.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-4">
        Završetak narudžbe
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          required
          placeholder="Ime i prezime"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        <input
          type="tel"
          required
          placeholder="Telefon"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        <input
          type="text"
          required
          placeholder="Adresa"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
        >
          {loading ? "Slanje…" : "Pošalji narudžbu"}
        </button>

        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  );
}





















