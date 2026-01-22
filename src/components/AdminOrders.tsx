import { useEffect, useState } from "react";
import { supabaseAdmin } from "../lib/supabaseAdmin";

interface Order {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: any[];
  total_price: number;
  status: string;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      const { data, error } = await supabaseAdmin
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        setError("Ne mogu da učitam porudžbine");
        console.error(error);
      } else {
        setOrders(data || []);
      }

      setLoading(false);
    };

    fetchOrders();
  }, []);

  if (loading) return <p className="p-4">Učitavanje...</p>;
  if (error) return <p className="p-4 text-red-600">{error}</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin – Porudžbine</h1>

      {orders.length === 0 && (
        <p>Nema porudžbina.</p>
      )}

      {orders.map(order => (
        <div
          key={order.id}
          className="border p-4 rounded space-y-2"
        >
          <div className="text-sm text-gray-500">
            {new Date(order.created_at).toLocaleString()}
          </div>

          <div className="font-semibold">
            {order.customer_name} – {order.customer_phone}
          </div>

          <div className="text-sm">
            {order.customer_address}
          </div>

          <div className="mt-2 space-y-1">
            {order.items.map((item, index) => (
              <div key={index} className="text-sm">
                {item.quantity}× {item.name} ({item.price} RSD)
              </div>
            ))}
          </div>

          <div className="font-bold mt-2">
            Ukupno: {order.total_price} RSD
          </div>

          <div className="text-sm">
            Status: {order.status}
          </div>
        </div>
      ))}
    </div>
  );
}
