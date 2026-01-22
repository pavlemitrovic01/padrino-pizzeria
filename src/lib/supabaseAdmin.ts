import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY!;

/**
 * ⚠️ DEV ONLY
 * This client bypasses RLS.
 * Do NOT use in public frontend in production.
 */
export const supabaseAdmin = createClient(
  supabaseUrl,
  serviceRoleKey
);

