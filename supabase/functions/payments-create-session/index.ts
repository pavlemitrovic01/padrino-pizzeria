import type {} from "../deno.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentMethod = "cash" | "card";

// MODE A (za frontend hook-up bez dupliranja): samo verifikuj postojeci order
type CreateSessionByOrderIdRequest = {
  order_id: string;
  payment_method?: PaymentMethod; // default "cash"
};

// MODE B (legacy/test): kreiraj order direktno iz payload-a
type CreateSessionInsertRequest = {
  customer_name: string;
  customer_phone: string;
  customer_address: string;

  items: unknown; // očekujemo array ili JSON string (frontend već šalje array)
  total_eur_cents: number;

  currency?: string; // default "EUR"
  payment_method?: PaymentMethod; // default "cash"
};

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

function safeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Math.trunc(Number(v));
  return null;
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

function parseItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;

  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
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

    // common
    const payment_method = (safeString(bodyUnknown["payment_method"]) as PaymentMethod) || "cash";
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

    // MODE A: order_id path (bez inserta)
    const bodyA = bodyUnknown as Partial<CreateSessionByOrderIdRequest>;
    const order_id = safeString(bodyA.order_id);

    if (order_id) {
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
    }

    // MODE B: legacy insert path
    const body = bodyUnknown as Partial<CreateSessionInsertRequest>;

    const customer_name = safeString(body.customer_name);
    const customer_phone = safeString(body.customer_phone);
    const customer_address = safeString(body.customer_address);

    const total_eur_cents = safeInt(body.total_eur_cents);
    const currency = safeString(body.currency) || "EUR";

    if (!customer_name || !customer_phone || !customer_address) {
      return json(400, { ok: false, error: "Missing customer fields" }, origin);
    }

    if (total_eur_cents == null || total_eur_cents < 0) {
      return json(400, { ok: false, error: "Invalid total_eur_cents" }, origin);
    }

    const items = parseItems(body.items);
    if (items.length === 0) {
      return json(400, { ok: false, error: "Missing items" }, origin);
    }

    // status: u tabeli vidimo "pending" kao standard
    const status = "pending";

    const insertRow: Record<string, unknown> = {
      customer_name,
      customer_phone,
      customer_address,
      items,
      currency,
      status,
      total_eur_cents,
      total_price: total_eur_cents / 100, // legacy kompatibilno
    };

    const { data, error } = await supabase.from("orders").insert(insertRow).select("id").single();

    if (error) {
      console.error("orders insert failed:", error);
      return json(500, { ok: false, error: "Database insert failed" }, origin);
    }

    return json(
      200,
      {
        ok: true,
        payment_method: "cash",
        order_id: data?.id ?? null,
        mode: "insert",
      },
      origin,
    );
  } catch (e) {
    console.error("payments-create-session error:", e);
    return json(500, { ok: false, error: String(e) }, origin);
  }
});