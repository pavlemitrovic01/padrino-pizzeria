import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type CreateOrderBody = {
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;

  items?: unknown;

  // očekujemo EUR cente (int)
  total_eur_cents?: unknown;

  // opcionalno (default)
  currency?: unknown; // "EUR"
  status?: unknown; // "pending"
  fx_rsd_per_eur?: unknown; // number | null
};

function json(res: VercelResponse, status: number, body: any) {
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
  // Ne radimo duboku validaciju (da ne uvodimo krhkost),
  // ali moramo zahtijevati da bude JSON niz.
  if (Array.isArray(v)) return v;
  return [];
}

function getEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing env: ${name}`);
  return val;
}

function buildSupabaseAdmin() {
  // Preferiramo server-side env nazive (Vercel)
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SERVICE_ROLE =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE;

  if (!SUPABASE_URL) throw new Error("Missing env: SUPABASE_URL (or VITE_SUPABASE_URL)");
  if (!SERVICE_ROLE) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/create-order" } },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // CORS (sigurno i minimalno) – da radi i sa preview domena ako treba
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

    const body: CreateOrderBody = isPlainObject(req.body) ? (req.body as any) : {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const items = sanitizeItems(body.items);

    const total_eur_cents = toInt(body.total_eur_cents);

    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    // fx_rsd_per_eur može biti number ili null (ostavi null ako nevalidno)
    const fx_rsd_per_eur = (() => {
      if (body.fx_rsd_per_eur === null || body.fx_rsd_per_eur === undefined) return null;
      const n = typeof body.fx_rsd_per_eur === "number" ? body.fx_rsd_per_eur : Number(body.fx_rsd_per_eur);
      return Number.isFinite(n) ? n : null;
    })();

    // Minimalna validacija (stability-first)
    if (customer_name.length < 2) return json(res, 400, { ok: false, error: "Invalid customer_name" });
    if (customer_phone.length < 6) return json(res, 400, { ok: false, error: "Invalid customer_phone" });
    if (customer_address.length < 5) return json(res, 400, { ok: false, error: "Invalid customer_address" });
    if (!Array.isArray(items) || items.length === 0) return json(res, 400, { ok: false, error: "Items required" });
    if (total_eur_cents === null || total_eur_cents <= 0)
      return json(res, 400, { ok: false, error: "Invalid total_eur_cents" });

    const supabaseAdmin = buildSupabaseAdmin();

    // Bitno:
    // - total_price ostavljamo NULL (ako postoji trigger/legacy logika)
    // - total_eur_cents je izvor istine (cente)
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
      // Ne vraćamo interne detalje previše, ali dovoljno za debug
      return json(res, 500, {
        ok: false,
        error: error.message || "Insert failed",
        code: error.code || null,
      });
    }

    const id = String((data as any)?.id ?? "").trim();
    if (!id) return json(res, 500, { ok: false, error: "Insert ok but no id returned" });

    return json(res, 200, { ok: true, id });
  } catch (e: any) {
    return json(res, 500, { ok: false, error: String(e?.message || e) });
  }
}
