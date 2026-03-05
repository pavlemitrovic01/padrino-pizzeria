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

type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-update-order-status" } },
  });
}

const supabase = buildSupabaseAdmin();

/**
 * Break-glass fallback samo ako admin_users tabela ne postoji (deploy/migracija).
 * Pošto si tabelu već napravio, realno se ovo neće koristiti.
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

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";
  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

async function isAdminEmailDb(email: unknown): Promise<boolean> {
  const e = typeof email === "string" ? normalizeEmail(email) : "";
  if (!e) return false;

  const { data, error } = await supabase.from("admin_users").select("email, enabled").eq("email", e).maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) return FALLBACK_ADMIN_EMAILS.has(e);
    return false;
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  return enabled === true;
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;

  if (from === "pending") return to === "preparing" || to === "done" || to === "cancelled";
  if (from === "preparing") return to === "done" || to === "cancelled";
  // done/cancelled are terminal
  return false;
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
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "Invalid session" });

    const isAdmin = await isAdminEmailDb(userData.user.email);
    if (!isAdmin) return json(res, 403, { ok: false, error: "Not authorized" });

    const body = isPlainObject(req.body) ? req.body : null;
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const orderId = toTrimmedString(body.order_id) || toTrimmedString(body.orderId);
    const nextRaw = body.next_status ?? body.nextStatus ?? body.status;
    const nextStatus = toTrimmedString(nextRaw);

    if (!orderId) return json(res, 400, { ok: false, error: "Missing order_id" });
    if (!isOrderStatus(nextStatus)) return json(res, 400, { ok: false, error: "Invalid next_status" });

    const { data: current, error: readErr } = await supabase
      .from("orders")
      .select("id, status")
      .eq("id", orderId)
      .single();

    if (readErr) {
      const msg = typeof readErr.message === "string" && readErr.message.trim() ? readErr.message : "DB read failed";
      // Supabase often throws for "single()" when no row; treat as 404-friendly
      return json(res, 404, { ok: false, error: msg });
    }

    const fromStatus = current?.status;
    if (!isOrderStatus(fromStatus)) {
      return json(res, 500, { ok: false, error: "Order has invalid status in DB" });
    }

    if (!canTransition(fromStatus, nextStatus)) {
      return json(res, 400, { ok: false, error: `Invalid transition: ${fromStatus} -> ${nextStatus}` });
    }

    const { data: updated, error: updErr } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .select("status")
      .single();

    if (updErr) {
      const msg = typeof updErr.message === "string" && updErr.message.trim() ? updErr.message : "DB update failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const finalStatus = updated?.status;
    if (isOrderStatus(finalStatus)) {
      return json(res, 200, { ok: true, status: finalStatus });
    }

    // fallback (should not happen)
    return json(res, 200, { ok: true, status: nextStatus });
  } catch (err: unknown) {
    console.error("admin-update-order-status fatal error:", err);
    const msg = err instanceof Error ? err.message : String(err);
    return json(res, 500, { ok: false, error: msg || "Unknown error" });
  }
}