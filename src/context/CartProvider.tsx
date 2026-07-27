/* eslint-disable react-refresh/only-export-components */

// Named export useCart kao alias na postojeći hook
export { useCart } from "./useCart";

import { ReactNode, useMemo, useState } from "react";
import {
  AddToCartOptions,
  CartAddon,
  CartContext,
  CartItem,
  CheckoutState,
  OrderSnapshot,
  OrderStatus,
  PaymentMethod,
  PizzaSize,
  PizzaVariant,
  isPizzaSize,
} from "./CartContext";
import { toSafeInt } from "../lib/money";
import {
  trackAddToCart,
  trackRemoveFromCart,
  trackAddPaymentInfo,
} from "../lib/analytics";
import {
  buildCartLineId,
  isStuffedCrustAddonName,
  stripPizzaSizeFromName,
  stuffedCrustPriceForSize,
} from "../lib/cartDrawerHelpers";

/**
 * Cart row key (B20).
 *
 * The key encodes the whole configuration — menu item, size, addons, note —
 * so every writer that changes one of those must re-derive it. A row left
 * holding a stale key no longer describes itself: a later identical add would
 * land as a second row instead of merging into this one.
 *
 * Before B20 the key was the size-stripped name, which made a 33 cm and a
 * 50 cm of the same pizza the same row. Adding the second size did not add it
 * — it incremented the first one, so the customer got two of the wrong size at
 * the wrong price (the server prices by `menu_item_id`, which stayed behind).
 */
function withLineId(item: CartItem): CartItem {
  return {
    ...item,
    id: buildCartLineId({
      identity: item.menuItemId ?? item.baseKey ?? item.name,
      size: item.size ?? null,
      addons: item.addons,
      note: item.note ?? "",
    }),
  };
}

function parsePizzaSizeFromText(text: string): PizzaSize | null {
  const t = String(text ?? "").toLowerCase();
  if (/\b50\s*cm\b|pizza\s*50\s*cm[.,]?/i.test(t)) return "50";
  if (/\b33\s*cm\b|pizza\s*33\s*cm[.,]?/i.test(t)) return "33";
  return null;
}

function isPizzaLike(category: string, name: string) {
  return (
    category === "Pizza 33 cm" ||
    category === "Pizza 50 cm" ||
    /pizza/i.test(category) ||
    /33\s*cm|50\s*cm/i.test(name)
  );
}

function adjustAddonsForSize(size: PizzaSize | null | undefined, addons: CartAddon[]): CartAddon[] {
  if (!addons.length) return addons;

  const targetPrice = stuffedCrustPriceForSize(size);

  let changed = false;
  const next = addons.map((a) => {
    if (!isStuffedCrustAddonName(a.name)) return a;

    const qty = Math.max(1, toSafeInt(a.quantity ?? 1, 1));
    const currentPrice = toSafeInt(a.price ?? 0, 0);

    if (currentPrice === targetPrice && qty === a.quantity) return a;

    changed = true;
    return { ...a, price: targetPrice, quantity: qty };
  });

  return changed ? next : addons;
}
/** ---------------------------------------------------------------------- */

function computeAddonsTotal(addons?: CartAddon[]): number {
  if (!addons || addons.length === 0) return 0;

  return addons.reduce((sum, a) => {
    const qty = Math.max(1, toSafeInt((a as CartAddon).quantity ?? 1, 1));
    const price = toSafeInt(a.price ?? 0, 0);
    return sum + price * qty;
  }, 0);
}

function pickBestSize(variants?: Partial<Record<PizzaSize, PizzaVariant>>): PizzaSize | null {
  if (variants?.["33"]) return "33";
  if (variants?.["50"]) return "50";
  return null;
}

function getBasePrice(item: CartItem): number {
  if (typeof item.basePrice === "number" && Number.isFinite(item.basePrice)) {
    return toSafeInt(item.basePrice, 0);
  }

  const addonsTotal = computeAddonsTotal(item.addons);
  const derived = toSafeInt(item.price ?? 0, 0) - addonsTotal;

  return Math.max(0, derived);
}

function normalizeIncomingItem(item: CartItem): CartItem {
  const looksLikePizza = isPizzaLike(item.category, item.name);

  const normalizedAddons: CartAddon[] = (item.addons ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    price: toSafeInt(a.price, 0),
    quantity: Math.max(1, toSafeInt(a.quantity ?? 1, 1)),
  }));

  const incomingPrice = toSafeInt(item.price ?? 0, 0);

  if (!looksLikePizza) {
    const basePrice = getBasePrice({ ...item, addons: normalizedAddons } as CartItem);
    const finalPrice = basePrice + computeAddonsTotal(normalizedAddons);

    return withLineId({
      ...item,
      price: finalPrice,
      basePrice,
      addons: normalizedAddons,
      size: null,
      baseKey: item.baseKey ?? item.name,
      menuItemId: item.menuItemId ?? item.id,
      variants: item.variants ?? undefined,
      note: item.note ?? "",
    });
  }

  const baseKey = item.baseKey ?? stripPizzaSizeFromName(item.name);

  const detected = item.size ?? parsePizzaSizeFromText(item.name);
  const detectedSize: PizzaSize | null = isPizzaSize(detected) ? detected : null;

  const incomingMenuItemId = item.menuItemId ?? item.id;
  const incomingBasePrice = toSafeInt(item.basePrice ?? incomingPrice, 0);

  const variants: Partial<Record<PizzaSize, PizzaVariant>> = {
    ...(item.variants ?? {}),
  };

  if (detectedSize) {
    variants[detectedSize] = {
      menuItemId: incomingMenuItemId,
      price: incomingBasePrice,
      category: item.category,
    };
  }

  const finalSize = detectedSize ?? pickBestSize(variants);
  const chosenVariant = finalSize ? variants[finalSize] : undefined;

  const basePrice = toSafeInt(chosenVariant?.price ?? incomingBasePrice, 0);
  const menuItemId = chosenVariant?.menuItemId ?? incomingMenuItemId;
  const category = chosenVariant?.category ?? item.category;

  const adjustedAddons = adjustAddonsForSize(finalSize, normalizedAddons);
  const finalPrice = basePrice + computeAddonsTotal(adjustedAddons);

  // `name` stays the size-stripped display name — the cart renders `size` as
  // its own line ("Veličina: 50 cm"), so the suffix would read twice.
  return withLineId({
    ...item,
    name: baseKey,
    baseKey,
    size: finalSize,
    menuItemId,
    variants,
    basePrice,
    addons: adjustedAddons,
    price: finalPrice,
    category,
    note: item.note ?? "",
  });
}

/** -------------------- ORDER / PAYMENT (PRE-NLB PREP) -------------------- */
function safeUuid(): string {
  try {
    const c = globalThis.crypto as Crypto | undefined;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    // ignore
  }
  // fallback: dovoljno dobro za client-side draft ID
  return `order_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}
/** ---------------------------------------------------------------------- */

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  // ✅ Checkout state (default A = cash)
  const [checkout, setCheckout] = useState<CheckoutState>(() => ({
    paymentMethod: "cash",
    status: "draft",
    snapshot: null,
    error: null,
  }));

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addToCart = (rawItem: CartItem, options?: AddToCartOptions) => {
    const item = normalizeIncomingItem(rawItem);

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === item.id);

      // A matching row key means the customer picked the identical thing
      // again — same item, size, addons and note. The only thing that changes
      // is how many. Quantity comes from the incoming item (≥1) so the detail
      // sheet can send pizzaQty>1 without it being dropped.
      //
      // Addons are deliberately NOT merged: they are per-item and multiplied
      // by quantity in `totalPrice`, so summing them here would charge the
      // second pizza twice for the same sauce. Anything that differs in
      // addons or note is a different key and lands as its own row.
      if (existingIndex >= 0) {
        const incomingQty = Math.max(1, toSafeInt(item.quantity ?? 1, 1));

        return prev.map((i, idx) =>
          idx === existingIndex ? { ...i, quantity: i.quantity + incomingQty } : i,
        );
      }

      return [...prev, item];
    });

    if (options?.openCart !== false) {
      setIsOpen(true);
    }

    trackAddToCart({
      // The row key is per-configuration, so it would split GA4 reporting into
      // one item_id per addon combination. Report the menu item instead.
      item_id: item.menuItemId ?? item.id,
      item_name: item.name,
      price: item.price / 100,
      quantity: Math.max(1, toSafeInt(item.quantity ?? 1, 1)),
    });
  };

  /**
   * Pure replacement of an existing cart item by id. Used by the edit-reopen
   * flow (L8.4) where MenuItemDetailSheet is opened pre-filled from a cart
   * item and saves a new snapshot of size/qty/addons/note.
   *
   * Differs from addToCart: the replacement is normalized (same pipeline as
   * addToCart) and swapped in place at the matching index rather than added.
   *
   * If id is not found in the cart, the function logs a warning and no-ops —
   * shouldn't happen in practice (UI only emits this for cart items) but
   * avoids silent state corruption if a stale id leaks through.
   *
   * No GA4 events fire here — edits are not new conversions.
   */
  const updateItemInCart = (id: string, replacement: CartItem) => {
    const normalized = normalizeIncomingItem(replacement);
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === id);
      if (idx < 0) {
        // eslint-disable-next-line no-console
        console.warn("updateItemInCart: cart item not found for id", id);
        return prev;
      }

      // The edit re-keys the row, so it can land on a configuration another
      // row already holds — switching a 50 cm down to 33 cm when a 33 cm with
      // the same addons and note is in the cart. Fold that duplicate into the
      // edited row: two rows sharing a key would collide as React keys and
      // make qty +/- and remove hit both at once.
      const next = [...prev];
      next[idx] = normalized;

      const duplicateIdx = next.findIndex((i, at) => at !== idx && i.id === normalized.id);
      if (duplicateIdx >= 0) {
        next[idx] = {
          ...normalized,
          quantity: normalized.quantity + next[duplicateIdx].quantity,
        };
        next.splice(duplicateIdx, 1);
      }

      return next;
    });
  };

  const increase = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i)));
  };

  const decrease = (id: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    const removing = items.find((i) => i.id === id);
    if (removing) {
      trackRemoveFromCart({
        // Same reasoning as add_to_cart: report the menu item, not the row key.
        item_id: removing.menuItemId ?? removing.id,
        item_name: removing.name,
        price: removing.price / 100,
        quantity: removing.quantity,
      });
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const changeSize = (id: string, size: PizzaSize, next: PizzaVariant) => {
    setItems((prev) => {
      const current = prev.find((i) => i.id === id);
      if (!current) return prev;

      const baseKey = current.baseKey ?? current.name;
      const rawAddons = current.addons ?? [];
      const addons = adjustAddonsForSize(size, rawAddons);

      const mergedVariants: Partial<Record<PizzaSize, PizzaVariant>> = {
        ...(current.variants ?? {}),
        [size]: next,
      };

      const basePrice = toSafeInt(next.price, 0);
      const finalPrice = basePrice + computeAddonsTotal(addons);

      return prev.map((i) => {
        if (i.id !== id) return i;

        return withLineId({
          ...i,
          baseKey,
          name: baseKey,
          size,
          menuItemId: next.menuItemId,
          category: next.category,
          variants: mergedVariants,
          basePrice,
          addons,
          price: finalPrice,
          note: i.note ?? "",
        });
      });
    });
  };

  const addAddonToItem = (id: string, addon: Omit<CartAddon, "quantity">) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];

        const normalizedAddon: Omit<CartAddon, "quantity"> = isStuffedCrustAddonName(addon.name)
          ? { ...addon, price: stuffedCrustPriceForSize(i.size ?? "33") }
          : { ...addon, price: toSafeInt(addon.price, 0) };

        const found = existing.find((a) => a.id === normalizedAddon.id);

        let nextAddons: CartAddon[];
        if (found) {
          nextAddons = existing.map((a) =>
            a.id === normalizedAddon.id
              ? { ...a, price: normalizedAddon.price, quantity: a.quantity + 1 }
              : a
          );
        } else {
          nextAddons = [...existing, { ...normalizedAddon, quantity: 1 }];
        }

        nextAddons = adjustAddonsForSize(i.size ?? null, nextAddons);

        const basePrice = getBasePrice(i);
        const finalPrice = basePrice + computeAddonsTotal(nextAddons);

        return withLineId({ ...i, addons: nextAddons, basePrice, price: finalPrice, note: i.note ?? "" });
      })
    );
  };

  const increaseAddonQuantity = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        let nextAddons = existing.map((a) =>
          a.id === addonId ? { ...a, quantity: a.quantity + 1 } : a
        );
        nextAddons = adjustAddonsForSize(i.size ?? null, nextAddons);

        const basePrice = getBasePrice(i);
        const finalPrice = basePrice + computeAddonsTotal(nextAddons);

        return withLineId({ ...i, addons: nextAddons, basePrice, price: finalPrice });
      })
    );
  };

  const decreaseAddonQuantity = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        let nextAddons = existing
          .map((a) => (a.id === addonId ? { ...a, quantity: a.quantity - 1 } : a))
          .filter((a) => a.quantity > 0);

        nextAddons = adjustAddonsForSize(i.size ?? null, nextAddons);

        const basePrice = getBasePrice(i);
        const finalPrice = basePrice + computeAddonsTotal(nextAddons);

        return withLineId({ ...i, addons: nextAddons, basePrice, price: finalPrice });
      })
    );
  };

  const removeAddonFromItem = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        let nextAddons = existing.filter((a) => a.id !== addonId);
        nextAddons = adjustAddonsForSize(i.size ?? null, nextAddons);

        const basePrice = getBasePrice(i);
        const finalPrice = basePrice + computeAddonsTotal(nextAddons);

        return withLineId({ ...i, addons: nextAddons, basePrice, price: finalPrice });
      })
    );
  };

  const setItemNote = (id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? withLineId({ ...i, note }) : i)));
  };

  const clearCart = () => setItems([]);
  const resetCart = () => setItems([]);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + toSafeInt(i.price, 0) * i.quantity, 0),
    [items]
  );

  /** -------------------- CHECKOUT API (PRE-NLB) -------------------- */
  const setPaymentMethod = (method: PaymentMethod) => {
    setCheckout((prev) => ({
      ...prev,
      paymentMethod: method,
      // kad promeni metod, resetujemo error ali snapshot ostaje dok user eksplicitno ne resetuje
      error: null,
    }));
    trackAddPaymentInfo(method, totalPrice);
  };

  const setCheckoutStatus = (status: OrderStatus) => {
    setCheckout((prev) => ({ ...prev, status }));
  };

  const setCheckoutError = (message: string | null) => {
    setCheckout((prev) => ({ ...prev, error: message }));
  };

  const resetCheckout = () => {
    setCheckout({
      paymentMethod: "cash",
      status: "draft",
      snapshot: null,
      error: null,
    });
  };

  const createOrderSnapshot = (): OrderSnapshot => {
    const method = checkout.paymentMethod ?? "cash";
    const nextStatus: OrderStatus = method === "card" ? "pending_payment" : "draft";

    const snapshot: OrderSnapshot = {
      id: safeUuid(),
      createdAt: nowIso(),
      items: items.map((i) => ({
        ...i,
        // normalizujemo note da UI uvek ima string
        note: i.note ?? "",
      })),
      totalItems,
      totalPrice,
      paymentMethod: method,
      status: nextStatus,
      note: "",
      gateway: {
        provider: "UNKNOWN",
      },
    };

    // zaključavamo snapshot u checkout state i sinhronizujemo status
    setCheckout((prev) => ({
      ...prev,
      status: nextStatus,
      snapshot,
      error: null,
    }));

    return snapshot;
  };
  /** -------------------------------------------------------------- */

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        totalItems,
        totalPrice,
        openCart,
        closeCart,
        addToCart,
        updateItemInCart,
        increase,
        decrease,
        removeFromCart,
        changeSize,
        addAddonToItem,
        increaseAddonQuantity,
        decreaseAddonQuantity,
        removeAddonFromItem,
        setItemNote,
        clearCart,
        resetCart,

        // ✅ checkout (pre NLB)
        checkout,
        setPaymentMethod,
        setCheckoutStatus,
        setCheckoutError,
        createOrderSnapshot,
        resetCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}