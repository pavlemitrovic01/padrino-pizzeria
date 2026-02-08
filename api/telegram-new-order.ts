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
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY)");

  let u: URL;
  try {
    u = new URL(SUPABASE_URL);
  } catch {
    throw new Error("Invalid supabaseUrl: Provided URL is malformed.");
  }
  if (!u.hostname.endsWith(".supabase.co")) {
    throw new Error("Invalid supabaseUrl: Expected *.supabase.co host.");
  }

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
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // bez parse_mode => najstabilnije za emoji + plain text
        disable_web_page_preview: true,
      }),
    });
  } catch {
    // best-effort
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

  // 1) izvuci napomenu sa META stavke (ako postoji)
  const meta = rawItems.find((it: any) => isPlainObject(it) && isMetaRow(it));
  const orderNote = meta && typeof meta.note === "string" ? meta.note.trim() : "";

  // 2) pravi items = bez META
  const items = rawItems.filter(
    (it: any) => isPlainObject(it) && (it as any).cart_id && !isMetaRow(it)
  );

  // 3) podeli na pizze i pica
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

  // PIZZE + DODACI + NAPOMENE PO STAVCI
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

  // PIĆA
  if (drinks.length > 0) {
    lines.push("🥤● Piće:");
    for (const it of drinks) {
      const nm = String(it?.name ?? "").trim() || "Piće";
      const qty = Math.max(1, safeInt(it?.quantity, 1));
      lines.push(`  - ${qty}x ${nm}`);
    }
    lines.push("");
  }

  // NAPOMENA ZA PORUDŽBINU (iz META.note)
  if (orderNote) {
    lines.push(`🚨 ● NAPOMENA: ${orderNote}`);
    lines.push("");
  }

  lines.push(`💸 ● Ukupno: ${total} €`);

  return lines.join("\n").trim();
}

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-telegram-secret");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

  // Secret guard (ako postoji env)
  const expectedSecret = toTrimmedString(process.env.TELEGRAM_WEBHOOK_SECRET);
  if (expectedSecret) {
    const got = normalizeHeaderValue(req.headers?.["x-telegram-secret"]);
    if (!got || got !== expectedSecret) {
      return json(res, 401, { ok: false, error: "Unauthorized" });
    }
  }

  const body = isPlainObject(req.body) ? req.body : {};
  const order_id =
    toTrimmedString((body as any).order_id) || toTrimmedString((body as any).orderId);

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
    return json(res, 500, {
      ok: false,
      error:
        typeof error === "object" && error && "message" in error ? (error as any).message : String(error),
    });
  }

  try {
    const message = formatOrderForTelegram(order);
    await sendTelegramMessage(message);
  } catch {
    // best-effort
  }

  return json(res, 200, { ok: true });
}
