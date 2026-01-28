import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_price: number;
  items: unknown[];
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, customer_name, customer_phone, customer_address, total_price, items"
          )
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setError("Greška pri učitavanju porudžbina.");
          setLoading(false);
          return;
        }

        setOrders((data ?? []) as OrderRow[]);
        setLoading(false);
      } catch {
        if (!mounted) return;
        setError("Greška pri povezivanju sa bazom.");
        setLoading(false);
      }
    }

    void loadOrders();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="p-8 text-gray-400">Učitavanje porudžbina…</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400">{error}</div>;
  }

  if (orders.length === 0) {
    return <div className="p-8 text-gray-400">Nema porudžbina.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold text-white mb-6">
        Admin — Porudžbine
      </h1>

      <div className="space-y-4">
        {orders.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-white/10 bg-[#121212] p-5"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-semibold">{o.customer_name}</p>
                <p className="text-sm text-gray-400">{o.customer_phone}</p>
                <p className="text-sm text-gray-400">{o.customer_address}</p>
              </div>

              <div className="text-right">
                <p className="text-white font-bold">{o.total_price} RSD</p>
                <p className="text-xs text-gray-400">
                  {(o.items?.length ?? 0)} stavki
                </p>
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Kreirano: {new Date(o.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
