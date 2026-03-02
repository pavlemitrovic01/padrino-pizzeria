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

  try {
    const u = new URL(SUPABASE_URL);
    if (!u.hostname.endsWith(".supabase.co")) {
      throw new Error("Invalid supabaseUrl: Expected *.supabase.co host.");
    }
  } catch {
    throw new Error("Invalid supabaseUrl: Provided URL is malformed.");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
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

  // fallback: menu_item_id null + price_per_item 0 je vrlo verovatno meta
  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  const p = v.price_per_item ?? v.pricePerItem;
  if (!menuItemId && typeof p === "number" && p === 0) return true;

  return false;
}

function looksLikeRealItemButInvalid(v: unknown) {
  if (!isPlainObject(v)) return false;

  // META item ne smemo tretirati kao “invalid real item”
  if (looksLikeLegacyMetaItem(v) || looksLikeCartMetaItem(v)) return false;

  // must-have: name + quantity + price_per_item
  const name = toTrimmedString(v.name);
  const q = v.quantity;
  const p = v.price_per_item ?? v.pricePerItem;

  if (!name) return true;
  if (typeof q !== "number" || !Number.isFinite(q) || q <= 0) return true;
  if (typeof p !== "number" || !Number.isFinite(p) || p < 0) return true;

  // optional: addons must be array if present
  if ("addons" in v && v.addons != null && !Array.isArray(v.addons)) return true;

  return false;
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
          const a = safeNumber(pt[0], 0);
          const b = safeNumber(pt[1], 0);
          return [a, b];
        })
      : [];

    if (!id || !name || polygon.length < 3) continue;

    zones.push({ id, name, fee_eur: fee, polygon });
  }

  return zones;
}

// basic point-in-polygon (ray casting)
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

  // Case 1: legacy meta item at index 0
  if (items.length > 0 && looksLikeLegacyMetaItem(items[0])) {
    const meta = isPlainObject(items[0]) ? items[0] : {};
    const note = toTrimmedString(meta.order_note) || toTrimmedString(meta.note);
    const updated = { ...meta, order_note: appendMetaLine(note, line) };
    items[0] = updated;
    return items;
  }

  // Case 2: cart meta item exists anywhere
  const idx = items.findIndex((it) => looksLikeCartMetaItem(it));
  if (idx >= 0) {
    const meta = isPlainObject(items[idx]) ? items[idx] : {};
    const note = toTrimmedString(meta.note);
    const updated = { ...meta, note: appendMetaLine(note, line) };
    items[idx] = updated;
    return items;
  }

  // Case 3: no meta item => add one (cart meta)
  items.unshift({
    cart_id: "meta",
    category: "meta",
    name: "META",
    quantity: 1,
    price_per_item: 0,
    note: line,
  });

  return items;
}

async function fetchMenuPricesCents(ids: string[]): Promise<Map<string, number>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));

  if (unique.length === 0) return new Map();

  const { data, error } = await supabase.from("menu_items").select("id,price_eur_cents").in("id", unique);

  if (error) throw new Error(`DB: menu_items fetch failed (${error.message})`);

  const map = new Map<string, number>();
  for (const row of Array.isArray(data) ? data : []) {
    const r = row as unknown as PricingRow;
    const id = toTrimmedString(r.id);
    const cents = safeInt(r.price_eur_cents, 0);
    if (id) map.set(id, cents);
  }
  return map;
}

function sumAddonsCents(addons: unknown, priceMap: Map<string, number>): number {
  if (!Array.isArray(addons)) return 0;

  let total = 0;
  for (const a of addons) {
    if (!isPlainObject(a)) continue;
    const id = toTrimmedString(a.id);
    const q = safeInt(a.quantity, 1);
    const cents = id ? priceMap.get(id) ?? 0 : 0;
    if (q > 0 && cents > 0) total += q * cents;
  }
  return total;
}

function getDeliveryFeeCentsFromMeta(items: unknown[], zones: Zone[], point: LatLng | null): { feeCents: number; zoneName: string } {
  // If point exists, compute zone fee by polygon
  if (point) {
    const pt: [number, number] = [point.lng, point.lat];
    for (const z of zones) {
      if (isPointInPolygon(pt, z.polygon)) {
        return { feeCents: Math.round(z.fee_eur * 100), zoneName: z.name };
      }
    }
  }

  // fallback: attempt to parse from meta note line "Dostava: X €" and "Zona: Y"
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
    const n = normalizeText(line);

    if (!zoneName && n.startsWith("zona:")) {
      zoneName = line.replace(/^Zona\s*:\s*/i, "").trim();
    }

    if (feeEur == null && n.startsWith("dostava:")) {
      const m = line.match(/Dostava\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i);
      if (m && typeof m[1] === "string") {
        const v = Number(m[1].replace(",", "."));
        if (Number.isFinite(v) && v >= 0) feeEur = v;
      }
    }
  }

  if (feeEur != null) {
    return { feeCents: Math.round(feeEur * 100), zoneName };
  }

  return { feeCents: 0, zoneName };
}

function safeTotalCentsFromBody(body: Record<string, unknown>): number {
  // prefer cents if present
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
  // fallback prod domain
  const url = base || "https://padrinobudva.com";
  return {
    order_id: orderId,
    notify_url: `${url}/api/telegram-new-order`,
  };
}

async function bestEffortTelegramNotify(orderId: string) {
  const payload = buildTelegramPayload(orderId);
  const url = payload.notify_url;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order_id: orderId }),
    });
  } catch {
    // best effort
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

    // NEW (backwards-compatible): accept payment_method if sent
    const pmRaw = toTrimmedString(body.payment_method) || toTrimmedString(body.paymentMethod);
    if (pmRaw && pmRaw !== "cash" && pmRaw !== "card") {
      return json(res, 400, { ok: false, error: "Invalid payment_method" });
    }
    const payment_method: PaymentMethod = pmRaw === "card" ? "card" : "cash";

    // 🔒 HARD GUARD: kartica disabled dok NLB ne stigne (ne pravimo porudžbinu)
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

    // ✅ items that we actually store in DB (META note appended with payment)
    const itemsForInsert = withPaymentInMetaItems(rawItems, payment_method);

    // samo real itemi, bez meta (legacy + cart meta)
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

    // pricing from DB (base + addons)
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
    const zones = await fetchZones();
    const delivery = getDeliveryFeeCentsFromMeta(itemsForInsert, zones, point);

    const computedTotalCents = subtotal_eur_cents + Math.max(0, delivery.feeCents);

    const bodyTotalCents = safeTotalCentsFromBody(body);

    // minimal anti-tamper: must match within 1 cent
    if (bodyTotalCents > 0 && Math.abs(bodyTotalCents - computedTotalCents) > 1) {
      return json(res, 400, { ok: false, error: "Total mismatch" });
    }

    const total_items = safeInt(body.total_items ?? body.totalItems, 0);

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
        total_items,
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      const msg = insErr?.message ? `DB insert failed (${insErr.message})` : "DB insert failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const orderId = toTrimmedString(inserted.id);

    // best effort: telegram + payments session create
    void bestEffortTelegramNotify(orderId);
    void bestEffortPaymentsCreateSession(orderId, payment_method);

    return json(res, 200, { ok: true, order_id: orderId, orderId });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return json(res, 500, { ok: false, error: msg || "Unknown error" });
  }
}