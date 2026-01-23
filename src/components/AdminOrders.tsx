import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type Order = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  items: OrderItem[];
  total_price: number;
  status: "pending" | "done";
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.functions.invoke<Order[]>(
      "admin-orders",
      {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      }
    );

    if (error) {
      console.error(error);
      setError("Ne mogu da učitam porudžbine.");
      setLoading(false);
      return;
    }

    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadOrders();
  }, []);

  async function markAsDone(orderId: string) {
    const { error } = await supabase.functions.invoke("admin-orders", {
      method: "PATCH",
      body: { id: orderId, status: "done" },
      headers: {
        Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
      },
    });

    if (error) {
      alert("Greška pri promeni statusa.");
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "done" } : o
      )
    );
  }

  if (loading) {
    return <p className="p-6">Učitavanje porudžbina...</p>;
  }

  if (error) {
    return <p className="p-6 text-red-600">{error}</p>;
  }

  if (orders.length === 0) {
    return <p className="p-6">Nema porudžbina.</p>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin – Porudžbine</h1>

      {orders.map((order) => (
        <div
          key={order.id}
          className="border rounded-lg p-4 space-y-3"
        >
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">
              {order.customer_name}
            </h2>
            <span
              className={
                order.status === "pending"
                  ? "text-orange-600"
                  : "text-green-600"
              }
            >
              {order.status}
            </span>
          </div>

          <p>📞 {order.customer_phone}</p>
          <p>📍 {order.customer_address}</p>

          <div className="border-t pt-3">
            <p className="font-semibold mb-2">Stavke:</p>
            <ul className="space-y-1">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>{item.price * item.quantity} RSD</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between items-center pt-3 border-t">
            <p className="font-bold">
              Ukupno: {order.total_price} RSD
            </p>

            {order.status === "pending" && (
              <button
                onClick={() => markAsDone(order.id)}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Završi
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

