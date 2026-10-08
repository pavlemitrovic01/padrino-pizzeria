/**
 * Order rows for api/create-order.ts — what counts as an item, how it is
 * priced from menu_items, and what the server stores for the kitchen
 * (B23b–B23e). Moved out of create-order.ts in B26 so the handler reads as
 * the request flow; every rule here is covered through the handler tests
 * (api/create-order.test.ts, src/lib/pricingParity.test.tsx).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlainObject, normalizeText, safeInt, safeNumber } from "./parsing.js";
import { crustSizeForItem, stuffedCrustSizeOf } from "./stuffed-crust.js";
import { displayNameOfMenuRow, pizzaSizeOfName } from "./menu-display.js";

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Legacy meta zapis koji frontend ubacuje u items[0]:
 * { total_items: number, order_note?: string }
 */
export function looksLikeLegacyMetaItem(v: unknown) {
  if (!isPlainObject(v)) return false;
  const keys = Object.keys(v);
  if (keys.length === 0) return false;

  const allowed = new Set(["total_items", "order_note", "note"]);
  const itemish = ["quantity", "price_per_item", "name", "menu_item_id", "cart_id", "menuItemId"];
  if (itemish.some((k) => k in v)) return false;

  return keys.every((k) => allowed.has(k));
}

/**
 * A row the kitchen never sees. Telegram (api/telegram-new-order.ts) and the
 * admin panel (src/lib/adminOrdersLib.ts) both hide the rows whose cart_id,
 * name or category is "meta" and list the others, so the server prices every
 * other row (B23c). The frontend's own meta row is
 * { cart_id: "meta", name: "META", category: "meta", note }; legacy meta rows
 * ({ total_items, order_note }) carry no item at all.
 */
export function isMetaRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (looksLikeLegacyMetaItem(v)) return true;
  return [v.cart_id, v.name, v.category].some((x) => normalizeText(toTrimmedString(x)) === "meta");
}

// Far above any real order (prod max: 6 of an item, 10 of an addon) and low
// enough that no quantity × price can overflow the total (a non-finite total
// is stored as NULL and Telegram shows "Ukupno: 0,00 €").
export const MAX_LINE_QUANTITY = 99;

export function isLineQuantity(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= MAX_LINE_QUANTITY;
}

/**
 * B23c: a row that is not meta is food the kitchen will make, so the server
 * must be able to price it exactly: a cart_id (Telegram lists only rows that
 * have one), a menu_item_id, a whole quantity 1–99, and addons that each have
 * an id and a whole quantity 1–99. The kitchen prints max(1, quantity) and
 * lists every addon object, so anything looser (no price, quantity −1 or 0, an
 * addon without id) was stored and made but never charged.
 */
export function isPriceableItemRow(v: unknown): boolean {
  if (!isPlainObject(v)) return false;
  if (!toTrimmedString(v.cart_id)) return false;

  const menuItemId = toTrimmedString(v.menu_item_id) || toTrimmedString(v.menuItemId);
  if (!menuItemId || !isLineQuantity(v.quantity)) return false;

  if (v.addons === undefined || v.addons === null) return true;
  if (!Array.isArray(v.addons)) return false;
  return v.addons.every(
    (a) => isPlainObject(a) && toTrimmedString(a.id) !== "" && isLineQuantity(a.quantity),
  );
}

export type PricingRow = {
  id: string;
  name: string;
  price_eur_cents: number;
};

export function metaNoteOf(meta: Record<string, unknown>): string {
  return toTrimmedString(meta.order_note) || toTrimmedString(meta.note);
}

// The two lines the cart writes into its note (CartDrawer): the payment and
// "Zona: <label>, Dostava: <fee>".
export const CART_PAYMENT_LINE = /^pla[cć]anje\s*:\s*(gotovina|kartica)\s*$/i;
export const CART_ZONE_LINE = /^zona\s*:\s*([^,]*),\s*dostava\s*:.*$/i;

/**
 * The zone label from the cart's "Zona: …, Dostava: …" line. Only for carts
 * loaded before B23e, which send no `delivery_zone` key; the label picks the
 * zone, the fee still comes from the server's table.
 */
export function zoneLabelFromNote(items: unknown[]): string {
  const meta = items.find((it) => isMetaRow(it));
  if (!isPlainObject(meta)) return "";
  for (const line of metaNoteOf(meta).split(/\r?\n/)) {
    const m = line.trim().match(CART_ZONE_LINE);
    if (m) return m[1].trim();
  }
  return "";
}

/**
 * B23e: Telegram reads the order's payment, zone and delivery fee from the
 * first note lines that carry them ("Plaćanje: …", "Zona: …", "Dostava: …";
 * api/telegram-new-order.ts parseMetaFromNote). The customer's own text used to
 * come first, so a note typed as "Plaćanje: Kartica" on a cash order told the
 * driver it was paid. The server now stores a single meta row whose note starts
 * with those lines, written from what it charged. Lines in the cart's own
 * format are dropped (a copy of the server's, or a lie); any other text follows
 * as the customer's note — Telegram reads only the first payment/zone/fee
 * lines, so a "Dostava: 0" typed there shows as a note, never as the fee.
 */
export function withServerMetaRow(items: unknown[], serverLines: string[]): unknown[] {
  const meta = items.find((it) => isMetaRow(it));
  const customerLines = isPlainObject(meta)
    ? metaNoteOf(meta)
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !CART_PAYMENT_LINE.test(line) && !CART_ZONE_LINE.test(line))
    : [];
  const note = [...serverLines, ...customerLines].join("\n");

  const metaRow = {
    cart_id: "meta",
    menu_item_id: null,
    name: "META",
    size: null,
    quantity: 1,
    base_price: null,
    price_per_item: 0,
    addons: [],
    note,
    order_note: note,
    image: "",
    category: "meta",
  };
  return [metaRow, ...items.filter((it) => !isMetaRow(it))];
}

export type MenuRows = {
  prices: Map<string, number>;
  // Row names, for the stuffed-crust size check (B23b).
  names: Map<string, string>;
};

export async function fetchMenuRows(supabase: SupabaseClient, ids: string[]): Promise<MenuRows> {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  if (uniq.length === 0) return { prices: new Map(), names: new Map() };

  const { data, error } = await supabase
    .from("menu_items")
    .select("id,name,price_eur_cents")
    .eq("is_active", true)
    .in("id", uniq);

  if (error) throw new Error(`DB: pricing fetch failed (${error.message})`);

  const prices = new Map<string, number>();
  const names = new Map<string, string>();
  for (const row of Array.isArray(data) ? data : []) {
    const r = row as unknown as PricingRow;
    const id = toTrimmedString((r as unknown as Record<string, unknown>).id);
    const p = safeInt((r as unknown as Record<string, unknown>).price_eur_cents, 0);
    // Include every active row so the existence check (findMissingMenuItemIds)
    // recognizes free addons (price 0, e.g. ketchup/mayo). Price stays accurate
    // (0 for free items); sumAddonsCents already ignores non-positive prices.
    if (id) {
      prices.set(id, p > 0 ? p : 0);
      names.set(id, toTrimmedString((r as unknown as Record<string, unknown>).name));
    }
  }
  return { prices, names };
}

/**
 * B23b: the first addon that is the stuffed crust of the other pizza size
 * (e.g. the 2 € 33 cm crust on a 50 cm pizza), or null. Both sizes come from
 * menu row names — never from the `size` field the client sends.
 *
 * A crust row ordered as an item of its own is refused too: the kitchen lists
 * it as a separate line it could put on any pizza, and the cart never sends it
 * that way (prod: 0 such rows).
 */
export function findCrustSizeMismatch(
  items: Record<string, unknown>[],
  names: Map<string, string>,
): { menuItemId: string; addonId: string } | null {
  for (const item of items) {
    const menuItemId = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);
    const itemName = names.get(menuItemId) ?? "";
    if (stuffedCrustSizeOf(itemName) !== null) return { menuItemId, addonId: "" };
    const fits = crustSizeForItem(itemName);

    const addons = Array.isArray(item.addons) ? item.addons : [];
    for (const a of addons) {
      if (!isPlainObject(a)) continue;
      const addonId = toTrimmedString(a.id);
      const crust = stuffedCrustSizeOf(names.get(addonId) ?? "");
      if (crust !== null && crust !== fits) return { menuItemId, addonId };
    }
  }
  return null;
}

export function sumAddonsCents(addons: unknown, priceMap: Map<string, number>) {
  const list = Array.isArray(addons) ? addons : [];
  let total = 0;

  for (const a of list) {
    if (!isPlainObject(a)) continue;
    const addonId = toTrimmedString(a.id);
    const q = safeInt(a.quantity, 1);
    if (!addonId || q <= 0) continue;

    const cents = priceMap.get(addonId) ?? 0;
    if (cents > 0) total += q * cents;
  }

  return total;
}

export function findMissingMenuItemIds(ids: string[], priceMap: Map<string, number>): string[] {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  return uniq.filter((id) => !priceMap.has(id));
}

/**
 * B23d: Telegram prints each row's name, size and addon names as stored, and
 * the admin panel its price_per_item and addon prices — while the server
 * charges by id. So the server stores what it charged: those fields come from
 * the menu rows. An honest cart already sends exactly this ("Diavolo" + "50"
 * for the row "Diavolo 50 cm", Telegram: "1x Diavolo (50)"), so the kitchen
 * reads the same. Meta rows, and each row's cart_id, quantity, note, image and
 * category, stay as sent.
 */
export function withMenuRowDisplay(
  items: unknown[],
  prices: Map<string, number>,
  names: Map<string, string>,
): unknown[] {
  return items.map((it) => {
    if (!isPlainObject(it) || isMetaRow(it)) return it;

    const menuItemId = toTrimmedString(it.menu_item_id) || toTrimmedString(it.menuItemId);
    const rowName = names.get(menuItemId) ?? "";
    const basePrice = prices.get(menuItemId) ?? 0;

    const addons = Array.isArray(it.addons)
      ? it.addons.map((a) => {
          if (!isPlainObject(a)) return a;
          const addonId = toTrimmedString(a.id);
          return { ...a, name: names.get(addonId) ?? "", price: prices.get(addonId) ?? 0 };
        })
      : it.addons;

    return {
      ...it,
      name: displayNameOfMenuRow(rowName),
      size: pizzaSizeOfName(rowName),
      base_price: basePrice,
      price_per_item: basePrice + sumAddonsCents(addons, prices),
      addons,
    };
  });
}

export function safeTotalCentsFromBody(body: Record<string, unknown>): number {
  const cents = body.total_eur_cents ?? body.totalEurCents;
  const asCents = safeInt(cents, -1);
  if (asCents >= 0) return asCents;

  const price = body.total_price ?? body.totalPrice;
  const n = safeNumber(price, Number.NaN);
  if (Number.isFinite(n) && n >= 0) return Math.round(n * 100);

  return 0;
}
