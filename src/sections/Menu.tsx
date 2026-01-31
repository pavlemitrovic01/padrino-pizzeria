import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import MenuItem from "../components/MenuItem";
import type { PizzaSize } from "../context/CartContext";

type MenuItemData = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
};

type PizzaVariantsProp = Partial<
  Record<"33" | "50", { id: string; price: number; category: string }>
>;

type PizzaDisplayItem = {
  id: string;
  baseKey: string;
  name: string;
  description: string;
  category: string;
  image: string;
  variants: PizzaVariantsProp;
  defaultSize: PizzaSize;
  defaultPrice: number;
};

function normalize(value: string) {
  return (value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("đ", "dj")
    .replaceAll("ž", "z")
    .trim();
}

function stripExt(filename: string) {
  return filename.replace(/\.(png|jpg|jpeg|webp)$/i, "");
}

function lastSegment(path: string) {
  const clean = path.split("?")[0].split("#")[0];
  const parts = clean.split("/").filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

/**
 * Fix za Vercel 404:
 * - Baza ima legacy putanje /pizza/*.jpg i /drinks/*.jpg
 * - U repo-u realno postoji public/menu/*.png
 *
 * Pravilo:
 * - full URL => koristi
 * - /menu/* => koristi
 * - /pizza/* ili golo ime => mapiraj na /menu/<name>.png
 * - pića (pica) => placeholder (/menu/about.png) dok ne ubaciš drink slike
 */
function resolveMenuImage(item: MenuItemData): string {
  const raw = (item.image ?? "").trim();
  const cat = normalize(item.category);

  // Pića trenutno nemaju fajlove u public/ => da ne spamuje 404, držimo placeholder
  if (cat === "pica" || cat === "pica" || cat === "pica") {
    return "/menu/about.png";
  }

  if (!raw) return "/menu/about.png";

  // Full URL (Supabase Storage/CDN)
  if (/^https?:\/\//i.test(raw)) return raw;

  // Ako je već pravilno iz public/menu
  if (raw.startsWith("/menu/")) return raw;

  // Legacy putanje ("/pizza/x.jpg", "/drinks/x.jpg") ili "x.jpg"
  const base = stripExt(lastSegment(raw));
  if (!base) return "/menu/about.png";

  // Mapiramo na postojeći folder i ekstenziju (.png)
  return `/menu/${base}.png`;
}

function isPizzaSize(name: string, size: 33 | 50) {
  const safe = name ?? "";
  const re = new RegExp(`\\b${size}\\s*cm\\b`, "i");
  return re.test(safe);
}

function stripSizeFromName(name: string) {
  return name
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function slugify(input: string) {
  return (input ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("đ", "dj")
    .replaceAll("ž", "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function Menu() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          // eslint-disable-next-line no-console
          console.error("Greška pri učitavanju menija:", error);
          setItems([]);
        } else {
          setItems((data ?? []) as MenuItemData[]);
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const pizzaGrouped = useMemo(() => {
    const pizzaRows = items.filter((i) => normalize(i.category) === "pizza");
    const map = new Map<string, PizzaDisplayItem>();

    for (const row of pizzaRows) {
      const size: PizzaSize | null = isPizzaSize(row.name, 50)
        ? "50"
        : isPizzaSize(row.name, 33)
          ? "33"
          : null;

      const baseName = stripSizeFromName(row.name);
      const baseKey = slugify(baseName || row.id);

      const existing = map.get(baseKey);

      if (!existing) {
        const defaultSize: PizzaSize = size ?? "33";
        const variants: PizzaVariantsProp = {};

        if (size === "33") variants["33"] = { id: row.id, price: row.price, category: row.category };
        if (size === "50") variants["50"] = { id: row.id, price: row.price, category: row.category };
        if (!size) variants["33"] = { id: row.id, price: row.price, category: row.category };

        map.set(baseKey, {
          id: row.id,
          baseKey,
          name: baseName || row.name,
          description: row.description,
          category: row.category,
          image: resolveMenuImage(row),
          variants,
          defaultSize,
          defaultPrice: row.price,
        });
      } else {
        if (size === "33") existing.variants["33"] = { id: row.id, price: row.price, category: row.category };
        else if (size === "50") existing.variants["50"] = { id: row.id, price: row.price, category: row.category };
        else existing.variants["33"] = { id: row.id, price: row.price, category: row.category };

        // držimo image stabilno kroz resolver
        existing.image = resolveMenuImage(row);

        if (existing.defaultSize === "50" && !existing.variants["50"] && existing.variants["33"]) {
          existing.defaultSize = "33";
          existing.defaultPrice = existing.variants["33"].price;
        }
        if (existing.defaultSize === "33" && !existing.variants["33"] && existing.variants["50"]) {
          existing.defaultSize = "50";
          existing.defaultPrice = existing.variants["50"].price;
        }
      }
    }

    return Array.from(map.values());
  }, [items]);

  const nonPizzaByCategory = useMemo(() => {
    const out = new Map<string, MenuItemData[]>();

    for (const row of items) {
      if (normalize(row.category) === "pizza") continue;

      const key = row.category || "Ostalo";
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push({
        ...row,
        image: resolveMenuImage(row),
      });
    }

    return out;
  }, [items]);

  // Hero slika: trenutno koristi fajl koji sigurno postoji u public/menu/
  const heroImage = useMemo(() => "/menu/about.png", []);

  if (loading) {
    return (
      <section className="bg-black text-white py-16">
        <div className="mx-auto max-w-5xl px-4">
          <p className="text-white/70">Učitavam meni…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-black text-white">
      <div className="relative mx-auto max-w-5xl px-4 pt-16">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121212]">
          <img
            src={heroImage}
            alt="Padrino meni"
            className="h-56 w-full object-cover opacity-60"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <h2 className="text-4xl font-extrabold">Naš meni</h2>
            <p className="mt-2 text-white/70">
              Autentične pice i osvježavajuća pića — veličinu biraš u korpi.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-10">
          <div>
            <h3 className="text-2xl font-extrabold">Pizza</h3>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              {pizzaGrouped.map((p) => (
                <MenuItem
                  key={p.baseKey}
                  id={p.variants[p.defaultSize]?.id ?? p.id}
                  name={p.name}
                  description={p.description}
                  price={p.variants[p.defaultSize]?.price ?? p.defaultPrice}
                  image={p.image}
                  category={p.category}
                  pizzaSize={p.defaultSize}
                  baseKey={p.baseKey}
                  variants={p.variants}
                />
              ))}
            </div>
          </div>

          {Array.from(nonPizzaByCategory.entries()).map(([cat, rows]) => (
            <div key={cat}>
              <h3 className="text-2xl font-extrabold">{cat}</h3>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
                {rows.map((r) => (
                  <MenuItem
                    key={r.id}
                    id={r.id}
                    name={r.name}
                    description={r.description}
                    price={r.price}
                    image={r.image}
                    category={r.category}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="h-12" />
      </div>
    </section>
  );
}
