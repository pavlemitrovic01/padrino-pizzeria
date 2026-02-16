import { createClient } from "@supabase/supabase-js";

function setCors(req: any, res: any) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin : "";
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-update-order-status" } },
  });
}

const supabase = buildSupabaseAdmin();

const ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function isAdminEmail(email: unknown): boolean {
  const e = typeof email === "string" ? normalizeEmail(email) : "";
  return e.length > 0 && ADMIN_EMAILS.has(e);
}

function isPlainObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function getBearerToken(req: any): string {
  const h = toTrimmedString(req?.headers?.authorization || req?.headers?.Authorization);
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

function currentOrDefault(v: unknown): OrderStatus {
  if (isOrderStatus(v)) return v;
  return "pending";
}

/**
 * Minimal state machine:
 * - pending -> preparing | cancelled
 * - preparing -> done | cancelled
 * - done -> done (no changes)
 * - cancelled -> cancelled (no changes)
 */
function isAllowedTransition(current: OrderStatus, next: OrderStatus) {
  if (current === next) return true;

  if (current === "pending") return next === "preparing" || next === "cancelled";
  if (current === "preparing") return next === "done" || next === "cancelled";
  if (current === "done") return false;
  if (current === "cancelled") return false;

  return false;
}

export default async function handler(req: any, res: any) {
  setCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method not allowed" });

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    // Server-side auth: verify JWT with Supabase and check allowlist email
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(res, 401, { ok: false, error: "Invalid session" });
    }

    const email = userData.user.email;
    if (!isAdminEmail(email)) {
      return json(res, 403, { ok: false, error: "Not authorized" });
    }

    const body = isPlainObject(req.body) ? req.body : null;
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const orderId = toTrimmedString(body.order_id || body.orderId);
    const nextRaw = body.next_status || body.nextStatus;

    if (!orderId) return json(res, 400, { ok: false, error: "Missing order_id" });
    if (!isOrderStatus(nextRaw)) return json(res, 400, { ok: false, error: "Invalid next_status" });

    const nextStatus: OrderStatus = nextRaw;

    const { data: existing, error: readErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (readErr || !existing) {
      return json(res, 404, { ok: false, error: "Order not found" });
    }

    const currentStatus = currentOrDefault((existing as any).status);

    if (!isAllowedTransition(currentStatus, nextStatus)) {
      return json(res, 400, {
        ok: false,
        error: `Invalid transition: ${currentStatus} -> ${nextStatus}`,
      });
    }

    const { data: updated, error: updErr } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .select("id, status")
      .single();

    if (updErr || !updated) {
      console.error("[admin-update-order-status] update error:", updErr);
      return json(res, 500, { ok: false, error: "Update failed" });
    }

    return json(res, 200, { ok: true, id: (updated as any).id, status: (updated as any).status });
  } catch (err: any) {
    console.error("admin-update-order-status fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
