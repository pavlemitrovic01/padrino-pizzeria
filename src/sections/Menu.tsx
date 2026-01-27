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
          setItems((data ?? []) as MenuItemData[]);
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

    return (
      <div className="space-y-5">
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

  const renderDodaci = (data: MenuItemData[]) => {
    if (data.length === 0) {
      return <p className="text-sm text-gray-500">Trenutno nema dodataka u ponudi.</p>;
    }

    return (
      <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
        <p className="text-sm text-gray-300 leading-relaxed">
          Dodaci se biraju <span className="text-white font-semibold">u korpi</span> uz izabranu
          stavku. Ovo je spisak dostupnih dodataka i cijena:
        </p>

        <div className="mt-4 space-y-2">
          {data.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <div>
                <p className="text-white font-semibold">{d.name}</p>
                {d.description ? (
                  <p className="text-xs text-gray-400 mt-1">{d.description}</p>
                ) : null}
              </div>
              <p className="text-white font-bold">{d.price} RSD</p>
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 mt-4">
          * Dodaci se računaju po komadu (množe se sa količinom stavke u korpi).
        </p>
      </div>
    );
  };

  const PromoCard = () => (
    <div className="mt-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
        <div className="absolute inset-0">
          <img
            src="/menu-hero.jpg"
            alt="Padrino promo"
            className="w-full h-full object-cover opacity-35"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/85" />
        </div>

        <div className="relative z-10 p-6 md:p-7">
          <p className="text-xs text-yellow-400 font-bold tracking-wide">VAŽNO</p>

          <h4 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            Veličinu i dodatke biraš u korpi
          </h4>

          <p className="text-gray-300 mt-3 max-w-xl leading-relaxed">
            Izaberi pizzu iz menija, a onda u korpi odaberi veličinu (33 / 50 cm),
            soseve i ostale dodatke. Brzo, jasno i bezbjedno.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Pizza 33 cm / 50 cm
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Dodaci u korpi
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Napomena uz stavku
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <section id="menu" className="relative bg-black">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/85 to-black" />
        <img
          src="/menu-hero.jpg"
          alt="Pozadina pizzerije"
          className="w-full h-full object-cover opacity-35"
        />
      </div>

      <div className="relative z-10 px-6 py-28">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">Naš meni</h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Autentične pizze i osvježavajuća pića — veličinu biraš u korpi.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/5 bg-gradient-to-b from-[#0f0f0f] to-[#070707] shadow-2xl">
            <div className="p-6 md:p-10">
              {loading ? (
                <div className="py-24 text-center text-gray-400">Učitavanje menija…</div>
              ) : (
                <div className="grid gap-10 lg:grid-cols-12">
                  {/* PIZZA + DODACI */}
                  <div className="lg:col-span-8 space-y-10">
                    {/* Pizza */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-white">Pizza</h3>
                      </div>
                      <div className="h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
                      {renderPizzaGrid(pizzaMenuList)}
                    </div>

                    {/* Dodaci */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-bold text-white">Dodaci</h3>
                      </div>
                      <div className="h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
                      {renderDodaci(dodaciItems)}
                    </div>

                    <PromoCard />
                  </div>

                  {/* Pića */}
                  <div className="lg:col-span-4 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-white">Pića</h3>
                    </div>
                    <div className="h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />
                    {renderPica(picaItems)}
                  </div>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-10">
            * Veličinu pizze i dodatke biraš u korpi prije poručivanja.
          </p>
        </div>
      </div>
    </section>
  );
}
