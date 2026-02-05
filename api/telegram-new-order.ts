
import { createClient } from "@supabase/supabase-js";

function json(res: any, status: number, body: any) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeHeaderValue(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? "").trim();
  return String(v ?? "").trim();
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;
  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)");
  let u: URL;
  try { u = new URL(SUPABASE_URL); } catch { throw new Error("Invalid supabaseUrl: Provided URL is malformed."); }
  if (!u.hostname.endsWith(".supabase.co")) throw new Error("Invalid supabaseUrl: Expected *.supabase.co host.");
  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/telegram-new-order" } },
  });
}

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
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
    // ignore errors, do not leak secrets
  } catch {}
}

function formatOrderForTelegram(order: any) {
  const name = String(order?.customer_name ?? "");
  const phone = String(order?.customer_phone ?? "");
  const address = String(order?.customer_address ?? "");
  const status = String(order?.status ?? "");
  const cents = Number(order?.total_eur_cents ?? 0);
  const total = Number.isFinite(cents) ? (cents / 100).toFixed(2) : "0.00";
  const items = Array.isArray(order?.items) ? order.items : [];
  const lines: string[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    if ((it as any).cart_id) {
      const nm = String((it as any).name ?? "");
      const size = (it as any).size ? ` (${String((it as any).size)} cm)` : "";
      const qty = Number((it as any).quantity ?? 1) || 1;
      lines.push(`• ${nm}${size} x${qty}`);
    }
  }
  const msg =
    `<b>Nova porudžbina</b>\n` +
    `Ime: ${name}\n` +
    `Telefon: ${phone}\n` +
    `Adresa: ${address}\n` +
    `Status: ${status}\n` +
    `Ukupno: ${total} €\n\n` +
    (lines.length ? lines.join("\n") : "");
  return msg;
}

export default async function handler(req: any, res: any) {
  // CORS: dozvoli x-telegram-secret
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-telegram-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

  // Provjera x-telegram-secret ako postoji env
  const expectedSecret = toTrimmedString(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (expectedSecret) {
    const got = normalizeHeaderValue(req.headers?.["x-telegram-secret"]);
    if (!got || got !== expectedSecret) {
      return json(res, 401, { ok: false, error: "Unauthorized" });
    }
  }

  const body = isPlainObject(req.body) ? req.body : {};
  // order_id ili orderId
  const order_id = toTrimmedString((body as any).order_id) || toTrimmedString((body as any).orderId);
  if (!order_id) return json(res, 400, { ok: false, error: "order_id required" });

  let order: any = null;
  let error: any = null;
  try {
    const supabaseAdmin = buildSupabaseAdmin();
    const result = await supabaseAdmin.from("orders").select("*").eq("id", order_id).single();
    order = result.data;
    error = result.error;
  } catch (e) {
    error = e;
  }
  if (error) {
    return json(res, 500, { ok: false, error: typeof error === "object" && error && "message" in error ? error.message : String(error) });
  }

  try {
    const message = formatOrderForTelegram(order);
    await sendTelegramMessage(message);
  } catch {}

  return json(res, 200, { ok: true });
}
