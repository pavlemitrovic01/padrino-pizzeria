import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../context/useCart";
import CheckoutSuccess from "./CheckoutSuccess";
import { createOrder } from "../lib/createOrder";

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
  return "Došlo je do greške pri slanju porudžbine. Pokušajte ponovo.";
}

export default function Checkout() {
  const {
    items,
    totalItems,
    totalPrice,
    resetCart,
  } = useCart();

  const isEmpty = items.length === 0;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const formattedTotal = useMemo(
    () => `${totalPrice} RSD`,
    [totalPrice]
  );

  function validate(): boolean {
    const next: FieldErrors = {};

    if (fullName.trim().length < 2) {
      next.fullName = "Unesite ime i prezime.";
    }

    if (phone.trim().length < 6) {
      next.phone = "Unesite ispravan broj telefona.";
    }

    if (address.trim().length < 5) {
      next.address = "Unesite adresu za dostavu.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;

    setSubmitError(null);

    if (isEmpty) {
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
        total_price: totalPrice,
        items: items.map((item) => ({
          cart_id: item.id,
          menu_item_id: item.menuItemId ?? null,
          name: item.name,
          size: item.size ?? null,
          quantity: item.quantity,
          base_price: item.basePrice ?? null,
          price_per_item: item.price,
          addons: (item.addons ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            quantity: a.quantity ?? 1,
          })),
          note: (item.note ?? "").trim() || null,
          image: item.image ?? null,
          category: item.category ?? null,
        })),
      });

      resetCart();
      setShowSuccess(true);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (showSuccess) {
    return (
      <CheckoutSuccess
        onBackToMenu={() => {
          setShowSuccess(false);
          document
            .getElementById("menu")
            ?.scrollIntoView({ behavior: "smooth" });
        }}
      />
    );
  }

  return (
    <section id="checkout" className="bg-black px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-extrabold text-white">
            Poručivanje
          </h2>
          <p className="text-gray-400 mt-3">
            Završimo porudžbinu brzo i bezbjedno.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-3xl border border-white/10 bg-[#121212] p-6"
        >
          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Ime i prezime
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none"
            />
            {errors.fullName && (
              <p className="text-sm text-red-400 mt-1">
                {errors.fullName}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Telefon
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none"
            />
            {errors.phone && (
              <p className="text-sm text-red-400 mt-1">
                {errors.phone}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Adresa
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none"
            />
            {errors.address && (
              <p className="text-sm text-red-400 mt-1">
                {errors.address}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">
              Napomena (opciono)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full min-h-[100px] rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none"
            />
          </div>

          {submitError && (
            <p className="text-sm text-red-400">
              {submitError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isEmpty}
            className="w-full rounded-2xl bg-white py-3 font-bold text-black disabled:opacity-60"
          >
            {isSubmitting
              ? "Slanje u toku…"
              : `Pošalji porudžbinu (${formattedTotal})`}
          </button>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-gray-500 text-center"
          >
            Porudžbina se obrađuje bezbjedno.
          </motion.p>
        </form>
      </div>
    </section>
  );
}

