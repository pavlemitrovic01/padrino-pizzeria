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

function buildSupabaseAdmin() {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/telegram-new-order" } },
  });
}

async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token) throw new Error("Missing env: TELEGRAM_BOT_TOKEN");
  if (!chatId) throw new Error("Missing env: TELEGRAM_CHAT_ID");

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
    throw new Error(`Telegram sendMessage failed: HTTP ${res.status} ${json ? JSON.stringify(json) : ""}`);
  }
}

function formatOrderForTelegram(order: any) {
  const name = String(order?.customer_name ?? "");
  const phone = String(order?.customer_phone ?? "");
  const address = String(order?.customer_address ?? "");
  const status = String(order?.status ?? "");
  const cents = Number(order?.total_eur_cents ?? 0);
  const total = Number.isFinite(cents) ? (cents / 100).toFixed(2) : "0.00";

  const items = Array.isArray(order?.items) ? order.items : [];
  // prvi element zna biti meta (total_items/order_note)
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
  try {
    // Minimalan CORS (sigurno)
    res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body = isPlainObject(req.body) ? (req.body as any) : {};
    const order_id = toTrimmedString(body.order_id);

    if (!order_id) return json(res, 400, { ok: false, error: "order_id required" });

    const supabaseAdmin = buildSupabaseAdmin();

    const { data: order, error } = await supabaseAdmin.from("orders").select("*").eq("id", order_id).single();

    if (error) {
      return json(res, 500, { ok: false, error: error.message || "Failed to read order", code: error.code || null });
    }

    const message = formatOrderForTelegram(order);
    await sendTelegramMessage(message);

    return json(res, 200, { ok: true });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
}
