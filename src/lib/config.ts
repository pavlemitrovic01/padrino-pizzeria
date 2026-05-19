/**
 * config.ts — PROJECT-SPECIFIC TEMPLATE SWAP POINT (src/ side).
 *
 * Mirror of api/_shared/config.ts for the browser-build context
 * (Vite). When forking Padrino → app#2, edit THIS file + the api/
 * mirror. No other src/ code change required for project-specific
 * values.
 *
 * Contents:
 *   SITE_URL                  — canonical production domain
 *   DEFAULT_BILLING_CITY      — fallback billing city (mirrors api BANKART_FALLBACK_CITY)
 *   DEFAULT_BILLING_POSTCODE  — fallback billing postcode (mirrors api BANKART_FALLBACK_POSTCODE)
 *   DELIVERY_ZONES            — Padrino-specific delivery zones (Budva + 7 surrounding)
 *
 * Out of scope (intentional — kept inline):
 *   - Bankart sessionStorage key      → CartDrawer payment-flow internal
 *   - Bankart PaymentJS DOM div IDs   → CartDrawer DOM-mount internal
 *   - SEO hash links (/#meni etc.)    → URL fragments, not config
 *   - Contact email/phone literals    → DB-driven (site_settings)
 *
 * Real-money note: DELIVERY_ZONES values (minCents/feeCents) are the
 * customer-visible delivery pricing. Server-side create-order.ts
 * validates client-sent feeCents — any divergence here is a real
 * pricing bug. Edit with care.
 */

export const SITE_URL = "https://padrinobudva.com";
export const DEFAULT_BILLING_CITY = "Budva";
export const DEFAULT_BILLING_POSTCODE = "85310";

export type DeliveryZoneKey =
  | "budva"
  | "becici"
  | "rafailovici"
  | "przno"
  | "sveti-stefan"
  | "seoce"
  | "jaz"
  | "lastva";

export type DeliveryZone = {
  key: DeliveryZoneKey;
  label: string;
  minCents: number;
  feeCents: number;
};

export const DELIVERY_ZONES: DeliveryZone[] = [
  { key: "budva", label: "Budva", minCents: 0, feeCents: 0 },
  { key: "becici", label: "Bečići", minCents: 1500, feeCents: 300 },
  { key: "rafailovici", label: "Rafailovići", minCents: 2000, feeCents: 500 },
  { key: "przno", label: "Pržno", minCents: 2500, feeCents: 500 },
  { key: "sveti-stefan", label: "Sveti Stefan", minCents: 2500, feeCents: 500 },
  { key: "seoce", label: "Seoce", minCents: 2000, feeCents: 500 },
  { key: "jaz", label: "Jaz", minCents: 2500, feeCents: 500 },
  { key: "lastva", label: "Lastva", minCents: 3000, feeCents: 500 },
];
