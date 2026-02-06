import type { VercelRequest, VercelResponse } from "vercel";
import { createClient } from "@supabase/supabase-js";

function json(res: VercelResponse, status: number, body: any) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.send(JSON.stringify(body));
}

function toTrimmedString(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function getEnv(name: string): string {
  return toTrimmedString((process.env as any)?.[name]);
}

function getSupabase() {
  // Primarni (server-side) env:
  const rawUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const rawKey =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") ||
    getEnv("SUPABASE_SERVICE_KEY") ||
    getEnv("SUPABASE_SERVICE_ROLE");

  if (!rawUrl || !rawKey) {
    // Fail fast (ali bez leakovanja vrijednosti)
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  // Trim + striktna validacija URL-a (poznati bug: razmaci -> 'Provided URL is malformed')
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new Error("Invalid supabaseUrl: Provided URL is malformed.");
  }

  // Minimalna sanity provjera – sprečava slučajne copy/paste greške
  if (!u.hostname.endsWith("supabase.co")) {
    throw new Error("Invalid SUPABASE_URL: expected a *.supabase.co host.");
  }

  return createClient(rawUrl, rawKey, {
    auth: { persistSession: false },
  });
}

// Singleton (jedna instanca po cold start-u)
const supabase = getSupabase();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);

    const items = Array.isArray(body.items) ? body.items : [];

    // legacy/default
    const currency = toTrimmedString(body.currency) || "EUR";
    const status = toTrimmedString(body.status) || "pending";

    // ---------- HARD VALIDATION ----------
    if (
      customer_name.length < 2 ||
      customer_phone.length < 6 ||
      customer_address.length < 5 ||
      items.length === 0
    ) {
      return json(res, 400, { ok: false, error: "Invalid payload" });
    }

    // ---------- PRICE CALCULATION (SOURCE OF TRUTH) ----------
    let total_eur_cents = 0;

    for (const item of items) {
      const quantity = (item as any)?.quantity;
      const price_per_item = (item as any)?.price_per_item;

      if (typeof quantity !== "number" || typeof price_per_item !== "number") {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }

      // stability: reject NaN / Infinity / negatives
      if (!Number.isFinite(quantity) || !Number.isFinite(price_per_item)) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }
      if (quantity <= 0 || price_per_item < 0) {
        return json(res, 400, { ok: false, error: "Invalid item values" });
      }

      total_eur_cents += Math.round(quantity * price_per_item);
    }

    if (!Number.isFinite(total_eur_cents) || total_eur_cents <= 0) {
      return json(res, 400, {
        ok: false,
        error: "Total price must be greater than zero",
      });
    }

    // ---------- DB INSERT ----------
    const insertRow: Record<string, any> = {
      customer_name,
      customer_phone,
      customer_address,
      items,
      currency,
      status,
      total_eur_cents,
      // legacy: čuvamo kao number (ne string) da se ne lomi numeric kolona
      total_price: total_eur_cents / 100,
    };

    const { data, error } = await supabase
      .from("orders")
      .insert(insertRow)
      .select("id")
      .single();

    if (error) {
      // Ne vraćamo error detalje klijentu (stability + security)
      console.error("Supabase insert error:", error);
      return json(res, 500, { ok: false, error: "Database insert failed" });
    }

    return json(res, 200, { ok: true, id: data.id });
  } catch (err: any) {
    console.error("create-order fatal error:", err);
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
