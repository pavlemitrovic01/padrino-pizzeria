/**
 * Stuffed-crust size rules for Vercel serverless handlers (api/**).
 * Mirror of the crust helpers in src/lib/cartDrawerHelpers.ts (separate build
 * context, same rules — src/lib/pricingParity.test.tsx asserts both sides
 * read every name the same way).
 *
 * Each pizza size has its own crust row in `menu_items`: "Ivice punjene sirom"
 * (33 cm, 2 €) and "Ivice punjene sirom 50 cm" (4 €). The cart only offers the
 * row matching the pizza (B23a); the server enforces it (B23b), so a request
 * edited to put the 2 € crust on a 50 cm pizza is refused.
 *
 * Sizes come from menu row NAMES, never from the `size` field the client
 * sends: a pizza row is "… 33 cm" / "… 50 cm", and the 50 cm crust row must
 * keep "50 cm" in its name, or it is taken for a 33 cm crust.
 */

import { normalizeText } from "./parsing.js";

export type PizzaSize = "33" | "50";

function isStuffedCrustName(name: string): boolean {
  const n = normalizeText(name);
  if (!n) return false;

  if (n.includes("ivice punjene")) return true;
  if (n.includes("punjene ivice")) return true;
  if (n.includes("ivica punjena")) return true;
  if (n.includes("punjena ivica")) return true;

  return n === "rub";
}

function hasSize50(name: string): boolean {
  return /\b50\s*cm\b/.test(normalizeText(name));
}

/** The pizza size a stuffed-crust row belongs to; null for any other addon. */
export function stuffedCrustSizeOf(name: string): PizzaSize | null {
  if (!isStuffedCrustName(name)) return null;
  return hasSize50(name) ? "50" : "33";
}

/**
 * The crust size that fits an ordered item, from its menu row name: "50" for a
 * 50 cm pizza, "33" for anything else — the same row the cart offers.
 */
export function crustSizeForItem(itemName: string): PizzaSize {
  return hasSize50(itemName) ? "50" : "33";
}
