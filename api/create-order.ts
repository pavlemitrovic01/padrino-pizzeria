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
  if (typeof v !== "string") return "";
  return v.trim();
}

function getEnv(name: string): string {
  return toTrimmedString((process.env as any)?.[name]);
}

function getSupabase() {
  const rawUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const rawKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!rawUrl || !rawKey) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Trim + striktna validacija URL-a (poznati bug: razmaci -> malformed URL)
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith("supabase.co")) {
      throw new Error("Invalid SUPABASE_URL: expected a *.supabase.co host.");
    }
  } catch {
    throw new Error("Invalid supabaseUrl: Provided URL is malformed.");
  }

  return createClient(rawUrl, rawKey, {
    auth: { persistSession: false },
  });
}

const supabase = getSupabase();

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Legacy meta zapis koji frontend ubacuje u items[0]:
 * { total_items: number, order_note?: string }
 * - nema quantity/price_per_item
 * - treba ga ignorisati u validaciji i obračunu
 */
function looksLikeLegacyMetaItem(v: any) {
  if (!isPlainObject(v)) return false;

  const keys = Object.keys(v);
  if (keys.length === 0) return false;

  const allowed = new Set(["total_items", "order_note", "note"]);

  const itemish = ["quantity", "price_per_item", "name", "menu_item_id", "cart_id"];
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
  try {
    const base = getRequestBaseUrl(req);
    if (!base) return;

    const url = `${base}/api/telegram-new-order`;
    const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");

    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (secret) headers["x-telegram-secret"] = secret;

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId }),
    });

    // Best-effort: ne rušimo narudžbinu ako Telegram padne
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      console.error("[telegram-new-order] notify failed:", res.status, j);
    }
  } catch (e) {
    console.error("[telegram-new-order] notify error:", e);
  }
}

export default async function handler(req: any, res: any) {
  setCors(req, res);

  // ✅ Preflight
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

    // ✅ Reject ako bilo koji element liči na item ali je “polu-popunjen”
    for (const it of rawItems) {
      if (looksLikeRealItemButInvalid(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    // ✅ Za obračun koristimo samo real iteme sa quantity + price_per_item
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
      return json(res, 400, {
        ok: false,
        error: "Total price must be greater than zero",
      });
    }

    // Čuvamo items tačno kako su došli (uključujući meta), radi kompatibilnosti/debug-a
    const insertRow: Record<string, any> = {
      customer_name,
      customer_phone,
      customer_address,
      items: rawItems,
      currency,
      status,
      total_eur_cents,
      // legacy: number radi kompatibilnosti
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
    await notifyTelegramBestEffort(req, data.id);

    return json(res, 200, { ok: true, id: data.id });
  } catch (err: any) {
    console.error("create-order fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
