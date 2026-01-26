import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type AddonDTO = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderItemNew = {
  cart_id?: string | null;
  menu_item_id?: string | null;

  name?: string;
  size?: "33" | "50" | null;
  quantity?: number;

  base_price?: number | null;
  price_per_item?: number;

  addons?: AddonDTO[];
  note?: string | null;

  image?: string;
  category?: string;

  // meta (globalna napomena)
  order_note?: string | null;
};

type OrderItemOld = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type OrderStatus = "pending" | "done";

type Order = {
  id: string;
  created_at: string;

  customer_name: string;
  customer_phone: string;
  customer_address: string;

  items: unknown;
  total_price: number;
  total_items?: number | null;

  status: OrderStatus;
};

function formatDateTime(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("sr-ME", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPizzaSize(size: unknown) {
  if (size === "33") return "33 cm";
  if (size === "50") return "50 cm";
  return null;
}

function safeJsonParse(input: unknown) {
  if (typeof input === "string") {
    try {
      return JSON.parse(input);
    } catch {
      return null;
    }
  }
  return input;
}

function normalizeOrderItems(raw: unknown): OrderItemNew[] {
  const parsed = safeJsonParse(raw);
  if (!parsed) return [];

  if (Array.isArray(parsed)) {
    const looksNew = parsed.some(
      (x) =>
        x &&
        typeof x === "object" &&
        ("price_per_item" in x || "addons" in x || "menu_item_id" in x || "order_note" in x)
    );

    if (looksNew) {
      return (parsed as any[]).map((i) => ({
        ...i,
        addons: Array.isArray(i.addons) ? i.addons : [],
        quantity: Number(i.quantity ?? 1),
        price_per_item: Number(i.price_per_item ?? i.price ?? 0),
      }));
    }

    return (parsed as OrderItemOld[]).map((i) => ({
      cart_id: i.id,
      menu_item_id: null,
      name: i.name,
      size: null,
      quantity: Number(i.quantity ?? 1),
      base_price: null,
      price_per_item: Number(i.price ?? 0),
      addons: [],
      note: null,
    }));
  }

  return [];
}

function calcItemLineTotal(item: OrderItemNew) {
  const p = Number(item.price_per_item ?? 0);
  const q = Number(item.quantity ?? 0);

  const safeP = Number.isFinite(p) ? p : 0;
  const safeQ = Number.isFinite(q) ? q : 0;

  return safeP * safeQ;
}

function extractOrderNoteFromItems(items: OrderItemNew[]) {
  // tražimo meta entry { order_note: "..." }
  const meta = items.find((x) => typeof x?.order_note === "string" && x.order_note.trim().length > 0);
  return meta?.order_note?.trim() ?? null;
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<Set<string>>(new Set());

  async function loadOrders() {
    setError(null);

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const { data, error } = await supabase.functions.invoke("admin-orders", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      console.error(error);

      if (error.status === 401) setError("Nijeste autorizovani za pristup admin panelu.");
      else if (error.status === 429) setError("Previše zahtjeva. Pokušajte ponovo za minut.");
      else if (error.status === 500) setError("Greška na serveru. Pokušajte kasnije.");
      else setError("Ne mogu da učitam porudžbine.");

      setLoading(false);
      return;
    }

    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;

      if (Array.isArray(parsed)) setOrders(parsed as Order[]);
      else {
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
    const interval = setInterval(() => loadOrders(), 30000);
    return () => clearInterval(interval);
  }, []);

  async function markAsDone(orderId: string) {
    setUpdating((prev) => new Set(prev).add(orderId));

    const token = (await supabase.auth.getSession()).data.session?.access_token;

    const { error } = await supabase.functions.invoke("admin-orders", {
      method: "PATCH",
      body: { id: orderId, status: "done" },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      let msg = "Greška pri promjeni statusa.";
      if (error.status === 401) msg = "Nijeste autorizovani za ovu akciju.";
      else if (error.status === 429) msg = "Previše zahtjeva. Pokušajte ponovo za minut.";
      else if (error.status === 500) msg = "Greška na serveru. Pokušajte kasnije.";

      setError(msg);

      setUpdating((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
      return;
    }

    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "done" } : o)));

    setUpdating((prev) => {
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });
  }

  const normalized = useMemo(() => {
    return orders.map((o) => ({
      ...o,
      _items: normalizeOrderItems(o.items),
    }));
  }, [orders]);

  if (loading) return <p className="p-6">Učitavanje porudžbina…</p>;
  if (error) return <p className="p-6 text-red-600">{error}</p>;
  if (orders.length === 0) return <p className="p-6">Nema porudžbina.</p>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin — porudžbine</h1>

      {normalized.map((order) => {
        const itemsAll = (order as any)._items as OrderItemNew[];
        const orderNote = extractOrderNoteFromItems(itemsAll);

        // ✅ filtriramo meta entry da se ne prikazuje kao “stavka”
        const items = itemsAll.filter((x) => !(x && typeof x === "object" && "order_note" in x && !x.name));

        return (
          <div
            key={order.id}
            className={`border rounded-lg p-4 space-y-3 ${
              order.status === "pending" ? "border-l-4 border-orange-500 bg-orange-50" : ""
            }`}
          >
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="font-semibold">{order.customer_name}</h2>
                <p className="text-xs text-gray-600">{formatDateTime(order.created_at)}</p>
              </div>

              <span
                className={
                  order.status === "pending" ? "text-orange-600 font-semibold" : "text-green-600"
                }
              >
                {order.status === "pending" ? "na čekanju" : "završeno"}
              </span>
            </div>

            <p>📞 {order.customer_phone}</p>
            <p>📍 {order.customer_address}</p>

            {orderNote && (
              <div className="border-t pt-3">
                <p className="font-semibold mb-1">Napomena za porudžbinu:</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{orderNote}</p>
              </div>
            )}

            <div className="border-t pt-3">
              <p className="font-semibold mb-2">Stavke:</p>

              {items.length === 0 ? (
                <p className="text-sm text-gray-600">Nema stavki u porudžbini.</p>
              ) : (
                <ul className="space-y-3">
                  {items.map((item, idx) => {
                    const sizeLabel = formatPizzaSize(item.size);
                    const addons = Array.isArray(item.addons) ? item.addons : [];
                    const hasAddons = addons.length > 0;
                    const hasItemNote = typeof item.note === "string" && item.note.trim().length > 0;

                    const lineTotal = calcItemLineTotal(item);
                    const key = item.cart_id ?? item.menu_item_id ?? `${item.name}-${idx}`;

                    return (
                      <li key={key} className="rounded-md border bg-white p-3">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold truncate">{item.name}</p>

                            {sizeLabel && (
                              <p className="text-xs text-gray-600 mt-1">
                                Veličina: <span className="font-semibold">{sizeLabel}</span>
                              </p>
                            )}

                            <p className="text-xs text-gray-600 mt-1">
                              Cijena:{" "}
                              <span className="font-semibold">{item.price_per_item} RSD</span> ×{" "}
                              {item.quantity}
                            </p>
                          </div>

                          <p className="font-bold whitespace-nowrap">{lineTotal} RSD</p>
                        </div>

                        {hasAddons && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700">Dodaci:</p>
                            <div className="mt-1 space-y-1">
                              {addons.map((a) => (
                                <div key={a.id} className="flex justify-between text-xs">
                                  <span className="text-gray-700 truncate">
                                    ⭐ {a.name} ×{a.quantity}
                                  </span>
                                  <span className="text-gray-700 font-semibold">
                                    {a.price * a.quantity} RSD
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {hasItemNote && (
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-700">Napomena:</p>
                            <p className="text-xs text-gray-700 whitespace-pre-wrap">{item.note}</p>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-between items-center pt-3 border-t">
              <p className="font-bold">Ukupno: {order.total_price} RSD</p>

              {order.status === "pending" && (
                <button
                  onClick={() => markAsDone(order.id)}
                  disabled={updating.has(order.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded disabled:bg-gray-400"
                >
                  {updating.has(order.id) ? "Ažuriram…" : "Označi kao završeno"}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}


