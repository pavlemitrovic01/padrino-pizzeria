// Putanja: src/sections/Menu.tsx
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartProvider";
import { PizzaSize, isPizzaSize } from "../context/CartContext";

type MenuItemRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  image: string | null;
  sizes: unknown; // moze biti object/string/null
  is_active: boolean | null;
};

type ParsedSizes = Partial<Record<PizzaSize, number>>;

const normalizeCategory = (c: string | null | undefined) =>
  (c || "").trim().toLowerCase();

function resolveMenuImage(row: MenuItemRow): string {
  if (row.image && typeof row.image === "string" && row.image.trim() !== "") {
    return row.image.trim();
  }

  // Fallback dok ne ubacis sve slike
  const cat = normalizeCategory(row.category);
  if (cat.includes("pizza")) return "/menu/anatoli.png";
  if (cat.includes("dodaci")) return "/menu/anatoli.png";
  if (cat.includes("pice")) return "/menu/anatoli.png";
  if (cat.includes("sos")) return "/menu/anatoli.png";

  return "/menu/anatoli.png";
}

function tryParseJson(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function toIntPrice(v: unknown): number | null {
  // očekujemo EUR cente (int) ili broj
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function parseSizes(raw: unknown): ParsedSizes {
  // Podržava:
  // - object: { "33": 1100, "50": 1700 }
  // - json string: "{...}"
  // - null/undefined -> {}
  if (raw == null) return {};

  let obj: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) obj = tryParseJson(trimmed);
    else return {};
  }

  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return {};

  const rec = obj as Record<string, unknown>;
  const out: ParsedSizes = {};

  const p33 = toIntPrice(rec["33"]);
  const p50 = toIntPrice(rec["50"]);

  if (p33 != null) out["33"] = p33;
  if (p50 != null) out["50"] = p50;

  return out;
}

function pickDefaultSizeKey(sizes: ParsedSizes): PizzaSize | null {
  if (sizes["33"] != null) return "33";
  if (sizes["50"] != null) return "50";
  return null;
}

function formatEur(cents: number): string {
  const eur = (cents / 100).toFixed(2);
  // Zamijeni tacku zarezom radi prikaza
  return `${eur.replace(".", ",")} €`;
}

function CartIconSvg() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

  const [rows, setRows] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from("menu_items")
        .select("id,name,description,category,image,sizes,is_active")
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (cancelled) return;

      if (err) {
        setError(err.message || "Greška pri učitavanju menija.");
        setRows([]);
        setLoading(false);
        return;
      }

      const list = Array.isArray(data) ? (data as MenuItemRow[]) : [];
      // Prikaži samo aktivne ako postoji flag
      const filtered = list.filter((r) => r && (r.is_active === null || r.is_active === true));

      setRows(filtered);
      setLoading(false);
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<string, MenuItemRow[]>();
    for (const r of rows) {
      const key = (r.category || "Ostalo").trim() || "Ostalo";
      const arr = map.get(key) || [];
      arr.push(r);
      map.set(key, arr);
    }

    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [rows]);

  if (loading) {
    return (
      <section className="px-4 py-10">
        <h2 className="text-3xl font-semibold text-white mb-6">Meni</h2>
        <div className="text-white/70">Učitavam...</div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="px-4 py-10">
        <h2 className="text-3xl font-semibold text-white mb-6">Meni</h2>
        <div className="text-red-300">{error}</div>
      </section>
    );
  }

  return (
    <section className="px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-3xl font-semibold text-white">Meni</h2>
      </div>

      <div className="space-y-10">
        {grouped.map(([category, items]) => (
          <div key={category}>
            <h3 className="text-xl font-semibold text-white mb-4">
              {category}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((row) => {
                const img = resolveMenuImage(row);
                const sizes = parseSizes(row.sizes);
                const defaultSizeKey = pickDefaultSizeKey(sizes);

                const safeSize: PizzaSize | null =
                  defaultSizeKey && isPizzaSize(defaultSizeKey)
                    ? defaultSizeKey
                    : null;

                const price =
                  (safeSize ? sizes[safeSize] : null) ??
                  sizes["33"] ??
                  sizes["50"] ??
                  0;

                return (
                  <motion.div
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.25 }}
                    className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden shadow-sm"
                  >
                    <div className="aspect-[16/9] bg-black/30">
                      <img
                        src={img}
                        alt={row.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-white font-semibold">
                            {row.name}
                          </div>
                          {row.description ? (
                            <div className="text-white/70 text-sm mt-1">
                              {row.description}
                            </div>
                          ) : null}
                        </div>

                        <div className="text-yellow-300 font-semibold whitespace-nowrap">
                          {formatEur(price)}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-white/60 text-xs">
                          {safeSize ? `Veličina: ${safeSize} cm` : ""}
                        </div>

                        <button
                          className="shrink-0 inline-flex items-center gap-2 rounded-full bg-yellow-400 text-black font-semibold px-4 py-2 hover:bg-yellow-300 transition"
                          onClick={() => {
                            // BITNO: bez cart_id i bez menu_item_id
                            // id ostaje row.id (CartProvider će normalizovati za pizze po baseKey)
                            addToCart({
                              id: row.id,
                              name: row.name,
                              description: row.description ?? null,
                              category: row.category ?? "Ostalo",
                              image: img,
                              quantity: 1,
                              price: price ?? 0,
                              size: safeSize, // PizzaSize | null
                              addons: [],
                              note: "",
                              // Interno koristimo camelCase (CartProvider već očekuje menuItemId)
                              menuItemId: row.id,
                              // variants/basePrice/baseKey ostavi da CartProvider normalizuje
                            } as any);
                          }}
                        >
                          <span className="inline-flex items-center justify-center">
                            <CartIconSvg />
                          </span>
                          Dodaj
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
