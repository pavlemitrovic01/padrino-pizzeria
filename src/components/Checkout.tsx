import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../context/useCart";
import CheckoutSuccess from "./CheckoutSuccess";
import { createOrder } from "../lib/createOrder";
import { formatEUR } from "../lib/money";

type FieldErrors = {
  fullName?: string;
  phone?: string;
  address?: string;
};

function getErrorMessage(err: unknown) {
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    return String((err as any).message);
  }
  return "Došlo je do greške.";
}

export default function Checkout() {
  const { items, totalPrice, totalItems, resetCart } = useCart();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const formattedTotal = useMemo(() => formatEUR(totalPrice), [totalPrice]);

  const validate = () => {
    const next: FieldErrors = {};

    if (fullName.trim().length < 2) next.fullName = "Upiši ime i prezime.";
    if (phone.trim().length < 6) next.phone = "Upiši validan broj telefona.";
    if (address.trim().length < 5) next.address = "Upiši tačnu adresu dostave.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    setSubmitError(null);

    if (items.length === 0) {
      setSubmitError("Korpa je prazna.");
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      await createOrder({
        customer_name: fullName.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        note: note.trim() || null,
        total_items: totalItems,
        total_price: totalPrice, // EUR cente
        items: items.map((item) => ({
          cart_id: item.id,
          menu_item_id: item.menuItemId ?? null,
          name: item.name,
          size: item.size ?? null,
          quantity: item.quantity,
          base_price: item.basePrice ?? null, // EUR cente
          price_per_item: item.price, // EUR cente
          addons: (item.addons ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price, // EUR cente
            quantity: a.quantity ?? 1,
          })),
          note: (item.note ?? "").trim() || null,
          image: item.image ?? "",     // IMPORTANT: uvijek string
          category: item.category ?? "", // IMPORTANT: uvijek string
        })),
      });

      resetCart();
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showSuccess) {
    return <CheckoutSuccess onBackToMenu={() => setShowSuccess(false)} />;
  }

  return (
    <section id="checkout" className="bg-black text-white py-16">
      <div className="mx-auto max-w-3xl px-4">
        <h2 className="text-3xl font-extrabold">Porudžbina</h2>
        <p className="mt-2 text-white/70">
          Unesi podatke za dostavu. Plaćanje je pouzećem (za sada).
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="text-sm text-white/80">Ime i prezime</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-yellow-500/40"
                placeholder="npr. Pavle Mitrović"
              />
              {errors.fullName && (
                <p className="mt-2 text-xs text-red-400">{errors.fullName}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-white/80">Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-yellow-500/40"
                placeholder="npr. +382 6X XXX XXX"
              />
              {errors.phone && (
                <p className="mt-2 text-xs text-red-400">{errors.phone}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-white/80">Adresa</label>
              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-yellow-500/40"
                placeholder="npr. Budva, ..."
              />
              {errors.address && (
                <p className="mt-2 text-xs text-red-400">{errors.address}</p>
              )}
            </div>

            <div>
              <label className="text-sm text-white/80">Napomena (opciono)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:border-yellow-500/40"
                placeholder="npr. bez luka, pozovi na dolasku..."
                rows={3}
              />
            </div>

            {submitError && (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {submitError}
              </p>
            )}

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting || items.length === 0}
              onClick={onSubmit}
              className="w-full rounded-2xl bg-yellow-500 px-5 py-3 text-sm font-extrabold text-black hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Šaljem..." : "Potvrdi porudžbinu"}
            </motion.button>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-lg font-extrabold">Pregled</h3>

            <div className="mt-4 space-y-3">
              {items.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {i.name} {i.size ? `(${i.size} cm)` : ""}
                    </p>
                    <p className="text-xs text-white/60">x{i.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {formatEUR(i.price * i.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 border-t border-white/10 pt-4 flex items-center justify-between">
              <span className="text-white/70">Ukupno</span>
              <span className="text-white text-xl font-extrabold">{formattedTotal}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
