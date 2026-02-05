import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * HARDENED ENV LOADING
 * - trim() uklanja whitespace / newline / hidden chars
 * - nema više "Invalid supabaseUrl"
 */
const SUPABASE_URL = (process.env.SUPABASE_URL || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
).trim();

if (!SUPABASE_URL) {
  throw new Error("SUPABASE_URL is missing or empty");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing or empty");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const {
      customer_name,
      customer_phone,
      customer_address,
      items,
      total_eur_cents,
      currency = "EUR",
      status = "pending",
    } = req.body || {};

    if (
      !customer_name ||
      !customer_phone ||
      !customer_address ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        ok: false,
        error: "Invalid payload",
      });
    }

    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name,
        customer_phone,
        customer_address,
        items,
        total_eur_cents,
        currency,
        status,
      })
      .select("id")
      .single();

    if (error) {
      console.error("DB INSERT ERROR:", error);
      return res.status(500).json({
        ok: false,
        error: "DB insert failed",
      });
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
    });
  } catch (err: any) {
    console.error("CREATE ORDER FATAL:", err);

    return res.status(500).json({
      ok: false,
      error: "Server error",
    });
  }
}
