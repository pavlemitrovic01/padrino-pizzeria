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

function formatMoneyRSD(value: unknown): string {
  const n = safeNumber(value, NaN);
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(2)} RSD`;
}

type OrderItemAddon = {
  id?: string;
  name?: string;
  price?: number;
  quantity?: number;
};

type OrderItem = {
  name?: string;
  size?: "33" | "50" | string | null;
  quantity?: number;
  addons?: OrderItemAddon[];
  note?: string | null;
};

type OrderRecord = {
  id?: string | number;
  created_at?: string;
  status?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  total_price?: number;
  items?: unknown;
  note?: string | null;
};

type WebhookPayload = {
  record?: unknown;
  old_record?: unknown;
  new?: unknown;
  data?: unknown;
};

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function extractRecord(payload: unknown): OrderRecord | null {
  if (!isObject(payload)) return null;

  const p = payload as WebhookPayload;

  // Supabase Database Webhooks usually send: { ..., record, old_record }
  if (isObject(p.record)) return p.record as unknown as OrderRecord;

  // Some setups send { new: {...} } or { data: {...} }
  if (isObject(p.new)) return p.new as unknown as OrderRecord;
  if (isObject(p.data)) return p.data as unknown as OrderRecord;

  // If someone calls the function manually with the record directly
  return payload as unknown as OrderRecord;
}

function normalizeOrderId(v: unknown): string {
  const s = safeString(v);
  if (s) return s;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function summarizeItems(items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "";

  const lines: string[] = [];

  for (const raw of items) {
    const item = (isObject(raw) ? (raw as unknown as OrderItem) : ({} as OrderItem));

    const name = safeString(item.name) || "Stavka";
    const qty =
      typeof item.quantity === "number" && Number.isFinite(item.quantity)
        ? item.quantity
        : 1;

    const size = safeString(item.size);
    const sizePart = size ? ` (${size}cm)` : "";

    const note = safeString(item.note);
    const notePart = note ? ` — Napomena: ${note}` : "";

    let addonsPart = "";
    if (Array.isArray(item.addons) && item.addons.length > 0) {
      const addonNames = item.addons
        .map((a) => {
          const an = safeString(a?.name);
          const aq =
            typeof a?.quantity === "number" && Number.isFinite(a.quantity)
              ? a.quantity
              : 1;
          return an ? `${an}${aq > 1 ? ` x${aq}` : ""}` : "";
        })
        .filter((x) => x.length > 0);

      if (addonNames.length > 0) addonsPart = ` + ${addonNames.join(", ")}`;
    }

    lines.push(`• ${name}${sizePart} x${qty}${addonsPart}${notePart}`);
  }

  return lines.join("\n");
}

function buildTelegramMessage(order: OrderRecord): string {
  const id = safeString(order.id);
  const createdAt = safeString(order.created_at);

  const customerName = safeString(order.customer_name);
  const phone = safeString(order.customer_phone);
  const address = safeString(order.customer_address);

  const total = formatMoneyRSD(order.total_price);

  const header = `🍕 Nova porudžbina (PENDING)`;
  const meta: string[] = [];

  if (id) meta.push(`ID: ${id}`);
  if (createdAt) meta.push(`Vreme: ${createdAt}`);

  const customer: string[] = [];
  if (customerName) customer.push(`Kupac: ${customerName}`);
  if (phone) customer.push(`Tel: ${phone}`);
  if (address) customer.push(`Adresa: ${address}`);

  const items = summarizeItems(order.items);
  const itemsBlock = items ? `\n\n${items}` : "";

  const note = safeString(order.note);
  const orderNoteBlock = note ? `\n\n📝 Napomena (order): ${note}` : "";

  const totalLine = total ? `\n\n💰 Ukupno: ${total}` : "";

  const metaBlock = meta.length ? `\n${meta.join("\n")}` : "";
  const customerBlock = customer.length ? `\n\n${customer.join("\n")}` : "";

  return `${header}${metaBlock}${customerBlock}${itemsBlock}${orderNoteBlock}${totalLine}`.trim();
}

async function sendTelegram(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID");

  if (!token) return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN" };
  if (!chatId) return { ok: false, error: "Missing TELEGRAM_CHAT_ID" };

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      ok: false,
      error: `Telegram sendMessage failed: ${res.status} ${res.statusText} ${body}`.trim(),
    };
  }

  const json: unknown = await res.json().catch(() => null);
  if (!isObject(json) || (json as { ok?: boolean }).ok !== true) {
    return { ok: false, error: `Telegram API returned not-ok: ${JSON.stringify(json)}` };
  }

  return { ok: true };
}

/**
 * Best-effort idempotency (per warm Edge instance):
 * Webhooks can retry; we try to prevent duplicate sends for the same order id.
 * Marks only on successful send (so we don't drop notifications).
 */
const processed = new Map<string, number>(); // orderId -> timestamp ms
const DEDUPE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function cleanupProcessed(now: number) {
  for (const [k, ts] of processed) {
    if (now - ts > DEDUPE_TTL_MS) processed.delete(k);
  }
}

function isDuplicate(orderId: string): boolean {
  const now = Date.now();
  cleanupProcessed(now);
  const last = processed.get(orderId);
  return typeof last === "number" && now - last <= DEDUPE_TTL_MS;
}

function markProcessed(orderId: string) {
  processed.set(orderId, Date.now());
}

function json(status: number, body: unknown, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "content-type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  // Minimal CORS for browser testing; webhook calls won't care.
  const origin = req.headers.get("origin") ?? "*";
  const corsHeaders: Record<string, string> = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, x-webhook-secret",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, corsHeaders);
  }

  // Require shared secret if configured (accept both env names to avoid mismatch)
  const requiredSecret =
    Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ??
    Deno.env.get("WEBHOOK_SECRET") ??
    "";

  if (requiredSecret) {
    const got = req.headers.get("x-webhook-secret") ?? "";
    if (got !== requiredSecret) {
      return json(401, { ok: false, error: "Unauthorized" }, corsHeaders);
    }
  }

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return json(400, { ok: false, error: "Invalid JSON" }, corsHeaders);
  }

  const record = extractRecord(payload);
  if (!record) {
    return json(400, { ok: false, error: "Missing record payload" }, corsHeaders);
  }

  const status = safeString(record.status).toLowerCase();
  // Notify ONLY on pending (locked requirement).
  if (status !== "pending") {
    return json(200, { ok: true, skipped: true, reason: "status_not_pending" }, corsHeaders);
  }

  const orderId = normalizeOrderId(record.id);

  // Dedupe only if we have a stable order id
  if (orderId && isDuplicate(orderId)) {
    return json(200, { ok: true, skipped: true, reason: "duplicate" }, corsHeaders);
  }

  const message = buildTelegramMessage(record);

  try {
    const sent = await sendTelegram(message);
    if (!sent.ok) {
      // 500 -> Supabase webhook retries (good).
      // We do NOT mark processed on failure.
      return json(500, { ok: false, error: sent.error ?? "Telegram send failed" }, corsHeaders);
    }

    if (orderId) markProcessed(orderId);

    return json(200, { ok: true }, corsHeaders);
  } catch (e) {
    return json(
      500,
      { ok: false, error: (e as Error)?.message ?? "Unknown error" },
      corsHeaders
    );
  }
});
