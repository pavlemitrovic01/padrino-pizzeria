/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Card payments (optional). Runtime toggle: VITE_BANKART_PAYMENTJS_ENABLED + VITE_BANKART_PAYMENTJS_PUBLIC_KEY.
  readonly VITE_CARD_PAYMENTS_ENABLED?: string;
  readonly VITE_BANKART_PAYMENTJS_ENABLED?: string;
  readonly VITE_BANKART_PAYMENTJS_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}