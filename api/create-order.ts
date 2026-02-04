import { createClient } from "@supabase/supabase-js";

type CreateOrderBody = {
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;
  items?: unknown;

  total_eur_cents?: unknown;
  currency?: unknown;
  status?: unknown;
  fx_rsd_per_eur?: unknown;
};

function json(res: any, status: number, body: any) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function isPlainObject(v: unknown): v is Record<string, any> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Math.trunc(Number(v));
  return null;
}

function sanitizeItems(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  return [];
}

function safeUrlHost(value: string | null | undefined): string | null {
  try {
    if (!value) return null;
    const u = new URL(value.trim());
    return u.host;
  } catch {
    return null;
  }
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();

  const SERVICE_ROLE =
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      "").trim();

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

function extractErrorDetails(err: any) {
  // Bez tajni — samo “stvarni razlog” fetch failed
  const message = String(err?.message || err);
  const name = err?.name ? String(err.name) : null;

  // Node često stavlja pravi razlog u err.cause
  const cause = err?.cause
    ? {
        name: err.cause?.name ? String(err.cause.name) : null,
        message: err.cause?.message ? String(err.cause.message) : String(err.cause),
        code: err.cause?.code ? String(err.cause.code) : null,
      }
    : null;

  return { name, message, cause };
}

export default async function handler(req: any, res: any) {
  // Minimalan CORS
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

  // Debug info (bez ključeva)
  const debug = {
    nodeEnv: process.env.NODE_ENV || null,
    supabaseUrlHost: safeUrlHost(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL),
    hasSupabaseUrl: Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim()),
    hasServiceRole: Boolean(
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        "").trim()
    ),
  };

  try {
    const body: CreateOrderBody = isPlainObject(req.body) ? (req.body as any) : {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const items = sanitizeItems(body.items);
    const total_eur_cents = toInt(body.total_eur_cents);

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    const fx_rsd_per_eur = (() => {
      if (body.fx_rsd_per_eur === null || body.fx_rsd_per_eur === undefined) return null;
      const n = typeof body.fx_rsd_per_eur === "number" ? body.fx_rsd_per_eur : Number(body.fx_rsd_per_eur);
      return Number.isFinite(n) ? n : null;
    })();

    // Minimalna validacija
    if (customer_name.length < 2) return json(res, 400, { ok: false, error: "Invalid customer_name", debug });
    if (customer_phone.length < 6) return json(res, 400, { ok: false, error: "Invalid customer_phone", debug });
    if (customer_address.length < 5) return json(res, 400, { ok: false, error: "Invalid customer_address", debug });
    if (!Array.isArray(items) || items.length === 0) return json(res, 400, { ok: false, error: "Items required", debug });
    if (total_eur_cents === null || total_eur_cents <= 0)
      return json(res, 400, { ok: false, error: "Invalid total_eur_cents", debug });

    const supabaseAdmin = buildSupabaseAdmin();

    const row: Record<string, any> = {
      customer_name,
      customer_phone,
      customer_address,
      items,
      total_price: null,
      currency,
      total_eur_cents,
      fx_rsd_per_eur,
      status,
    };

    const { data, error } = await supabaseAdmin.from("orders").insert([row]).select("id").single();

    if (error) {
      return json(res, 500, {
        ok: false,
        error: error.message || "Insert failed",
        code: error.code || null,
        debug,
      });
    }

    const id = String((data as any)?.id ?? "").trim();
    if (!id) return json(res, 500, { ok: false, error: "Insert ok but no id returned", debug });

    return json(res, 200, { ok: true, id });
  } catch (err: any) {
    const details = extractErrorDetails(err);
    console.error("[api/create-order] error:", details, debug);
    return json(res, 500, { ok: false, error: details.message, details, debug });
  }
}
