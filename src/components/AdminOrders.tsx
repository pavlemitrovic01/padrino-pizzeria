import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { formatEUR, formatRSD, toSafeInt } from "../lib/money";

type OrderStatus = "pending" | "done" | "cancelled";

type OrderRow = {
  id: string;
  created_at: string;

  customer_name: string;
  customer_phone: string;
  customer_address: string;

  // legacy (stare porudžbine u RSD, nove su bile svašta ranije)
  total_price: number | null;

  // EUR migracija (nove porudžbine)
  currency: string | null;
  total_eur_cents: number | null;
  fx_rsd_per_eur: number | null;

  items: unknown[] | null;
  status: OrderStatus | null;
};

type ParsedItem = {
  name: string;
  quantity: number;
  size: string | null;
  price_per_item: number;
  addons: { name: string; quantity: number; price: number }[];
  note: string | null;
};

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function safeInt(v: unknown, fallback = 0): number {
  return toSafeInt(v, fallback);
}

function safeDateTime(value: unknown) {
  const s = safeString(value);
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("sr-Latn-ME", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function isEurOrder(o: OrderRow) {
  const c = safeString(o.currency).toUpperCase();
  return c === "EUR" || typeof o.total_eur_cents === "number";
}

function getOrderTotalLabel(o: OrderRow) {
  if (isEurOrder(o)) {
    const cents =
      typeof o.total_eur_cents === "number"
        ? safeInt(o.total_eur_cents, 0)
        : safeInt(o.total_price, 0);
    return formatEUR(cents);
  }
  // legacy RSD
  return formatRSD(o.total_price ?? 0);
}

function parseOrderItems(itemsRaw: unknown[] | null): { meta: any | null; items: ParsedItem[] } {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return { meta: null, items: [] };

  const [first, ...rest] = itemsRaw;

  const meta =
    first && typeof first === "object" && !Array.isArray(first) ? (first as any) : null;

  const items: ParsedItem[] = rest
    .filter((x) => x && typeof x === "object" && !Array.isArray(x))
    .map((x: any) => {
      const addons = Array.isArray(x.addons)
        ? x.addons
            .filter((a: any) => a && typeof a === "object" && !Array.isArray(a))
            .map((a: any) => ({
              name: safeString(a.name),
              quantity: Math.max(1, safeInt(a.quantity, 1)),
              price: safeInt(a.price, 0),
            }))
        : [];

      return {
        name: safeString(x.name),
        quantity: Math.max(1, safeInt(x.quantity, 1)),
        size: x.size ? safeString(x.size) : null,
        price_per_item: safeInt(x.price_per_item, 0),
        addons,
        note: x.note ? safeString(x.note) : null,
      };
    });

  return { meta, items };
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorMsg(null);

      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer_address, total_price, currency, total_eur_cents, fx_rsd_per_eur, items, status"
        )
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        setOrders([]);
        setErrorMsg(error.message ?? "Greška pri učitavanju.");
      } else {
        setOrders((data ?? []) as OrderRow[]);
      }

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const renderedOrders = useMemo(() => orders, [orders]);

  return (
    <section className="bg-black text-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-3xl font-extrabold">Admin — Porudžbine</h2>
        <p className="mt-2 text-white/70">
          Nove porudžbine su u EUR (cents), stare ostaju u RSD (fallback).
        </p>

        <div className="mt-8">
          {loading ? (
            <p className="text-white/70">Učitavam…</p>
          ) : errorMsg ? (
            <p className="text-red-300">{errorMsg}</p>
          ) : renderedOrders.length === 0 ? (
            <p className="text-white/70">Nema porudžbina.</p>
          ) : (
            <div className="space-y-3">
              {renderedOrders.map((o) => {
                const parsed = parseOrderItems(o.items);
                const metaTotalItems =
                  parsed.meta && typeof parsed.meta.total_items === "number"
                    ? safeInt(parsed.meta.total_items, 0)
                    : null;

                const computedCount =
                  metaTotalItems ?? parsed.items.reduce((s, it) => s + it.quantity, 0);

                const eur = isEurOrder(o);
                const isExpanded = expandedId === o.id;

                return (
                  <div
                    key={o.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm text-white/60">{safeDateTime(o.created_at)}</p>
                        <p className="mt-1 text-lg font-extrabold text-white truncate">
                          {o.customer_name}
                        </p>
                        <p className="mt-1 text-sm text-white/70 truncate">{o.customer_phone}</p>
                        <p className="mt-1 text-sm text-white/70 truncate">{o.customer_address}</p>
                        <p className="mt-2 text-xs text-white/60">
                          Status: {safeString(o.status ?? "pending")}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-white font-extrabold">{getOrderTotalLabel(o)}</p>
                        <p className="text-xs text-gray-400">{computedCount} stavki</p>

                        <button
                          className="mt-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20"
                          onClick={() => setExpandedId((prev) => (prev === o.id ? null : o.id))}
                        >
                          {isExpanded ? "Sakrij" : "Detalji"}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-4 border-t border-white/10 pt-4 space-y-3">
                        {parsed.items.map((it, idx) => {
                          const qty = Math.max(1, it.quantity);
                          const lineTotal = safeInt(it.price_per_item, 0) * qty;

                          return (
                            <div
                              key={`${o.id}-${idx}`}
                              className="rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-white font-semibold truncate">
                                    {it.name}{" "}
                                    {it.size ? (
                                      <span className="text-white/60 font-normal">({it.size})</span>
                                    ) : null}
                                  </p>
                                  <p className="text-xs text-white/60 mt-1">x{qty}</p>

                                  {it.addons.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {it.addons.map((a, j) => {
                                        const aq = Math.max(1, a.quantity);
                                        const addonLabel = `+ ${a.name} ${aq > 1 ? `x${aq}` : ""}`;

                                        // Stabilno:
                                        // - EUR: addons su EUR centi
                                        // - RSD: addons istorijski nijesu pouzdani -> prikazujemo bez iznosa
                                        return (
                                          <div
                                            key={`${idx}-${j}`}
                                            className="flex items-center justify-between text-xs"
                                          >
                                            <span className="text-white/70">{addonLabel}</span>

                                            {eur ? (
                                              <span className="text-gray-400">
                                                {formatEUR(safeInt(a.price, 0) * aq)}
                                              </span>
                                            ) : (
                                              <span className="text-gray-500">—</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {it.note ? (
                                    <p className="mt-2 text-xs text-white/60">Napomena: {it.note}</p>
                                  ) : null}
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-white font-bold">
                                    {eur ? formatEUR(lineTotal) : formatRSD(lineTotal)}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
