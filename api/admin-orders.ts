import { createClient } from "@supabase/supabase-js";

function setCors(req: any, res: any) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin : "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with, authorization");
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

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-orders" } },
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

function getBearerToken(req: any): string {
  const h = toTrimmedString(req?.headers?.authorization || req?.headers?.Authorization);
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function parseLimit(v: unknown, def: number, min: number, max: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "Invalid session" });

    if (!isAdminEmail(userData.user.email)) return json(res, 403, { ok: false, error: "Not authorized" });

    const limit = parseLimit(req.query?.limit, 200, 1, 500);

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, created_at, customer_name, customer_phone, customer_address, total_price, currency, total_eur_cents, fx_rsd_per_eur, items, status"
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return json(res, 500, { ok: false, error: error.message || "DB select failed" });

    return json(res, 200, { ok: true, orders: data ?? [] });
  } catch (err: any) {
    console.error("admin-orders fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
