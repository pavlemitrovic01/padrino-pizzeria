import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartProvider";
import { formatEUR } from "../lib/money";
import { createOrder, type CreateOrderPayload } from "../lib/createOrder";

export default function Checkout() {
  const navigate = useNavigate();
  const { items, totalPrice, clearCart } = useCart();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalItems = useMemo(() => items.reduce((acc, i) => acc + (i.quantity || 0), 0), [items]);

  const canSubmit = useMemo(() => {
    if (!name.trim() || !phone.trim() || !address.trim()) return false;
    if (items.length === 0) return false;
    if (totalItems <= 0) return false;
    if (totalPrice <= 0) return false;
    return true;
  }, [name, phone, address, items.length, totalItems, totalPrice]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    try {
      setSubmitting(true);

      const payload: CreateOrderPayload = {
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_address: address.trim(),
        items: items.map((i) => ({
          cart_id: String(i.id),
          menu_item_id: i.menuItemId ?? null,
          name: i.name,
          size: i.size ?? null,
          quantity: i.quantity || 1,
          base_price: typeof i.basePrice === "number" ? i.basePrice : null,
          price_per_item: typeof i.price === "number" ? i.price : 0,
          addons: Array.isArray(i.addons) ? i.addons : [],
          note: i.note ? String(i.note) : null,
          image: i.image,
          category: i.category,
        })),
        total_price: totalPrice,
        total_items: totalItems,
        note: note.trim() || null,
        payment_method: "cash",
      };

      const result = await createOrder(payload);

      clearCart();
      navigate(`/checkout/success?id=${encodeURIComponent(result.orderId)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Došlo je do greške pri slanju porudžbine.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 pb-16 pt-10">
      <h2 className="mb-6 text-4xl font-extrabold tracking-tight text-white">Porudžbina</h2>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">Ime i prezime</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]"
              placeholder="Npr. Marko Markovic"
              autoComplete="name"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">Telefon</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]"
              placeholder="Npr. 06X XXX XXX"
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">Adresa</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-2xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]"
              placeholder="Ulica i broj"
              autoComplete="street-address"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-white/80">Napomena (opciono)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-28 w-full resize-none rounded-2xl bg-white/5 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]"
              placeholder="Npr. bez luka, pozvati prije dolaska…"
            />
          </div>

          {error ? <div className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}

          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className={[
              "w-full rounded-2xl px-5 py-3 text-sm font-extrabold text-black transition flex items-center justify-center gap-2",
              !canSubmit || submitting ? "bg-[#f2b400]/50" : "bg-[#f2b400] hover:brightness-95",
            ].join(" ")}
          >
            {submitting ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                Šaljem…
              </>
            ) : (
              "Potvrdi porudžbinu"
            )}
          </button>

          {!canSubmit && !submitting ? (
            <div className="text-xs text-white/50">Popuni ime/telefon/adresu i provjeri da korpa ima ispravan obračun.</div>
          ) : null}
        </form>

        <aside className="rounded-3xl bg-black/50 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10">
          <div className="mb-4 text-2xl font-extrabold text-white">Pregled</div>

          <div className="space-y-3">
            {items.map((i) => {
              const unit = typeof i.price === "number" ? i.price : typeof i.basePrice === "number" ? i.basePrice : 0;
              const qty = i.quantity || 1;
              const lineTotal = unit * qty;

              return (
                <div key={i.id} className="flex items-start justify-between gap-4 text-white">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {i.name} {i.size ? `(${i.size} cm)` : ""}
                    </div>
                    <div className="text-xs text-white/60">x {qty}</div>

                    {Array.isArray(i.addons) && i.addons.length > 0 ? (
                      <div className="mt-2 space-y-1">
                        {i.addons.map((a) => (
                          <div key={a.id} className="text-xs text-white/55">
                            + {a.name} x{a.quantity} ({formatEUR(a.price * a.quantity)})
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="shrink-0 text-sm font-extrabold text-white">{formatEUR(lineTotal)}</div>
                </div>
              );
            })}
          </div>

          <div className="my-6 h-px bg-white/10" />

          <div className="flex items-center justify-between text-white">
            <div className="text-sm font-bold text-white/70">Ukupno</div>
            <div className="text-2xl font-extrabold text-white">{formatEUR(totalPrice)}</div>
          </div>

          <div className="mt-3 text-xs text-white/55">Plaćanje: gotovina (kartice uskoro).</div>
        </aside>
      </div>
    </section>
  );
}