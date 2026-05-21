/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Card payments (optional). Runtime: VITE_BANKART_PAYMENTJS_ENABLED + VITE_BANKART_PAYMENTJS_PUBLIC_KEY.
  readonly VITE_BANKART_PAYMENTJS_ENABLED?: string;
  readonly VITE_BANKART_PAYMENTJS_PUBLIC_KEY?: string;

  // Build-time git SHA injected via vite.config.ts define (from VERCEL_GIT_COMMIT_SHA).
  // "unknown" when building locally (system env var not set outside Vercel).
  readonly VITE_BUILD_SHA?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}