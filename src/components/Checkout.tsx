import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/useCart";
import CheckoutSuccess from "./CheckoutSuccess";

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

    if (fullName.trim().length < 2) next.fullName = "Unesi ime i prezime.";
    if (phone.trim().length < 6) next.phone = "Unesi ispravan broj telefona.";
    if (address.trim().length < 5) next.address = "Unesi adresu za dostavu.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isEmpty) return;

    const ok = validate();
    if (!ok) return;

    setSubmitting(true);

    try {
      const orderNote = note.trim();

      const orderItems = items.map((i) => ({
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
        order_note: orderNote || null,

        image: i.image,
        category: i.category,
      }));

      const { error } = await supabase.from("orders").insert([
        {
          customer_name: fullName.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim(),
          total_price: totalPrice,
          total_items: totalItems,
          items: orderItems,
        },
      ]);

      if (error) {
        console.error("Greška pri slanju porudžbine:", error);
        setSubmitError(
          "Došlo je do greške pri slanju porudžbine. Pokušaj ponovo za koji trenutak."
        );
        setSubmitting(false);
        return;
      }

      resetCart();
      setShowSuccess(true);
    } catch (err) {
      console.error("Neočekivana greška pri slanju porudžbine:", err);
      setSubmitError("Došlo je do neočekivane greške. Pokušaj ponovo.");
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
              Završimo porudžbinu brzo i bezbjedno. Provjeri stavke i unesi podatke
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
                      const addons = item.addons ?? [];
                      const hasAddons = addons.length > 0;
                      const hasItemNote = (item.note ?? "").trim().length > 0;

                      return (
                        <div
                          key={item.id}
                          className="flex gap-4 bg-[#1b1b1b] rounded-2xl p-4 border border-white/5"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-16 h-16 rounded-xl object-cover"
                          />

                          <div className="flex-1">
                            <div className="flex justify-between">
                              <div className="min-w-0">
                                <p className="text-white font-semibold truncate">
                                  {item.name}
                                </p>

                                {sizeLabel && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Veličina:{" "}
                                    <span className="text-gray-300">{sizeLabel}</span>
                                  </p>
                                )}

                                <p className="text-sm text-gray-400 mt-1">
                                  {item.price} RSD
                                </p>

                                {hasAddons && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-[11px] text-gray-500">Dodaci:</p>
                                    {addons.map((a) => (
                                      <div
                                        key={a.id}
                                        className="flex items-center justify-between text-xs"
                                      >
                                        <span className="text-gray-300 truncate">
                                          ⭐ {a.name} ×{a.quantity}
                                        </span>
                                        <span className="text-gray-400 font-semibold">
                                          {a.price * a.quantity} RSD
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {hasItemNote && (
                                  <div className="mt-2">
                                    <p className="text-[11px] text-gray-500">Napomena:</p>
                                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                                      {item.note}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="text-gray-500 hover:text-red-400"
                                aria-label="Ukloni stavku"
                                type="button"
                              >
                                ✕
                              </button>
                            </div>

                            <div className="flex justify-between items-center mt-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => decrease(item.id)}
                                  className="w-8 h-8 rounded-full bg-gray-700 text-white"
                                  aria-label="Smanji količinu"
                                  type="button"
                                >
                                  −
                                </button>
                                <span className="text-white font-semibold">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => increase(item.id)}
                                  className="w-8 h-8 rounded-full bg-gray-700 text-white"
                                  aria-label="Povećaj količinu"
                                  type="button"
                                >
                                  +
                                </button>
                              </div>

                              <p className="text-white font-semibold">
                                {item.price * item.quantity} RSD
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div className="flex justify-between pt-4 border-t border-gray-800 text-white font-bold">
                      <span>Ukupno</span>
                      <span>{formattedTotal}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Desno: forma */}
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-white/5 bg-[#121212] shadow-xl px-6 py-6 space-y-4"
            >
              <h3 className="text-xl font-bold text-white">Podaci za dostavu</h3>

              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ime i prezime"
                className="w-full rounded-2xl bg-[#1b1b1b] border border-white/5 px-4 py-3 text-white"
              />
              {errors.fullName && (
                <p className="text-sm text-red-400">{errors.fullName}</p>
              )}

              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Telefon"
                className="w-full rounded-2xl bg-[#1b1b1b] border border-white/5 px-4 py-3 text-white"
              />
              {errors.phone && (
                <p className="text-sm text-red-400">{errors.phone}</p>
              )}

              <input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Adresa"
                className="w-full rounded-2xl bg-[#1b1b1b] border border-white/5 px-4 py-3 text-white"
              />
              {errors.address && (
                <p className="text-sm text-red-400">{errors.address}</p>
              )}

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Napomena (opciono) — npr. interfon, sprat, ulaz…"
                className="w-full min-h-[100px] rounded-2xl bg-[#1b1b1b] border border-white/5 px-4 py-3 text-white"
              />

              {submitError && (
                <p className="text-sm text-red-400">{submitError}</p>
              )}

              <motion.button
                whileTap={!submitting ? { scale: 0.97 } : undefined}
                disabled={isEmpty || submitting}
                className={`w-full py-3 rounded-full font-semibold transition ${
                  isEmpty || submitting
                    ? "bg-gray-600 text-gray-300 cursor-not-allowed opacity-80"
                    : "bg-yellow-500 text-black hover:bg-yellow-400"
                }`}
              >
                {submitting ? "Šaljem porudžbinu…" : "Potvrdi porudžbinu"}
              </motion.button>

              <p className="text-xs text-gray-600">
                Klikom na “Potvrdi porudžbinu” porudžbina se šalje restoranu.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}




















