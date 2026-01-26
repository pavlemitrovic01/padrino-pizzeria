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

function formatPizzaSize(size: unknown) {
  if (size === "33") return "33 cm";
  if (size === "50") return "50 cm";
  return null;
}

function getErrorMessage(err: any) {
  const msg =
    err?.message ||
    err?.error_description ||
    err?.details ||
    (typeof err === "string" ? err : null);

  if (msg && typeof msg === "string") return msg;

  try {
    return JSON.stringify(err);
  } catch {
    return "Došlo je do greške pri slanju porudžbine.";
  }
}

export default function Checkout() {
  const {
    items,
    totalItems,
    totalPrice,
    removeFromCart,
    increase,
    decrease,
    resetCart,
  } = useCart();

  const isEmpty = items.length === 0;

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const formattedTotal = useMemo(() => `${totalPrice} RSD`, [totalPrice]);

  const validate = () => {
    const next: FieldErrors = {};

    if (fullName.trim().length < 2) next.fullName = "Unesite ime i prezime.";
    if (phone.trim().length < 6) next.phone = "Unesite ispravan broj telefona.";
    if (address.trim().length < 5) next.address = "Unesite adresu za dostavu.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isEmpty) {
      setSubmitError("Korpa je prazna. Dodajte stavke pa pokušajte ponovo.");
      return;
    }

    if (!validate()) return;

    setSubmitting(true);

    try {
      await createOrder({
        customer_name: fullName,
        customer_phone: phone,
        customer_address: address,
        total_price: totalPrice,
        total_items: totalItems,
        note: note.trim() || null,
        items: items.map((i) => ({
          cart_id: i.id,
          menu_item_id: i.menuItemId ?? null,
          name: i.name,
          size: i.size ?? null,
          quantity: i.quantity,
          base_price: i.basePrice ?? null,
          price_per_item: i.price,
          addons: (i.addons ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            price: a.price,
            quantity: a.quantity,
          })),
          note: (i.note ?? "").trim() || null,
          image: i.image,
          category: i.category,
        })),
      });

      resetCart();
      setShowSuccess(true);
    } catch (err: any) {
      console.error("Greška pri slanju porudžbine:", err);
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (showSuccess) {
    return (
      <CheckoutSuccess
        onBackToMenu={() => {
          setShowSuccess(false);
          const el = document.getElementById("menu");
          if (el) el.scrollIntoView({ behavior: "smooth" });
        }}
      />
    );
  }

  return (
    <section id="checkout" className="relative bg-black">
      <div className="relative z-10 px-6 py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Poručivanje
            </h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Završimo porudžbinu brzo i bezbjedno. Provjerite stavke i unesite podatke
              za dostavu.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {/* Lijevo: stavke */}
            <div className="rounded-3xl border border-white/5 bg-[#121212] shadow-xl">
              <div className="px-6 py-5 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white">Tvoja porudžbina</h3>
                <p className="text-sm text-gray-400 mt-1">
                  {totalItems > 0 ? `${totalItems} stavki u korpi` : "Korpa je prazna"}
                </p>
              </div>

              <div className="px-6 py-6">
                {isEmpty ? (
                  <p className="text-gray-400 text-center py-10">
                    Nema stavki za poručivanje.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {items.map((item) => {
                      const sizeLabel = formatPizzaSize(item.size);

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-black/40 p-4"
                        >
                          <div className="flex gap-4">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-16 w-16 rounded-xl object-cover"
                              loading="lazy"
                            />

                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <p className="text-white font-semibold">
                                  {item.name}
                                  {sizeLabel && (
                                    <span className="text-gray-400 font-normal">
                                      {" "}
                                      • {sizeLabel}
                                    </span>
                                  )}
                                </p>

                                <button
                                  type="button"
                                  onClick={() => removeFromCart(item.id)}
                                  className="text-sm text-red-400"
                                >
                                  Ukloni
                                </button>
                              </div>

                              <div className="mt-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => decrease(item.id)}
                                    className="h-9 w-9 rounded-full border border-white/10 text-white"
                                  >
                                    –
                                  </button>

                                  <span className="text-white w-8 text-center">
                                    {item.quantity}
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => increase(item.id)}
                                    className="h-9 w-9 rounded-full border border-white/10 text-white"
                                  >
                                    +
                                  </button>
                                </div>

                                <p className="text-white font-bold">
                                  {item.price * item.quantity} RSD
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Desno: forma */}
            <div className="rounded-3xl border border-white/5 bg-[#121212] shadow-xl">
              <div className="px-6 py-5 border-b border-gray-800">
                <h3 className="text-xl font-bold text-white">Podaci za dostavu</h3>
                <p className="text-sm text-gray-400 mt-1">
                  Ukupno:{" "}
                  <span className="text-white font-semibold">{formattedTotal}</span>
                </p>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Ime i prezime
                  </label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="npr. Pavle Mitrović"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-red-400 mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Telefon</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="npr. 06x xxx xxx"
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-400 mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Adresa</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="Ulica i broj, sprat, stan..."
                  />
                  {errors.address && (
                    <p className="text-sm text-red-400 mt-1">{errors.address}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Napomena (opciono)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full min-h-[110px] rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="npr. pozvati kad stignete, bez luka..."
                  />
                </div>

                {submitError && <p className="text-sm text-red-400">{submitError}</p>}

                <button
                  type="submit"
                  disabled={submitting || isEmpty}
                  className="w-full rounded-2xl bg-white text-black font-bold py-3 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? "Šaljem…" : "Pošalji porudžbinu"}
                </button>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-gray-500 text-center"
                >
                  Porudžbina se šalje bezbjedno preko sistema.
                </motion.p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

