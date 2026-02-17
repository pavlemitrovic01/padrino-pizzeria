import { createClient } from "@supabase/supabase-js";

function setCors(req: any, res: any) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin : "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with, authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res: any, status: number, body: any) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function toTrimmedString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function getEnv(name: string): string {
  const v = (process.env as any)?.[name];
  return typeof v === "string" ? v : "";
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const SERVICE_ROLE =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  try {
    const u = new URL(SUPABASE_URL);
    if (!u.hostname.endsWith(".supabase.co")) {
      throw new Error("Invalid supabaseUrl: Expected *.supabase.co host.");
    }
  } catch {
    throw new Error("Invalid supabaseUrl: Provided URL is malformed.");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-resend-telegram" } },
  });
}

const supabase = buildSupabaseAdmin();

const ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function isAdminEmail(email: unknown): boolean {
  const e = typeof email === "string" ? normalizeEmail(email) : "";
  return e.length > 0 && ADMIN_EMAILS.has(e);
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getBearerToken(req: any): string {
  const h = toTrimmedString(req?.headers?.authorization || req?.headers?.Authorization);
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
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

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatTotalFromCents(cents: number) {
  const n = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  return (n / 100).toFixed(2);
}

function isMetaRow(it: any) {
  const cartId = String(it?.cart_id ?? "").trim().toLowerCase();
  const name = String(it?.name ?? "").trim().toLowerCase();
  const cat = String(it?.category ?? "").trim().toLowerCase();
  return cartId === "meta" || name === "meta" || cat === "meta";
}

function isDrinkRow(it: any) {
  const c = normalizeText(String(it?.category ?? ""));
  return c.includes("pica") || c.includes("pice") || c.includes("napici") || c.includes("napitci");
}

function addonEmoji(name: string) {
  const n = normalizeText(name);

  if (n.includes("sos") || n.includes("kecap") || n.includes("kečap") || n.includes("majonez")) return "🧄";
  if (n.includes("sir") || n.includes("mozz") || n.includes("kačk") || n.includes("kack")) return "🧀";
  if (n.includes("krof") || n.includes("donut")) return "🍩";
  if (n.includes("pecur") || n.includes("šamp") || n.includes("samp")) return "🍄";
  if (n.includes("masl") || n.includes("olive")) return "🫒";
  if (n.includes("sunka") || n.includes("prsut") || n.includes("slanina")) return "🥓";

  return "➕";
}

function formatOrderForTelegram(order: any) {
  const name = String(order?.customer_name ?? "").trim();
  const phone = String(order?.customer_phone ?? "").trim();
  const address = String(order?.customer_address ?? "").trim();
  const status = String(order?.status ?? "pending").trim() || "pending";

  const totalCents = safeInt(order?.total_eur_cents, 0);
  const total = formatTotalFromCents(totalCents);

  const rawItems = Array.isArray(order?.items) ? order.items : [];

  // 1) note from META row
  const meta = rawItems.find((it: any) => isPlainObject(it) && isMetaRow(it));
  const orderNote = meta && typeof meta.note === "string" ? meta.note.trim() : "";

  // 2) items without META
  const items = rawItems.filter((it: any) => isPlainObject(it) && (it as any).cart_id && !isMetaRow(it));

  // 3) split pizzas and drinks
  const pizzas = items.filter((it: any) => !isDrinkRow(it));
  const drinks = items.filter((it: any) => isDrinkRow(it));

  const lines: string[] = [];

  lines.push("📪📬📭 Nova porudžbina:");
  lines.push(`🙅‍♂️ Ime: ${name || "-"}`);
  lines.push(`☎️ Telefon: ${phone || "-"}`);
  lines.push(`🏠 Adresa: ${address || "-"}`);
  lines.push(`🕒 Status: ${status}`);
  lines.push("");
  lines.push("🔊🔊 LISTA PROIZVODA:");

  for (const it of pizzas) {
    const nm = String(it?.name ?? "").trim() || "Proizvod";
    const qty = Math.max(1, safeInt(it?.quantity, 1));
    const size = typeof it?.size === "string" && it.size.trim() ? ` (${it.size.trim()})` : "";
    lines.push(`🍕 ● ${qty}x ${nm}${size}`);

    const addons = Array.isArray(it?.addons) ? it.addons : [];
    if (addons.length > 0) {
      lines.push(`🍄● Dodaci:`);
      for (const a of addons) {
        const an = String(a?.name ?? "").trim();
        if (!an) continue;
        const aq = Math.max(1, safeInt(a?.quantity, 1));
        lines.push(` ${addonEmoji(an)}● ${aq}x ${an}`);
      }
    }

    const itemNote = typeof it?.note === "string" ? it.note.trim() : "";
    if (itemNote) {
      lines.push(`🚨 ● NAPOMENA: ${itemNote}`);
    }

    lines.push("");
  }

  if (drinks.length > 0) {
    lines.push("🥤● Piće:");
    for (const it of drinks) {
      const nm = String(it?.name ?? "").trim() || "Piće";
      const qty = Math.max(1, safeInt(it?.quantity, 1));
      lines.push(`  - ${qty}x ${nm}`);
    }
    lines.push("");
  }

  if (orderNote) {
    lines.push(`🚨 ● NAPOMENA: ${orderNote}`);
    lines.push("");
  }

  lines.push(`💸 ● Ukupno: ${total} €`);

  return lines.join("\n").trim();
}

async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    });

    if (!r.ok) {
      return { ok: false, error: `Telegram HTTP ${r.status}` };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg || "Telegram request failed" };
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(res, 401, { ok: false, error: "Invalid session" });
    }

    if (!isAdminEmail(userData.user.email)) {
      return json(res, 403, { ok: false, error: "Not authorized" });
    }

    const body = isPlainObject(req.body) ? req.body : null;
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const orderId = toTrimmedString(body.order_id || body.orderId);
    if (!orderId) return json(res, 400, { ok: false, error: "Missing order_id" });

    const { data: order, error: readErr } = await supabase.from("orders").select("*").eq("id", orderId).single();

    if (readErr) return json(res, 500, { ok: false, error: readErr.message || "DB read failed" });

    const message = formatOrderForTelegram(order);
    const sent = await sendTelegramMessage(message);

    if (!sent.ok) {
      return json(res, 502, { ok: false, error: sent.error || "Telegram failed" });
    }

    return json(res, 200, { ok: true, telegram: "sent" });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, 500, { ok: false, error: msg || "Unknown error" });
  }
}
