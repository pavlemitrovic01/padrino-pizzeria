import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminApiBase } from "../lib/adminApiBase";
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
  payment_status: string | null;
  payment_method: string | null;
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

const PAYMENT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  paid: { label: "Plaćeno", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/20" },
  refunded: { label: "Refundirano", cls: "bg-amber-500/15 text-amber-200 border-amber-500/20" },
  failed: { label: "Neuspelo", cls: "bg-red-500/15 text-red-200 border-red-500/20" },
  pending: { label: "Čeka plaćanje", cls: "bg-white/10 text-white/70 border-white/10" },
};

function paymentPill(ps: string): { label: string; cls: string } {
  return PAYMENT_STATUS_MAP[ps] ?? { label: ps, cls: "bg-white/10 text-white/70 border-white/10" };
}

const ADMIN_API_BASE = getAdminApiBase();

type AdminStatusUpdateResponse = { ok: true; status: OrderStatus } | { ok: false; error: string };

function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo",
  preparing: "U pripremi",
  done: "Završeno",
  cancelled: "Otkazano",
};

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
  const payment_status = safeString(raw.payment_status) || null;
  const payment_method = safeString(raw.payment_method) || null;

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
    payment_status,
    payment_method,
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

function formatTimeOnly(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("sr-Latn-ME", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

const BUSINESS_TIMEZONE = "Europe/Belgrade";

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

function groupOrdersByBusinessDay(
  orders: OrderRow[],
  sortDir: "newest" | "oldest",
): [string, OrderRow[]][] {
  const map = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const key = getBusinessDateKey(o.created_at);
    const arr = map.get(key) ?? [];
    arr.push(o);
    map.set(key, arr);
  }
  const entries = Array.from(map.entries());
  entries.sort(([a], [b]) => {
    if (a === "unknown") return 1;
    if (b === "unknown") return -1;
    return sortDir === "newest" ? b.localeCompare(a) : a.localeCompare(b);
  });
  return entries;
}

function formatDayHeader(dateKey: string): string {
  if (dateKey === "unknown") return "Nepoznat datum";
  try {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) return dateKey;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return dateKey;
    const d = new Date(Date.UTC(year, month, day));
    if (!Number.isFinite(d.getTime())) return dateKey;
    return new Intl.DateTimeFormat("sr-Latn-ME", {
      timeZone: BUSINESS_TIMEZONE,
      dateStyle: "long",
    }).format(d);
  } catch {
    return dateKey;
  }
}

function escapeCsvValue(val: string): string {
  const s = String(val ?? "").replace(/\r?\n/g, " ").trim();
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatExportDateTime(created_at: string): string {
  try {
    const d = new Date(created_at);
    if (!Number.isFinite(d.getTime())) return "";
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: BUSINESS_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts = fmt.formatToParts(d);
    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "";
    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return "";
  }
}

function buildItemsSummaryNoAddons(o: OrderRow): string {
  const { items } = parseOrderItems(o.items);
  return items
    .map((it) => {
      const qty = Math.max(1, it.quantity);
      const size = it.size ? ` (${it.size})` : "";
      return `${it.name}${size} x${qty}`;
    })
    .join(", ");
}

function generateCsvExport(orders: OrderRow[]): string {
  const header = "id;datum_vreme;kupac;telefon;adresa;status;status_placanja;nacin_placanja;stavke;ukupno_eur";
  const rows = orders.map((o) => {
    const status = (o.status ?? "pending") as OrderStatus;
    const ukupnoEur =
      typeof o.total_eur_cents === "number" && Number.isFinite(o.total_eur_cents)
        ? (o.total_eur_cents / 100).toFixed(2)
        : "";
    return [
      escapeCsvValue(o.id),
      escapeCsvValue(formatExportDateTime(o.created_at)),
      escapeCsvValue(o.customer_name ?? ""),
      escapeCsvValue(o.customer_phone ?? ""),
      escapeCsvValue(o.customer_address ?? ""),
      escapeCsvValue(STATUS_LABEL[status] ?? status),
      escapeCsvValue(o.payment_status ?? ""),
      escapeCsvValue(o.payment_method === "card" ? "Kartica" : o.payment_method === "cash" ? "Gotovina" : o.payment_method ?? ""),
      escapeCsvValue(buildItemsSummaryNoAddons(o)),
      escapeCsvValue(ukupnoEur),
    ].join(";");
  });
  const bom = "\uFEFF";
  return bom + header + "\r\n" + rows.join("\r\n");
}

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<"newest" | "oldest">("newest");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [busyStatusById, setBusyStatusById] = useState<Record<string, boolean>>({});
  const [busyTelegramById, setBusyTelegramById] = useState<Record<string, string>>({});
  const [toastById, setToastById] = useState<Record<string, string>>({});
  const [exportFeedback, setExportFeedback] = useState<string | null>(null);

  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    const r = await adminFetchOrders(200);

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

  const lastRefreshLabel = useMemo(() => {
    if (!lastRefreshedAt) return "";
    return formatTimeOnly(lastRefreshedAt);
  }, [lastRefreshedAt]);

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

  const statusAndSearchFiltered = useMemo(() => {
    const q = normalizeText(searchQuery);

    return orders.filter((o) => {
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
  }, [orders, searchQuery, statusFilter]);

  const paymentStatusCounts = useMemo(() => {
    const c = { all: statusAndSearchFiltered.length, paid: 0, refunded: 0, failed: 0, pending: 0 };
    for (const o of statusAndSearchFiltered) {
      const ps = o.payment_status ?? "";
      if (ps === "paid") c.paid += 1;
      else if (ps === "refunded") c.refunded += 1;
      else if (ps === "failed") c.failed += 1;
      else if (ps === "pending") c.pending += 1;
    }
    return c;
  }, [statusAndSearchFiltered]);

  const renderedOrders = useMemo(() => {
    const filtered =
      paymentStatusFilter === "all"
        ? statusAndSearchFiltered
        : statusAndSearchFiltered.filter((o) => (o.payment_status ?? "") === paymentStatusFilter);

    const sorted = [...filtered].sort((a, b) => {
      const ta = parseTimeMs(a.created_at);
      const tb = parseTimeMs(b.created_at);
      return sortDir === "newest" ? tb - ta : ta - tb;
    });

    return sorted;
  }, [statusAndSearchFiltered, sortDir, paymentStatusFilter]);

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
        }),
      );

      setToastById((m) => ({ ...m, [orderId]: "Status ažuriran ✓" }));
    },
    [setOrders],
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
    setToastById((m) => ({ ...m, [orderId]: ok ? "ID kopiran ✓" : "Kopiranje nije uspjelo" }));
  }, []);

  const handleExportCsv = useCallback(
    (orders: OrderRow[]) => {
      setExportFeedback(null);
      if (orders.length === 0) {
        setExportFeedback("Nema porudžbina za export.");
        setTimeout(() => setExportFeedback(null), 4000);
        return;
      }
      const csv = generateCsvExport(orders);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `porudzbine-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    },
    [],
  );

  function buildOrderSummary(o: OrderRow, parsed: { meta: MetaItem | null; items: ParsedItem[] }) {
    const eur = isEurOrder(o);

    const lines: string[] = [];

    const dt = safeDateTime(o.created_at);
    lines.push(`Porudžbina #${o.id}`);
    lines.push(`Vrijeme: ${dt}`);
    lines.push("");

    lines.push(`Kupac: ${safeString(o.customer_name) || "-"}`);
    lines.push(`Telefon: ${safeString(o.customer_phone) || "-"}`);
    lines.push(`Adresa: ${safeString(o.customer_address) || "-"}`);

    const metaNote = parsed.meta ? safeString(parsed.meta.order_note ?? parsed.meta.note) : "";

    if (o.payment_method) {
      lines.push(`Plaćanje: ${o.payment_method === "card" ? "Kartica" : "Gotovina"}`);
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
    setToastById((m) => ({ ...m, [o.id]: ok ? "Kopirano ✓" : "Kopiranje nije uspjelo" }));
  }

  return (
    <section className="bg-black text-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Admin — Porudžbine</h2>
            <p className="mt-2 text-white/70">Admin koristi server-side API (service role) za SELECT/UPDATE.</p>
            {import.meta.env.DEV ? (
              <p className="mt-1 text-xs text-white/50">DEV: Admin API base: {ADMIN_API_BASE || "(same origin)"}</p>
            ) : null}
            {lastRefreshLabel ? (
              <p className="mt-1 text-xs text-white/50">Posljednje osvježavanje: {lastRefreshLabel}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
            <button
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:border-white/20 disabled:opacity-60"
              onClick={() => void loadOrders()}
              title="Osvježi porudžbine"
              disabled={loading}
            >
              Osvježi listu
            </button>
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[0_4px_24px_rgba(0,0,0,0.25)]">
          <div className="p-5 space-y-5">
            {/* Status filters */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Status porudžbine</span>
              <div className="flex flex-wrap gap-2">
                {(["all", "pending", "preparing", "done", "cancelled"] as const).map((s) => {
                  const active = statusFilter === s;
                  const label = s === "all" ? "Sve" : STATUS_LABEL[s];
                  const count = s === "all" ? orders.length : counts[s];
                  return (
                    <button
                      key={s}
                      className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-white/25 bg-white/15 text-white shadow-sm"
                          : "border-white/10 bg-black/20 text-white/85 hover:border-white/18 hover:bg-black/30"
                      }`}
                      onClick={() => setStatusFilter(s)}
                      title="Filter po statusu"
                    >
                      {label} <span className={active ? "text-white/70" : "text-white/45"}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment filters */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">Status plaćanja</span>
              <div className="flex flex-wrap gap-2">
                {(["all", "paid", "refunded", "failed", "pending"] as const).map((ps) => {
                  const active = paymentStatusFilter === ps;
                  const label =
                    ps === "all" ? "Sve plaćanje" : ps === "paid" ? "Plaćeno" : ps === "refunded" ? "Refundirano" : ps === "failed" ? "Neuspelo" : "Čeka plaćanje";
                  const count = paymentStatusCounts[ps];
                  return (
                    <button
                      key={ps}
                      className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition ${
                        active
                          ? "border-white/25 bg-white/15 text-white shadow-sm"
                          : "border-white/10 bg-black/20 text-white/85 hover:border-white/18 hover:bg-black/30"
                      }`}
                      onClick={() => setPaymentStatusFilter(ps)}
                      title="Filter po statusu plaćanja"
                    >
                      {label} <span className={active ? "text-white/70" : "text-white/45"}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2 border-t border-white/8">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pretraga: ime / telefon / adresa / ID / napomena…"
                className="flex-1 min-w-0 max-w-md rounded-lg border border-white/10 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-white/35 outline-none focus:border-white/25 focus:ring-1 focus:ring-white/10 transition"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs font-semibold text-white/90 hover:border-white/20 hover:bg-black/40 transition"
                  onClick={() => setSortDir((p) => (p === "newest" ? "oldest" : "newest"))}
                  title="Promijeni sortiranje"
                >
                  Sort: {sortDir === "newest" ? "Najnovije" : "Najstarije"}
                </button>
                <button
                  className="rounded-lg border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs font-semibold text-white/90 hover:border-white/20 hover:bg-black/40 transition"
                  onClick={() => handleExportCsv(renderedOrders)}
                  title="Export trenutno filtriranih porudžbina u CSV"
                >
                  Export CSV
                </button>
                {exportFeedback ? (
                  <span className="text-xs text-amber-300/90">{exportFeedback}</span>
                ) : null}
                <label className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3.5 py-2.5 text-xs text-white/75 hover:border-white/15 cursor-pointer transition">
                  <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="rounded border-white/20" />
                  Auto osvježavanje (20s)
                </label>
              </div>
            </div>

            <p className="text-[11px] text-white/40 pt-1">
              Novo: {counts.pending} · U pripremi: {counts.preparing} · Završeno: {counts.done} · Otkazano: {counts.cancelled}
            </p>
          </div>
        </div>

        <div className="mt-6">
          {errorMsg ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMsg}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
              Učitavam porudžbine…
            </div>
          ) : renderedOrders.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
              Nema porudžbina.
            </div>
          ) : (
            <div className="space-y-6">
              {groupOrdersByBusinessDay(renderedOrders, sortDir).map(([dateKey, dayOrders]) => (
                <div key={dateKey} className="space-y-3">
                  <h3 className="text-sm font-bold text-white/90 border-b border-white/10 pb-2">
                    {formatDayHeader(dateKey)}
                  </h3>
                  {dayOrders.map((o) => {
                const status = (o.status ?? "pending") as OrderStatus;
                const isExpanded = expandedId === o.id;

                const parsed = parseOrderItems(o.items);
                const eur = isEurOrder(o);

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
                          <span
                            className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${pillClass(
                              status,
                            )}`}
                            title={status}
                          >
                            {STATUS_LABEL[status]}
                          </span>

                          {o.payment_status ? (() => {
                            const pp = paymentPill(o.payment_status);
                            return (
                              <span
                                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${pp.cls}`}
                                title={o.payment_status}
                              >
                                {pp.label}
                              </span>
                            );
                          })() : null}

                          <p className="text-xs text-gray-400">{safeDateTime(o.created_at)}</p>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-1 text-xs font-semibold text-white hover:border-white/20"
                            onClick={() => void copyOrderId(o.id)}
                            title="Kopiraj ID porudžbine"
                          >
                            Kopiraj ID
                          </button>

                          {toast ? <span className="text-xs text-white/60">· {toast}</span> : null}
                        </div>

                        <p className="mt-3 text-white font-bold truncate">{safeString(o.customer_name) || "—"}</p>

                        <p className="mt-1 text-xs text-white/70">
                          <span className="text-white/50">Telefon:</span> {safeString(o.customer_phone) || "—"}
                        </p>

                        <p className="mt-1 text-xs text-white/70">
                          <span className="text-white/50">Adresa:</span> {safeString(o.customer_address) || "—"}
                        </p>

                        {o.payment_method ? (
                          <p className="mt-2 text-xs text-white/70">
                            <span className="text-white/50">Plaćanje:</span>{" "}
                            <span className="text-white/90 font-semibold">
                              {o.payment_method === "card" ? "Kartica" : "Gotovina"}
                            </span>
                          </p>
                        ) : null}

                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            className="rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs font-semibold text-yellow-200 hover:border-yellow-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "pending"}
                            onClick={() => void updateStatus(o.id, "pending")}
                            title="Postavi status: Novo"
                          >
                            Novo
                          </button>

                          <button
                            className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-200 hover:border-blue-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "preparing"}
                            onClick={() => void updateStatus(o.id, "preparing")}
                            title="Postavi status: U pripremi"
                          >
                            U pripremi
                          </button>

                          <button
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 hover:border-emerald-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "done"}
                            onClick={() => void updateStatus(o.id, "done")}
                            title="Postavi status: Završeno"
                          >
                            Završeno
                          </button>

                          <button
                            className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:border-red-500/30 disabled:opacity-50"
                            disabled={statusBusy || status === "cancelled"}
                            onClick={() => void updateStatus(o.id, "cancelled")}
                            title="Postavi status: Otkazano"
                          >
                            Otkazano
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            disabled={telegramBusy}
                            onClick={() => void resendTelegram(o.id)}
                            title="Pošalji ponovo Telegram poruku za ovu porudžbinu"
                          >
                            {telegramBusy ? "Šaljem…" : "Pošalji Telegram ponovo"}
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            onClick={() => void copyOrder(o, parsed)}
                            title="Kopiraj porudžbinu (tekst)"
                          >
                            Kopiraj porudžbinu
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
                          {isExpanded ? "Sakrij detalje" : "Detalji"}
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

                                        return (
                                          <div key={`${idx}-${j}`} className="flex items-center justify-between text-xs">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}