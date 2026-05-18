import { useCallback, useEffect, useState } from "react";
import { getAdminApiBase } from "../../lib/adminApiBase";
import { supabaseAdminAuth } from "../../lib/supabaseAdminAuthClient";
import { formatEUR, toSafeInt } from "../../lib/money";
import { isRecord, safeString } from "../../lib/parsing";

const ADMIN_API_BASE = getAdminApiBase();

const BUSINESS_TIMEZONE = "Europe/Belgrade";

type DashboardOrder = {
  id: string;
  created_at: string;
  status: string | null;
  total_eur_cents: number | null;
  payment_status: string | null;
};

function safeNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function getBusinessDateKey(created_at: string): string {
  try {
    const d = new Date(created_at);
    if (!Number.isFinite(d.getTime())) return "unknown";
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    if (!year || !month || !day) return "unknown";
    return `${year}-${month}-${day}`;
  } catch {
    return "unknown";
  }
}

function getTodayBusinessDateKey(): string {
  return getBusinessDateKey(new Date().toISOString());
}

function isTodayBusiness(created_at: string): boolean {
  return getBusinessDateKey(created_at) === getTodayBusinessDateKey();
}

function formatTimeOnly(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("sr-Latn-ME", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

type FetchResult = { ok: true; orders: DashboardOrder[] } | { ok: false; error: string };

async function fetchOrders(limit: number): Promise<FetchResult> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { ok: false, error: "Missing admin session token" };

  const url = `${ADMIN_API_BASE}/api/admin-orders?limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    method: "GET",
    headers: { authorization: `Bearer ${token}` },
  });

  const jsonBody: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      isRecord(jsonBody) && typeof jsonBody.error === "string" && jsonBody.error.trim()
        ? jsonBody.error.trim()
        : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  if (isRecord(jsonBody) && jsonBody.ok === true && Array.isArray(jsonBody.orders)) {
    const orders: DashboardOrder[] = jsonBody.orders
      .filter((o): o is Record<string, unknown> => isRecord(o) && safeString(o.id).length > 0)
      .map((o) => ({
        id: safeString(o.id),
        created_at: safeString(o.created_at),
        status: safeString(o.status) || null,
        total_eur_cents: safeNumberOrNull(o.total_eur_cents),
        payment_status: safeString(o.payment_status) || null,
      }));
    return { ok: true, orders };
  }

  return { ok: false, error: "Unexpected response from admin-orders" };
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<DashboardOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const r = await fetchOrders(200);

    if (!r.ok) {
      setOrders([]);
      setErrorMsg(r.error);
      setLoading(false);
      setLastRefreshedAt(Date.now());
      return;
    }

    setOrders(r.orders);
    setLoading(false);
    setLastRefreshedAt(Date.now());
  }, []);

  useEffect(() => {
    let mounted = true;

    async function run() {
      setLoading(true);
      setErrorMsg(null);
      const r = await fetchOrders(200);
      if (!mounted) return;
      if (!r.ok) {
        setOrders([]);
        setErrorMsg(r.error);
      } else {
        setOrders(r.orders);
      }
      setLoading(false);
      setLastRefreshedAt(Date.now());
    }

    void run();
    return () => {
      mounted = false;
    };
  }, []);

  const todayOrders = orders.filter((o) => isTodayBusiness(o.created_at));
  const pending = todayOrders.filter((o) => (o.status ?? "pending") === "pending");
  const preparing = todayOrders.filter((o) => o.status === "preparing");
  const done = todayOrders.filter((o) => o.status === "done");
  const revenueCents = todayOrders
    .filter((o) => (o.payment_status ?? "") !== "refunded")
    .reduce((sum, o) => sum + toSafeInt(o.total_eur_cents, 0), 0);

  return (
    <div>
      <h2 className="text-3xl font-extrabold">Admin — Pregled</h2>
      <p className="mt-2 text-white/70">Pregled porudžbina za danas.</p>

      <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        <button
          className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:bg-white/5 disabled:opacity-60"
          onClick={() => void load()}
          title="Osvježi podatke"
          disabled={loading}
        >
          Osvježi
        </button>
        {lastRefreshedAt ? (
          <p className="text-xs text-white/50">Poslednje osvežavanje: {formatTimeOnly(lastRefreshedAt)}</p>
        ) : null}
      </div>

      {errorMsg ? (
        <div className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMsg}
        </div>
      ) : loading ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
          Učitavam…
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/50">Danas porudžbina</p>
            <p className="mt-2 text-2xl font-bold text-white">{todayOrders.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/50">Novo (pending)</p>
            <p className="mt-2 text-2xl font-bold text-yellow-200">{pending.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/50">U pripremi</p>
            <p className="mt-2 text-2xl font-bold text-blue-200">{preparing.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/50">Završeno danas</p>
            <p className="mt-2 text-2xl font-bold text-emerald-200">{done.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/50">Ukupna vrednost danas</p>
            <p className="mt-2 text-2xl font-bold text-white">{formatEUR(revenueCents)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
