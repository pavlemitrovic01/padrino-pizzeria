import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error("Supabase Vite env nedostaje: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

/**
 * Admin-auth client:
 * - mora da čuva sesiju (localStorage)
 * - mora da čita sesiju iz URL-a posle magic link-a
 * - ne utiče na checkout/client hardening, jer ga koristimo samo u admin delu
 */
export const supabaseAdminAuth = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    storageKey: "padrino-admin-auth",
  },
});
