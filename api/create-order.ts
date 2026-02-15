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

/** -------------------- SERVER-SIDE PRICING + DELIVERY (HARDENING) -------------------- */

type DeliveryZoneKey =
  | "budva"
  | "becici"
  | "rafailovici"
  | "przno"
  | "sveti-stefan"
  | "seoce"
  | "jaz"
  | "lastva";

type DeliveryZone = { key: DeliveryZoneKey; label: string; minCents: number; feeCents: number };

const DELIVERY_ZONES: DeliveryZone[] = [
  { key: "budva", label: "Budva", minCents: 0, feeCents: 0 },
  { key: "becici", label: "Bečići", minCents: 1500, feeCents: 300 },
  { key: "rafailovici", label: "Rafailovići", minCents: 2000, feeCents: 500 },
  { key: "przno", label: "Pržno", minCents: 2500, feeCents: 500 },
  { key: "sveti-stefan", label: "Sveti Stefan", minCents: 2500, feeCents: 500 },
  { key: "seoce", label: "Seoce", minCents: 2000, feeCents: 500 },
  { key: "jaz", label: "Jaz", minCents: 2500, feeCents: 500 },
  { key: "lastva", label: "Lastva", minCents: 3000, feeCents: 500 },
];

function normalizeText(input: string): string {
  return String(input ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseZoneAndFeeFromNote(note: string): {
  zone: DeliveryZone | null;
  requestedFeeCents: number | null;
} {
  const n = String(note ?? "").trim();
  if (!n) return { zone: null, requestedFeeCents: null };

  // Expect a line like: "Zona: <label>, Dostava: <0€ / 3€ / 5€>"
  // but be tolerant to encoding issues and spacing.
  const lines = n
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  let zonePart = "";
  let feePart = "";

  for (const line of lines) {
    const norm = normalizeText(line);
    if (norm.includes("zona:") && norm.includes("dostava:")) {
      const mZone = line.match(/Zona\s*:\s*([^,]+)\s*,?/i);
      const mFee =
        line.match(/Dostava\s*:\s*([^\s]+)\s*€/i) || line.match(/Dostava\s*:\s*([^,\s]+)/i);
      if (mZone) zonePart = String(mZone[1] ?? "").trim();
      if (mFee) feePart = String(mFee[1] ?? "").trim();
      break;
    }
  }

  const zoneNorm = normalizeText(zonePart);
  const zone = DELIVERY_ZONES.find((z) => normalizeText(z.label) === zoneNorm) ?? null;

  let requestedFeeCents: number | null = null;
  if (feePart) {
    const num = Number(String(feePart).replace(",", ".").replace(/[^0-9.]/g, ""));
    if (Number.isFinite(num)) requestedFeeCents = Math.round(num * 100);
  }

  return { zone, requestedFeeCents };
}

function getLegacyOrderNote(body: any, rawItems: any[]): string {
  const direct =
    toTrimmedString(body?.note) || toTrimmedString(body?.order_note) || toTrimmedString(body?.orderNote);

  if (direct) return direct;

  const meta = rawItems.find((it) => looksLikeLegacyMetaItem(it));
  if (meta) {
    return toTrimmedString(meta.order_note) || toTrimmedString(meta.note) || "";
  }

  return "";
}

function safeInt(v: any): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

async function fetchMenuPricesCents(ids: string[]): Promise<Map<string, number>> {
  const uniq = Array.from(new Set(ids.filter((s) => typeof s === "string" && s.trim().length > 0)));
  const map = new Map<string, number>();
  if (uniq.length === 0) return map;

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, price_eur_cents, price")
    .in("id", uniq);

  if (error) {
    console.error("[create-order] menu_items fetch error:", error);
    throw new Error("Menu pricing lookup failed");
  }

  for (const r of (data ?? []) as any[]) {
    const id = toTrimmedString(r?.id);
    const price_eur_cents = r?.price_eur_cents;
    const price = r?.price;

    let cents = 0;
    if (typeof price_eur_cents === "number" && Number.isFinite(price_eur_cents)) {
      cents = Math.round(price_eur_cents);
    } else if (typeof price === "number" && Number.isFinite(price)) {
      cents = Math.round(price * 100);
    }

    if (id) map.set(id, cents);
  }

  return map;
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

    // Pricing hardening: ignore client prices and fetch authoritative prices from DB
    const idsToFetch: string[] = [];

    for (const it of calcItems) {
      const menu_item_id = toTrimmedString(it.menu_item_id) || toTrimmedString(it.menuItemId);
      if (menu_item_id) idsToFetch.push(menu_item_id);

      const addons = Array.isArray(it.addons) ? it.addons : [];
      for (const a of addons) {
        if (!isPlainObject(a)) continue;
        const addonId = toTrimmedString(a.id);
        if (addonId) idsToFetch.push(addonId);
      }
    }

    const priceMap = await fetchMenuPricesCents(idsToFetch);

    // SOURCE OF TRUTH: subtotal_eur_cents računamo na serveru iz DB cena
    let subtotal_eur_cents = 0;

    for (const item of calcItems) {
      const quantity = safeInt(item.quantity);
      const menu_item_id = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);

      if (!menu_item_id) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }

      const baseCents = priceMap.get(menu_item_id);
      if (typeof baseCents !== "number" || !Number.isFinite(baseCents)) {
        return json(res, 400, { ok: false, error: "Invalid menu item id" });
      }

      if (quantity <= 0) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }

      let perItemCents = Math.max(0, Math.round(baseCents));

      const addons = Array.isArray(item.addons) ? item.addons : [];
      for (const a of addons) {
        if (!isPlainObject(a)) {
          return json(res, 400, { ok: false, error: "Invalid addon structure" });
        }
        const addonId = toTrimmedString(a.id);
        if (!addonId) {
          return json(res, 400, { ok: false, error: "Invalid addon structure" });
        }

        const addonCents = priceMap.get(addonId);
        if (typeof addonCents !== "number" || !Number.isFinite(addonCents)) {
          return json(res, 400, { ok: false, error: "Invalid addon id" });
        }

        const aq = safeInt(a.quantity);
        const addonQty = aq > 0 ? aq : 1;

        perItemCents += Math.max(0, Math.round(addonCents)) * addonQty;
      }

      subtotal_eur_cents += Math.round(quantity * perItemCents);
    }

    if (!Number.isFinite(subtotal_eur_cents) || subtotal_eur_cents <= 0) {
      return json(res, 400, { ok: false, error: "Total price must be greater than zero" });
    }

    // Delivery hardening: parse zone + requested fee from note (no new payload fields)
    const rawNote = getLegacyOrderNote(body, rawItems);
    const parsed = parseZoneAndFeeFromNote(rawNote);

    if (!parsed.zone) {
      return json(res, 400, { ok: false, error: "Missing delivery zone" });
    }

    const zone = parsed.zone;
    const qualifiesFree = subtotal_eur_cents >= zone.minCents;
    const expectedFeeCents = qualifiesFree ? 0 : zone.feeCents;

    // If the client asked for a fee (via "Doplati"), accept only if it matches expected for zone.
    // If client sent 0 while not qualifying, we enforce expectedFeeCents.
    // If client sent a different fee, reject.
    if (parsed.requestedFeeCents !== null) {
      if (parsed.requestedFeeCents !== 0 && parsed.requestedFeeCents !== zone.feeCents) {
        return json(res, 400, { ok: false, error: "Invalid delivery fee" });
      }
    }

    const delivery_fee_cents = expectedFeeCents;

    const total_eur_cents = subtotal_eur_cents + delivery_fee_cents;

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

    const { data, error } = await supabase.from("orders").insert(insertRow).select("id").single();

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
