import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { ShoppingCart } from "lucide-react";
import { useCart } from "../context/CartProvider";

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  sizes: any;
  is_active: boolean | null;
};

const normalizeCategory = (c: string | null | undefined) => (c || "").trim().toLowerCase();

function resolveMenuImage(row: MenuItemRow): string {
  if (row.image && typeof row.image === "string" && row.image.trim() !== "") return row.image.trim();
  const cat = normalizeCategory(row.category);
  if (cat.includes("pizza")) return "/menu/anatoli.png";
  if (cat.includes("dodaci")) return "/menu/anatoli.png";
  if (cat.includes("pice")) return "/menu/anatoli.png";
  return "/menu/anatoli.png";
}

export default function Menu() {
  const [items, setItems] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,description,category,image,sizes,is_active")
          .eq("is_active", true)
          .order("category", { ascending: true })
          .order("name", { ascending: true });

        if (!alive) return;
        if (error) {
          console.error("[Menu] failed to load menu_items:", error);
          setItems([]);
        } else {
          setItems((data || []) as MenuItemRow[]);
        }
      } catch (e) {
        console.error("[Menu] unexpected error:", e);
        if (!alive) return;
        setItems([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemRow[]>();
    for (const it of items) {
      const cat = normalizeCategory(it.category) || "ostalo";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(it);
    }
    return Array.from(map.entries());
  }, [items]);

  const heroImage = useMemo(() => "/menu/anatoli.png", []);

  return (
    <section id="meni" className="py-20 bg-black">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl font-bold text-white mb-6">Naš meni</h2>
          <p className="text-gray-300 text-lg mb-10">
            Autentične pice i osvježavajuća pića — veličinu biraš u korpi.
          </p>

          <div className="relative rounded-2xl overflow-hidden mb-14">
            <img
              src={heroImage}
              alt="Padrino meni"
              className="w-full h-52 object-cover opacity-60"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center text-gray-400 py-10">Učitavanje menija…</div>
        ) : (
          <div className="space-y-12">
            {grouped.map(([cat, rows]) => (
              <div key={cat}>
                <h3 className="text-2xl font-semibold text-white mb-6 capitalize">
                  {cat}
                </h3>

                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rows.map((row) => {
                    const img = resolveMenuImage(row);
                    const sizesObj = row.sizes && typeof row.sizes === "object" ? row.sizes : {};
                    const firstSizeKey = Object.keys(sizesObj)[0] || "33";
                    const price =
                      typeof (sizesObj as any)?.[firstSizeKey] === "number"
                        ? (sizesObj as any)[firstSizeKey]
                        : null;

                    return (
                      <motion.div
                        key={row.id}
                        whileHover={{ scale: 1.02 }}
                        className="bg-[#111111] rounded-2xl border border-gray-800 overflow-hidden shadow"
                      >
                        <div className="h-40 bg-black/40">
                          <img
                            src={img}
                            alt={row.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>

                        <div className="p-5 text-left">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h4 className="text-lg font-semibold text-white">
                                {row.name}
                              </h4>
                              {row.description ? (
                                <p className="text-sm text-gray-400 mt-1">
                                  {row.description}
                                </p>
                              ) : null}
                            </div>

                            <button
                              className="shrink-0 inline-flex items-center gap-2 bg-yellow-400 text-black px-3 py-2 rounded-full font-semibold hover:bg-yellow-300 transition"
                              onClick={() => {
                                addToCart({
                                  cart_id: row.name,
                                  menu_item_id: row.id,
                                  name: row.name,
                                  size: firstSizeKey,
                                  quantity: 1,
                                  base_price: price ?? 0,
                                  price_per_item: price ?? 0,
                                  addons: [],
                                  note: null,
                                  image: img,
                                  category: row.category || "menu",
                                });
                              }}
                            >
                              <ShoppingCart className="w-4 h-4" />
                              Dodaj
                            </button>
                          </div>

                          <div className="mt-4 flex items-baseline justify-between">
                            <span className="text-gray-400 text-sm">Od</span>
                            <span className="text-yellow-400 font-bold text-lg">
                              {price !== null ? `${(price / 100).toFixed(2)} €` : "—"}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
