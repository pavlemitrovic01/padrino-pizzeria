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
  res.send(JSON.stringify(body));
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function maskId(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return `${v.slice(0, 2)}***`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
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

  const hasItemIdentity =
    "name" in v || "menu_item_id" in v || "cart_id" in v || "menuItemId" in v;

  if (!hasItemIdentity) return false;

  const hasQty = "quantity" in v;
  const hasPpi = "price_per_item" in v || "pricePerItem" in v;

  return !hasQty || !hasPpi;
}

function getRequestBaseUrl(req: ReqLike) {
  const xfProto = headerString(req, "x-forwarded-proto");
  const proto = xfProto || "https";
  const xfHost = headerString(req, "x-forwarded-host");
  const host = xfHost || headerString(req, "host");
  if (!host) return "";
  return `${proto}://${host}`;
}

async function notifyTelegramBestEffort(req: ReqLike, orderId: string) {
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
  } catch (e: unknown) {
    console.error("[create-order] telegram notify error:", e);
    return { attempted: true, ok: false, status: 0 };
  }
}

/** -------------------- PAYMENTS (SERVER-SIDE BEST EFFORT) -------------------- */

function getSupabaseFunctionUrl(functionName: string): string {
  const base = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  if (!base) return "";
  return `${base.replace(/\/+$/, "")}/functions/v1/${functionName}`;
}

function getSupabaseAnonKey(): string {
  return (
    getEnv("SUPABASE_ANON_KEY") ||
    getEnv("VITE_SUPABASE_ANON_KEY") ||
    getEnv("SUPABASE_ANON_PUBLIC_KEY") ||
    getEnv("SUPABASE_PUBLIC_ANON_KEY")
  );
}

function getPaymentsEdgeToken(): string {
  // This must exist on the Vercel server environment (not Supabase Vault)
  return getEnv("PAYMENTS_EDGE_TOKEN");
}

async function notifyPaymentsBestEffort(orderId: string, paymentMethod: PaymentMethod) {
  const url = getSupabaseFunctionUrl("payments-create-session");
  const anon = getSupabaseAnonKey();
  const edgeToken = getPaymentsEdgeToken();

  if (!url || !anon) {
    console.warn(
      `[create-order] payments skip (missing url/anon) order_id=${maskId(orderId)} hasUrl=${!!url} hasAnon=${!!anon}`,
    );
    return { attempted: false, ok: false, status: 0 };
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    apikey: anon,
    authorization: `Bearer ${anon}`,
    "x-client-info": "padrino-vercel-api/create-order",
  };

  // ✅ send guard token only if configured
  if (edgeToken) {
    headers["x-padrino-token"] = edgeToken;
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ order_id: orderId, payment_method: paymentMethod }),
    });

    const j = (await r.json().catch(() => null)) as Json | null;

    if (!r.ok) {
      const code = typeof j?.code === "string" ? j.code : "";
      const reqId = typeof j?.request_id === "string" ? j.request_id : "";
      console.warn(
        `[create-order] payments call not-ok status=${r.status} code=${code || "none"} request_id=${
          reqId || "none"
        } order_id=${maskId(orderId)} pm=${paymentMethod} token=${edgeToken ? "yes" : "no"}`,
      );
      return { attempted: true, ok: false, status: r.status };
    }

    const reqId = typeof j?.request_id === "string" ? j.request_id : "";
    console.info(
      `[create-order] payments ok status=${r.status} request_id=${reqId || "none"} order_id=${maskId(
        orderId,
      )} pm=${paymentMethod} token=${edgeToken ? "yes" : "no"}`,
    );
    return { attempted: true, ok: true, status: r.status };
  } catch (e: unknown) {
    console.error(
      `[create-order] payments error order_id=${maskId(orderId)} pm=${paymentMethod} token=${edgeToken ? "yes" : "no"}`,
      e,
    );
    return { attempted: true, ok: false, status: 0 };
  }
}

/** -------------------- DELIVERY (HARDENING) -------------------- */

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

function getMetaNote(body: Record<string, unknown>, rawItems: unknown[]): string {
  const direct =
    toTrimmedString(body.note) ||
    toTrimmedString(body.order_note) ||
    toTrimmedString(body.orderNote);

  if (direct) return direct;

  // legacy meta
  const legacy = rawItems.find((it) => looksLikeLegacyMetaItem(it));
  if (legacy && isPlainObject(legacy)) {
    return toTrimmedString(legacy.order_note) || toTrimmedString(legacy.note) || "";
  }

  // cart meta (naš)
  const meta = rawItems.find((it) => looksLikeCartMetaItem(it));
  if (meta && isPlainObject(meta)) {
    return toTrimmedString(meta.note) || "";
  }

  return "";
}

/** -------------------- META NOTE: append payment line -------------------- */

function hasPaymentLine(note: string): boolean {
  const lines = String(note ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return lines.some((l) => normalizeText(l).startsWith("placanje:"));
}

function appendPaymentLine(note: string, pm: PaymentMethod): string {
  const base = String(note ?? "").trim();
  if (!base) return base;

  if (hasPaymentLine(base)) return base;

  const label = pm === "card" ? "kartica" : "gotovina";
  return `${base}\nPlaćanje: ${label}`;
}

function withPaymentInMetaItems(rawItems: unknown[], pm: PaymentMethod): unknown[] {
  // clone array; clone only the meta objects we touch
  const out = rawItems.slice();

  // 1) cart meta (our preferred)
  const idxCart = out.findIndex((it) => looksLikeCartMetaItem(it));
  if (idxCart >= 0) {
    const it = out[idxCart];
    if (isPlainObject(it)) {
      const prev = toTrimmedString(it.note);
      const next = appendPaymentLine(prev, pm);
      if (next && next !== prev) {
        out[idxCart] = { ...it, note: next };
      }
    }
    return out;
  }

  // 2) legacy meta fallback
  const idxLegacy = out.findIndex((it) => looksLikeLegacyMetaItem(it));
  if (idxLegacy >= 0) {
    const it = out[idxLegacy];
    if (isPlainObject(it)) {
      const prev = toTrimmedString(it.order_note) || toTrimmedString(it.note);
      const next = appendPaymentLine(prev, pm);
      if (next && next !== prev) {
        // keep both fields for max compatibility
        out[idxLegacy] = { ...it, order_note: next, note: next };
      }
    }
  }

  return out;
}

function safeInt(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.trunc(n);
}

type MenuItemRow = {
  id: unknown;
  price_eur_cents?: unknown;
  price?: unknown;
};

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

  const rows = (data ?? []) as MenuItemRow[];

  for (const r of rows) {
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

    const rawNote = getMetaNote(body, itemsForInsert);
    const parsed = parseZoneAndFeeFromNote(rawNote);

    if (!parsed.zone) {
      return json(res, 400, { ok: false, error: "Missing delivery zone" });
    }

    const zone = parsed.zone;
    const qualifiesFree = subtotal_eur_cents >= zone.minCents;
    const expectedFeeCents = qualifiesFree ? 0 : zone.feeCents;

    // zaštita od manipulacije fee-a
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

    const insertRow: Record<string, unknown> = {
      customer_name,
      customer_phone,
      customer_address,
      items: itemsForInsert,
      currency,
      status,
      total_eur_cents,
      // legacy: numeric kompatibilno
      total_price: total_eur_cents / 100,
    };

    const { data, error } = await supabase.from("orders").insert(insertRow).select("id").single();

    if (error || !data || typeof (data as { id?: unknown }).id !== "string") {
      console.error("Supabase insert error:", error);
      return json(res, 500, { ok: false, error: "Database insert failed" });
    }

    const orderId = (data as { id: string }).id;

    // Telegram best-effort (existing)
    const telegram = await notifyTelegramBestEffort(req, orderId);

    // payments-create-session best-effort (server-side)
    const payments = await notifyPaymentsBestEffort(orderId, payment_method);

    return json(res, 200, { ok: true, id: orderId, telegram, payments });
  } catch (err: unknown) {
    console.error("create-order fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}