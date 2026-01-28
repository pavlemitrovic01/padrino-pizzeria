import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";

type OrderStatus = "pending" | "done" | "cancelled";
type StatusFilter = "all" | OrderStatus;

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

type SortKey =
  | "created_desc"
  | "created_asc"
  | "price_desc"
  | "price_asc"
  | "name_asc"
  | "name_desc";

type ItemLine = {
  name: string;
  quantity: number;
  price: number;
  category?: string;
  size?: string | number | null;
  addons?: { name: string; quantity?: number; price?: number }[];
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

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseItems(items: unknown[] | null): ItemLine[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;

      const r = raw as Record<string, unknown>;

      const name =
        safeString(r.name) ||
        safeString(r.title) ||
        safeString(r.product_name) ||
        "Stavka";

      const quantity = Math.max(1, safeNumber(r.quantity, 1));
      const price = safeNumber(r.price, 0);

      const category = typeof r.category === "string" ? r.category : undefined;
      const size =
        typeof r.size === "string" || typeof r.size === "number" ? r.size : null;

      const addonsRaw = r.addons;
      const addons = Array.isArray(addonsRaw)
        ? addonsRaw
            .map((a) => {
              if (!a || typeof a !== "object") return null;
              const ar = a as Record<string, unknown>;
              const aname = safeString(ar.name, "");
              if (!aname) return null;
              const aqty = safeNumber(ar.quantity, 1);
              const aprice = safeNumber(ar.price, 0);
              return { name: aname, quantity: aqty, price: aprice };
            })
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
        : [];

      return { name, quantity, price, category, size, addons };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateErrorById, setUpdateErrorById] = useState<Record<string, string | undefined>>(
    {}
  );

  // UX: pretraga + filter + sortiranje
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");

  // UX: detalji porudžbine
  const [openId, setOpenId] = useState<string | null>(null);

  // UX: osvježavanje
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const loadOrders = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);

    if (!silent) {
      setLoading(true);
      setError(null);
    } else {
      setRefreshing(true);
    }

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer_address, total_price, items, status"
        )
        .order("created_at", { ascending: false });

      if (error) {
        setError("Greška pri učitavanju porudžbina.");
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setOrders((data ?? []) as OrderRow[]);
      setLastUpdatedAt(new Date().toISOString());
      setLoading(false);
      setRefreshing(false);
    } catch {
      setError("Greška pri povezivanju sa bazom.");
      setOrders([]);
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await loadOrders();
    };

    void run();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totals = useMemo(() => {
    const all = orders.length;
    const pending = orders.filter((o) => normalizeStatus(o.status) === "pending").length;
    const done = orders.filter((o) => normalizeStatus(o.status) === "done").length;
    const cancelled = orders.filter((o) => normalizeStatus(o.status) === "cancelled").length;
    return { all, pending, done, cancelled };
  }, [orders]);

  const filteredSorted = useMemo(() => {
    const q = normalizeText(query);

    let next = orders;

    if (statusFilter !== "all") {
      next = next.filter((o) => normalizeStatus(o.status) === statusFilter);
    }

    if (q.length > 0) {
      next = next.filter((o) => {
        const hay = [
          o.customer_name,
          o.customer_phone,
          o.customer_address,
          o.total_price,
          o.created_at,
        ]
          .map(normalizeText)
          .join(" ");
        return hay.includes(q);
      });
    }

    const collator = new Intl.Collator("sr-Latn-ME", { sensitivity: "base" });

    const sorted = [...next].sort((a, b) => {
      if (sortKey === "created_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortKey === "created_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortKey === "price_desc") return (b.total_price ?? 0) - (a.total_price ?? 0);
      if (sortKey === "price_asc") return (a.total_price ?? 0) - (b.total_price ?? 0);
      if (sortKey === "name_asc") return collator.compare(a.customer_name ?? "", b.customer_name ?? "");
      return collator.compare(b.customer_name ?? "", a.customer_name ?? "");
    });

    return sorted;
  }, [orders, query, statusFilter, sortKey]);

  async function updateStatus(orderId: string, next: OrderStatus) {
    const current = orders.find((o) => o.id === orderId);
    const currentStatus = normalizeStatus(current?.status);

    if (!current) return;
    if (updatingId) return;
    if (currentStatus === next) return;

    const msg =
      next === "done"
        ? "Da li ste sigurni da želite da označite porudžbinu kao završenu?"
        : next === "cancelled"
        ? "Da li ste sigurni da želite da otkažete porudžbinu?"
        : "Da li ste sigurni da želite da vratite porudžbinu na čekanje?";

    if (!window.confirm(msg)) return;

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

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
    } catch {
      setUpdateErrorById((prev) => ({
        ...prev,
        [orderId]: "Greška pri ažuriranju statusa.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }

  const FilterPill = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-xs font-semibold border transition",
        active
          ? "bg-white text-black border-white"
          : "bg-black/40 text-gray-200 border-white/10 hover:border-white/25",
      ].join(" ")}
    >
      {label}
    </button>
  );

  if (loading) {
    return <div className="p-8 text-gray-400">Učitavanje porudžbina…</div>;
  }

  if (error) {
    return <div className="p-8 text-red-400">{error}</div>;
  }

  return (
    <div className="p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Admin — Porudžbine</h1>
          <p className="text-sm text-gray-400 mt-1">
            Ukupno: <span className="text-gray-200 font-semibold">{totals.all}</span>
            {" · "}
            Na čekanju: <span className="text-gray-200 font-semibold">{totals.pending}</span>
            {" · "}
            Završeno: <span className="text-gray-200 font-semibold">{totals.done}</span>
            {" · "}
            Otkazano: <span className="text-gray-200 font-semibold">{totals.cancelled}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Posljednje osvježavanje:{" "}
            <span className="text-gray-400">
              {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("sr-Latn-ME") : "—"}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-[560px]">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraga po imenu, telefonu ili adresi…"
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-white/25"
            />
            <button
              type="button"
              onClick={() => void loadOrders({ silent: true })}
              disabled={refreshing}
              className="shrink-0 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
              title="Osvježi"
            >
              {refreshing ? "Osvježavam…" : "Osvježi"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              active={statusFilter === "all"}
              label="Sve"
              onClick={() => setStatusFilter("all")}
            />
            <FilterPill
              active={statusFilter === "pending"}
              label="Na čekanju"
              onClick={() => setStatusFilter("pending")}
            />
            <FilterPill
              active={statusFilter === "done"}
              label="Završeno"
              onClick={() => setStatusFilter("done")}
            />
            <FilterPill
              active={statusFilter === "cancelled"}
              label="Otkazano"
              onClick={() => setStatusFilter("cancelled")}
            />

            <div className="ml-auto">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
              >
                <option value="created_desc">Najnovije prvo</option>
                <option value="created_asc">Najstarije prvo</option>
                <option value="price_desc">Cijena ↓</option>
                <option value="price_asc">Cijena ↑</option>
                <option value="name_asc">Ime A–Z</option>
                <option value="name_desc">Ime Z–A</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Prikazujem: <span className="text-gray-300 font-semibold">{filteredSorted.length}</span>
          </p>
        </div>
      </div>

      {filteredSorted.length === 0 ? (
        <div className="p-8 text-gray-400">Nema porudžbina za ovaj filter.</div>
      ) : (
        <div className="space-y-4">
          {filteredSorted.map((o) => {
            const st = normalizeStatus(o.status);
            const items = parseItems(o.items);
            const itemsCount = items.reduce((sum, it) => sum + (it.quantity ?? 1), 0);
            const isUpdatingThis = updatingId === o.id;
            const isOpen = openId === o.id;

            return (
              <div key={o.id} className="rounded-2xl border border-white/10 bg-[#121212] p-5">
                <div className="flex justify-between items-start gap-6">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{o.customer_name}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-400">{o.customer_phone}</p>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(o.customer_phone)}
                        className="text-xs rounded-full border border-white/10 px-2 py-1 text-gray-200 hover:border-white/25"
                        title="Kopiraj telefon"
                      >
                        Kopiraj
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-400 truncate">{o.customer_address}</p>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(o.customer_address)}
                        className="text-xs rounded-full border border-white/10 px-2 py-1 text-gray-200 hover:border-white/25"
                        title="Kopiraj adresu"
                      >
                        Kopiraj
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold text-white ${statusColor(
                          st
                        )}`}
                      >
                        {statusLabel(st)}
                      </span>
                      <span className="text-xs text-gray-400">Status</span>

                      <button
                        type="button"
                        onClick={() => setOpenId((prev) => (prev === o.id ? null : o.id))}
                        className="ml-2 text-xs rounded-full border border-white/10 px-3 py-1 text-gray-200 hover:border-white/25"
                      >
                        {isOpen ? "Sakrij detalje" : "Detalji"}
                      </button>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-white font-bold">{o.total_price} RSD</p>
                    <p className="text-xs text-gray-400">{itemsCount} stavki</p>
                    <p className="mt-3 text-xs text-gray-500">
                      Kreirano: {new Date(o.created_at).toLocaleString("sr-Latn-ME")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
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

                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-orange-600 text-white font-semibold disabled:opacity-60"
                    disabled={isUpdatingThis || st === "pending"}
                    onClick={() => void updateStatus(o.id, "pending")}
                  >
                    Vrati na čekanje
                  </button>
                </div>

                {updateErrorById[o.id] && (
                  <p className="text-xs text-red-400 mt-2">{updateErrorById[o.id]}</p>
                )}

                {isOpen && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white mb-3">Stavke</p>

                    {items.length === 0 ? (
                      <p className="text-sm text-gray-400">Nema stavki u porudžbini.</p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((it, idx) => {
                          const addons = it.addons ?? [];
                          return (
                            <div key={`${o.id}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 p-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-white font-semibold truncate">{it.name}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Količina: <span className="text-gray-200 font-semibold">{it.quantity}</span>
                                    {it.size !== null && it.size !== undefined && it.size !== "" ? (
                                      <>
                                        {" · "}Veličina:{" "}
                                        <span className="text-gray-200 font-semibold">{String(it.size)}</span>
                                      </>
                                    ) : null}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-white font-bold">{it.price} RSD</p>
                                </div>
                              </div>

                              {addons.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-400 mb-2">Dodaci</p>
                                  <div className="flex flex-col gap-1">
                                    {addons.map((a, aidx) => (
                                      <div
                                        key={`${o.id}-${idx}-a-${aidx}`}
                                        className="flex items-center justify-between text-xs rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                                      >
                                        <span className="text-gray-200">
                                          {a.name}
                                          {typeof a.quantity === "number" && a.quantity > 1 ? ` ×${a.quantity}` : ""}
                                        </span>
                                        <span className="text-gray-400">
                                          {typeof a.price === "number" && a.price > 0 ? `${a.price} RSD` : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
