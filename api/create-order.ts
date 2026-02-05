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
  if (typeof v === "string") {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function sanitizeItems(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
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
  // Server treba da koristi server varijablu; VITE_* je za frontend.
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();

  const SERVICE_ROLE =
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE ||
      "").trim();

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

function extractErrorDetails(err: any) {
  const message = String(err?.message || err);
  const name = err?.name ? String(err.name) : null;

  const cause = err?.cause
    ? {
        name: err.cause?.name ? String(err.cause.name) : null,
        message: err.cause?.message ? String(err.cause.message) : String(err.cause),
        code: err.cause?.code ? String(err.cause.code) : null,
      }
    : null;

  return { name, message, cause };
}

function readJsonBody(req: any): Record<string, any> {
  // Vercel može dati body kao object ili kao string (zavisi od okruženja).
  const raw = req?.body;

  if (isPlainObject(raw)) return raw;

  if (typeof raw === "string" && raw.trim() !== "") {
    try {
      const parsed = JSON.parse(raw);
      return isPlainObject(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }

  return {};
}

export default async function handler(req: any, res: any) {
  // Minimalan CORS
  res.setHeader("Access-Control-Allow-Origin", req.headers?.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

  const debug = {
    nodeEnv: process.env.NODE_ENV || null,
    supabaseUrlHost: safeUrlHost(process.env.SUPABASE_URL),
    hasSupabaseUrl: Boolean((process.env.SUPABASE_URL || "").trim()),
    hasServiceRole: Boolean(
      (process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SUPABASE_SERVICE_KEY ||
        process.env.SUPABASE_SERVICE_ROLE ||
        "").trim()
    ),
  };

  try {
    const body = readJsonBody(req) as CreateOrderBody;

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const items = sanitizeItems(body.items);

    const total_eur_cents = toInt(body.total_eur_cents);
    const fx_rsd_per_eur = toInt(body.fx_rsd_per_eur);

    const currencyRaw = toTrimmedString(body.currency);
    const currency = currencyRaw || "EUR";

    const statusRaw = toTrimmedString(body.status);
    const status = statusRaw || "pending";

    if (!customer_name) return json(res, 400, { ok: false, error: "Missing customer_name", debug });
    if (!customer_phone) return json(res, 400, { ok: false, error: "Missing customer_phone", debug });
    if (!customer_address) return json(res, 400, { ok: false, error: "Missing customer_address", debug });
    if (total_eur_cents === null) return json(res, 400, { ok: false, error: "Missing total_eur_cents", debug });

    const supabase = buildSupabaseAdmin();

    // Legacy compat: total_price (EUR) za stare admin prikaze
    const total_price = total_eur_cents / 100;

    const insertPayload = {
      customer_name,
      customer_phone,
      customer_address,
      items,
      currency,
      total_eur_cents,
      fx_rsd_per_eur,
      status,
      total_price,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(insertPayload)
      .select("id")
      .single();

    if (error) {
      return json(res, 500, { ok: false, error: "DB insert failed", details: error, debug });
    }

    return json(res, 200, { ok: true, id: data?.id || null, debug });
  } catch (err: any) {
    return json(res, 500, { ok: false, error: "Unhandled error", details: extractErrorDetails(err), debug });
  }
}
