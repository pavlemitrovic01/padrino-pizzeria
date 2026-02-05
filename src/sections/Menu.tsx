import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartProvider";
import type { CartItem } from "../context/CartContext";

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;

  // realna šema (vidi CartDrawer.tsx)
  price_eur_cents: number | null;
  price: number | null; // legacy

  is_active: boolean | null;
};

const normalizeCategory = (c: string | null | undefined) => (c || "").trim();

function formatCategoryLabel(c: string) {
  const s = c.trim();
  if (!s) return "Ostalo";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function toSafeInt(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function priceFromRow(row: MenuItemRow): number {
  // primarno koristimo EUR cente (int)
  if (typeof row.price_eur_cents === "number" && Number.isFinite(row.price_eur_cents)) {
    return Math.trunc(row.price_eur_cents);
  }

  // fallback: ako je legacy price u eurima
  if (typeof row.price === "number" && Number.isFinite(row.price)) {
    return Math.trunc(row.price * 100);
  }

  return 0;
}

function formatEur(cents: number): string {
  const eur = (cents / 100).toFixed(2);
  return `${eur.replace(".", ",")} €`;
}

function resolveMenuImage(row: MenuItemRow): string {
  if (row.image && typeof row.image === "string" && row.image.trim() !== "") {
    return row.image.trim();
  }

  // stabilan fallback (ne ruši UI ako nema slike)
  return "/menu/anatoli.png";
}

function CartIconSvg() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 6h15l-2 8H8L6 2H3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 22a1 1 0 100-2 1 1 0 000 2zM18 22a1 1 0 100-2 1 1 0 000 2z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Menu() {
  const { addToCart } = useCart();

  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>("");

  const computed = useMemo(() => {
    const activeOnly = items.filter((x) => x.is_active !== false);

    const categories = Array.from(
      new Set(activeOnly.map((x) => normalizeCategory(x.category)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const filtered = activeOnly.filter((x) => {
      const cat = normalizeCategory(x.category);
      if (!activeCategory) return true;
      return cat === activeCategory;
    });

    return { categories, filtered };
  }, [items, activeCategory]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("menu_items")
        .select("id,name,description,category,image,price,price_eur_cents,is_active")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (!mounted) return;

      if (err) {
        setError(err.message || "Greška pri učitavanju menija.");
        setItems([]);
        setLoading(false);
        return;
      }

      setItems((data as MenuItemRow[]) || []);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!activeCategory && computed.categories.length > 0) {
      setActiveCategory(computed.categories[0]);
    }
  }, [activeCategory, computed.categories]);

  if (loading) {
    return (
      <section id="menu" className="px-4 py-10 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/80">Učitavam meni…</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="menu" className="px-4 py-10 scroll-mt-24">
        <div className="max-w-6xl mx-auto">
          <p className="text-red-400 font-semibold">Greška: {error}</p>
        </div>
      </section>
    );
  }

  return (
    <section id="menu" className="px-4 py-10 scroll-mt-24">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white">Meni</h2>
            <p className="text-white/60 mt-2 text-sm">
              Izaberi kategoriju i dodaj u korpu. Cijene su prikazane u €.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {computed.categories.map((c) => {
              const isActive = c === activeCategory;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setActiveCategory(c)}
                  className={[
                    "px-4 py-2 rounded-full text-sm font-extrabold transition",
                    isActive
                      ? "bg-yellow-500 text-black"
                      : "bg-white/5 text-white/80 hover:bg-white/10",
                  ].join(" ")}
                >
                  {formatCategoryLabel(c)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {computed.filtered.map((row) => {
            const imageUrl = resolveMenuImage(row);
            const cents = priceFromRow(row);

            return (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-3xl border border-white/10 bg-white/5 overflow-hidden hover:bg-white/[0.07] transition"
              >
                <div className="h-44 w-full overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={row.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-black text-white leading-tight">{row.name}</h3>
                      {row.description && (
                        <p className="text-sm text-white/70 mt-1">{row.description}</p>
                      )}
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold text-yellow-300">
                        {cents > 0 ? formatEur(cents) : "—"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="text-xs text-white/50">
                      {normalizeCategory(row.category) || "Ostalo"}
                    </span>

                    <button
                      type="button"
                      onClick={() => {
                        const item: CartItem = {
                          id: row.id,
                          name: row.name,
                          image: imageUrl,
                          description: row.description ?? "",
                          category: normalizeCategory(row.category) || "ostalo",

                          // CartItem tip u projektu koristi "price" i "quantity"
                          price: toSafeInt(cents, 0),
                          quantity: 1,

                          // bitno: camelCase
                          basePrice: toSafeInt(cents, 0),

                          // ostalo normalizuje CartProvider
                          note: "",
                          addons: [],
                        };

                        addToCart(item);
                      }}
                      className="inline-flex items-center gap-2 rounded-full bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold px-4 py-2 text-sm transition"
                      title="Dodaj u korpu"
                    >
                      <CartIconSvg />
                      Dodaj
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
