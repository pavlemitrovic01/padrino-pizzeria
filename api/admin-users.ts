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

type AdminRole = "owner" | "staff";

type AdminUserRow = {
  email: string;
  role: AdminRole;
  enabled: boolean;
  created_at: string;
};

/**
 * Break-glass fallback samo ako admin_users tabela ne postoji (deploy/migracija).
 * Pošto si tabelu već napravio, realno se ovo neće koristiti.
 */
const FALLBACK_ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-users" } },
  });
}

const supabase = buildSupabaseAdmin();

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function isLikelyEmail(v: string) {
  const s = normalizeEmail(v);
  if (!s) return false;
  if (s.includes(" ")) return false;
  const at = s.indexOf("@");
  if (at <= 0) return false;
  const dot = s.lastIndexOf(".");
  if (dot <= at + 1) return false;
  if (dot >= s.length - 1) return false;
  return true;
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";
  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

function isAdminRole(v: unknown): v is AdminRole {
  return v === "owner" || v === "staff";
}

async function getAdminFromDb(email: string): Promise<{ table: "ok" | "missing" | "error"; isAdmin: boolean; role: AdminRole | null }> {
  const e = normalizeEmail(email);
  if (!e) return { table: "ok", isAdmin: false, role: null };

  const { data, error } = await supabase.from("admin_users").select("email, role, enabled").eq("email", e).maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) {
      const fallback = FALLBACK_ADMIN_EMAILS.has(e);
      return { table: "missing", isAdmin: fallback, role: fallback ? "owner" : null };
    }
    return { table: "error", isAdmin: false, role: null };
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  const role = isAdminRole(data?.role) ? data.role : null;

  if (!enabled) return { table: "ok", isAdmin: false, role: null };
  return { table: "ok", isAdmin: true, role: role ?? "staff" };
}

async function countEnabledOwners(): Promise<number> {
  const { data, error } = await supabase.from("admin_users").select("email, role, enabled");
  if (error) return 0;

  const rows = Array.isArray(data) ? (data as Array<{ role?: unknown; enabled?: unknown }>) : [];

  let n = 0;
  for (const r of rows) {
    const enabled = typeof r.enabled === "boolean" ? r.enabled : false;
    const role = isAdminRole(r.role) ? r.role : null;
    if (enabled && role === "owner") n += 1;
  }
  return n;
}

function normalizeAdminUserRow(raw: unknown): AdminUserRow | null {
  if (!isPlainObject(raw)) return null;

  const email = normalizeEmail(toTrimmedString(raw.email));
  const role = raw.role;
  const enabled = raw.enabled;
  const createdAt = toTrimmedString(raw.created_at);

  if (!email) return null;
  if (!isAdminRole(role)) return null;
  if (typeof enabled !== "boolean") return null;

  return { email, role, enabled, created_at: createdAt || "" };
}

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "Invalid session" });

    const actorEmailRaw = typeof userData.user.email === "string" ? userData.user.email : "";
    const actorEmail = normalizeEmail(actorEmailRaw);
    if (!actorEmail) return json(res, 401, { ok: false, error: "Invalid session" });

    const actor = await getAdminFromDb(actorEmail);
    if (!actor.isAdmin) return json(res, 403, { ok: false, error: "Not authorized" });

    // ✅ GET: svi admini mogu da vide listu
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("admin_users")
        .select("email, role, enabled, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        const msg = typeof error.message === "string" && error.message.trim() ? error.message : "DB select failed";
        return json(res, 500, { ok: false, error: msg });
      }

      const list = Array.isArray(data)
        ? data.map(normalizeAdminUserRow).filter((x): x is AdminUserRow => Boolean(x))
        : [];

      return json(res, 200, {
        ok: true,
        actor: { email: actorEmail, role: actor.role ?? "staff" },
        users: list,
      });
    }

    // ✅ POST: samo OWNER može da menja listu
    if (actor.role !== "owner") {
      return json(res, 403, { ok: false, error: "Owner required" });
    }

    const body = isPlainObject(req.body) ? req.body : null;
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const targetEmailRaw = toTrimmedString(body.email);
    const targetEmail = normalizeEmail(targetEmailRaw);

    const enabledRaw = body.enabled;
    const roleRaw = body.role;

    const enabled = typeof enabledRaw === "boolean" ? enabledRaw : true;
    const role: AdminRole = isAdminRole(roleRaw) ? roleRaw : "staff";

    if (!isLikelyEmail(targetEmail)) return json(res, 400, { ok: false, error: "Invalid email" });

    // Self-lockout guard: owner ne može da disable/demote sebe
    if (targetEmail === actorEmail) {
      if (!enabled) return json(res, 400, { ok: false, error: "You cannot disable your own admin access" });
      if (role !== "owner") return json(res, 400, { ok: false, error: "You cannot demote yourself from owner" });
    }

    // Last-owner guard: ne dozvoli da nestane poslednji enabled owner
    const { data: existing, error: existingErr } = await supabase
      .from("admin_users")
      .select("email, role, enabled")
      .eq("email", targetEmail)
      .maybeSingle();

    if (existingErr && !looksLikeMissingTable(existingErr)) {
      const msg =
        typeof existingErr.message === "string" && existingErr.message.trim()
          ? existingErr.message
          : "DB read failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const existingRole = isAdminRole(existing?.role) ? existing.role : null;
    const existingEnabled = typeof existing?.enabled === "boolean" ? existing.enabled : null;

    const removingOwner =
      existingRole === "owner" &&
      existingEnabled === true &&
      (enabled === false || role !== "owner");

    if (removingOwner) {
      const owners = await countEnabledOwners();
      if (owners <= 1) {
        return json(res, 400, { ok: false, error: "Cannot remove the last enabled owner" });
      }
    }

    const { error: upErr } = await supabase.from("admin_users").upsert(
      { email: targetEmail, role, enabled },
      { onConflict: "email" },
    );

    if (upErr) {
      const msg = typeof upErr.message === "string" && upErr.message.trim() ? upErr.message : "DB upsert failed";
      return json(res, 500, { ok: false, error: msg });
    }

    return json(res, 200, { ok: true, email: targetEmail, role, enabled });
  } catch {
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}