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
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  async function loadOrders() {
    setError(null);

    const { data, error } = await supabase.functions.invoke(
      "admin-orders",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${
            (await supabase.auth.getSession()).data.session?.access_token
          }`,
        },
      }
    );


    if (error) {
      console.error(error);
      if (error.status === 401) {
        setError("Niste autorizovani za pristup admin panelu.");
      } else if (error.status === 429) {
        setError("Previše zahteva. Pokušajte ponovo za minut.");
      } else if (error.status === 500) {
        setError("Greška na serveru. Pokušajte kasnije.");
      } else {
        setError("Ne mogu da učitam porudžbine.");
      }
      setLoading(false);
      return;
    }

    try {
      // 🔴 KLJUČNA NORMALIZACIJA
      const parsed =
        typeof data === "string" ? JSON.parse(data) : data;

      if (Array.isArray(parsed)) {
        setOrders(parsed as Order[]);
      } else {
        console.error("Neočekivan format podataka:", parsed);
        setOrders([]);
      }
    } catch (e) {
      console.error("Greška pri parsiranju podataka:", e);
      setOrders([]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      loadOrders();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function markAsDone(orderId: string) {
    setUpdating((prev) => new Set(prev).add(orderId));

    const { error } = await supabase.functions.invoke("admin-orders", {
      method: "PATCH",
      body: { id: orderId, status: "done" },
      headers: {
        Authorization: `Bearer ${
          (await supabase.auth.getSession()).data.session?.access_token
        }`,
      },
    });


    if (error) {
      let msg = "Greška pri promeni statusa.";
      if (error.status === 401) {
        msg = "Niste autorizovani za ovu akciju.";
      } else if (error.status === 429) {
        msg = "Previše zahteva. Pokušajte ponovo za minut.";
      } else if (error.status === 500) {
        msg = "Greška na serveru. Pokušajte kasnije.";
      }
      setError(msg);
      setUpdating((prev) => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId ? { ...o, status: "done" } : o
      )
    );

    setUpdating((prev) => {
      const newSet = new Set(prev);
      newSet.delete(orderId);
      return newSet;
    });
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
          className={`border rounded-lg p-4 space-y-3 ${
            order.status === "pending"
              ? "border-l-4 border-orange-500 bg-orange-50"
              : ""
          }`}
        >
          <div className="flex justify-between items-center">
            <h2 className="font-semibold">
              {order.customer_name}
            </h2>
            <span
              className={
                order.status === "pending"
                  ? "text-orange-600 font-semibold"
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
                disabled={updating.has(order.id)}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
              >
                {updating.has(order.id) ? "Završeno" : "Završi"}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}




