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

  const isEmpty = !Array.isArray(items) || items.length === 0;

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
    const trimmedName = fullName.trim();
    if (trimmedName.split(/\s+/).length < 2) next.fullName = "Unesite ime i prezime (minimum dvije riječi).";
    const phoneDigits = phone.replace(/[^\d]/g, "");
    if (phoneDigits.length < 6) next.phone = "Unesite ispravan broj telefona (minimum 6 cifara).";
    if (address.trim().length < 5) next.address = "Unesite adresu za dostavu (minimum 5 karaktera).";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const isFormValid = useMemo(() => {
    const trimmedName = fullName.trim();
    const phoneDigits = phone.replace(/[^\d]/g, "");
    return (
      trimmedName.split(/\s+/).length >= 2 &&
      phoneDigits.length >= 6 &&
      address.trim().length >= 5 &&
      !isEmpty
    );
  }, [fullName, phone, address, isEmpty]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);

    if (isEmpty) {
      setSubmitError("Korpa je prazna. Dodajte stavke pa pokušajte ponovo.");
      return;
    }

    if (!validate()) return;

    setSubmitting(true);

    try {
      await createOrder({
        customer_name: fullName.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        total_price: Number.isFinite(totalPrice) ? totalPrice : 0,
        total_items: Number.isFinite(totalItems) ? totalItems : 0,
        note: note.trim() ? note.trim() : null,
        items: items.map((i) => ({
          cart_id: i.id,
          menu_item_id: i.menuItemId ?? null,
          name: i.name,
          size: i.size ?? null,
          quantity: typeof i.quantity === "number" && i.quantity >= 1 ? i.quantity : 1,
          base_price: typeof i.basePrice === "number" ? i.basePrice : null,
          price_per_item: typeof i.price === "number" ? i.price : 0,
          addons: (i.addons ?? []).map((a) => ({
            id: a.id,
            name: a.name,
            price: typeof a.price === "number" ? a.price : 0,
            quantity: typeof a.quantity === "number" && a.quantity >= 1 ? a.quantity : 1,
          })),
          note: (i.note ?? "").trim() || null,
          image: typeof i.image === "string" ? i.image : "",
          category: i.category,
        })),
      });

      resetCart();
      setShowSuccess(true);
    } catch (err: any) {
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
                      const safeImage = typeof item.image === "string" ? item.image : "";
                      const safeQuantity = typeof item.quantity === "number" && item.quantity >= 1 ? item.quantity : 1;
                      const safePrice = typeof item.price === "number" ? item.price : 0;
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-white/10 bg-black/40 p-4"
                        >
                          <div className="flex gap-4">
                            <img
                              src={safeImage}
                              alt={item.name || "Stavka"}
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
                                    {safeQuantity}
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
                                  {safePrice * safeQuantity} RSD
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
                    autoComplete="name"
                    aria-invalid={!!errors.fullName}
                    aria-describedby={errors.fullName ? "fullName-error" : undefined}
                    disabled={submitting}
                  />
                  {errors.fullName && (
                    <p id="fullName-error" className="text-sm text-red-400 mt-1">{errors.fullName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Telefon</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="npr. 06x xxx xxx"
                    inputMode="tel"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "phone-error" : undefined}
                    disabled={submitting}
                  />
                  {errors.phone && (
                    <p id="phone-error" className="text-sm text-red-400 mt-1">{errors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-gray-300 mb-1">Adresa</label>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-white outline-none focus:border-white/25"
                    placeholder="Ulica i broj, sprat, stan..."
                    autoComplete="street-address"
                    aria-invalid={!!errors.address}
                    aria-describedby={errors.address ? "address-error" : undefined}
                    disabled={submitting}
                  />
                  {errors.address && (
                    <p id="address-error" className="text-sm text-red-400 mt-1">{errors.address}</p>
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
                    disabled={submitting}
                  />
                </div>

                {submitError && <p className="text-sm text-red-400">{submitError}</p>}

                <button
                  type="submit"
                  disabled={submitting || isEmpty || !isFormValid}
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

