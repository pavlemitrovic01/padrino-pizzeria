import { createClient } from "@supabase/supabase-js";
import { isAdminEmailDb } from "./_shared/admin-auth.js";
import { isPlainObject } from "./_shared/parsing.js";
import { applyCors } from "./_shared/cors.js";

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

export type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
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

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

export function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return true;

  if (from === "pending") return to === "preparing" || to === "done" || to === "cancelled";
  if (from === "preparing") return to === "done" || to === "cancelled";
  // done/cancelled are terminal
  return false;
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "POST", allowHeaders: "content-type, x-requested-with, authorization" });

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

    const isAdmin = await isAdminEmailDb(supabase, userData.user.email);
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
      return json(res, 404, { ok: false, error: "DB read failed" });
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
      .eq("status", fromStatus)
      .select("status")
      .maybeSingle();

    if (updErr) {
      return json(res, 500, { ok: false, error: "DB update failed" });
    }

    if (!updated) {
      const { data: actualRow } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .maybeSingle();
      const currentStatus = isOrderStatus(actualRow?.status) ? actualRow.status : null;
      return json(res, 409, {
        ok: false,
        error: currentStatus
          ? `Status promijenjen u međuvremenu (trenutno: ${currentStatus}). Osvježite listu.`
          : "Status promijenjen u međuvremenu. Osvježite listu.",
        current_status: currentStatus,
        attempted_from: fromStatus,
        attempted_to: nextStatus,
      });
    }

    const finalStatus = updated.status;
    if (isOrderStatus(finalStatus)) {
      return json(res, 200, { ok: true, status: finalStatus });
    }

    // Unreachable — updated.status is valid when row is returned
    return json(res, 200, { ok: true, status: nextStatus });
  } catch (err: unknown) {
    console.error("admin-update-order-status fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}