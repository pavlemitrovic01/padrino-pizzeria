import type {} from "../deno.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentMethod = "cash" | "card";

type Json = Record<string, unknown>;

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

function json(status: number, body: Json, origin?: string | null) {
  const headers = new Headers();
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("access-control-allow-origin", origin ?? "*");
  headers.set("vary", "origin");
  headers.set("access-control-allow-methods", "POST, OPTIONS");
  headers.set("access-control-allow-headers", "content-type, authorization, apikey, x-client-info");
  return new Response(JSON.stringify(body), { status, headers });
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
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return json(200, { ok: true }, origin);
  }

  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, origin);
  }

  try {
    const bodyUnknown: unknown = await req.json().catch(() => null);
    if (!isRecord(bodyUnknown)) {
      return json(400, { ok: false, error: "Invalid JSON body" }, origin);
    }

    const order_id = safeString(bodyUnknown["order_id"]);
    const payment_method = (safeString(bodyUnknown["payment_method"]) as PaymentMethod) || "cash";

    if (!order_id) {
      return json(400, { ok: false, error: "order_id required" }, origin);
    }

    if (payment_method !== "cash" && payment_method !== "card") {
      return json(400, { ok: false, error: "Invalid payment_method" }, origin);
    }

    // HARD GUARD: kartica disabled dok NLB ne stigne
    if (payment_method === "card") {
      return json(
        501,
        {
          ok: false,
          error: "Card payments are disabled (NLB pending).",
          code: "CARD_DISABLED",
        },
        origin,
      );
    }

    const { data, error } = await supabase.from("orders").select("id").eq("id", order_id).single();

    if (error || !data?.id) {
      return json(404, { ok: false, error: "Order not found" }, origin);
    }

    return json(
      200,
      {
        ok: true,
        payment_method: "cash",
        order_id: data.id,
        mode: "by_order_id",
      },
      origin,
    );
  } catch (e) {
    console.error("payments-create-session error:", e);
    return json(500, { ok: false, error: String(e) }, origin);
  }
});