import type { VercelRequest, VercelResponse } from "@vercel/node";
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

function sendJson(res: VercelResponse, status: number, body: unknown) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.trunc(n);
  }
  return null;
}

function safeUrlHost(value: string | null | undefined): string | null {
  try {
    if (!value) return null;
    const u = new URL(String(value).trim());
    return u.host;
  } catch {
    return null;
  }
}

function readJsonBody(req: VercelRequest): Record<string, unknown> {
  const raw = (req as any)?.body;

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

function buildSupabaseAdmin() {
  const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
  const SERVICE_ROLE = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

/**
 * Best-effort total calc (u centima), bez nagađanja o strukturi stavki:
 * - podržava item.price_eur_cents i item.quantity
 * - addons ako imaju price_eur_cents/price i quantity
 * Ako nešto fali, ignoriše taj dio (ne ruši request).
 */
function calcTotalEurCents(items: any[]): number {
  let total = 0;

  for (const it of items) {
    const qty = Math.max(1, toInt(it?.quantity) ?? 1);

    // primary price on item
    const priceItem =
      toInt(it?.price_eur_cents) ??
      toInt(it?.price_per_item) ?? // ako je već u centima
      toInt(it?.base_price) ?? // (u vašem sistemu često centi)
      null;

    if (typeof priceItem === "number" && Number.isFinite(priceItem)) {
      total += priceItem * qty;
    }

    const addons = Array.isArray(it?.addons) ? it.addons : [];
    for (const ad of addons) {
      const aq = Math.max(1, toInt(ad?.quantity) ?? 1);

      // addon price može biti "price_eur_cents" ili "price" (često centi u vašim podacima)
      const ap =
        toInt(ad?.price_eur_cents) ??
        toInt(ad?.price) ??
        null;

      if (typeof ap === "number" && Number.isFinite(ap)) {
        total += ap * aq;
      }
    }
  }

  return total;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS (minimalno i stabilno)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Method Not Allowed" });

  const debug = {
    nodeEnv: process.env.NODE_ENV || null,
    supabaseUrlHost: safeUrlHost(process.env.SUPABASE_URL),
    hasSupabaseUrl: Boolean((process.env.SUPABASE_URL || "").trim()),
    hasServiceRole: Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim()),
  };

  try {
    const body = readJsonBody(req) as CreateOrderBody;

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const items = Array.isArray(body.items) ? (body.items as any[]) : [];

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    const fx_rsd_per_eur = toInt(body.fx_rsd_per_eur);
    const totalProvided = toInt(body.total_eur_cents);
    const totalCalculated = calcTotalEurCents(items);
    const total_eur_cents = (totalProvided ?? totalCalculated) || null;

    if (!customer_name || !customer_phone || !customer_address) {
      return sendJson(res, 400, {
        ok: false,
        error: "Validation failed",
        details: {
          customer_name: Boolean(customer_name),
          customer_phone: Boolean(customer_phone),
          customer_address: Boolean(customer_address),
        },
        debug,
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return sendJson(res, 400, { ok: false, error: "Validation failed", details: "items must be a non-empty array", debug });
    }

    const supabase = buildSupabaseAdmin();

    const insertPayload: Record<string, any> = {
      customer_name,
      customer_phone,
      customer_address,
      items,
      status,
      currency,
      total_eur_cents,
      fx_rsd_per_eur,
    };

    // NOTE: total_price ne diramo — ako imate trigger, neka radi svoje.
    const { data, error } = await supabase
      .from("orders")
      .insert([insertPayload])
      .select("id")
      .single();

    if (error) {
      // Ovo mora da izađe u Vercel Logs
      console.error("[create-order] DB insert failed", {
        message: error.message,
        details: (error as any).details || null,
        hint: (error as any).hint || null,
        code: (error as any).code || null,
        debug,
      });

      return sendJson(res, 500, {
        ok: false,
        error: "DB insert failed",
        details: {
          message: error.message,
          details: (error as any).details || null,
          hint: (error as any).hint || null,
          code: (error as any).code || null,
        },
        debug,
      });
    }

    return sendJson(res, 200, { ok: true, id: data?.id ?? null });
  } catch (err: any) {
    // Ovo mora da izađe u Vercel Logs
    console.error("[create-order] Unhandled error", {
      name: err?.name || null,
      message: err?.message || String(err),
      debug,
      cause: err?.cause ? { name: err.cause?.name || null, message: err.cause?.message || String(err.cause), code: err.cause?.code || null } : null,
    });

    return sendJson(res, 500, {
      ok: false,
      error: "Server error",
      details: {
        name: err?.name || null,
        message: err?.message || String(err),
        cause: err?.cause
          ? {
              name: err.cause?.name || null,
              message: err.cause?.message || String(err.cause),
              code: err.cause?.code || null,
            }
          : null,
      },
      debug,
    });
  }
}
