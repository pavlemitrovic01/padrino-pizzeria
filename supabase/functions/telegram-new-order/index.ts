/// <reference path="../deno.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type InsertOrderPayload = {
  id?: string;
  created_at?: string;
  status?: string | null;

  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;

  // legacy
  total_price?: number;

  // EUR migration
  currency?: string | null;
  total_eur_cents?: number | null;
  fx_rsd_per_eur?: number | null;

  items?: unknown;
};

type WebhookBody =
  | {
      type?: string;
      table?: string;
      schema?: string;
      record?: InsertOrderPayload;
      old_record?: unknown;
    }
  | InsertOrderPayload;

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function formatMoneyEUR(cents: number) {
  const safe = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  const amount = safe / 100;

  try {
    return new Intl.NumberFormat("sr-Latn-ME", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}

function formatMoneyRSD(value: number) {
  const safe = Number.isFinite(value) ? value : 0;
  try {
    return new Intl.NumberFormat("sr-Latn-ME", {
      style: "currency",
      currency: "RSD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `${Math.round(safe)} RSD`;
  }
}

function requireWebhookSecret(): string {
  const secret =
    Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ??
    Deno.env.get("WEBHOOK_SECRET") ??
    "";

  // DETERMINISTIČKI: ako nema secreta, failuj odmah (da ne ostane “otvoren” endpoint)
  if (!secret) {
    throw new Error("Missing TELEGRAM_WEBHOOK_SECRET (or WEBHOOK_SECRET). Set it in Settings → Vault (BETA) then redeploy.");
  }

  return secret;
}

function pickRecord(body: WebhookBody | null): InsertOrderPayload | null {
  if (!body || typeof body !== "object") return null;

  if ("record" in (body as any)) {
    const r = (body as any).record;
    if (r && typeof r === "object") return r as InsertOrderPayload;
    return null;
  }

  return body as InsertOrderPayload;
}

const recentIds = new Map<string, number>();
const RECENT_TTL_MS = 2 * 60 * 1000;

function seenRecently(id: string) {
  const now = Date.now();
  for (const [k, t] of recentIds.entries()) {
    if (now - t > RECENT_TTL_MS) recentIds.delete(k);
  }
  if (recentIds.has(id)) return true;
  recentIds.set(id, now);
  return false;
}

function extractOrderNote(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  const meta = items[0];
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return "";

  const note =
    (meta as any).order_note ??
    (meta as any).note ??
    (meta as any).napomena ??
    "";

  return safeString(note);
}

function extractLineItems(items: unknown): any[] {
  if (!Array.isArray(items)) return [];
  // items[0] je meta {order_note}, ostalo su stavke
  if (
    items.length > 0 &&
    items[0] &&
    typeof items[0] === "object" &&
    !Array.isArray(items[0]) &&
    ("order_note" in (items[0] as any) || "note" in (items[0] as any) || "napomena" in (items[0] as any))
  ) {
    return items.slice(1);
  }
  return items;
}

function computeTotalString(order: InsertOrderPayload): string {
  const currency = safeString(order.currency).toUpperCase();
  const eurCents = safeNumber(order.total_eur_cents);

  if (eurCents != null) return formatMoneyEUR(eurCents);

  const totalPrice = safeNumber(order.total_price);
  if (currency === "EUR" && totalPrice != null) return formatMoneyEUR(totalPrice);
  if (totalPrice != null) return formatMoneyRSD(totalPrice);

  return "N/A";
}

function buildMessage(order: InsertOrderPayload) {
  const name = safeString(order.customer_name);
  const phone = safeString(order.customer_phone);
  const address = safeString(order.customer_address);

  const header = `🍕 Nova porudžbina (PENDING)`;

  const meta: string[] = [];
  if (name) meta.push(`<b>Ime:</b> ${name}`);
  if (phone) meta.push(`<b>Telefon:</b> ${phone}`);
  if (address) meta.push(`<b>Adresa:</b> ${address}`);

  meta.push(`<b>Ukupno:</b> ${computeTotalString(order)}`);

  const note = extractOrderNote(order.items);
  if (note) meta.push(`<b>Napomena:</b> ${note}`);

  const currency = safeString(order.currency).toUpperCase();
  const preferEur = safeNumber(order.total_eur_cents) != null || currency === "EUR";

  const lineItems = extractLineItems(order.items);
  const lines: string[] = [];

  for (const it of lineItems) {
    if (!it || typeof it !== "object" || Array.isArray(it)) continue;

    const n = safeString((it as any).name) || "Stavka";
    const qty = Math.max(1, Math.floor(safeNumber((it as any).quantity) ?? 1));
    const ppi = safeNumber((it as any).price_per_item) ?? 0;
    const lineTotal = ppi * qty;

    const money = preferEur ? formatMoneyEUR(lineTotal) : formatMoneyRSD(lineTotal);

    const size = safeString((it as any).size);
    const sizeSuffix = size ? ` (${size})` : "";

    lines.push(`• ${n}${sizeSuffix} x${qty} — ${money}`);
  }

  const body = lines.length ? `\n\n<b>Stavke:</b>\n${lines.join("\n")}` : "";
  return `${header}\n\n${meta.join("\n")}${body}`;
}

async function sendTelegramMessage(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, status: res.status, json };
  return { ok: true, json };
}

serve(async (req) => {
  try {
    // 1) Secret MUST exist, иначе fail odmah (stabilno ponašanje)
    const secret = requireWebhookSecret();

    // 2) Secret MUST match header
    const header = req.headers.get("x-webhook-secret") ?? "";
    if (header !== secret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => null)) as WebhookBody | null;
    const record = pickRecord(body);

    if (!record) {
      return new Response(JSON.stringify({ ok: false, error: "Missing record" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const id = safeString(record.id);
    if (id && seenRecently(id)) {
      return new Response(JSON.stringify({ ok: true, skipped: "duplicate" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const status = safeString((record as any).status);
    if (status && status !== "pending") {
      return new Response(JSON.stringify({ ok: true, skipped: "not-pending" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const text = buildMessage(record);
    const sent = await sendTelegramMessage(text);

    return new Response(JSON.stringify(sent), {
      status: sent.ok ? 200 : 500,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
