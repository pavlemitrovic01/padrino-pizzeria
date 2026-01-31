// Putanja: src/sections/Menu.tsx
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

function pickFallbackImage(category: string) {
  // Stabilno: imamo garantovane fajlove u /public/menu (nema slika za svako piće/pizzu u DB-u).
  // Cilj: bez 404 spam-a u produkciji.
  const c = normalizeCategory(category);
  if (c === "pica") return "/menu/about.png";
  // default za sve ostalo (pizza, dodaci, itd.)
  return "/menu/margherita.png";
}

function resolveMenuImage(raw: unknown, category: string, name: string) {
  const fallback = pickFallbackImage(category);

  if (typeof raw !== "string") return fallback;

  const trimmed = raw.trim();
  if (!trimmed) return fallback;

  // Full URL (Supabase storage ili eksterni CDN) – ostavi kako jeste
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  // Apsolutna putanja iz /public
  if (trimmed.startsWith("/")) {
    // legacy value u kodu
    if (trimmed === "/menu-hero.jpg") return "/menu/margherita.png";
    return trimmed;
  }

  // Ako iz baze dolazi samo ime fajla (npr "margherita.png" ili "capricciosa.jpg"),
  // pokušaj da ga mapiramo na postojeće /public/menu/*.png.
  const file = trimmed.toLowerCase();
  const byName = name.toLowerCase();

  const mapTo = (slug: string) => `/menu/${slug}.png`;

  // Najčešći fallback-ovi (ako se ikad pojave u bazi)
  if (file.includes("margherita") || byName.includes("margherita")) return mapTo("margherita");
  if (file.includes("capricciosa") || byName.includes("capricciosa")) return mapTo("capricciosa");
  if (file.includes("diavola") || byName.includes("diavolo") || byName.includes("diavola"))
    return mapTo("diavola");
  if (file.includes("pesto") || byName.includes("pesto")) return mapTo("pesto");
  if (file.includes("vegetariana") || byName.includes("vegetariana")) return mapTo("vegetariana");
  if (file.includes("quattro") || byName.includes("quattro")) return mapTo("quattro-formaggi");

  // Ako baš imamo PNG, pokušaj iz /menu (ali samo za poznate slučajeve gore).
  // U suprotnom – stabilan fallback.
  return fallback;
}

function normalizeCategory(value: string) {
  return value
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function isPizzaSize(name: string, size: 33 | 50) {
  const safe = name.toLowerCase();
  const re = new RegExp(`\\b${size}\\s*cm\\b`, "i");
  return re.test(safe);
}

function stripSizeFromName(name: string) {
  return name
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPiroska(name: string) {
  const n = name.toLowerCase();
  return n.includes("piroska") || n.includes("piroška");
}

type PizzaVariantsProp = Partial<
  Record<"33" | "50", { id: string; price: number; category: string }>
>;

type PizzaDisplayItem = {
  baseKey: string;
  base: MenuItemData; // reprezentativni item (opis/slika)
  variants: PizzaVariantsProp;
};

export default function Menu() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          console.error("Greška pri učitavanju menija:", error);
          setItems([]);
        } else {
          setItems(
            ((data ?? []) as MenuItemData[]).map((row) => ({
              ...row,
              image: resolveMenuImage(row.image, row.category, row.name),
            }))
          );
        }
        setLoading(false);
      });
  }, []);

  // ----- PIZZA: grupišemo 33/50 po istom baseKey -----
  const pizzaGrouped = useMemo(() => {
    const pizzaRows = items.filter((i) => normalizeCategory(i.category) === "pizza");
    const map = new Map<string, PizzaDisplayItem>();

    for (const row of pizzaRows) {
      const size: PizzaSize | null = isPizzaSize(row.name, 50)
        ? "50"
        : isPizzaSize(row.name, 33)
        ? "33"
        : null;

      // Ako nije prepoznata veličina, tretiramo kao “33”
      const safeSize: PizzaSize = size ?? "33";
      const baseKey = stripSizeFromName(row.name);

      const existing = map.get(baseKey);

      const nextVariants: PizzaVariantsProp = {
        ...(existing?.variants ?? {}),
        [safeSize]: {
          id: row.id,
          price: row.price,
          category: row.category,
        },
      };

      // base: preferiramo 33 kao reprezentativnu (opis/slika)
      const shouldReplaceBase =
        !existing ||
        (safeSize === "33" && (!existing.base || isPizzaSize(existing.base.name, 50)));

      map.set(baseKey, {
        baseKey,
        base: shouldReplaceBase ? row : (existing?.base ?? row),
        variants: nextVariants,
      });
    }

    // sortiranje: piroška na kraj, ostalo po imenu
    return [...map.values()].sort((a, b) => {
      const ap = isPiroska(a.baseKey) ? 1 : 0;
      const bp = isPiroska(b.baseKey) ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return a.baseKey.localeCompare(b.baseKey);
    });
  }, [items]);

  // ✅ OPCIJA A: u meniju prikazujemo jednu “Pizza” listu
  // cijenu i default veličinu uzimamo: 33 ako postoji, inače 50
  const pizzaMenuList = useMemo(() => {
    return pizzaGrouped.filter((p) => Boolean(p.variants["33"] || p.variants["50"]));
  }, [pizzaGrouped]);

  const picaItems = useMemo(() => {
    return items.filter((i) => normalizeCategory(i.category) === "pica");
  }, [items]);

  const dodaciItems = useMemo(() => {
    return items
      .filter((i) => normalizeCategory(i.category) === "dodaci")
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const renderPizzaGrid = (data: PizzaDisplayItem[]) => {
    if (data.length === 0) {
      return <p className="text-sm text-gray-500">Trenutno nema pizza u ponudi.</p>;
    }

    const isOdd = data.length % 2 === 1;

    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {data.map((p, idx) => {
          const isLast = idx === data.length - 1;
          const wrapperClass =
            isOdd && isLast ? "sm:col-span-2 sm:max-w-[520px] sm:mx-auto" : "";

          const v33 = p.variants["33"];
          const v50 = p.variants["50"];

          const defaultSize: PizzaSize = v33 ? "33" : "50";
          const v = defaultSize === "33" ? v33 : v50;

          if (!v) return null;

          return (
            <div key={p.baseKey} className={wrapperClass}>
              <MenuItem
                id={v.id}
                name={p.baseKey}
                description={p.base.description}
                price={v.price}
                image={p.base.image}
                category={v.category}
                // bitno: u korpi se poslije bira 33/50
                pizzaSize={defaultSize}
                baseKey={p.baseKey}
                variants={p.variants}
              />
            </div>
          );
        })}
      </div>
    );
  };

  const renderPica = (data: MenuItemData[]) => {
    if (data.length === 0) {
      return <p className="text-sm text-gray-500">Trenutno nema pića u ponudi.</p>;
    }

    // Standardizuj količine pića u nazivu
    function standardizeDrinkName(name: string): string {
      // Coca-Cola, Fanta, Sprite → 0.33 l
      if (/^(coca[- ]?cola|coke|fanta|sprite)/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.33 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.33 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.33 l");
      }
      // Bravo sokovi → 0.25 l
      if (/^bravo/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.25 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.25 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.25 l");
      }
      // Nikšićko pivo → 0.5 l
      if (/niksicko|nikšićko/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.5 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.5 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.5 l");
      }
      // Rosa voda → 0.5 l
      if (/rosa/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.5 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.5 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.5 l");
      }
      // Knjaz Miloš → 0.5 l
      if (/knjaz/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.5 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.5 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.5 l");
      }
      // Heineken → 0.25 l
      if (/heineken/i.test(name)) {
        return name
          .replace(
            /(0[.,]?\s?\d{2,3}\s?(l|L|ml)?|0[.,]?\d{2,3})/gi,
            "0.25 l"
          )
          .replace(/([\d.,]+\s?(l|L|ml))/gi, "0.25 l")
          .replace(/([\d.,]+)(\s?l)/gi, "0.25 l");
      }
      return name;
    }

    return (
      <div className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          {data.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              name={standardizeDrinkName(item.name)}
              description={item.description}
              price={item.price}
              image={item.image}
              category={item.category}
            />
          ))}
        </div>
      </div>
    );
  };

  const renderDodaci = (data: MenuItemData[]) => {
    if (data.length === 0) {
      return null;
    }

    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {data.map((item) => (
          <MenuItem
            key={item.id}
            id={item.id}
            name={item.name}
            description={item.description}
            price={item.price}
            image={item.image}
            category={item.category}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <section id="menu" className="bg-black text-white py-20">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-4xl font-extrabold mb-6">Naš meni</h2>
          <p className="text-gray-400">Učitavam meni…</p>
        </div>
      </section>
    );
  }

  return (
    <section id="menu" className="bg-black text-white py-20">
      <div className="max-w-5xl mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#111]">
          <div className="absolute inset-0">
            <img
              src="/menu/margherita.png"
              alt="Menu"
              className="h-full w-full object-cover opacity-25"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black" />
          </div>

          <div className="relative p-8 md:p-10">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Naš meni</h2>
            <p className="text-gray-300 mt-3 max-w-2xl">
              Autentične pице i osvježavajuća pića — veličinu biraš u korpi.
            </p>
          </div>
        </div>

        <div className="mt-10 space-y-14">
          {/* PIZZA */}
          <div>
            <h3 className="text-2xl font-extrabold mb-4">Pizza</h3>
            {renderPizzaGrid(pizzaMenuList)}
          </div>

          {/* PIĆA */}
          <div>
            <h3 className="text-2xl font-extrabold mb-4">Pića</h3>
            {renderPica(picaItems)}
          </div>

          {/* DODACI */}
          {dodaciItems.length > 0 ? (
            <div>
              <h3 className="text-2xl font-extrabold mb-4">Dodaci</h3>
              {renderDodaci(dodaciItems)}
            </div>
          ) : null}
        </div>

        <div className="mt-14 relative overflow-hidden rounded-3xl border border-white/10 bg-[#111]">
          <div className="absolute inset-0">
            <img
              src="/menu/margherita.png"
              alt="Menu"
              className="h-full w-full object-cover opacity-25"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/70 to-black" />
          </div>

          <div className="relative p-8 md:p-10">
            <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Poruči brzo i jednostavno
            </h3>
            <p className="text-gray-300 mt-3 max-w-2xl">
              Dodaj omiljene stavke u korpu, izaberi veličinu pице i završi porudžbinu za minut.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
