import { useEffect, useMemo, useState } from "react";
import type { SyntheticEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/useCart";

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  price_eur_cents: number;
  category: string;
  image: string | null;
  size: string | null;
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
  // Stabilan fallback (mora postojati u public/menu/)
  const fallback = "/menu/about.png";
  if (!image) return fallback;

  // Već ispravna putanja u projektu
  if (image.startsWith("/menu/")) return image;

  // Ako u bazi stoje stare rute (/drinks, /extras, /public/...), prebacimo na /menu/<basename>
  if (image.startsWith("/drinks/") || image.startsWith("/extras/") || image.startsWith("/public/")) {
    const file = safeBasename(image);
    return `/menu/${file}`;
  }

  // Ako je bez leading slash
  if (!image.startsWith("/")) return `/${image}`;

  return image;
}

function handleImgError(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  img.onerror = null; // spriječi infinite loop
  img.src = "/menu/about.png";
}

async function fetchMenuItems(): Promise<{ data: MenuItemRow[]; error: string | null }> {
  // 1) Pokušaj sa created_at (ako postoji)
  const first = await supabase
    .from("menu_items")
    .select("id,name,description,price_eur_cents,category,image,size")
    .order("created_at", { ascending: false });

  if (!first.error) {
    return { data: (first.data ?? []) as MenuItemRow[], error: null };
  }

  // 2) Fallback ako created_at ne postoji / pravi problem
  const second = await supabase
    .from("menu_items")
    .select("id,name,description,price_eur_cents,category,image,size")
    .order("id", { ascending: false });

  if (second.error) {
    return { data: [], error: second.error.message || "Greška pri učitavanju menija." };
  }

  return { data: (second.data ?? []) as MenuItemRow[], error: null };
}

export default function Menu() {
  const { addToCart } = useCart();

  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("pizza");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    const wanted = activeCategory.toLowerCase();

    return items.filter((i) => {
      const cat = String(i.category || "").toLowerCase();

      // podrži i varijante iz baze: "pice" -> "pica", "sosovi/sos" -> "sosevi"
      if (wanted === "pica") return cat === "pica" || cat === "pice" || cat === "drinks";
      if (wanted === "sosevi") return cat === "sosevi" || cat === "sosovi" || cat === "sos" || cat === "sauces";
      return cat === wanted;
    });
  }, [items, activeCategory]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      const res = await fetchMenuItems();
      if (cancelled) return;

      if (res.error) {
        setItems([]);
        setError(res.error);
      } else {
        setItems(res.data);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
          {filteredItems.map((item) => {
            const imgSrc = normalizeImagePath(item.image);
            const priceEur =
              typeof item.price_eur_cents === "number"
                ? (item.price_eur_cents / 100).toFixed(2).replace(".", ",")
                : "0,00";

            return (
              <div
                key={item.id}
                className="overflow-hidden rounded-3xl bg-black/50 shadow-[0_8px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/10"
              >
                <img
                  src={imgSrc}
                  alt={item.name}
                  className="h-44 w-full object-cover"
                  loading="lazy"
                  onError={handleImgError}
                />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-extrabold text-white">{item.name}</div>
                      {item.description ? <div className="mt-1 text-sm text-white/70">{item.description}</div> : null}
                      <div className="mt-3 text-xs text-white/50">{String(item.category || "").toLowerCase()}</div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-extrabold text-[#f2b400]">{priceEur} €</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        addToCart({
                          id: item.id,
                          name: item.name,
                          image: imgSrc,
                          category: String(item.category || "").toLowerCase(),
                          quantity: 1,
                          base_price: item.price_eur_cents,
                          price_per_item: item.price_eur_cents,
                          menu_item_id: item.id,
                          size: item.size ?? null,
                          note: null,
                          addons: [],
                          cart_id: item.name,
                        } as any)
                      }
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
