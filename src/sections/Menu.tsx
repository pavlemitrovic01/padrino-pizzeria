import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/useCart";
import type { MenuItem } from "../types/menu";

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] =
    useState<"PIZZA" | "PASTA">("PIZZA");

  const { addToCart } = useCart();

  useEffect(() => {
    const fetchItems = async () => {
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .order("name");

      if (!error && data) {
        setItems(data);
      }
    };

    fetchItems();
  }, []);

  const filtered = items.filter(
    (item) => item.category === activeCategory
  );

  return (
    <section className="bg-[#0f0f12] py-12 px-4">
      <div className="flex justify-center gap-8 mb-10">
        {(["PIZZA", "PASTA"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-lg ${
              activeCategory === cat
                ? "text-yellow-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-gray-400">
          Nema stavki u ovoj kategoriji
        </p>
      ) : (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-[#1a1a1f] rounded-2xl overflow-hidden"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="h-48 w-full object-cover"
                />
              )}

              <div className="p-5">
                <h3 className="text-xl text-white">{item.name}</h3>

                {item.description && (
                  <p className="text-sm text-gray-400 mt-1 mb-3">
                    {item.description}
                  </p>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-yellow-400 font-semibold">
                    {item.price} RSD
                  </span>

                  <button
                    onClick={() => addToCart(item)}
                    className="text-yellow-400 hover:text-yellow-300"
                  >
                    Dodaj →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}




































