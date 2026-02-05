// Robust fallback za slike: ako slika ne postoji, koristi /menu/about.png
function handleImgError(e: React.SyntheticEvent<HTMLImageElement, Event>) {
  const target = e.currentTarget;
  if (target.src.endsWith('/menu/about.png')) return;
  target.onerror = null;
  target.src = '/menu/about.png';
}
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useCart } from "../context/useCart";
import { formatEUR } from "../lib/money";
import { supabase } from "../lib/supabaseClient";
import type { MenuItemRow } from "../types";

type CategoryKey = "dodaci" | "pica" | "pizza" | "sosevi";

function normalizeCategory(input: unknown): CategoryKey {
  const raw = String(input ?? "").trim().toLowerCase();

  if (raw === "pizza") return "pizza";
  if (raw === "pica" || raw === "pića" || raw === "pice") return "pica";
  if (raw === "dodaci" || raw === "dodatak" || raw === "dodaci ") return "dodaci";
  if (raw === "sosevi" || raw === "sosovi" || raw === "sos") return "sosevi";

  // Fallback: treat unknown as pizza to keep UI consistent
  return "pizza";
}

function formatCategoryLabel(c: CategoryKey) {
  if (c === "dodaci") return "Dodaci";
  if (c === "pica") return "Pića";
  if (c === "pizza") return "Pizza";
  return "Sosevi";
}

function priceFromRow(row: MenuItemRow): number {
  // Supports either cents (number) or euro (number/string) – project historically had mixed inputs.
  const anyRow = row as any;
  if (typeof anyRow.price_eur_cents === "number") return anyRow.price_eur_cents;

  const price = anyRow.price ?? anyRow.base_price ?? 0;
  if (typeof price === "number") {
    // If price looks like cents (>= 100), keep it. If it looks like euros (e.g., 9.5), convert.
    if (price >= 100) return Math.round(price);
    return Math.round(price * 100);
  }

  if (typeof price === "string") {
    const n = Number(price.replace(",", "."));
    if (Number.isFinite(n)) {
      if (n >= 100) return Math.round(n);
      return Math.round(n * 100);
    }
  }

  return 0;
}

function resolveMenuImage(row: MenuItemRow): string {
  // If DB already stores full path like "/menu/bianco.png" keep it.
  const img = String((row as any).image ?? "").trim();
  if (!img) return "/menu/about.png";

  // Ensure leading slash
  if (img.startsWith("/")) return img;
  return `/${img}`;
}

export default function Menu() {
  const { addToCart } = useCart();

  const [rows, setRows] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("pizza");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message ?? "Greška pri učitavanju menija.");
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as MenuItemRow[]);
      setLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const computed = useMemo(() => {
    const normalized = rows.map((r) => ({
      ...r,
      _categoryKey: normalizeCategory((r as any).category),
    })) as Array<MenuItemRow & { _categoryKey: CategoryKey }>;

    const categories: CategoryKey[] = ["dodaci", "pica", "pizza", "sosevi"];

    const filtered = normalized.filter((r) => r._categoryKey === activeCategory);

    return { normalized, categories, filtered };
  }, [rows, activeCategory]);

  function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    // Prevent infinite loop if placeholder also fails
    img.onerror = null;
    img.src = "/menu/about.png";
  }

  return (
    <section id="meni" className="relative py-16">
      <div className="container mx-auto px-4">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div>
            <h2 className="text-4xl sm:text-5xl font-black text-white">Meni</h2>
            <p className="text-white/70 mt-2">
              Izaberi kategoriju i dodaj u korpu. Cijene su prikazane u €.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {computed.categories.map((c) => {
              const isActive = c === activeCategory;
              return (
                <button
                  key={c}
                  onClick={() => setActiveCategory(c)}
                  className={[
                    "px-4 py-2 rounded-full text-sm font-bold transition",
                    "border border-white/10",
                    isActive ? "bg-yellow-400 text-black" : "bg-white/5 text-white hover:bg-white/10",
                  ].join(" ")}
                >
                  {formatCategoryLabel(c)}
                </button>
              );
            })}
          </div>
        </div>

        {loading && (
          <div className="mt-10 text-white/70">
            Učitavam meni…
          </div>
        )}

        {!loading && error && (
          <div className="mt-10 text-red-200 bg-red-500/10 border border-red-500/20 rounded-2xl p-4">
            {error}
          </div>
        )}

        {!loading && !error && (
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
                      onError={handleImgError}
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

                      <div className="shrink-0 text-yellow-300 font-black">
                        {formatEUR(cents)}
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-white/50">
                        {normalizeCategory((row as any).category)}
                      </span>

                      <button
                        onClick={() => addToCart(row)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-400 text-black font-black hover:brightness-95 active:brightness-90 transition"
                      >
                        <span className="inline-flex">🛒</span>
                        Dodaj
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
