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

function isPiroska(name: string) {
  const n = name.toLowerCase();
  return n.includes("piroska") || n.includes("piroška");
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

  const pizza33Items = useMemo(() => {
    const list = items.filter(
      (i) => normalizeCategory(i.category) === "pizza" && isPizzaSize(i.name, 33)
    );

    // Piroška ide na kraj
    return [...list].sort((a, b) => {
      const ap = isPiroska(a.name) ? 1 : 0;
      const bp = isPiroska(b.name) ? 1 : 0;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
  }, [items]);

  const picaItems = useMemo(() => {
    return items.filter((i) => normalizeCategory(i.category) === "pica");
  }, [items]);

  const renderPizza33 = (data: MenuItemData[]) => {
    if (data.length === 0) {
      return <p className="text-sm text-gray-500">Trenutno nema pizza 33 cm u ponudi.</p>;
    }

    const isOdd = data.length % 2 === 1;

    return (
      <div className="grid gap-5 sm:grid-cols-2">
        {data.map((item, idx) => {
          const isLast = idx === data.length - 1;

          // Ako je neparan broj — posljednja kartica zauzima oba mjesta u redu
          const wrapperClass =
            isOdd && isLast ? "sm:col-span-2 sm:max-w-[520px] sm:mx-auto" : "";

          return (
            <div key={item.id} className={wrapperClass}>
              <MenuItem
                id={item.id}
                name={item.name}
                description={item.description}
                price={item.price}
                image={item.image}
                category={item.category}
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

  const PromoCard = () => (
    <div className="mt-8">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#121212] shadow-2xl">
        {/* slika */}
        <div className="absolute inset-0">
          <img
            src="/menu-hero.jpg"
            alt="Padrino promo"
            className="w-full h-full object-cover opacity-35"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/85" />
        </div>

        {/* sadržaj */}
        <div className="relative z-10 p-6 md:p-7">
          <p className="text-xs text-yellow-400 font-bold tracking-wide">
            VAŽNO
          </p>

          <h4 className="text-2xl md:text-3xl font-extrabold text-white mt-2">
            Dodatke i veličinu biraš u korpi
          </h4>

          <p className="text-gray-300 mt-3 max-w-xl leading-relaxed">
            Izaberi pizzu iz menija, a onda u korpi odaberi veličinu (33 / 50 cm),
            soseve i ostale dodatke. Brzo, jasno i bezbjedno.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Veličina u korpi
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Dodaci u korpi
            </span>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/5 text-gray-200 border border-white/10">
              ✔ Napomena za sos
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
            <h2 className="text-4xl md:text-5xl font-extrabold text-white">
              Naš meni
            </h2>
            <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
              Autentične pizze i osvježavajuća pića — dodatke biraš u korpi.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/5 bg-gradient-to-b from-[#0f0f0f] to-[#070707] shadow-2xl">
            <div className="p-6 md:p-10">
              {loading ? (
                <div className="py-24 text-center text-gray-400">
                  Učitavanje menija…
                </div>
              ) : (
                <div className="grid gap-10 lg:grid-cols-12">
                  {/* Pizza 33 cm */}
                  <div className="lg:col-span-8 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-bold text-white">Pizza 33 cm</h3>
                    </div>
                    <div className="h-px bg-gradient-to-r from-white/10 via-white/20 to-white/10" />

                    {renderPizza33(pizza33Items)}

                    {/* ✅ Pokriva “prazan dio” ispod pizza */}
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





















