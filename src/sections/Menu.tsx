import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartProvider";
import type { CartItem } from "../context/CartContext";
import { formatEUR } from "../lib/money";

type DbMenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image: string | null;

  // koristimo cents kao primarni izvor
  price_eur_cents: number | null;

  // legacy fallback
  price: number | null;

  created_at?: string;
};

type CategoryKey = "dodaci" | "pica" | "pizza" | "sosevi";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  dodaci: "Dodaci",
  pica: "Pića",
  pizza: "Pizza",
  sosevi: "Sosevi",
};

function safeBasename(path: string) {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : clean;
}

function normalizeImagePath(image: string | null) {
  if (!image) return "/menu/about.png";

  // već dobro
  if (image.startsWith("/menu/")) return image;

  // ako je došlo /public/menu/... to treba bez /public (public je root)
  if (image.startsWith("/public/")) {
    const file = safeBasename(image);
    return `/menu/${file}`;
  }

  // ako je došlo /drinks/... ili /extras/... a mi u public nemamo te foldere na vercelu, fallback na /menu/<file>
  if (image.startsWith("/drinks/") || image.startsWith("/extras/")) {
    const file = safeBasename(image);
    return `/menu/${file}`;
  }

  // relative -> napravi absolute
  if (!image.startsWith("/")) return `/${image}`;

  return image;
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.onerror = null;
  img.src = "/menu/about.png";
}

export default function Menu() {
  const { addToCart } = useCart();

  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("pizza");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const cat = activeCategory.toLowerCase();
    return items.filter((i) => (i.category || "").toLowerCase() === cat);
  }, [items, activeCategory]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      // bitno: ne tražimo kolone koje ne postoje (npr size)
      const { data, error } = await supabase
        .from("menu_items")
        .select("id,name,description,category,image,price_eur_cents,price,created_at")
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        setError(error.message);
        setItems([]);
      } else {
        setItems((data ?? []) as DbMenuItem[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function onAdd(row: DbMenuItem) {
    const cents =
      typeof row.price_eur_cents === "number"
        ? row.price_eur_cents
        : typeof row.price === "number"
          ? row.price
          : 0;

    const cartItem: CartItem = {
      id: row.id,
      name: row.name,
      price: cents, // KLJUČNO: CartProvider očekuje "price"
      image: normalizeImagePath(row.image),
      description: row.description ?? "",
      category: row.category ?? "",
      quantity: 1,
      // ostalo CartProvider sam normalizuje (pizza size, variants itd)
    };

    addToCart(cartItem);
  }

  return (
    <section id="meni" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10">
      <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-white">Meni</h2>
      <p className="mb-6 text-sm text-white/70">Izaberi kategoriju i dodaj u korpu. Cijene su prikazane u €.</p>

      <div className="mb-6 flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((k) => {
          const active = k === activeCategory;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setActiveCategory(k)}
              className={[
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                active ? "bg-[#f2b400] text-black" : "bg-white/10 text-white hover:bg-white/15",
              ].join(" ")}
            >
              {CATEGORY_LABELS[k]}
            </button>
          );
        })}
      </div>

      {loading && <div className="rounded-xl bg-white/5 p-4 text-white/80">Učitavam meni…</div>}

      {error && <div className="rounded-xl bg-red-500/10 p-4 text-red-200">{error}</div>}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((row) => {
            const imgSrc = normalizeImagePath(row.image);
            const cents =
              typeof row.price_eur_cents === "number"
                ? row.price_eur_cents
                : typeof row.price === "number"
                  ? row.price
                  : 0;

            return (
              <div
                key={row.id}
                className="overflow-hidden rounded-3xl bg-black/50 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
              >
                <img
                  src={imgSrc}
                  alt={row.name}
                  className="h-44 w-full object-cover"
                  loading="lazy"
                  onError={handleImgError}
                />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-extrabold text-white">{row.name}</div>
                      {row.description ? <div className="mt-1 text-sm text-white/70">{row.description}</div> : null}
                      <div className="mt-3 text-xs text-white/50">{(row.category || "").toLowerCase()}</div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold text-[#f2b400]">{formatEUR(cents)}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => onAdd(row)}
                      className="inline-flex items-center gap-2 rounded-full bg-[#f2b400] px-5 py-2 text-sm font-extrabold text-black hover:brightness-95"
                    >
                      <span>🛒</span>
                      Dodaj
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
