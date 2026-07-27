// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

// GA4 is a side channel here — mocked so the cart state stays the subject,
// and so the reported item_id can be asserted directly.
vi.mock("../lib/analytics", () => ({
  trackAddToCart: vi.fn(),
  trackRemoveFromCart: vi.fn(),
  trackAddPaymentInfo: vi.fn(),
}));

import { CartProvider } from "./CartProvider";
import { useCart } from "./useCart";
import { trackAddToCart } from "../lib/analytics";
import type { CartAddon, CartItem, PizzaSize } from "./CartContext";

/**
 * B20 — cart line identity.
 *
 * A cart row is one configuration: menu item + size + addons + note. Two adds
 * fold into one row only when all of those match. The bug this locks down: the
 * row key used to be the size-stripped name, so a 50 cm added on top of a
 * 33 cm did not appear — it incremented the 33 cm, and the customer got two of
 * the wrong size at the wrong price.
 *
 * Fixtures mirror what MenuItemDetailSheet actually emits on confirm.
 */

const VARIANTS: Record<PizzaSize, { menuItemId: string; price: number; category: string }> = {
  "33": { menuItemId: "menu-kapricoza-33", price: 700, category: "Pizza 33 cm" },
  "50": { menuItemId: "menu-kapricoza-50", price: 1200, category: "Pizza 50 cm" },
};

const GARLIC: CartAddon = { id: "addon-garlic", name: "Garlik sos", price: 100, quantity: 1 };
const KETCHUP: CartAddon = { id: "addon-ketchup", name: "Kečap", price: 50, quantity: 1 };

function pizza(size: PizzaSize, overrides: Partial<CartItem> = {}): CartItem {
  const variant = VARIANTS[size];
  return {
    id: variant.menuItemId,
    name: "Kapričoza",
    price: variant.price,
    image: "/menu/kapricoza.webp",
    description: "",
    category: variant.category,
    quantity: 1,
    size,
    baseKey: "Kapričoza",
    menuItemId: variant.menuItemId,
    basePrice: variant.price,
    variants: { [size]: variant },
    ...overrides,
  };
}

function drink(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "menu-cola",
    name: "Coca Cola",
    price: 200,
    image: "/menu/coca-cola.webp",
    description: "",
    category: "Piće",
    quantity: 1,
    size: null,
    baseKey: "Coca Cola",
    menuItemId: "menu-cola",
    basePrice: 200,
    ...overrides,
  };
}

function setup() {
  return renderHook(() => useCart(), {
    wrapper: ({ children }: { children: ReactNode }) => <CartProvider>{children}</CartProvider>,
  });
}

/** addToCart with the drawer suppressed — irrelevant to row identity. */
function add(cart: ReturnType<typeof setup>, item: CartItem) {
  act(() => {
    cart.result.current.addToCart(item, { openCart: false });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CartProvider — row identity", () => {
  it("keeps 33 cm and 50 cm of the same pizza as separate rows", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("50"));

    const { items, totalPrice, totalItems } = cart.result.current;

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.size)).toEqual(["33", "50"]);
    expect(items.map((i) => i.menuItemId)).toEqual([
      "menu-kapricoza-33",
      "menu-kapricoza-50",
    ]);
    expect(items.map((i) => i.basePrice)).toEqual([700, 1200]);
    expect(items[0].id).not.toBe(items[1].id);
    expect(items.every((i) => i.quantity === 1)).toBe(true);
    expect(totalItems).toBe(2);
    expect(totalPrice).toBe(1900);
  });

  it("keeps both sizes separate regardless of which one went in first", () => {
    const cart = setup();

    add(cart, pizza("50"));
    add(cart, pizza("33"));

    const { items, totalPrice } = cart.result.current;

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.size)).toEqual(["50", "33"]);
    expect(totalPrice).toBe(1900);
  });

  it("stacks an identical pick into one row", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("33"));

    const { items, totalPrice } = cart.result.current;

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    expect(totalPrice).toBe(1400);
  });

  it("carries the incoming quantity into the stack instead of adding one", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("33", { quantity: 3 }));

    expect(cart.result.current.items[0].quantity).toBe(4);
  });

  it("does not double the addons when an identical pick is stacked", () => {
    const cart = setup();

    add(cart, pizza("33", { addons: [GARLIC] }));
    add(cart, pizza("33", { addons: [GARLIC] }));

    const { items, totalPrice } = cart.result.current;

    // Two pizzas with one sauce each — not one row carrying two sauces.
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
    expect(items[0].addons).toHaveLength(1);
    expect(items[0].addons?.[0].quantity).toBe(1);
    expect(items[0].price).toBe(800);
    expect(totalPrice).toBe(1600);
  });

  it("splits rows when the same pizza is picked with different addons", () => {
    const cart = setup();

    add(cart, pizza("33", { addons: [GARLIC] }));
    add(cart, pizza("33"));

    const { items, totalPrice } = cart.result.current;

    expect(items).toHaveLength(2);
    expect(items[0].addons).toHaveLength(1);
    expect(items[1].addons ?? []).toHaveLength(0);
    expect(totalPrice).toBe(1500);
  });

  it("splits rows when the same pizza is picked with different notes", () => {
    const cart = setup();

    add(cart, pizza("33", { note: "bez luka" }));
    add(cart, pizza("33", { note: "extra hrskavo" }));

    const { items } = cart.result.current;

    expect(items).toHaveLength(2);
    expect(items.map((i) => i.note)).toEqual(["bez luka", "extra hrskavo"]);
  });

  it("treats a different addon quantity as a different row", () => {
    const cart = setup();

    add(cart, pizza("33", { addons: [GARLIC] }));
    add(cart, pizza("33", { addons: [{ ...GARLIC, quantity: 2 }] }));

    expect(cart.result.current.items).toHaveLength(2);
  });

  it("ignores the order the addons were picked in", () => {
    const cart = setup();

    add(cart, pizza("33", { addons: [GARLIC, KETCHUP] }));
    add(cart, pizza("33", { addons: [KETCHUP, GARLIC] }));

    const { items } = cart.result.current;

    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it("stacks a repeated drink but splits it on a different note", () => {
    const cart = setup();

    add(cart, drink());
    add(cart, drink());
    add(cart, drink({ note: "bez leda" }));

    const { items } = cart.result.current;

    expect(items).toHaveLength(2);
    expect(items[0].quantity).toBe(2);
    expect(items[1].quantity).toBe(1);
    expect(items[1].note).toBe("bez leda");
  });
});

describe("CartProvider — per-row operations with both sizes in the cart", () => {
  it("increases, decreases and removes only the targeted row", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("50"));

    const [row33, row50] = cart.result.current.items.map((i) => i.id);

    act(() => cart.result.current.increase(row50));
    expect(cart.result.current.items.map((i) => i.quantity)).toEqual([1, 2]);

    act(() => cart.result.current.decrease(row50));
    expect(cart.result.current.items.map((i) => i.quantity)).toEqual([1, 1]);

    act(() => cart.result.current.removeFromCart(row33));

    const { items, totalPrice } = cart.result.current;
    expect(items).toHaveLength(1);
    expect(items[0].size).toBe("50");
    expect(totalPrice).toBe(1200);
  });

  it("drops a row when its quantity is decreased to zero", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("50"));

    const row33 = cart.result.current.items[0].id;
    act(() => cart.result.current.decrease(row33));

    expect(cart.result.current.items).toHaveLength(1);
    expect(cart.result.current.items[0].size).toBe("50");
  });
});

describe("CartProvider — edit (updateItemInCart)", () => {
  it("re-keys the row when the edit changes the size", () => {
    const cart = setup();

    add(cart, pizza("33"));
    const rowId = cart.result.current.items[0].id;

    act(() => cart.result.current.updateItemInCart(rowId, pizza("50")));

    const { items, totalPrice } = cart.result.current;
    expect(items).toHaveLength(1);
    expect(items[0].size).toBe("50");
    expect(items[0].menuItemId).toBe("menu-kapricoza-50");
    expect(items[0].id).not.toBe(rowId);
    expect(totalPrice).toBe(1200);
  });

  it("folds the edited row into an existing duplicate instead of leaving two rows with one key", () => {
    const cart = setup();

    add(cart, pizza("33"));
    add(cart, pizza("50", { quantity: 2 }));

    const row50 = cart.result.current.items[1].id;

    // Editing the 50 cm down to 33 cm lands on the configuration row 0 holds.
    // The replacement carries the quantity the sheet shows, which CartDrawer
    // pre-fills from the row being edited — so the two 50 cm come along.
    act(() => cart.result.current.updateItemInCart(row50, pizza("33", { quantity: 2 })));

    const { items, totalPrice, totalItems } = cart.result.current;

    expect(items).toHaveLength(1);
    expect(items[0].size).toBe("33");
    expect(items[0].quantity).toBe(3);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    expect(totalItems).toBe(3);
    expect(totalPrice).toBe(2100);
  });

  it("no-ops on an unknown row id", () => {
    const cart = setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    add(cart, pizza("33"));
    act(() => cart.result.current.updateItemInCart("nepostojeci-id", pizza("50")));

    expect(cart.result.current.items).toHaveLength(1);
    expect(cart.result.current.items[0].size).toBe("33");
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});

describe("CartProvider — analytics", () => {
  it("reports the menu item as item_id, not the row key", () => {
    const cart = setup();

    add(cart, pizza("50", { addons: [GARLIC] }));

    expect(trackAddToCart).toHaveBeenCalledTimes(1);
    expect(vi.mocked(trackAddToCart).mock.calls[0][0]).toMatchObject({
      item_id: "menu-kapricoza-50",
      item_name: "Kapričoza",
      quantity: 1,
    });
  });
});
