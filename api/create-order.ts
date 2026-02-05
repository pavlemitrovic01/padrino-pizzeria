import type { VercelRequest, VercelResponse } from "vercel";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  }
);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed",
    });
  }

  try {
    const {
      customer_name,
      customer_phone,
      customer_address,
      items,
      currency = "EUR",
      status = "pending",
    } = req.body ?? {};

    // ---------- HARD VALIDATION ----------
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

    // ---------- PRICE CALCULATION (SOURCE OF TRUTH) ----------
    let total_eur_cents = 0;

    for (const item of items) {
      if (
        typeof item.quantity !== "number" ||
        typeof item.price_per_item !== "number"
      ) {
        return res.status(400).json({
          ok: false,
          error: "Invalid item structure",
        });
      }

      total_eur_cents += item.quantity * item.price_per_item;
    }

    if (total_eur_cents <= 0) {
      return res.status(400).json({
        ok: false,
        error: "Total price must be greater than zero",
      });
    }

    // ---------- DB INSERT ----------
    const { data, error } = await supabase
      .from("orders")
      .insert({
        customer_name,
        customer_phone,
        customer_address,
        items,
        currency,
        status,
        total_eur_cents,
        total_price: (total_eur_cents / 100).toFixed(2),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        ok: false,
        error: "Database insert failed",
      });
    }

    return res.status(200).json({
      ok: true,
      id: data.id,
    });
  } catch (err: any) {
    console.error("create-order fatal error:", err);
    return res.status(500).json({
      ok: false,
      error: "Internal server error",
    });
  }
}
