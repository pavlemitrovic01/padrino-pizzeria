import { useEffect, useState } from "react";
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
  key: string;
  title: string;
};

/**
 * CENTRALNO MJESTO ZA SEKCIJE
 * Dodavanje nove sekcije = jedna linija
 */
const MENU_SECTIONS: MenuSection[] = [
  { key: "pizza", title: "Pizza" },
  { key: "pasta", title: "Pasta" },
  // spremno za:
  // { key: "pica", title: "Pića" },
  // { key: "dodaci", title: "Dodaci" },
  // { key: "deserti", title: "Deserti" },
];

function normalizeCategory(value: string) {
  return value
    .toLowerCase()
    .replace("č", "c")
    .replace("ć", "c")
    .replace("š", "s")
    .replace("ž", "z")
    .replace("đ", "dj")
    .trim();
}

export default function Menu() {
  const [items, setItems] = useState<MenuItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("menu_items")
      .select("*")
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

  if (loading) {
    return (
      <div className="py-32 text-center text-gray-400">
        Učitavanje menija…
      </div>
    );
  }

  const renderSection = (title: string, data: MenuItemData[]) => {
    if (data.length === 0) return null;

    return (
      <div className="space-y-8">
        <h3 className="text-2xl font-bold text-white tracking-wide border-b border-gray-700 pb-3">
          {title}
        </h3>

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
      </div>
    );
  };

  return (
    <section id="menu" className="relative bg-black">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/80 to-black" />
        <img
          src="/menu-hero.jpg"
          alt="Padrino meni"
          className="w-full h-full object-cover opacity-40"
        />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 px-6 py-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-extrabold text-white tracking-wide">
              Naš meni
            </h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Autentične pizze i paste, pripremljene od pažljivo
              biranih sastojaka.
            </p>
          </div>

          <div className="grid gap-16 lg:grid-cols-2">
            {MENU_SECTIONS.map((section) => {
              const sectionItems = items.filter(
                (i) =>
                  normalizeCategory(i.category) === section.key
              );

              return (
                <div key={section.key}>
                  {renderSection(
                    section.title,
                    sectionItems
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}






