import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  body?: unknown;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

type CartAddon = {
  name?: unknown;
  quantity?: unknown;
};

type CartItem = {
  cart_id?: unknown;
  name?: unknown;
  category?: unknown;
  quantity?: unknown;
  size?: unknown;
  addons?: unknown;
  note?: unknown;
};

type OrderRow = {
  id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;
  status?: unknown;
  total_eur_cents?: unknown;
  total_price?: unknown;
  currency?: unknown;
  items?: unknown;
  note?: unknown;
};

/**
 * Break-glass fallback samo ako admin_users tabela ne postoji (deploy/migracija).
 * Pošto si tabelu već napravio, realno se ovo neće koristiti.
 */
const FALLBACK_ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

// Hard timeout da Vercel funkcija nikad ne visi na Telegram fetch-u
const TELEGRAM_FETCH_TIMEOUT_MS = 7000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function setCors(req: ReqLike, res: ResLike) {
  const origin = headerString(req, "origin");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with, authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res: ResLike, status: number, body: Json) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const SERVICE_ROLE =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");

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

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";
  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

async function isAdminEmailDb(email: unknown): Promise<boolean> {
  const e = typeof email === "string" ? normalizeEmail(email) : "";
  if (!e) return false;

  const { data, error } = await supabase.from("admin_users").select("email, enabled").eq("email", e).maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) return FALLBACK_ADMIN_EMAILS.has(e);
    return false;
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  return enabled === true;
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
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

function parseItems(raw: unknown): CartItem[] {
  if (Array.isArray(raw)) return raw as CartItem[];

  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function isMetaRow(it: unknown) {
  if (!isPlainObject(it)) return false;

  const cartId = normalizeText(toTrimmedString(it.cart_id));
  const name = normalizeText(toTrimmedString(it.name));
  const cat = normalizeText(toTrimmedString(it.category));

  return cartId === "meta" || name === "meta" || cat === "meta";
}

function isDrinkRow(it: unknown) {
  if (!isPlainObject(it)) return false;
  const c = normalizeText(toTrimmedString(it.category));
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

type ParsedMeta = {
  zone: string;
  delivery: string;
  payment: string;
  extraNote: string;
};

function splitNoteLines(note: string): string[] {
  return String(note ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMetaFromNote(note: string): ParsedMeta {
  const lines = splitNoteLines(note);
  let zone = "";
  let delivery = "";
  let payment = "";

  const extra: string[] = [];

  for (const line of lines) {
    const norm = normalizeText(line);
    let usedAsMeta = false;

    if (norm.includes("zona:") || norm.includes("dostava:") || norm.includes("placanje:")) {
      if (!zone && norm.includes("zona:")) {
        const mZone = line.match(/Zona\s*:\s*([^,]+)\s*,?/i);
        if (mZone && typeof mZone[1] === "string") {
          zone = mZone[1].trim();
          usedAsMeta = true;
        }
      }

      if (!delivery && norm.includes("dostava:")) {
        const mFeeNum = line.match(/Dostava\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i);
        if (mFeeNum && typeof mFeeNum[1] === "string") {
          delivery = `${mFeeNum[1].trim()} €`;
          usedAsMeta = true;
        } else {
          const mFeeAny = line.match(/Dostava\s*:\s*([^,]+)$/i);
          if (mFeeAny && typeof mFeeAny[1] === "string") {
            delivery = mFeeAny[1].trim();
            usedAsMeta = true;
          }
        }
      }

      if (!payment && norm.includes("placanje:")) {
        const mPay = line.match(/Pla[cć]anje\s*:\s*(.+)$/i);
        if (mPay && typeof mPay[1] === "string") {
          payment = mPay[1].trim();
          usedAsMeta = true;
        }
      }
    }

    if (!usedAsMeta) extra.push(line);
  }

  return { zone, delivery, payment, extraNote: extra.join("\n").trim() };
}

function paymentIcon(payment: string): string {
  const p = normalizeText(payment);
  if (p.includes("kart")) return "💳";
  if (p.includes("gotov") || p.includes("kes") || p.includes("cash")) return "💵";
  return "💳";
}

function extractOrderNote(order: OrderRow, items: CartItem[]) {
  const direct = toTrimmedString(order?.note);
  if (direct) return direct;

  const meta = items.find((it) => isMetaRow(it));
  return meta ? toTrimmedString(meta.note) : "";
}

function formatOrderForTelegram(order: OrderRow) {
  const name = toTrimmedString(order?.customer_name) || "-";
  const phone = toTrimmedString(order?.customer_phone) || "-";
  const address = toTrimmedString(order?.customer_address) || "-";
  const status = toTrimmedString(order?.status) || "pending";

  const itemsAll = parseItems(order?.items);
  const noteRaw = extractOrderNote(order, itemsAll);
  const meta = parseMetaFromNote(noteRaw);

  const realItems = itemsAll.filter((it) => isPlainObject(it) && toTrimmedString(it.cart_id) && !isMetaRow(it));
  const pizzas = realItems.filter((it) => !isDrinkRow(it));
  const drinks = realItems.filter((it) => isDrinkRow(it));

  const totalCents =
    Math.max(0, safeInt(order?.total_eur_cents, 0)) ||
    Math.max(
      0,
      Math.round((typeof order?.total_price === "number" ? order.total_price : Number(order?.total_price)) * 100 || 0),
    );

  const total = formatTotalFromCents(totalCents);

  const lines: string[] = [];

  lines.push("📪📬📭 Nova porudžbina:");
  lines.push(`🙅‍♂️ Ime: ${name}`);
  lines.push(`☎️ Telefon: ${phone}`);
  lines.push(`🏠 Adresa: ${address}`);
  lines.push(`🕒 Status: ${status}`);

  if (meta.zone) lines.push(`📍 Zona: ${meta.zone}`);
  if (meta.delivery) lines.push(`🚚 Dostava: ${meta.delivery}`);
  if (meta.payment) lines.push(`${paymentIcon(meta.payment)} Plaćanje: ${meta.payment}`);

  lines.push("");
  lines.push("🔊🔊 LISTA PROIZVODA:");

  for (const it of pizzas) {
    const nm = toTrimmedString(it?.name) || "Proizvod";
    const qty = Math.max(1, safeInt(it?.quantity, 1));
    const sizeRaw = toTrimmedString(it?.size);
    const size = sizeRaw ? ` (${sizeRaw})` : "";

    lines.push(`🍕 ● ${qty}x ${nm}${size}`);

    const addonsRaw = it?.addons;
    const addons: CartAddon[] = Array.isArray(addonsRaw) ? (addonsRaw as CartAddon[]) : [];

    if (addons.length > 0) {
      lines.push("🍄● Dodaci:");
      for (const a of addons) {
        const an = toTrimmedString(a?.name);
        if (!an) continue;
        const aq = Math.max(1, safeInt(a?.quantity, 1));
        lines.push(` ${addonEmoji(an)}● ${aq}x ${an}`);
      }
    }

    const itemNote = toTrimmedString(it?.note);
    if (itemNote) {
      lines.push(`🚨 ● NAPOMENA: ${itemNote}`);
    }

    lines.push("");
  }

  if (drinks.length > 0) {
    lines.push("🥤● Piće:");
    for (const it of drinks) {
      const nm = toTrimmedString(it?.name) || "Piće";
      const qty = Math.max(1, safeInt(it?.quantity, 1));
      lines.push(`  - ${qty}x ${nm}`);
    }
    lines.push("");
  }

  if (meta.extraNote) {
    lines.push(`🚨 ● NAPOMENA: ${meta.extraNote}`);
    lines.push("");
  }

  lines.push(`💸 ● Ukupno: ${total} €`);

  return lines.join("\n").trim();
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
      TELEGRAM_FETCH_TIMEOUT_MS,
    );

    if (!r.ok) {
      return { ok: false, error: `Telegram HTTP ${r.status}` };
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.trim() ? msg.trim() : "Telegram request failed";
    const isAbort = m.toLowerCase().includes("abort");
    return { ok: false, error: isAbort ? `Telegram timeout (${TELEGRAM_FETCH_TIMEOUT_MS}ms)` : m };
  }
}

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(res, 401, { ok: false, error: "Invalid session" });
    }

    const isAdmin = await isAdminEmailDb(userData.user.email);
    if (!isAdmin) {
      return json(res, 403, { ok: false, error: "Not authorized" });
    }

    const body = isPlainObject(req.body) ? req.body : null;
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const orderId = toTrimmedString(body.order_id) || toTrimmedString(body.orderId);
    if (!orderId) return json(res, 400, { ok: false, error: "Missing order_id" });

    const { data: order, error: readErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
    if (readErr) {
      const msg = typeof readErr.message === "string" && readErr.message.trim() ? readErr.message : "DB read failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const message = formatOrderForTelegram((order ?? {}) as OrderRow);
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