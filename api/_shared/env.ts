/**
 * Env access and the service-role Supabase client for Vercel handlers (B26).
 * Before B26 every handler carried its own copy of these (9 × getEnv /
 * buildSupabaseAdmin, 3 × getFirstEnv).
 *
 * The legacy aliases (SUPABASE_SERVICE_KEY, SUPABASE_SERVICE_ROLE, and the
 * NLB_* names read by the Bankart handlers) stay until the Vercel project is
 * checked for which names it actually sets — dropping one it uses would take
 * production down.
 */

import { createClient } from "@supabase/supabase-js";

export function getEnv(name: string): string {
  const v = process.env[name];
  return typeof v === "string" ? v.trim() : "";
}

/** The first of `names` that is set. */
export function getFirstEnv(...names: string[]): string {
  for (const name of names) {
    const value = getEnv(name);
    if (value) return value;
  }
  return "";
}

/** Service-role client; `clientInfo` names the handler in Supabase logs. */
export function buildSupabaseAdmin(clientInfo: string) {
  const SUPABASE_URL = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const SERVICE_ROLE =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": `padrino-vercel-api/${clientInfo}` } },
  });
}
