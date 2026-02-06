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
  price_eur_cents: number | null;
  price: number | null;
  created_at?: string;
};

type CategoryKey = "pizza" | "pica";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  pizza: "Pizza",
  pica: "Pića",
};

function safeBasename(path: string) {
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : clean;
}

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function normalizeCategory(value: string) {
  return normalizeText(value);
}

function isPizza50cmName(name: string) {
  return /\b50\s*cm\b/i.test(String(name ?? ""));
}

/**
 * ✅ BITNO: nikad ne vraćamo "about.png" ili neku izmišljenu sliku.
 * Ako nema slike -> null (nema network requesta).
 */
function normalizeImagePath(image: string | null): string | null {
  if (!image) return null;

  const trimmed = image.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/menu/")) return trimmed;

  if (trimmed.startsWith("/public/")) {
    const file = safeBasename(trimmed);
    return `/menu/${file}`;
  }

  if (trimmed.startsWith("/drinks/") || trimmed.startsWith("/extras/")) {
    const file = safeBasename(trimmed);
    return `/menu/${file}`;
  }

  if (!trimmed.startsWith("/")) return `/${trimmed}`;
  return trimmed;
}

function handleImgError(e: React.SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;

  // ✅ Stabilno: kad failuje, ne pokušavamo drugi URL (da ne pravimo 404 spam)
  img.onerror = null;

  // Sakrij sliku
  img.style.display = "none";

  // Pokaži placeholder odmah posle <img>
  const placeholder = img.nextElementSibling as HTMLElement | null;
  if (placeholder) {
    placeholder.style.display = "flex";
  }
}

/**
 * Stabilna klasifikacija kategorija iz baze (bez migracija):
 * - pizza: "pizza", "pizze", "pice"
 * - pica: "pica", "pice", "pića", "pice", "drinks", "napici", "napitci", "sokovi"
 */
const PIZZA_ALIASES = new Set<string>(["pizza", "pizze", "pice"]);
const DRINKS_ALIASES = new Set<string>([
  "pica",
  "pice",
  "pića",
  "pice",
  "drinks",
  "napici",
  "napitci",
  "sokovi",
  "voda",
  "gazirano",
  "negazirano",
]);

function isInUiCategory(rowCategoryRaw: string, uiCategory: CategoryKey): boolean {
  const c = normalizeCategory(rowCategoryRaw);

  if (uiCategory === "pizza") return PIZZA_ALIASES.has(c);
  return DRINKS_ALIASES.has(c);
}

export default function Menu() {
  const { addToCart } = useCart();

  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("pizza");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const byCategory = items.filter((i) => isInUiCategory(i.category || "", activeCategory));

    if (activeCategory === "pizza") {
      return byCategory.filter((i) => !isPizza50cmName(i.name));
    }

    return byCategory;
  }, [items, activeCategory]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

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

    const img = normalizeImagePath(row.image);

    const cartItem: CartItem = {
      id: row.id,
      name: row.name,
      price: cents,
      // ✅ ako nema slike, stavi prazno (CartDrawer ima svoje ponašanje, a ovdje nema spam requesta)
      image: img ?? "",
      description: row.description ?? "",
      category: row.category ?? "",
      quantity: 1,
    };

    addToCart(cartItem);
  }

  return (
    <section id="meni" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-10">
      <h2 className="mb-2 text-4xl font-extrabold tracking-tight text-white">Meni</h2>
      <p className="mb-6 text-sm text-white/70">
        Izaberi kategoriju i dodaj u korpu. Cijene su prikazane u €.
      </p>

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

      {loading && (
        <div className="rounded-xl bg-white/5 p-4 text-white/80">Učitavam meni…</div>
      )}

      {error && (
        <div className="rounded-xl bg-red-500/10 p-4 text-red-200">{error}</div>
      )}

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
                {imgSrc ? (
                  <>
                    <img
                      src={imgSrc}
                      alt={row.name}
                      className="h-44 w-full object-cover"
                      loading="lazy"
                      onError={handleImgError}
                    />
                    {/* placeholder (skriven dok slika ne failuje) */}
                    <div
                      className="h-44 w-full items-center justify-center bg-white/5 text-white/40 text-sm font-semibold"
                      style={{ display: "none" }}
                    >
                      Nema slike
                    </div>
                  </>
                ) : (
                  <div className="h-44 w-full flex items-center justify-center bg-white/5 text-white/40 text-sm font-semibold">
                    Nema slike
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-extrabold text-white">{row.name}</div>
                      {row.description ? (
                        <div className="mt-1 text-sm text-white/70">{row.description}</div>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold text-[#f2b400]">
                        {formatEUR(cents)}
                      </div>
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
