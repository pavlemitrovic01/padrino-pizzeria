import type {} from "../deno.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentMethod = "cash" | "card";
type Json = Record<string, unknown>;

const ALLOWED_ORIGINS = new Set<string>([
  "https://padrinobudva.com",
  "https://www.padrinobudva.com",
  "http://localhost:5173",
]);

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

function newRequestId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function maskId(value: string): string {
  const v = value.trim();
  if (!v) return "";
  if (v.length <= 8) return `${v.slice(0, 2)}***`;
  return `${v.slice(0, 4)}…${v.slice(-4)}`;
}

function resolveCorsOrigin(origin: string | null): string | null {
  // Non-browser requests (PowerShell/CLI) often have no Origin; allow them
  if (!origin) return "*";
  return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function corsHeaders(allowOrigin: string) {
  return {
    "access-control-allow-origin": allowOrigin,
    "vary": "origin",
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, apikey, x-client-info, x-padrino-token",
  };
}

function json(status: number, body: Json, allowOrigin: string, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
      ...corsHeaders(allowOrigin),
    },
  });
}

// For blocked-origin responses: no CORS headers by design
function jsonNoCors(status: number, body: Json, requestId: string) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-request-id": requestId,
      "vary": "origin",
    },
  });
}

function getEnv(name: string): string {
  return safeString(Deno.env.get(name));
}

function buildSupabaseAdmin() {
  const url = getEnv("SUPABASE_URL");
  const key = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-edge/payments-create-session" } },
  });
}

const supabase = buildSupabaseAdmin();

serve(async (req) => {
  const requestId = newRequestId();

  const origin = req.headers.get("origin");
  const allowOrigin = resolveCorsOrigin(origin);

  // If Origin is present but not allowed -> block
  if (origin && !allowOrigin) {
    console.warn(`[payments-create-session] request_id=${requestId} origin_blocked origin=${origin}`);
    return jsonNoCors(403, { ok: false, error: "Origin not allowed", request_id: requestId }, requestId);
  }

  // Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      status: 200,
      headers: {
        ...corsHeaders(allowOrigin ?? "*"),
        "cache-control": "no-store",
        "x-request-id": requestId,
      },
    });
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed", request_id: requestId }, allowOrigin ?? "*", requestId);
  }

  // ✅ Optional guard: enforce only if PAYMENTS_EDGE_TOKEN exists
  const requiredToken = getEnv("PAYMENTS_EDGE_TOKEN");
  if (requiredToken) {
    const gotToken = safeString(req.headers.get("x-padrino-token"));
    if (!gotToken || gotToken !== requiredToken) {
      console.warn(
        `[payments-create-session] request_id=${requestId} auth_failed origin=${origin ?? "none"} allow=${
          allowOrigin ?? "*"
        }`,
      );
      return json(401, { ok: false, error: "Unauthorized", request_id: requestId }, allowOrigin ?? "*", requestId);
    }
  }

  try {
    const bodyUnknown: unknown = await req.json().catch(() => null);
    if (!isRecord(bodyUnknown)) {
      return json(400, { ok: false, error: "Invalid JSON body", request_id: requestId }, allowOrigin ?? "*", requestId);
    }

    const order_id = safeString(bodyUnknown["order_id"]);
    const payment_method = (safeString(bodyUnknown["payment_method"]) as PaymentMethod) || "cash";

    if (!order_id) {
      return json(400, { ok: false, error: "order_id required", request_id: requestId }, allowOrigin ?? "*", requestId);
    }

    if (payment_method !== "cash" && payment_method !== "card") {
      return json(
        400,
        { ok: false, error: "Invalid payment_method", request_id: requestId },
        allowOrigin ?? "*",
        requestId,
      );
    }

    console.info(
      `[payments-create-session] request_id=${requestId} start origin=${origin ?? "none"} allow=${
        allowOrigin ?? "*"
      } pm=${payment_method} order_id=${maskId(order_id)}`,
    );

    // HARD GUARD: kartica disabled dok NLB ne stigne
    if (payment_method === "card") {
      return json(
        501,
        {
          ok: false,
          error: "Card payments are disabled (NLB pending).",
          code: "CARD_DISABLED",
          request_id: requestId,
        },
        allowOrigin ?? "*",
        requestId,
      );
    }

    const { data, error } = await supabase.from("orders").select("id").eq("id", order_id).single();

    if (error || !data?.id) {
      console.warn(
        `[payments-create-session] request_id=${requestId} order_not_found order_id=${maskId(order_id)} supabase_error=${
          error?.message ?? "none"
        }`,
      );
      return json(404, { ok: false, error: "Order not found", request_id: requestId }, allowOrigin ?? "*", requestId);
    }

    return json(
      200,
      { ok: true, payment_method: "cash", order_id: data.id, mode: "by_order_id", request_id: requestId },
      allowOrigin ?? "*",
      requestId,
    );
  } catch (e: unknown) {
    console.error(`[payments-create-session] request_id=${requestId} unhandled_error`, e);
    return json(500, { ok: false, error: "Internal server error", request_id: requestId }, allowOrigin ?? "*", requestId);
  }
});