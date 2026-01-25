import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import MenuItem from "../components/MenuItem";

type MenuItemData = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
};

type MenuSection = {
  key: "pizza33" | "dodaci" | "pica";
  title: string;
  emptyText: string;
};

const MENU_SECTIONS: MenuSection[] = [
  { key: "pizza33", title: "Pizza 33 cm", emptyText: "Trenutno nema pizza 33 cm u ponudi." },
  { key: "dodaci", title: "Dodaci", emptyText: "Trenutno nema dodataka u ponudi." },
  { key: "pica", title: "Pića", emptyText: "Trenutno nema pića u ponudi." },
];

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
          setItems(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  /**
   * Pizza varijante (33/50) i dalje držimo u memoriji,
   * iako 50 cm NE prikazujemo kao posebnu sekciju.
   * (Treba za promjenu veličine u korpi.)
   */
  const pizzaVariants = useMemo(() => {
    const map = new Map<
      string,
      Partial<Record<"33" | "50", { id: string; price: number; category: string }>>
    >();

    for (const item of items) {
      const isPizza = normalizeCategory(item.category) === "pizza";
      if (!isPizza) continue;

      const size: "33" | "50" | null = isPizzaSize(item.name, 33)
        ? "33"
        : isPizzaSize(item.name, 50)
        ? "50"
        : null;

      if (!size) continue;

      const baseKey = stripSizeFromName(item.name);
      const prev = map.get(baseKey) ?? {};
      map.set(baseKey, {
        ...prev,
        [size]: { id: item.id, price: item.price, category: item.category },
      });
    }

    return map;
  }, [items]);

  const renderSection = (section: MenuSection, data: MenuItemData[]) => {
    const isPizza33 = section.key === "pizza33";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white">{section.title}</h3>
        </div>

        <div className="h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

        {data.length === 0 ? (
          <p className="text-sm text-gray-500">{section.emptyText}</p>
        ) : isPizza33 ? (
          // Pizza 33 cm: raspored u 2 kolone (da vizuelno zauzme “dva reda” i izgleda punije)
          <div className="grid gap-5 sm:grid-cols-2">
            {data.map((item) => {
              const baseKey = stripSizeFromName(item.name);
              const variants = pizzaVariants.get(baseKey);

              const size: "33" | "50" | null = isPizzaSize(item.name, 33)
                ? "33"
                : isPizzaSize(item.name, 50)
                ? "50"
                : null;

              return (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  name={item.name}
                  description={item.description}
                  price={item.price}
                  image={item.image}
                  category={item.category}
                  pizzaSize={size}
                  baseKey={baseKey}
                  variants={variants}
                />
              );
            })}
          </div>
        ) : (
          // Dodaci / Pića: ostaje vertikalni raspored
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
        )}
      </div>
    );
  };

  const getSectionItems = (key: MenuSection["key"]) => {
    if (key === "pizza33") {
      return items.filter(
        (i) => normalizeCategory(i.category) === "pizza" && isPizzaSize(i.name, 33)
      );
    }

    return items.filter((i) => normalizeCategory(i.category) === key);
  };

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
              Autentične pizze, ukusni dodaci i osvježavajuća pića — sve na jednom mjestu.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/5 bg-gradient-to-b from-[#0f0f0f] to-[#070707] shadow-2xl">
            <div className="p-6 md:p-10">
              {loading ? (
                <div className="py-24 text-center text-gray-400">Učitavanje menija…</div>
              ) : (
                <div className="grid gap-10 lg:grid-cols-3">
                  {MENU_SECTIONS.map((section) => {
                    const sectionItems = getSectionItems(section.key);
                    const isPizza33 = section.key === "pizza33";

                    return (
                      <div key={section.key} className={isPizza33 ? "lg:col-span-2" : ""}>
                        {renderSection(section, sectionItems)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-gray-600 mt-10">
            * Veličine pizza (33 cm / 50 cm) postoje u bazi i koriste se za promjenu veličine u korpi.
          </p>
        </div>
      </div>
    </section>
  );
}

























