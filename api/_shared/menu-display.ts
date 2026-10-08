/**
 * How an order row reads in the kitchen, taken from its menu row (B23d).
 * Mirror of the cart's naming rules in src/lib/cartDrawerHelpers.ts
 * (`stripPizzaSizeFromName`, `parsePizzaSizeFromName`) — separate build
 * context, same rules; src/lib/pricingParity.test.tsx asserts both sides read
 * every name the same way.
 *
 * Each pizza size is its own `menu_items` row ("Diavolo 33 cm" / "Diavolo
 * 50 cm"). The cart sends the name without the size and the size on its own
 * ("Diavolo" + "50"), and Telegram prints "1x Diavolo (50)". The server stores
 * the same two fields, read from the row it charged — never from the `name` /
 * `size` the client sent.
 *
 * A row with no "33 cm" / "50 cm" in its name (drinks, sauces) keeps its whole
 * name and has no size. On prod every active pizza row carries its size in the
 * name.
 */

import { normalizeText } from "./parsing.js";
import type { PizzaSize } from "./stuffed-crust.js";

/** "50" / "33" from a menu row name, null for a row without a pizza size. */
export function pizzaSizeOfName(name: string): PizzaSize | null {
  const n = normalizeText(name);
  if (/\b50\s*cm\b/.test(n)) return "50";
  if (/\b33\s*cm\b/.test(n)) return "33";
  return null;
}

/** The menu row name without its pizza size: "Diavolo 50 cm" → "Diavolo". */
export function displayNameOfMenuRow(name: string): string {
  return String(name ?? "")
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}
