import { getAdminApiBase } from "./adminApiBase";
import { supabaseAdminAuth } from "./supabaseAdminAuthClient";
import { formatEUR, formatRSD, toSafeInt } from "./money";
import { isRecord, isPlainObject, safeString, normalizeText } from "./parsing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

export type OrderRow = {
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

export type ParsedItem = {
  name: string;
  quantity: number;
  size: string | null;
  price_per_item: number;
  addons: { name: string; quantity: number; price: number }[];
  note: string | null;
};

export type MetaItem = {
  total_items?: unknown;
  order_note?: unknown;
  note?: unknown;
  cart_id?: unknown;
  name?: unknown;
  category?: unknown;
};

export type AdminStatusUpdateResponse = { ok: true; status: OrderStatus } | { ok: false; error: string };
export type AdminOrdersResponse = { ok: true; orders: OrderRow[] } | { ok: false; error: string };
export type AdminResendTelegramResponse = { ok: true; telegram: "sent" } | { ok: false; error: string };

// ─── Constants ────────────────────────────────────────────────────────────────

export const ADMIN_API_BASE = getAdminApiBase();

export const PAYMENT_STATUS_MAP: Record<string, { label: string; cls: string }> = {
  paid: { label: "Plaćeno", cls: "bg-emerald-500/15 text-emerald-200 border-emerald-500/20" },
  refunded: { label: "Refundirano", cls: "bg-amber-500/15 text-amber-200 border-amber-500/20" },
  failed: { label: "Neuspelo", cls: "bg-red-500/15 text-red-200 border-red-500/20" },
  pending: { label: "Čeka plaćanje", cls: "bg-white/10 text-white/70 border-white/10" },
};

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo",
  preparing: "U pripremi",
  done: "Završeno",
  cancelled: "Otkazano",
};

export const BUSINESS_TIMEZONE = "Europe/Belgrade";

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function safeInt(v: unknown, fallback = 0): number {
  return toSafeInt(v, fallback);
}

export function safeNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function safeDateTime(value: unknown) {
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

export function isEurOrder(o: OrderRow) {
  const c = safeString(o.currency).toUpperCase();
  return c === "EUR" || typeof o.total_eur_cents === "number";
}

export function getOrderTotalLabel(o: OrderRow) {
  if (isEurOrder(o)) {
    const cents =
      typeof o.total_eur_cents === "number"
        ? safeInt(o.total_eur_cents, 0)
        : safeInt(o.total_price, 0);
    return formatEUR(cents);
  }
  return formatRSD(o.total_price ?? 0);
}

export function parseTimeMs(value: string): number {
  const t = Date.parse(String(value ?? ""));
  return Number.isFinite(t) ? t : 0;
}

export function splitNoteLines(note: string): string[] {
  return String(note ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function stripPaymentLines(lines: string[]): string[] {
  return lines.filter((ln) => !/pla[ćc]anje\s*:/i.test(ln));
}

export async function copyToClipboard(text: string): Promise<boolean> {
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

export function isMetaRow(v: unknown): v is MetaItem {
  if (!isPlainObject(v)) return false;

  const cartId = normalizeText(safeString(v.cart_id));
  const name = normalizeText(safeString(v.name));
  const cat = normalizeText(safeString(v.category));

  return cartId === "meta" || name === "meta" || cat === "meta";
}

export function parseOrderItems(itemsRaw: unknown[] | null): { meta: MetaItem | null; items: ParsedItem[] } {
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

export function pillClass(status: OrderStatus) {
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

export function paymentPill(ps: string): { label: string; cls: string } {
  return PAYMENT_STATUS_MAP[ps] ?? { label: ps, cls: "bg-white/10 text-white/70 border-white/10" };
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

export function formatTimeOnly(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString("sr-Latn-ME", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export function getBusinessDateKey(created_at: string): string {
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

export function groupOrdersByBusinessDay(
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

export function formatDayHeader(dateKey: string): string {
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

export function escapeCsvValue(val: string): string {
  const s = String(val ?? "").replace(/\r?\n/g, " ").trim();
  if (/[;"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function formatExportDateTime(created_at: string): string {
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

export function buildItemsSummaryNoAddons(o: OrderRow): string {
  const { items } = parseOrderItems(o.items);
  return items
    .map((it) => {
      const qty = Math.max(1, it.quantity);
      const size = it.size ? ` (${it.size})` : "";
      return `${it.name}${size} x${qty}`;
    })
    .join(", ");
}

export function generateCsvExport(orders: OrderRow[]): string {
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
  const bom = "﻿";
  return bom + header + "\r\n" + rows.join("\r\n");
}

// ─── API functions ────────────────────────────────────────────────────────────

export function normalizeOrderRow(raw: unknown): OrderRow | null {
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

export async function adminFetchOrders(limit = 200): Promise<AdminOrdersResponse> {
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

export async function adminUpdateOrderStatus(orderId: string, next: OrderStatus): Promise<AdminStatusUpdateResponse> {
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

export async function adminResendTelegram(orderId: string): Promise<AdminResendTelegramResponse> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = data?.session?.access_token;

  if (!token) return { ok: false, error: "Missing admin session token" };

  const url = `${ADMIN_API_BASE}/api/admin-orders?op=resend-telegram`;

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

  return { ok: false, error: "Unexpected response from admin-orders resend-telegram" };
}

// ─── Order summary ────────────────────────────────────────────────────────────

export function buildOrderSummary(o: OrderRow, parsed: { meta: MetaItem | null; items: ParsedItem[] }): string {
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
