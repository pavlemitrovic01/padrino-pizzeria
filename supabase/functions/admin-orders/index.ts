// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const ALLOWED_ORIGINS = ["http://localhost:5173", "https://padrino.rs"];

function getCorsHeaders(origin: string | null) {
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  };
}

const ADMIN_EMAIL = "pavlemitrovic01@gmail.com";

// Basic in-memory rate limit: 60 req/min per IP
const rateLimitMap = new Map();
const RATE_LIMIT = 60;
const RATE_WINDOW = 60 * 1000; // 1 min

async function validateAdmin(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;

  const token = authHeader.split(" ")[1];
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user || user.email !== ADMIN_EMAIL) return false;
  return true;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Ako dolazi origin koji nije dozvoljen, vrati 403 (da ne bude "tiha" CORS blokada)
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Basic rate limit by IP
  const ip = req.headers.get("x-forwarded-for") || "unknown";
  const now = Date.now();
  const rl = rateLimitMap.get(ip);

  if (!rl || now - rl.ts > RATE_WINDOW) {
    rateLimitMap.set(ip, { count: 1, ts: now });
  } else {
    if (rl.count >= RATE_LIMIT) {
      return new Response(JSON.stringify({ error: "Too many requests" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    rl.count++;
    rateLimitMap.set(ip, rl);
  }

  // Validate admin access
  const isAdmin = await validateAdmin(req);
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const method = req.method.toUpperCase();

  if (method === "GET") {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (method === "PATCH") {
    const body = await req.json();
    const id = body?.id;
    const status = body?.status;

    const { error } = await supabase.from("orders").update({ status }).eq("id", id);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
