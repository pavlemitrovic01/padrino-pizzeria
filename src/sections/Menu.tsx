import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
};

export default function Menu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMenu() {
      const { data, error } = await supabase
        .from("menu")
        .select("*")
        .order("name");

      if (!error && data) {
        setItems(data as MenuItem[]);
      }

      setLoading(false);
    }

    loadMenu();
  }, []);

  if (loading) {
    return <p className="p-6">Učitavanje menija...</p>;
  }

  return (
    <section className="p-6">
      <h2 className="text-3xl font-bold mb-6">Meni</h2>

      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="border rounded-lg p-4 flex justify-between"
          >
            <div>
              <h3 className="font-semibold text-lg">{item.name}</h3>
              <p className="text-sm text-gray-600">
                {item.description}
              </p>
            </div>
            <div className="font-bold">
              {item.price} RSD
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}






































