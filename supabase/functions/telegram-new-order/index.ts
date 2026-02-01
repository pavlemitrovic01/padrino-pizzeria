/// <reference path="../deno.d.ts" />

// Supabase Edge Function: telegram-new-order
// Goal: cheapest + stable + read-only Telegram notification for NEW pending orders.
// Trigger: Supabase Database Webhook (INSERT on orders), calling this function URL.
//
// Env required (Supabase Dashboard → Project Settings → Functions → Secrets):
// - TELEGRAM_BOT_TOKEN
// - TELEGRAM_CHAT_ID
//
// Hardening (recommended):
// - TELEGRAM_WEBHOOK_SECRET (preferred)  OR  WEBHOOK_SECRET (back-compat)
//   If set, require header: x-webhook-secret to match exactly.
//
// Stability additions in this version:
// - Accept both env names for webhook secret (so you don't get locked into one)
// - Best-effort idempotency (in-memory TTL) to avoid duplicate Telegram messages from webhook retries
// - Keep "pending-only" behavior locked
// - Safe parsing + clear JSON responses

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function safeNumber(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatMoneyEUR(cents?: number) {
  const n = typeof cents === "number" ? cents : Number(cents);
  const safe = Number.isFinite(n) ? Math.trunc(n) : 0;
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

function formatMoneyRSD(value?: number) {
  const n = safeNumber(value, 0);
  try {
    return new Intl.NumberFormat("sr-Latn-ME", {
      style: "currency",
      currency: "RSD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)} RSD`;
  }
}

type InsertOrderPayload = {
  id?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_price?: number;
  currency?: string | null;
  total_eur_cents?: number | null;
  fx_rsd_per_eur?: number | null;
  items?: unknown;
  note?: string | null;
};

type WebhookBody = {
  type?: string;
  table?: string;
  record?: InsertOrderPayload;
  old_record?: unknown;
};

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

async function sendTelegramMessage(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  if (!token || !chatId) {
    return {
      ok: false,
      error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID",
    };
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

  if (!res.ok) {
    return { ok: false, status: res.status, json };
  }

  return { ok: true, json };
}

function buildMessage(order: InsertOrderPayload) {
  const name = safeString(order.customer_name);
  const phone = safeString(order.customer_phone);
  const address = safeString(order.customer_address);

  const currency = safeString(order.currency).toUpperCase();

  const total =
    currency === "EUR" || typeof order.total_eur_cents === "number"
      ? formatMoneyEUR(
          typeof order.total_eur_cents === "number" ? order.total_eur_cents : order.total_price
        )
      : formatMoneyRSD(order.total_price);

  const header = `🍕 Nova porudžbina (PENDING)`;
  const meta: string[] = [];

  if (name) meta.push(`<b>Ime:</b> ${name}`);
  if (phone) meta.push(`<b>Telefon:</b> ${phone}`);
  if (address) meta.push(`<b>Adresa:</b> ${address}`);
  meta.push(`<b>Ukupno:</b> ${total}`);

  const itemsRaw = order.items;
  let lines: string[] = [];

  if (Array.isArray(itemsRaw)) {
    const rawList = itemsRaw.slice(1);
    lines = rawList
      .filter((x) => x && typeof x === "object" && !Array.isArray(x))
      .map((it: any) => {
        const n = safeString(it.name);
        const qty = Math.max(1, Math.floor(safeNumber(it.quantity, 1)));
        const pricePerItem = safeNumber(it.price_per_item, 0);
        const lineTotal = pricePerItem * qty;

        const money =
          currency === "EUR" || typeof order.total_eur_cents === "number"
            ? formatMoneyEUR(lineTotal)
            : formatMoneyRSD(lineTotal);

        const size = safeString(it.size);
        const sizeSuffix = size ? ` (${size})` : "";
        return `• ${n}${sizeSuffix} x${qty} — ${money}`;
      });
  }

  const body = lines.length ? `\n\n<b>Stavke:</b>\n${lines.join("\n")}` : "";

  return `${header}\n\n${meta.join("\n")}${body}`;
}

function getSecret() {
  return Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? Deno.env.get("WEBHOOK_SECRET") ?? "";
}

export default async function handler(req: Request): Promise<Response> {
  const secret = getSecret();
  if (secret) {
    const header = req.headers.get("x-webhook-secret") ?? "";
    if (header !== secret) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      });
    }
  }

  const body = (await req.json().catch(() => null)) as WebhookBody | null;
  const record = body?.record;

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
}
