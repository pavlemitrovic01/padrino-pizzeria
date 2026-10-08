/**
 * Delivery zones for Vercel serverless handlers (api/**) — B23e.
 * Mirror of DELIVERY_ZONES in src/lib/config.ts (separate build context, same
 * table — src/lib/pricingParity.test.tsx asserts both sides hold the same
 * zones and charge the same fee).
 *
 * The server charges delivery from this table, never from the client: the
 * cart sends the zone key, the server looks up the fee and the free-delivery
 * minimum. Before B23e the fee was read from the client's free-text note
 * ("Dostava: X €"), so a hand-edited request could set it to 0.
 */

import { normalizeText } from "./parsing.js";

export type DeliveryZone = {
  key: string;
  label: string;
  /** Subtotal (EUR cents) from which delivery is free; 0 = always free. */
  minCents: number;
  /** Fee (EUR cents) below that subtotal; 0 = always free. */
  feeCents: number;
};

export const DELIVERY_ZONES: readonly DeliveryZone[] = [
  { key: "budva", label: "Budva", minCents: 0, feeCents: 0 },
  { key: "becici", label: "Bečići", minCents: 1500, feeCents: 300 },
  { key: "rafailovici", label: "Rafailovići", minCents: 2000, feeCents: 500 },
  { key: "przno", label: "Pržno", minCents: 2500, feeCents: 500 },
  { key: "sveti-stefan", label: "Sveti Stefan", minCents: 2500, feeCents: 500 },
  { key: "seoce", label: "Seoce", minCents: 2000, feeCents: 500 },
  { key: "jaz", label: "Jaz", minCents: 2500, feeCents: 500 },
  { key: "lastva", label: "Lastva", minCents: 3000, feeCents: 500 },
];

export function findDeliveryZone(key: string): DeliveryZone | null {
  return DELIVERY_ZONES.find((z) => z.key === key) ?? null;
}

/**
 * The zone whose label the client wrote into its note ("Zona: Bečići, …").
 * Only for carts loaded before B23e, which send no zone key; the fee still
 * comes from the table.
 */
export function findDeliveryZoneByLabel(label: string): DeliveryZone | null {
  const n = normalizeText(label);
  if (!n) return null;
  return DELIVERY_ZONES.find((z) => normalizeText(z.label) === n) ?? null;
}

/** Same rule as the cart (src/hooks/cart/useDeliveryZone.ts). */
export function deliveryFeeCents(zone: DeliveryZone, subtotalCents: number): number {
  if (zone.feeCents <= 0 || zone.minCents <= 0) return 0;
  return subtotalCents >= zone.minCents ? 0 : zone.feeCents;
}

/**
 * "3€" for whole euros (what the cart writes today), "1,50€" otherwise —
 * Telegram reads either with its "Dostava: X" pattern.
 */
export function formatDeliveryFee(cents: number): string {
  const c = Math.max(0, Math.trunc(cents));
  if (c % 100 === 0) return `${c / 100}€`;
  return `${(c / 100).toFixed(2).replace(".", ",")}€`;
}
