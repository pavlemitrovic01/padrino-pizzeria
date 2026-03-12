import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type QueryValue = string | string[] | undefined;
type QueryLike = Record<string, QueryValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  query?: QueryLike;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function queryString(req: ReqLike, key: string): string {
  const raw = req.query?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function setCors(req: ReqLike, res: ResLike) {
  const origin = headerString(req, "origin");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-orders" } },
  });
}

const supabase = buildSupabaseAdmin();

/**
 * Break-glass fallback samo ako admin_users tabela ne postoji (deploy/migracija).
 * Pošto si ti tabelu već napravio, realno se ovo neće koristiti.
 */
const FALLBACK_ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function parseLimit(v: string, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";
  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

async function isAdminEmailDb(email: string): Promise<boolean> {
  const e = normalizeEmail(email);
  if (!e) return false;

  const { data, error } = await supabase.from("admin_users").select("email, enabled").eq("email", e).maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) {
      return FALLBACK_ADMIN_EMAILS.has(e);
    }
    return false;
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  return enabled === true;
}

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "Invalid session" });

    const userEmail = typeof userData.user.email === "string" ? userData.user.email : "";
    const isAdmin = await isAdminEmailDb(userEmail);
    if (!isAdmin) return json(res, 403, { ok: false, error: "Not authorized" });

    const limitRaw = queryString(req, "limit");
    const limit = parseLimit(limitRaw, 200, 1, 500);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, customer_address, total_price, currency, total_eur_cents, fx_rsd_per_eur, items, status, payment_status",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return json(res, 500, { ok: false, error: "DB select failed" });
    }

    return json(res, 200, { ok: true, orders: data ?? [] });
  } catch (err: unknown) {
    console.error("admin-orders fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}