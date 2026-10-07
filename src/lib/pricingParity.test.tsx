// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import userEvent from "@testing-library/user-event";

/**
 * B23a — client vs server pricing parity for the same cart.
 *
 * The bug this locks down: the cart charged 4 € for stuffed crust on a 50 cm
 * pizza (a hardcoded 200/400 rewrite in CartProvider) while the server priced
 * the addon by id from `menu_items`, where only one 2 € crust row existed.
 * Every 50 cm + crust order since April died on `Total mismatch`.
 *
 * The chain under test is the real one end to end:
 *   MenuItemDetailSheet (size + addons picked by clicking)
 *     → CartProvider.addToCart (normalization, row price, totalPrice)
 *     → createOrder() (client payload normalization + POST)
 *     → api/create-order handler (server re-pricing from menu_items)
 *
 * One fixture (`MENU_ROWS`) is the database for both sides: the client loads
 * its catalog from it through the real useCatalogData, the server prices from
 * it. If the two sides ever disagree on what a cart costs, the server answers
 * `Total mismatch` and the test fails.
 */

type MenuRow = {
  id: string;
  name: string;
  description: string;
  category: string;
  image: string;
  price: number;
  price_eur_cents: number;
  is_active: boolean;
  sort_order: number;
};

type SupabaseResult = { data: unknown; error: unknown };

const hoisted = vi.hoisted(() => {
  const state: { rows: unknown[]; serverCalls: { status: number; body: unknown }[] } = {
    rows: [],
    serverCalls: [],
  };
  return { state };
});

// Client side: the browser Supabase client, read by useCatalogData.
vi.mock("./supabaseClient", () => {
  function makeQuery() {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    q.select = chain;
    q.eq = chain;
    q.order = chain;
    q.then = (onF: (v: SupabaseResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve({ data: hoisted.state.rows, error: null }).then(onF, onR);
    return q;
  }
  return { supabase: { from: () => makeQuery() } };
});

// Server side: the service-role client inside api/create-order.ts
// (builder shape: createOrderEndpoint.test.ts precedent).
vi.mock("@supabase/supabase-js", () => {
  function makeBuilder(result: SupabaseResult) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.insert = chain;
    builder.update = chain;
    builder.single = () => Promise.resolve(result);
    builder.then = (onF: (v: SupabaseResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR);
    return builder;
  }

  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === "menu_items") return makeBuilder({ data: hoisted.state.rows, error: null });
        if (table === "orders") return makeBuilder({ data: { id: "order-parity" }, error: null });
        return makeBuilder({ data: [], error: null });
      },
    }),
  };
});

vi.mock("./analytics", () => ({
  trackAddToCart: vi.fn(),
  trackRemoveFromCart: vi.fn(),
  trackAddPaymentInfo: vi.fn(),
}));

import handler from "../../api/create-order";
import MenuItemDetailSheet from "../components/MenuItemDetailSheet";
import { CartProvider } from "../context/CartProvider";
import { useCart } from "../context/useCart";
import type { CartContextType } from "../context/CartContext";
import { createOrder, type CreateOrderPayload } from "./createOrder";
import {
  addonsForPizzaSize,
  buildImageCandidates,
  isDrinkCategory,
  remapStuffedCrustForSize,
  stuffedCrustSizeOf,
} from "./cartDrawerHelpers";
import { formatEUR, toSafeInt } from "./money";

function row(id: string, name: string, category: string, cents: number): MenuRow {
  return {
    id,
    name,
    description: name,
    category,
    image: "",
    price: cents,
    price_eur_cents: cents,
    is_active: true,
    sort_order: 1,
  };
}

const PIZZA_33 = row("kap-33", "Kapričoza 33 cm", "pizza", 900);
const PIZZA_50 = row("kap-50", "Kapričoza 50 cm", "pizza", 1600);
const CRUST_33 = row("crust-33", "Ivice punjene sirom", "dodaci", 200);
const CRUST_50 = row("crust-50", "Ivice punjene sirom 50 cm", "dodaci", 400);
const BBQ = row("sauce-bbq", "Bbq", "sosevi", 100);

const MENU_ROWS: MenuRow[] = [PIZZA_33, PIZZA_50, CRUST_33, CRUST_50, BBQ];

// ─── Server bridge ───────────────────────────────────────────────────────────

type CapturedRes = {
  statusCode: number;
  body: unknown;
  res: {
    setHeader: (name: string, value: string) => void;
    status: (code: number) => CapturedRes["res"];
    send: (body: string) => void;
  };
};

function makeRes(): CapturedRes {
  const captured: CapturedRes = {
    statusCode: 0,
    body: undefined,
    res: {
      setHeader: () => {},
      status: (code: number) => {
        captured.statusCode = code;
        return captured.res;
      },
      send: (raw: string) => {
        try {
          captured.body = JSON.parse(raw) as unknown;
        } catch {
          captured.body = raw;
        }
      },
    },
  };
  return captured;
}

/**
 * fetch stub: the client's POST to /create-order is handed to the real
 * server handler; anything else (the server's best-effort Telegram call)
 * gets an inert OK.
 */
async function bridgeFetch(input: unknown, init?: { body?: unknown }) {
  if (String(input).endsWith("/create-order")) {
    const c = makeRes();
    const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    await handler({ method: "POST", headers: {}, body }, c.res);
    hoisted.state.serverCalls.push({ status: c.statusCode, body: c.body });
    return {
      ok: c.statusCode >= 200 && c.statusCode < 300,
      status: c.statusCode,
      json: () => Promise.resolve(c.body),
    };
  }
  return { ok: true, status: 200, json: () => Promise.resolve({}) };
}

// ─── Client harness ──────────────────────────────────────────────────────────

/** Latest cart state, published after each commit (read once the UI settles). */
const cartRef: { current: CartContextType | null } = { current: null };

function CartProbe() {
  const value = useCart();
  useEffect(() => {
    cartRef.current = value;
  });
  return null;
}

/**
 * Mirrors Menu.tsx: the sheet wrapper is mounted closed (item = null) so its
 * catalog loads first, and the customer taps a pizza afterwards. On confirm
 * the item goes to the cart with the drawer kept closed.
 */
function Sheet() {
  const { addToCart } = useCart();
  const [item, setItem] = useState<MenuRow | null>(null);
  return (
    <>
      <button type="button" onClick={() => setItem(PIZZA_33)}>
        Otvori picu
      </button>
      <MenuItemDetailSheet
        item={item}
        isHalal={false}
        onClose={() => setItem(null)}
        onConfirm={(ci) => addToCart(ci, { openCart: false })}
      />
    </>
  );
}

/**
 * The sheet is keyed per pizza so a second configuration starts from a fresh
 * sheet (an outer key change unmounts it outright — no exit animation left
 * in the DOM), while CartProvider above it keeps the cart.
 */
function App({ sheetKey }: { sheetKey: number }) {
  return (
    <CartProvider>
      <CartProbe />
      <Sheet key={sheetKey} />
    </CartProvider>
  );
}

function currentCart(): CartContextType {
  if (!cartRef.current) throw new Error("cart not mounted");
  return cartRef.current;
}

/**
 * Lets the closed sheet's catalog load, then taps the pizza — the sheet picks
 * its default size on open, from the variants it has at that moment.
 */
async function sheetReady() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await userEvent.click(screen.getByRole("button", { name: "Otvori picu" }));
  await screen.findByRole("button", { name: /^50 cm/ });
  await screen.findByText("Bbq");
}

async function pickSize(size: "33" | "50") {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${size} cm`) }));
}

async function pickAddon(name: string) {
  await userEvent.click(screen.getByText(name));
}

function ctaButton() {
  return screen.getByRole("button", { name: /Dodaj u porudžbinu/ });
}

/** formatEUR uses a no-break space; compare amounts with whitespace collapsed. */
function expectCtaTotal(cents: number) {
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
  expect(collapse(ctaButton().textContent ?? "")).toContain(collapse(formatEUR(cents)));
}

async function confirmSheet() {
  await userEvent.click(ctaButton());
}

/**
 * Cart → order items, mirroring the inline mapping in CartDrawer.tsx
 * (handleSubmit, `items: items.map(...)`). CartDrawer is a lock zone, so the
 * mapping is copied here rather than extracted.
 */
function orderPayload(totalPrice: number): CreateOrderPayload {
  const { items, totalItems } = currentCart();
  return {
    customer_name: "Test Kupac",
    customer_phone: "+38269000000",
    customer_address: "Slobode 10, Budva",
    total_price: totalPrice,
    total_items: totalItems,
    note: null,
    payment_method: "cash",
    items: items.map((it) => {
      const drink = isDrinkCategory(it.category ?? "");
      const addons = drink ? [] : (it.addons ?? []);

      const addonsTotal = addons.reduce((s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1), 0);
      const basePrice = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
      const rawSize = it.size ?? null;
      const size: "33" | "50" | null = rawSize === "33" || rawSize === "50" ? rawSize : null;
      const image =
        String(it.image ?? "").trim() || buildImageCandidates(null, it.name)[0] || "/menu/padrino.webp";

      return {
        cart_id: it.id,
        menu_item_id: it.menuItemId ?? null,
        name: it.name,
        size,
        quantity: toSafeInt(it.quantity, 1),
        base_price: basePrice,
        price_per_item: basePrice + addonsTotal,
        addons: addons.map((a) => ({
          id: a.id,
          name: a.name,
          price: toSafeInt(a.price, 0),
          quantity: a.quantity ?? 1,
        })),
        note: it.note ?? null,
        image,
        category: it.category ?? "",
      };
    }),
  };
}

/** Sends the cart at its own total; returns what the server answered. */
async function placeOrder(totalPrice = currentCart().totalPrice) {
  hoisted.state.serverCalls.length = 0;
  await createOrder(orderPayload(totalPrice)).catch(() => null);
  expect(hoisted.state.serverCalls).toHaveLength(1);
  return hoisted.state.serverCalls[0];
}

function lastAddons() {
  const items = currentCart().items;
  return items[items.length - 1]?.addons ?? [];
}

beforeEach(() => {
  hoisted.state.rows = [...MENU_ROWS];
  hoisted.state.serverCalls.length = 0;
  cartRef.current = null;
  vi.stubGlobal("fetch", vi.fn(bridgeFetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("B23a — sheet, cart and server agree on what a cart costs", () => {
  it("50 cm + stuffed crust: the 50 cm crust row is sent and the server accepts the total", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("50");
    await pickAddon("Ivice punjene sirom 50 cm");

    const expected = 1600 + 400;
    expectCtaTotal(expected);

    await confirmSheet();
    expect(lastAddons()).toEqual([
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 },
    ]);
    expect(currentCart().totalPrice).toBe(expected);

    const server = await placeOrder();
    expect(server.status).toBe(200);
    expect((server.body as Record<string, unknown>).ok).toBe(true);
  });

  it("50 cm × 2 with crust and a sauce: the sheet shows (base + addons) × qty, same as cart and server", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("50");
    await userEvent.click(screen.getByRole("button", { name: "Povećaj" })); // pizza qty → 2
    await pickAddon("Ivice punjene sirom 50 cm");
    await pickAddon("Bbq");

    const expected = (1600 + 400 + 100) * 2;
    expectCtaTotal(expected);

    await confirmSheet();
    expect(currentCart().totalPrice).toBe(expected);

    const server = await placeOrder();
    expect(server.status).toBe(200);
  });

  it("crust picked on 33 cm follows the switch to 50 cm (id and price swap, qty kept)", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("33");
    await pickAddon("Ivice punjene sirom");
    // [0] is the pizza stepper, [1] the stepper of the crust just picked.
    await userEvent.click(screen.getAllByRole("button", { name: "Povećaj" })[1]); // crust qty → 2

    await pickSize("50");
    expect(screen.queryByText("Ivice punjene sirom")).toBeNull();
    expect(screen.getByText("Ivice punjene sirom 50 cm")).toBeInTheDocument();

    const expected = 1600 + 2 * 400;
    expectCtaTotal(expected);

    await confirmSheet();
    expect(lastAddons()).toEqual([
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 2 },
    ]);

    const server = await placeOrder();
    expect(server.status).toBe(200);
  });

  it("33 cm + stuffed crust stays on the 33 cm crust row (regression guard)", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("33");
    expect(screen.queryByText("Ivice punjene sirom 50 cm")).toBeNull();
    await pickAddon("Ivice punjene sirom");

    const expected = 900 + 200;
    expectCtaTotal(expected);

    await confirmSheet();
    expect(lastAddons()).toEqual([
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 },
    ]);

    const server = await placeOrder();
    expect(server.status).toBe(200);
  });

  it("33 cm + crust and 50 cm + crust in one order: the server accepts the mixed cart", async () => {
    const view = render(<App sheetKey={1} />);
    await sheetReady();
    await pickSize("33");
    await pickAddon("Ivice punjene sirom");
    await confirmSheet();

    view.rerender(<App sheetKey={2} />);
    await sheetReady();
    await pickSize("50");
    await pickAddon("Ivice punjene sirom 50 cm");
    await confirmSheet();

    await waitFor(() => expect(currentCart().items).toHaveLength(2));
    expect(currentCart().totalPrice).toBe(900 + 200 + 1600 + 400);

    const server = await placeOrder();
    expect(server.status).toBe(200);
  });

  it("negative control: a total that differs from the server's recompute is rejected", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();
    await pickSize("50");
    await pickAddon("Ivice punjene sirom 50 cm");
    await confirmSheet();

    const server = await placeOrder(currentCart().totalPrice + 100);
    expect(server.status).toBe(400);
    expect((server.body as Record<string, unknown>).error).toBe("Total mismatch");
  });

  it("no 50 cm crust row in the menu: crust is not offered on 50 cm, still offered on 33 cm", async () => {
    hoisted.state.rows = MENU_ROWS.filter((r) => r.id !== CRUST_50.id);

    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("50");
    expect(screen.queryByText(/Ivice punjene sirom/)).toBeNull();

    await pickSize("33");
    expect(screen.getByText("Ivice punjene sirom")).toBeInTheDocument();
  });
});

describe("B23a — stuffed crust per size helpers", () => {
  const catalog = [
    { id: CRUST_33.id, name: CRUST_33.name, price: 200 },
    { id: CRUST_50.id, name: CRUST_50.name, price: 400 },
    { id: "krofne", name: "Krofne", price: 200 },
  ];

  it("stuffedCrustSizeOf: the unsized row is 33 cm, the 50 cm row is 50 cm, other addons are null", () => {
    expect(stuffedCrustSizeOf("Ivice punjene sirom")).toBe("33");
    expect(stuffedCrustSizeOf("Ivice punjene sirom 50 cm")).toBe("50");
    expect(stuffedCrustSizeOf("Krofne")).toBeNull();
    expect(stuffedCrustSizeOf("Bbq")).toBeNull();
  });

  it("addonsForPizzaSize keeps every other addon and only the crust row for the size", () => {
    expect(addonsForPizzaSize(catalog, "33").map((a) => a.id)).toEqual(["crust-33", "krofne"]);
    expect(addonsForPizzaSize(catalog, "50").map((a) => a.id)).toEqual(["crust-50", "krofne"]);
    expect(addonsForPizzaSize(catalog, null).map((a) => a.id)).toEqual(["crust-33", "krofne"]);
  });

  it("addonsForPizzaSize fails closed: no 50 cm row means no crust on 50 cm", () => {
    const without50 = catalog.filter((a) => a.id !== CRUST_50.id);
    expect(addonsForPizzaSize(without50, "50").map((a) => a.id)).toEqual(["krofne"]);
  });

  it("remapStuffedCrustForSize swaps the crust row and keeps its quantity; other addons untouched", () => {
    const selected = [
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 2 },
      { id: "krofne", name: "Krofne", price: 200, quantity: 1 },
    ];
    expect(remapStuffedCrustForSize(selected, catalog, "50")).toEqual([
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 2 },
      { id: "krofne", name: "Krofne", price: 200, quantity: 1 },
    ]);
    // Already on the right row: unchanged.
    expect(remapStuffedCrustForSize(selected, catalog, "33")).toEqual(selected);
  });

  it("remapStuffedCrustForSize drops the crust when the new size has no row, and never duplicates an id", () => {
    const without50 = catalog.filter((a) => a.id !== CRUST_50.id);
    const selected = [{ id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 }];
    expect(remapStuffedCrustForSize(selected, without50, "50")).toEqual([]);

    const both = [
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 },
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 3 },
    ];
    expect(remapStuffedCrustForSize(both, catalog, "50")).toEqual([
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 },
    ]);
  });
});
