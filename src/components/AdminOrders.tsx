import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseAdminAuth } from "../lib/supabaseAdminAuthClient";
import { formatEUR, formatRSD, toSafeInt } from "../lib/money";

type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

type OrderRow = {
  id: string;
  created_at: string;

  customer_name: string;
  customer_phone: string;
  customer_address: string;

  total_price: number | null;

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

type MetaItem = {
  total_items?: unknown;
  order_note?: unknown;
  note?: unknown;
  cart_id?: unknown;
  name?: unknown;
  category?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

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

function safeNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
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
  return formatRSD(o.total_price ?? 0);
}

function parseTimeMs(value: string): number {
  const t = Date.parse(String(value ?? ""));
  return Number.isFinite(t) ? t : 0;
}

function splitNoteLines(note: string): string[] {
  return String(note ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractPaymentValueFromNote(note: string): string | null {
  const m = String(note ?? "").match(/pla[ćc]anje\s*:\s*(.+)/i);
  const v = m?.[1]?.trim() ?? "";
  return v ? v : null;
}

function stripPaymentLines(lines: string[]): string[] {
  return lines.filter((ln) => !/pla[ćc]anje\s*:/i.test(ln));
}

async function copyToClipboard(text: string): Promise<boolean> {
  const t = String(text ?? "");
  if (!t) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch {
    // fallback ispod
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "true");
    ta.style.position = "fixed";
    ta.style.top = "0";
    ta.style.left = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

function isMetaRow(v: unknown): v is MetaItem {
  if (!isPlainObject(v)) return false;

  const cartId = normalizeText(safeString(v.cart_id));
  const name = normalizeText(safeString(v.name));
  const cat = normalizeText(safeString(v.category));

  return cartId === "meta" || name === "meta" || cat === "meta";
}

function parseOrderItems(itemsRaw: unknown[] | null): { meta: MetaItem | null; items: ParsedItem[] } {
  if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) return { meta: null, items: [] };

  const metaObj = itemsRaw.find((x): x is MetaItem => isMetaRow(x));
  const meta = metaObj ?? null;

  const items: ParsedItem[] = itemsRaw
    .filter((x): x is Record<string, unknown> => isPlainObject(x) && !isMetaRow(x))
    .map((x) => {
      const addonsRaw = x.addons;
      const addons =
        Array.isArray(addonsRaw) && addonsRaw.length > 0
          ? addonsRaw
              .filter((a): a is Record<string, unknown> => isPlainObject(a))
              .map((a) => ({
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

function pillClass(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "bg-yellow-500/15 text-yellow-200 border-yellow-500/20";
    case "preparing":
      return "bg-blue-500/15 text-blue-200 border-blue-500/20";
    case "done":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-500/20";
    case "cancelled":
      return "bg-red-500/15 text-red-200 border-red-500/20";
    default:
      return "bg-white/10 text-white/70 border-white/10";
  }
}

const ADMIN_API_BASE = import.meta.env.DEV ? "https://padrino-pizzeria.vercel.app" : "";

type AdminStatusUpdateResponse = { ok: true; status: OrderStatus } | { ok: false; error: string };

function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

async function adminUpdateOrderStatus(orderId: string, next: OrderStatus): Promise<AdminStatusUpdateResponse> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { ok: false, error: "Missing admin session token" };

  const url = `${ADMIN_API_BASE}/api/admin-update-order-status`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ order_id: orderId, next_status: next }),
  });

  const jsonBody: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      isRecord(jsonBody) && typeof jsonBody.error === "string" && jsonBody.error.trim()
        ? jsonBody.error.trim()
        : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  if (isRecord(jsonBody) && jsonBody.ok === true && isOrderStatus(jsonBody.status)) {
    return { ok: true, status: jsonBody.status };
  }

  return { ok: false, error: "Unexpected response from admin-update-order-status" };
}

type AdminOrdersResponse = { ok: true; orders: OrderRow[] } | { ok: false; error: string };

function normalizeOrderRow(raw: unknown): OrderRow | null {
  if (!isPlainObject(raw)) return null;

  const id = safeString(raw.id);
  const created_at = safeString(raw.created_at);
  const customer_name = safeString(raw.customer_name);
  const customer_phone = safeString(raw.customer_phone);
  const customer_address = safeString(raw.customer_address);

  if (!id) return null;

  const total_price = safeNumberOrNull(raw.total_price);
  const currency = safeString(raw.currency) || null;
  const total_eur_cents = safeNumberOrNull(raw.total_eur_cents);
  const fx_rsd_per_eur = safeNumberOrNull(raw.fx_rsd_per_eur);

  const items = Array.isArray(raw.items) ? (raw.items as unknown[]) : null;

  const status: OrderStatus | null = isOrderStatus(raw.status) ? raw.status : null;

  return {
    id,
    created_at,
    customer_name,
    customer_phone,
    customer_address,
    total_price,
    currency,
    total_eur_cents,
    fx_rsd_per_eur,
    items,
    status,
  };
}

async function adminFetchOrders(limit = 200): Promise<AdminOrdersResponse> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { ok: false, error: "Missing admin session token" };

  const url = `${ADMIN_API_BASE}/api/admin-orders?limit=${encodeURIComponent(String(limit))}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      authorization: `Bearer ${token}`,
    },
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
    const orders = jsonBody.orders.map((o) => normalizeOrderRow(o)).filter((o): o is OrderRow => Boolean(o));
    return { ok: true, orders };
  }

  return { ok: false, error: "Unexpected response from admin-orders" };
}

type AdminResendTelegramResponse = { ok: true; telegram: "sent" } | { ok: false; error: string };

async function adminResendTelegram(orderId: string): Promise<AdminResendTelegramResponse> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { ok: false, error: "Missing admin session token" };

  const url = `${ADMIN_API_BASE}/api/admin-resend-telegram`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ order_id: orderId }),
  });

  const jsonBody: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const msg =
      isRecord(jsonBody) && typeof jsonBody.error === "string" && jsonBody.error.trim()
        ? jsonBody.error.trim()
        : `HTTP ${res.status}`;
    return { ok: false, error: msg };
  }

  if (isRecord(jsonBody) && jsonBody.ok === true) {
    return { ok: true, telegram: "sent" };
  }

  return { ok: false, error: "Unexpected response from admin-resend-telegram" };
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [busyStatusById, setBusyStatusById] = useState<Record<string, boolean>>({});
  const [busyTelegramById, setBusyTelegramById] = useState<Record<string, string>>({});
  const [toastById, setToastById] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const r = await adminFetchOrders(200);

    if (!r.ok) {
      setOrders([]);
      setErrorMsg(r.error);
      setLoading(false);
      return;
    }

    setOrders(r.orders);
    setLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!mounted) return;
      await loadOrders();
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [loadOrders]);

  useEffect(() => {
    if (!autoRefresh) return;

    const id = window.setInterval(() => {
      void loadOrders();
    }, 20000);

    return () => {
      window.clearInterval(id);
    };
  }, [autoRefresh, loadOrders]);

  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = {
      pending: 0,
      preparing: 0,
      done: 0,
      cancelled: 0,
    };

    for (const o of orders) {
      const s = (o.status ?? "pending") as OrderStatus;
      if (s in c) c[s] += 1;
    }

    return c;
  }, [orders]);

  const renderedOrders = useMemo(() => {
    const q = normalizeText(searchQuery);

    const filtered = orders.filter((o) => {
      const status = (o.status ?? "pending") as OrderStatus;

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;

      const base = [
        safeString(o.id),
        safeString(o.customer_name),
        safeString(o.customer_phone),
        safeString(o.customer_address),
        safeString(o.status),
        safeString(o.created_at),
      ]
        .filter(Boolean)
        .join(" ");

      const parsed = parseOrderItems(o.items);

      const metaNote = parsed.meta ? safeString(parsed.meta.order_note ?? parsed.meta.note) : "";
      const metaBits = [metaNote, safeString(parsed.meta?.total_items), safeString(parsed.meta?.cart_id)]
        .filter(Boolean)
        .join(" ");

      const itemBits = parsed.items
        .flatMap((it) => [it.name, it.size ?? "", it.note ?? "", ...it.addons.map((a) => a.name)])
        .filter(Boolean)
        .join(" ");

      const hay = normalizeText([base, metaBits, itemBits].filter(Boolean).join(" "));
      return hay.includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      const ta = parseTimeMs(a.created_at);
      const tb = parseTimeMs(b.created_at);
      return sortDir === "newest" ? tb - ta : ta - tb;
    });

    return sorted;
  }, [orders, searchQuery, sortDir, statusFilter]);

  const updateStatus = useCallback(
    async (orderId: string, next: OrderStatus) => {
      setBusyStatusById((m) => ({ ...m, [orderId]: true }));
      setToastById((m) => ({ ...m, [orderId]: "" }));

      const r = await adminUpdateOrderStatus(orderId, next);

      setBusyStatusById((m) => ({ ...m, [orderId]: false }));

      if (!r.ok) {
        setToastById((m) => ({ ...m, [orderId]: `Greška: ${r.error}` }));
        return;
      }

      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          return { ...o, status: r.status };
        })
      );

      setToastById((m) => ({ ...m, [orderId]: "Status ažuriran ✓" }));
    },
    [setOrders]
  );

  const resendTelegram = useCallback(async (orderId: string) => {
    setBusyTelegramById((m) => ({ ...m, [orderId]: "1" }));
    setToastById((m) => ({ ...m, [orderId]: "" }));

    const r = await adminResendTelegram(orderId);

    setBusyTelegramById((m) => {
      const next = { ...m };
      delete next[orderId];
      return next;
    });

    if (!r.ok) {
      setToastById((m) => ({ ...m, [orderId]: `Greška: ${r.error}` }));
      return;
    }

    setToastById((m) => ({ ...m, [orderId]: "Telegram poslat ✓" }));
  }, []);

  const copyOrderId = useCallback(async (orderId: string) => {
    const ok = await copyToClipboard(orderId);
    setToastById((m) => ({ ...m, [orderId]: ok ? "ID kopiran ✓" : "Copy failed" }));
  }, []);

  function buildOrderSummary(o: OrderRow, parsed: { meta: MetaItem | null; items: ParsedItem[] }) {
    const eur = isEurOrder(o);

    const lines: string[] = [];

    const dt = safeDateTime(o.created_at);
    lines.push(`Porudžbina #${o.id}`);
    lines.push(`Vreme: ${dt}`);
    lines.push("");

    lines.push(`Kupac: ${safeString(o.customer_name) || "-"}`);
    lines.push(`Telefon: ${safeString(o.customer_phone) || "-"}`);
    lines.push(`Adresa: ${safeString(o.customer_address) || "-"}`);

    const metaNote = parsed.meta ? safeString(parsed.meta.order_note ?? parsed.meta.note) : "";
    const payment = extractPaymentValueFromNote(metaNote);

    if (payment) {
      lines.push(`Plaćanje: ${payment}`);
    }

    const other = stripPaymentLines(splitNoteLines(metaNote));
    if (other.length > 0) {
      lines.push(`Napomena: ${other.join(" | ")}`);
    }

    lines.push("");
    lines.push("Stavke:");

    for (const it of parsed.items) {
      const qty = Math.max(1, it.quantity);
      const sizeLabel = it.size ? ` (${it.size})` : "";
      const lineTotal = safeInt(it.price_per_item, 0) * qty;
      const priceLabel = eur ? formatEUR(lineTotal) : formatRSD(lineTotal);

      lines.push(`- ${it.name}${sizeLabel} x${qty} — ${priceLabel}`);

      for (const a of it.addons) {
        const aq = Math.max(1, a.quantity);
        const addonLabel = `  + ${a.name}${aq > 1 ? ` x${aq}` : ""}`;
        if (eur) {
          lines.push(`${addonLabel} (${formatEUR(safeInt(a.price, 0) * aq)})`);
        } else {
          lines.push(`${addonLabel}`);
        }
      }

      if (it.note) lines.push(`  Napomena: ${it.note}`);
    }

    lines.push("");
    lines.push(`Ukupno: ${getOrderTotalLabel(o)}`);

    return lines.join("\n");
  }

  async function copyOrder(o: OrderRow, parsed: { meta: MetaItem | null; items: ParsedItem[] }) {
    const text = buildOrderSummary(o, parsed);
    const ok = await copyToClipboard(text);
    setToastById((m) => ({ ...m, [o.id]: ok ? "Kopirano ✓" : "Copy failed" }));
  }

  return (
    <section className="bg-black text-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Admin — Porudžbine</h2>
            <p className="mt-2 text-white/70">Admin koristi server-side API (service role) za SELECT/UPDATE.</p>
            {import.meta.env.DEV ? (
              <p className="mt-1 text-xs text-white/50">DEV: Admin API ide na production endpoint.</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:border-white/20 disabled:opacity-60"
              onClick={() => void loadOrders()}
              title="Refresh orders"
              disabled={loading}
            >
              Osveži listu
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "preparing", "done", "cancelled"] as const).map((s) => {
                const active = statusFilter === s;
                const label =
                  s === "all"
                    ? "Sve"
                    : s === "pending"
                      ? "Pending"
                      : s === "preparing"
                        ? "Preparing"
                        : s === "done"
                          ? "Done"
                          : "Cancel";
                const count = s === "all" ? orders.length : counts[s as Exclude<typeof s, "all">];

                return (
                  <button
                    key={s}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                      active
                        ? "border-white/20 bg-black/40 text-white"
                        : "border-white/10 bg-black/20 text-white/80 hover:border-white/20"
                    }`}
                    onClick={() => setStatusFilter(s)}
                    title="Filter po statusu"
                  >
                    {label} <span className="text-white/50">({count})</span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraga: ime / tel / adresa / ID / napomena…"
                className="w-full md:w-[360px] rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
              />

              <button
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20"
                onClick={() => setSortDir((p) => (p === "newest" ? "oldest" : "newest"))}
                title="Promeni sortiranje"
              >
                Sort: {sortDir === "newest" ? "Najnovije" : "Najstarije"}
              </button>

              <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
                Auto refresh (20s)
              </label>
            </div>
          </div>

          <p className="mt-3 text-xs text-white/60">
            Pending: <span className="text-white/80">{counts.pending}</span> · Preparing:{" "}
            <span className="text-white/80">{counts.preparing}</span> · Done: <span className="text-white/80">{counts.done}</span> · Cancel:{" "}
            <span className="text-white/80">{counts.cancelled}</span>
          </p>
        </div>

        <div className="mt-6">
          {errorMsg ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{errorMsg}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">Učitavam porudžbine…</div>
          ) : renderedOrders.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">Nema porudžbina.</div>
          ) : (
            <div className="space-y-3">
              {renderedOrders.map((o) => {
                const status = (o.status ?? "pending") as OrderStatus;
                const isExpanded = expandedId === o.id;

                const parsed = parseOrderItems(o.items);
                const eur = isEurOrder(o);

                const metaNote = parsed.meta ? safeString(parsed.meta.order_note ?? parsed.meta.note) : "";
                const payment = extractPaymentValueFromNote(metaNote);

                const computedCount =
                  parsed.meta && parsed.meta.total_items != null
                    ? safeInt(parsed.meta.total_items, parsed.items.length)
                    : parsed.items.reduce((sum, it) => sum + Math.max(1, it.quantity), 0);

                const statusBusy = Boolean(busyStatusById[o.id]);
                const telegramBusy = Boolean(busyTelegramById[o.id]);
                const toast = safeString(toastById[o.id]);

                return (
                  <div key={o.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${pillClass(status)}`}>
                            {status}
                          </span>

                          <p className="text-xs text-gray-400">{safeDateTime(o.created_at)}</p>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white hover:border-white/20"
                            onClick={() => void copyOrderId(o.id)}
                            title="Copy order ID"
                          >
                            Copy ID
                          </button>

                          {toast ? <span className="text-xs text-white/60">· {toast}</span> : null}
                        </div>

                        <p className="mt-3 text-white font-bold truncate">{safeString(o.customer_name) || "—"}</p>

                        <p className="mt-1 text-xs text-white/70">
                          <span className="text-white/50">Tel:</span> {safeString(o.customer_phone) || "—"}
                        </p>

                        <p className="mt-1 text-xs text-white/70">
                          <span className="text-white/50">Adresa:</span> {safeString(o.customer_address) || "—"}
                        </p>

                        {payment ? (
                          <p className="mt-2 text-xs text-white/70">
                            <span className="text-white/50">Plaćanje:</span> <span className="text-white/90 font-semibold">{payment}</span>
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 hover:border-yellow-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "pending"}
                            onClick={() => void updateStatus(o.id, "pending")}
                          >
                            Pending
                          </button>

                          <button
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:border-blue-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "preparing"}
                            onClick={() => void updateStatus(o.id, "preparing")}
                          >
                            Preparing
                          </button>

                          <button
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "done"}
                            onClick={() => void updateStatus(o.id, "done")}
                          >
                            Done
                          </button>

                          <button
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:border-red-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "cancelled"}
                            onClick={() => void updateStatus(o.id, "cancelled")}
                          >
                            Cancel
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            disabled={telegramBusy}
                            onClick={() => void resendTelegram(o.id)}
                            title="Pošalji ponovo Telegram poruku za ovaj order"
                          >
                            {telegramBusy ? "Šaljem…" : "Resend Telegram"}
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            onClick={() => void copyOrder(o, parsed)}
                            title="Kopiraj porudžbinu (tekst) u clipboard"
                          >
                            Copy
                          </button>
                        </div>
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
                        {(() => {
                          const metaNote2 = parsed.meta ? safeString(parsed.meta.order_note ?? parsed.meta.note) : "";
                          const lines = splitNoteLines(metaNote2);
                          const other = stripPaymentLines(lines);

                          if (other.length === 0) return null;

                          return (
                            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                              <p className="text-xs font-semibold text-white/80">Napomena porudžbine</p>
                              <ul className="mt-2 space-y-1 text-xs text-white/70">
                                {other.map((ln, i) => (
                                  <li key={i} className="leading-relaxed">
                                    • {ln}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })()}

                        {parsed.items.map((it, idx) => {
                          const qty = Math.max(1, it.quantity);
                          const lineTotal = safeInt(it.price_per_item, 0) * qty;

                          return (
                            <div key={`${o.id}-${idx}`} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-white font-semibold truncate">
                                    {it.name} {it.size ? <span className="text-white/60 font-normal">({it.size})</span> : null}
                                  </p>
                                  <p className="text-xs text-white/60 mt-1">x{qty}</p>

                                  {it.addons.length > 0 && (
                                    <div className="mt-2 space-y-1">
                                      {it.addons.map((a, j) => {
                                        const aq = Math.max(1, a.quantity);
                                        const addonLabel = `+ ${a.name} ${aq > 1 ? `x${aq}` : ""}`;

                                        return (
                                          <div key={`${idx}-${j}`} className="flex items-center justify-between text-xs">
                                            <span className="text-white/70">{addonLabel}</span>

                                            {eur ? (
                                              <span className="text-gray-400">{formatEUR(safeInt(a.price, 0) * aq)}</span>
                                            ) : (
                                              <span className="text-gray-500">—</span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {it.note ? <p className="mt-2 text-xs text-white/60">Napomena: {it.note}</p> : null}
                                </div>

                                <div className="text-right shrink-0">
                                  <p className="text-white font-bold">{eur ? formatEUR(lineTotal) : formatRSD(lineTotal)}</p>
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