import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Json = Record<string, unknown>;

type RateLimitState = { count: number; ts: number };

type OrderStatus = "pending" | "preparing" | "done" | "cancelled";

const ADMIN_EMAIL = "pavlemitrovic01@gmail.com";

// CORS allowlist (Budva)
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "https://padrinobudva.com",
  "https://www.padrinobudva.com",
]);

// Basic in-memory rate limit: 60 req/min per IP (best-effort on edge runtime)
const rateLimitMap = new Map<string, RateLimitState>();
const RATE_LIMIT = 60;
const RATE_WINDOW_MS = 60 * 1000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function getEnvRequired(name: string): string {
  const v = safeString(Deno.env.get(name));
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const SUPABASE_URL = getEnvRequired("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = getEnvRequired("SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { headers: { "X-Client-Info": "padrino-edge/admin-orders" } },
});

function resolveCorsOrigin(origin: string | null): string | null {
  // Non-browser requests may have no Origin; allow them
  if (!origin) return "*";
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function getCorsHeaders(allowOrigin: string) {
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    Vary: "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status: number, body: Json, allowOrigin: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(allowOrigin), "Content-Type": "application/json; charset=utf-8" },
  });
}

function jsonNoCors(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", Vary: "Origin" },
  });
}

function getClientIp(req: Request): string {
  const xf = safeString(req.headers.get("x-forwarded-for"));
  if (!xf) return "unknown";
  // x-forwarded-for may contain a list
  const first = xf.split(",")[0]?.trim();
  return first || "unknown";
}

function hitRateLimit(ip: string): boolean {
  const now = Date.now();
  const prev = rateLimitMap.get(ip);

  if (!prev || now - prev.ts > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, ts: now });
    return false;
  }

  if (prev.count >= RATE_LIMIT) return true;

  rateLimitMap.set(ip, { count: prev.count + 1, ts: prev.ts });
  return false;
}

async function validateAdmin(req: Request): Promise<boolean> {
  const authHeader = safeString(req.headers.get("authorization"));
  if (!authHeader) return false;

  const m = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = m?.[1]?.trim() ?? "";
  if (!token) return false;

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return false;

  const email = safeString(data.user.email);
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

function isOrderStatus(v: unknown): v is OrderStatus {
  return v === "pending" || v === "preparing" || v === "done" || v === "cancelled";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const allowOrigin = resolveCorsOrigin(origin);

  // If Origin is present but not allowed -> block (explicit 403)
  if (origin && !allowOrigin) {
    return jsonNoCors(403, { error: "Origin not allowed" });
  }

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(allowOrigin ?? "*") });
  }

  // Rate limit
  const ip = getClientIp(req);
  if (hitRateLimit(ip)) {
    return json(429, { error: "Too many requests" }, allowOrigin ?? "*");
  }

  // Validate admin access
  const isAdmin = await validateAdmin(req);
  if (!isAdmin) {
    return json(401, { error: "Unauthorized" }, allowOrigin ?? "*");
  }

  const method = req.method.toUpperCase();

  if (method === "GET") {
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

    if (error) {
      return json(500, { error: error.message || "DB select failed" }, allowOrigin ?? "*");
    }

    // IMPORTANT: keep legacy response shape (array)
    return new Response(JSON.stringify(data ?? []), {
      status: 200,
      headers: { ...getCorsHeaders(allowOrigin ?? "*"), "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (method === "PATCH") {
    const bodyUnknown: unknown = await req.json().catch(() => null);
    if (!isRecord(bodyUnknown)) {
      return json(400, { error: "Invalid JSON body" }, allowOrigin ?? "*");
    }

    const id = safeString(bodyUnknown.id);
    const statusRaw = bodyUnknown.status;

    if (!id) {
      return json(400, { error: "Missing id" }, allowOrigin ?? "*");
    }

    if (!isOrderStatus(statusRaw)) {
      return json(400, { error: "Invalid status" }, allowOrigin ?? "*");
    }

    const { error } = await supabase.from("orders").update({ status: statusRaw }).eq("id", id);

    if (error) {
      return json(500, { error: error.message || "DB update failed" }, allowOrigin ?? "*");
    }

    // IMPORTANT: keep legacy response shape
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(allowOrigin ?? "*"), "Content-Type": "application/json; charset=utf-8" },
    });
  }

  return json(405, { error: "Method not allowed" }, allowOrigin ?? "*");
});