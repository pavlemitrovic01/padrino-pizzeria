import { createClient } from "@supabase/supabase-js";

type Json = Record<string, unknown>;

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
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

function setCors(req: ReqLike, res: ResLike) {
  const origin = headerString(req, "origin");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
}

function json(res: ResLike, code: number, body: Json) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(code).send(JSON.stringify(body));
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-me" } },
  });
}

const supabase = buildSupabaseAdmin();

/**
 * Break-glass fallback (samo dok admin_users tabela NE postoji).
 * Čim tabela postoji, koristi se ISKLJUČIVO DB allowlist.
 */
const FALLBACK_ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";

  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

type AdminRole = "owner" | "staff";
type TableState = "ok" | "missing" | "error";

function isAdminRole(v: unknown): v is AdminRole {
  return v === "owner" || v === "staff";
}

async function getAdminRoleFromDb(email: string): Promise<{ table: TableState; isAdmin: boolean; role: AdminRole | null }> {
  const normalized = normalizeEmail(email);

  const { data, error } = await supabase
    .from("admin_users")
    .select("email, role, enabled")
    .eq("email", normalized)
    .maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) {
      const fallback = FALLBACK_ADMIN_EMAILS.has(normalized);
      return { table: "missing", isAdmin: fallback, role: fallback ? "owner" : null };
    }

    return { table: "error", isAdmin: false, role: null };
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  const role = isAdminRole(data?.role) ? data.role : null;

  if (!enabled) return { table: "ok", isAdmin: false, role: null };
  return { table: "ok", isAdmin: true, role: role ?? "staff" };
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

    const email = typeof userData.user.email === "string" ? normalizeEmail(userData.user.email) : "";
    if (!email) return json(res, 401, { ok: false, error: "Invalid session" });

    const r = await getAdminRoleFromDb(email);

    return json(res, 200, {
      ok: true,
      email,
      is_admin: r.isAdmin,
      role: r.role,
      admin_users_table: r.table,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, 500, { ok: false, error: msg });
  }
}