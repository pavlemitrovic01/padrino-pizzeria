import { createClient } from "@supabase/supabase-js";

type PaymentMethod = "cash" | "card";
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with");
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
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

const supabase = buildSupabaseAdmin();

/**
 * Legacy meta zapis koji frontend ubacuje u items[0]:
 * { total_items: number, order_note?: string }
 */
function looksLikeLegacyMetaItem(v: unknown) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;

  const allowed = new Set(["total_items", "order_note", "note"]);
  const itemish = ["quantity", "price_per_item", "name", "menu_item_id", "cart_id", "menuItemId"];
  if (itemish.some((k) => k in v)) return false;

  return keys.every((k) => allowed.has(k));
}

/**
 * NOVO: “META” item koji frontend šalje kao “pravi item”
 * (cart_id/meta, category/meta, name/META), ima note, ali nema menu_item_id
 */
function looksLikeCartMetaItem(v: unknown) {
  if (!isPlainObject(v)) return false;

  const cartId = toTrimmedString(v.cart_id);
  const name = toTrimmedString(v.name);
  const category = toTrimmedString(v.category);

  if (cartId.toLowerCase() === "meta") return true;
  if (category.toLowerCase() === "meta") return true;
  if (name.toUpperCase() === "META") return true;

  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  const p = v.price_per_item ?? v.pricePerItem;
  if (!menuItemId && typeof p === "number" && p === 0) return true;

  return false;
}

function looksLikeRealItemButInvalid(v: unknown) {
  if (!isPlainObject(v)) return false;
  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  const name = toTrimmedString(v.name);
  const qty = v.quantity;

  const hasItemish = !!name || typeof qty === "number" || !!menuItemId;
  if (!hasItemish) return false;

  if (looksLikeLegacyMetaItem(v) || looksLikeCartMetaItem(v)) return false;

  return !menuItemId;
}

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function safeNumber(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
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

type Zone = {
  id: string;
  name: string;
  fee_eur: number;
  polygon: number[][];
};

type PricingRow = {
  id: string;
  price_eur_cents: number;
};

async function fetchZones(): Promise<Zone[]> {
  const { data, error } = await supabase.from("delivery_zones").select("id,name,fee_eur,polygon");
  if (error) throw new Error(`DB: zones fetch failed (${error.message})`);

  const zones: Zone[] = [];
  for (const row of Array.isArray(data) ? data : []) {
    const id = toTrimmedString((row as Record<string, unknown>).id);
    const name = toTrimmedString((row as Record<string, unknown>).name);
    const fee = safeNumber((row as Record<string, unknown>).fee_eur, 0);

    const polygonRaw = (row as Record<string, unknown>).polygon;
    const polygon: number[][] = Array.isArray(polygonRaw)
      ? (polygonRaw as unknown[]).map((pt) => {
          if (!Array.isArray(pt) || pt.length < 2) return [0, 0];
          return [safeNumber(pt[0], 0), safeNumber(pt[1], 0)];
        })
      : [];

    if (!id || !name || polygon.length < 3) continue;
    zones.push({ id, name, fee_eur: fee, polygon });
  }

  return zones;
}

function isPointInPolygon(point: [number, number], polygon: number[][]) {
  const x = point[0];
  const y = point[1];

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

type LatLng = { lat: number; lng: number };

function parseLatLngFromBody(body: Record<string, unknown>): LatLng | null {
  const lat = body.lat ?? body.latitude ?? body.customer_lat ?? body.customerLat;
  const lng = body.lng ?? body.longitude ?? body.customer_lng ?? body.customerLng;

  const la = safeNumber(lat, NaN);
  const lo = safeNumber(lng, NaN);

  if (!Number.isFinite(la) || !Number.isFinite(lo)) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;

  return { lat: la, lng: lo };
}

function appendMetaLine(existing: string, line: string): string {
  const e = existing.trim();
  const l = line.trim();
  if (!l) return e;
  if (!e) return l;

  const existingLines = e.split(/\r?\n/).map((s) => s.trim());
  if (existingLines.some((x) => normalizeText(x) === normalizeText(l))) return e;

  return `${e}\n${l}`;
}

function withPaymentInMetaItems(rawItems: unknown[], payment: PaymentMethod): unknown[] {
  const line = `Plaćanje: ${payment === "cash" ? "Gotovina" : "Kartica"}`;
  const items = Array.isArray(rawItems) ? [...rawItems] : [];

  const idx = items.findIndex((it) => isPlainObject(it) && (looksLikeLegacyMetaItem(it) || looksLikeCartMetaItem(it)));
  if (idx === -1) return items;

  const meta = items[idx];
  if (!isPlainObject(meta)) return items;

  const existing = toTrimmedString(meta.order_note) || toTrimmedString(meta.note);
  const merged = appendMetaLine(existing, line);

  items[idx] = { ...meta, order_note: merged, note: merged };
  return items;
}

async function fetchMenuPricesCents(ids: string[]): Promise<Map<string, number>> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return new Map();

  const { data, error } = await supabase.from("menu_items").select("id,price_eur_cents").in("id", uniq);
  if (error) throw new Error(`DB: pricing fetch failed (${error.message})`);

  const m = new Map<string, number>();
  for (const row of Array.isArray(data) ? data : []) {
    const r = row as unknown as PricingRow;
    const id = toTrimmedString((r as unknown as Record<string, unknown>).id);
    const p = safeInt((r as unknown as Record<string, unknown>).price_eur_cents, 0);
    if (id && p > 0) m.set(id, p);
  }
  return m;
}

function sumAddonsCents(addons: unknown, priceMap: Map<string, number>) {
  const list = Array.isArray(addons) ? addons : [];
  let total = 0;

  for (const a of list) {
    if (!isPlainObject(a)) continue;
    const addonId = toTrimmedString(a.id);
    const q = safeInt(a.quantity, 1);
    if (!addonId || q <= 0) continue;

    const cents = priceMap.get(addonId) ?? 0;
    if (cents > 0) total += q * cents;
  }

  return total;
}

function getDeliveryFeeCentsFromMeta(
  items: unknown[],
  zones: Zone[],
  point: LatLng | null,
): { feeCents: number; zoneName: string } {
  if (point) {
    const pt: [number, number] = [point.lng, point.lat];
    for (const z of zones) {
      if (isPointInPolygon(pt, z.polygon)) {
        return { feeCents: Math.round(z.fee_eur * 100), zoneName: z.name };
      }
    }
  }

  let metaNote = "";
  for (const it of items) {
    if (!isPlainObject(it)) continue;
    if (!looksLikeLegacyMetaItem(it) && !looksLikeCartMetaItem(it)) continue;

    const n = toTrimmedString(it.order_note) || toTrimmedString(it.note);
    if (n) metaNote = n;
    break;
  }

  const lines = metaNote.split(/\r?\n/).map((s) => s.trim());
  let feeEur: number | null = null;
  let zoneName = "";

  for (const line of lines) {
    if (!zoneName) {
      const mz = line.match(/Zona\s*:?\s*([^,\n\r]+)/i);
      if (mz && typeof mz[1] === "string") zoneName = mz[1].trim();
    }

    if (feeEur == null) {
      const mf = line.match(/Dostava\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i);
      if (mf && typeof mf[1] === "string") {
        const v = Number(mf[1].replace(",", "."));
        if (Number.isFinite(v) && v >= 0) feeEur = v;
      }
    }
  }

  if (feeEur != null) return { feeCents: Math.round(feeEur * 100), zoneName };
  return { feeCents: 0, zoneName };
}

function safeTotalCentsFromBody(body: Record<string, unknown>): number {
  const cents = body.total_eur_cents ?? body.totalEurCents;
  const asCents = safeInt(cents, -1);
  if (asCents >= 0) return asCents;

  const price = body.total_price ?? body.totalPrice;
  const n = safeNumber(price, NaN);
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 100);

  return 0;
}

function buildTelegramPayload(orderId: string) {
  const base = getEnv("VERCEL_URL") ? `https://${getEnv("VERCEL_URL")}` : "";
  const url = base || "https://padrinobudva.com";
  return { order_id: orderId, notify_url: `${url}/api/telegram-new-order` };
}

async function bestEffortTelegramNotify(orderId: string) {
  const url = buildTelegramPayload(orderId).notify_url;

  // telegram-new-order može imati optional secret guard (TELEGRAM_WEBHOOK_SECRET)
  const secret = getEnv("TELEGRAM_WEBHOOK_SECRET");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) headers["x-telegram-secret"] = secret;

  // serverless safety: ne dozvoliti da fetch "visi" (best-effort timeout)
  // 4s je prekratko jer telegram-new-order radi DB read + Telegram API call.
  const controller = new AbortController();
  const timeoutMs = 9000;
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const bodyText = await r.text().catch(() => "");
      console.error("bestEffortTelegramNotify: non-OK response", {
        status: r.status,
        body: bodyText.slice(0, 300),
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("bestEffortTelegramNotify: request failed", { error: msg || "unknown" });
  } finally {
    clearTimeout(t);
  }
}

async function bestEffortPaymentsCreateSession(orderId: string, paymentMethod: PaymentMethod) {
  const projectRef = getEnv("SUPABASE_PROJECT_REF");
  const anon = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY");
  const token = getEnv("PAYMENTS_EDGE_TOKEN");
  if (!projectRef || !anon) return;

  const url = `https://${projectRef}.supabase.co/functions/v1/payments-create-session`;

  const headers: Record<string, string> = {
    "content-type": "application/json",
    authorization: `Bearer ${anon}`,
  };
  if (token) headers["x-padrino-token"] = token;

  try {
    await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod }),
    });
  } catch {
    // best effort
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
    const body = isPlainObject(req.body) ? req.body : {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    const pmRaw = toTrimmedString(body.payment_method) || toTrimmedString(body.paymentMethod);
    if (pmRaw && pmRaw !== "cash" && pmRaw !== "card") {
      return json(res, 400, { ok: false, error: "Invalid payment_method" });
    }
    const payment_method: PaymentMethod = pmRaw === "card" ? "card" : "cash";

    if (payment_method === "card") {
      return json(res, 501, {
        ok: false,
        error: "Card payments are disabled (NLB pending).",
        code: "CARD_DISABLED",
      });
    }

    if (
      customer_name.length < 2 ||
      customer_phone.length < 6 ||
      customer_address.length < 5 ||
      rawItems.length === 0
    ) {
      return json(res, 400, { ok: false, error: "Invalid payload" });
    }

    for (const it of rawItems) {
      if (looksLikeRealItemButInvalid(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    const itemsForInsert = withPaymentInMetaItems(rawItems, payment_method);

    const calcItems = itemsForInsert.filter((it): it is Record<string, unknown> => {
      if (!isPlainObject(it)) return false;
      if (looksLikeLegacyMetaItem(it) || looksLikeCartMetaItem(it)) return false;

      const q = it.quantity;
      const p = it.price_per_item ?? it.pricePerItem;
      return typeof q === "number" && typeof p === "number";
    });

    if (calcItems.length === 0) {
      return json(res, 400, { ok: false, error: "Invalid item structure" });
    }

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

    let subtotal_eur_cents = 0;

    for (const item of calcItems) {
      const q = safeInt(item.quantity, 1);
      const id = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);
      const baseCents = id ? priceMap.get(id) ?? 0 : 0;
      const addonsCents = sumAddonsCents(item.addons, priceMap);

      subtotal_eur_cents += q * baseCents + q * addonsCents;
    }

    if (subtotal_eur_cents <= 0) {
      return json(res, 400, { ok: false, error: "Invalid calculated subtotal" });
    }

    const point = parseLatLngFromBody(body);

    let zones: Zone[] = [];
    if (point) {
      try {
        zones = await fetchZones();
      } catch {
        zones = [];
      }
    }

    const delivery = getDeliveryFeeCentsFromMeta(itemsForInsert, zones, point);

    const computedTotalCents = subtotal_eur_cents + Math.max(0, delivery.feeCents);
    const bodyTotalCents = safeTotalCentsFromBody(body);

    if (bodyTotalCents > 0 && Math.abs(bodyTotalCents - computedTotalCents) > 1) {
      return json(res, 400, { ok: false, error: "Total mismatch" });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("orders")
      .insert({
        customer_name,
        customer_phone,
        customer_address,
        items: itemsForInsert,
        status,
        currency,
        total_eur_cents: computedTotalCents,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      const msg = insErr?.message ? `DB insert failed (${insErr.message})` : "DB insert failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const orderId = toTrimmedString(inserted.id);

    await bestEffortTelegramNotify(orderId);

    void bestEffortPaymentsCreateSession(orderId, payment_method);

    return json(res, 200, { ok: true, id: orderId, order_id: orderId, orderId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(res, 500, { ok: false, error: msg || "Unknown error" });
  }
}