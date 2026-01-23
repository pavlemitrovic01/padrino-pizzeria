import { useState } from "react";
import { useCart } from "../context/useCart";
import { createOrder } from "../lib/createOrder";

interface Props {
  onSuccess?: () => void;
}

export default function Checkout({ onSuccess }: Props) {
  const { items, totalPrice, resetCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError(null);

    try {
      await createOrder({
        customerName: name,
        customerPhone: phone,
        customerAddress: address,
        items,
        totalPrice
      });

      resetCart();
      onSuccess?.();
    } catch {
      setError("Greška prilikom slanja porudžbine.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-lg font-bold">Podaci za dostavu</h3>

      <input
        required
        placeholder="Ime i prezime"
        value={name}
        onChange={e => setName(e.target.value)}
        className="w-full border p-2 rounded"
      />

      <input
        required
        placeholder="Telefon"
        value={phone}
        onChange={e => setPhone(e.target.value)}
        className="w-full border p-2 rounded"
      />

      <textarea
        required
        placeholder="Adresa"
        value={address}
        onChange={e => setAddress(e.target.value)}
        className="w-full border p-2 rounded"
      />

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
      >
        {loading ? "Slanje..." : "Potvrdi porudžbinu"}
      </button>
    </form>
  );
}





















