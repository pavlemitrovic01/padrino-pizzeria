import { createClient } from "@supabase/supabase-js";

function setCors(req: any, res: any) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin : "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res: any, status: number, body: any) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function getEnv(name: string): string {
  return toTrimmedString((process.env as any)?.[name]);
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

  // poznati bug: razmaci/pogrešan URL -> malformed
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

const supabase = buildSupabaseAdmin();

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Legacy meta zapis koji frontend ubacuje u items[0]:
 * { total_items: number, order_note?: string }
 */
function looksLikeLegacyMetaItem(v: any) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;

  const allowed = new Set(["total_items", "order_note", "note"]);
  const itemish = ["quantity", "price_per_item", "name", "menu_item_id", "cart_id", "menuItemId"];
  if (itemish.some((k) => k in v)) return false;

  return keys.every((k) => allowed.has(k));
}

function looksLikeRealItemButInvalid(v: any) {
  if (!isPlainObject(v)) return false;

  const hasItemIdentity =
    "name" in v || "menu_item_id" in v || "cart_id" in v || "menuItemId" in v;

  if (!hasItemIdentity) return false;

  const hasQty = "quantity" in v;
  const hasPpi = "price_per_item" in v || "pricePerItem" in v;

  return !hasQty || !hasPpi;
}

function getRequestBaseUrl(req: any) {
  const xfProto = toTrimmedString(req?.headers?.["x-forwarded-proto"]);
  const proto = xfProto || "https";
  const xfHost = toTrimmedString(req?.headers?.["x-forwarded-host"]);
  const host = xfHost || toTrimmedString(req?.headers?.host);
  if (!host) return "";
  return `${proto}://${host}`;
}

async function notifyTelegramBestEffort(req: any, orderId: string) {
  const base = getRequestBaseUrl(req);
  if (!base) return { attempted: false, ok: false, status: 0 };

  const url = `${base}/api/telegram-new-order`;
  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-telegram-secret"] = secret;

  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId }),
    });

    if (!r.ok) {
      const j = await r.json().catch(() => null);
      console.error("[create-order] telegram notify failed:", r.status, j);
      return { attempted: true, ok: false, status: r.status };
    }

    return { attempted: true, ok: true, status: r.status };
  } catch (e) {
    console.error("[create-order] telegram notify error:", e);
    return { attempted: true, ok: false, status: 0 };
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const rawItems = Array.isArray(body.items) ? body.items : [];

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    if (
      customer_name.length < 2 ||
      customer_phone.length < 6 ||
      customer_address.length < 5 ||
      rawItems.length === 0
    ) {
      return json(res, 400, { ok: false, error: "Invalid payload" });
    }

    // Reject item koji liči na pravi item ali mu fale polja
    for (const it of rawItems) {
      if (looksLikeRealItemButInvalid(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    // Za obračun koristimo samo real iteme
    const calcItems = rawItems.filter((it: any) => {
      if (looksLikeLegacyMetaItem(it)) return false;
      if (!isPlainObject(it)) return false;

      const q = it.quantity;
      const p = it.price_per_item ?? it.pricePerItem;

      return typeof q === "number" && typeof p === "number";
    });

    if (calcItems.length === 0) {
      return json(res, 400, { ok: false, error: "Invalid item structure" });
    }

    // SOURCE OF TRUTH: total_eur_cents računamo na serveru
    let total_eur_cents = 0;

    for (const item of calcItems) {
      const quantity = item.quantity;
      const price_per_item = item.price_per_item ?? item.pricePerItem;

      if (!Number.isFinite(quantity) || !Number.isFinite(price_per_item)) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }
      if (quantity <= 0 || price_per_item < 0) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }

      total_eur_cents += Math.round(quantity * price_per_item);
    }

    if (!Number.isFinite(total_eur_cents) || total_eur_cents <= 0) {
      return json(res, 400, { ok: false, error: "Total price must be greater than zero" });
    }

    const insertRow: Record<string, any> = {
      customer_name,
      customer_phone,
      customer_address,
      items: rawItems, // čuvamo tačno kako je došlo (meta + itemi)
      currency,
      status,
      total_eur_cents,
      // legacy: numeric kompatibilno
      total_price: total_eur_cents / 100,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return json(res, 500, { ok: false, error: "Database insert failed" });
    }

    // ✅ Telegram notify (best-effort)
    const telegram = await notifyTelegramBestEffort(req, data.id);

    return json(res, 200, { ok: true, id: data.id, telegram });
  } catch (err: any) {
    console.error("create-order fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
