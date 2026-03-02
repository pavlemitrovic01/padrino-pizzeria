/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // ✅ Toggle za kartice (default: undefined/false)
  // Na Vercel-u postavi: VITE_CARD_PAYMENTS_ENABLED="true" kad NLB bude spreman.
  readonly VITE_CARD_PAYMENTS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}