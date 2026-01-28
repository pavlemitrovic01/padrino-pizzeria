import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type OrderStatus = "pending" | "done" | "cancelled";

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_price: number;
  items: unknown[] | null;
  status: OrderStatus | null;
};

function statusLabel(status: OrderStatus) {
  if (status === "done") return "Završeno";
  if (status === "cancelled") return "Otkazano";
  return "Na čekanju";
}

function statusColor(status: OrderStatus) {
  if (status === "done") return "bg-green-600";
  if (status === "cancelled") return "bg-red-600";
  return "bg-orange-500";
}

function normalizeStatus(value: unknown): OrderStatus {
  if (value === "done" || value === "cancelled" || value === "pending") return value;
  return "pending";
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateErrorById, setUpdateErrorById] = useState<Record<string, string | undefined>>(
    {}
  );

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      try {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id, created_at, customer_name, customer_phone, customer_address, total_price, items, status"
          )
          .order("created_at", { ascending: false });

        if (!mounted) return;

        if (error) {
          setError("Greška pri učitavanju porudžbina.");
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as OrderRow[];
        setOrders(rows);
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

  const ordered = useMemo(() => orders, [orders]);

  async function updateStatus(orderId: string, next: OrderStatus) {
    const current = ordered.find((o) => o.id === orderId);
    const currentStatus = normalizeStatus(current?.status);

    if (!current) return;
    if (updatingId) return;
    if (currentStatus === next) return;

    setUpdatingId(orderId);
    setUpdateErrorById((prev) => ({ ...prev, [orderId]: undefined }));

    try {
      const { error } = await supabase.from("orders").update({ status: next }).eq("id", orderId);
      if (error) {
        setUpdateErrorById((prev) => ({
          ...prev,
          [orderId]: "Greška pri ažuriranju statusa.",
        }));
        return;
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: next } : o))
      );
    } catch {
      setUpdateErrorById((prev) => ({
        ...prev,
        [orderId]: "Greška pri ažuriranju statusa.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <div className="p-8 text-gray-400">Učitavanje porudžbina…</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400">{error}</div>;
  }

  if (ordered.length === 0) {
    return <div className="p-8 text-gray-400">Nema porudžbina.</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold text-white mb-6">Admin — Porudžbine</h1>

      <div className="space-y-4">
        {ordered.map((o) => {
          const st = normalizeStatus(o.status);
          const itemsCount = Array.isArray(o.items) ? o.items.length : 0;
          const isUpdatingThis = updatingId === o.id;

          return (
            <div key={o.id} className="rounded-2xl border border-white/10 bg-[#121212] p-5">
              <div className="flex justify-between items-start gap-6">
                <div>
                  <p className="text-white font-semibold">{o.customer_name}</p>
                  <p className="text-sm text-gray-400">{o.customer_phone}</p>
                  <p className="text-sm text-gray-400">{o.customer_address}</p>

                  <div className="mt-3 flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold text-white ${statusColor(
                        st
                      )}`}
                    >
                      {statusLabel(st)}
                    </span>
                    <span className="text-xs text-gray-400">Status</span>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-white font-bold">{o.total_price} RSD</p>
                  <p className="text-xs text-gray-400">{itemsCount} stavki</p>
                  <p className="mt-3 text-xs text-gray-500">
                    Kreirano: {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  className="px-4 py-2 rounded bg-green-600 text-white font-semibold disabled:opacity-60"
                  disabled={isUpdatingThis || st === "done"}
                  onClick={() => void updateStatus(o.id, "done")}
                >
                  Označi kao završeno
                </button>

                <button
                  type="button"
                  className="px-4 py-2 rounded bg-red-600 text-white font-semibold disabled:opacity-60"
                  disabled={isUpdatingThis || st === "cancelled"}
                  onClick={() => void updateStatus(o.id, "cancelled")}
                >
                  Otkaži
                </button>
              </div>

              {updateErrorById[o.id] && (
                <p className="text-xs text-red-400 mt-2">{updateErrorById[o.id]}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
