// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
 * The chain under test is the real one end to end — nothing in it is copied:
 *   MenuItemDetailSheet (size + addons picked by clicking)
 *     → CartProvider.addToCart (normalization, row price)
 *     → CartDrawer checkout (subtotal + delivery fee, order items, submit)
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

type ServerCall = { status: number; body: unknown; request: Record<string, unknown> };

const hoisted = vi.hoisted(() => {
  const state: {
    /** menu_items as the browser reads them. */
    clientRows: unknown[];
    /** menu_items as the server reads them; null = same as the client. */
    serverRows: unknown[] | null;
    /** When set, the browser's menu read waits for it (catalog still loading). */
    catalogGate: Promise<void> | null;
    serverCalls: ServerCall[];
    /** Rows the server inserted into `orders` (B23d: what the kitchen reads). */
    inserted: unknown[];
  } = { clientRows: [], serverRows: null, catalogGate: null, serverCalls: [], inserted: [] };
  return { state };
});

// Client side: the browser Supabase client. menu_items feeds useCatalogData;
// every other read (site_settings for the checkout form) fails, as in
// CartDrawer.e2e.test.tsx, and the drawer falls back to its defaults.
vi.mock("./supabaseClient", () => {
  function makeQuery(table: string) {
    const failed: SupabaseResult = { data: null, error: new Error("mocked") };
    const q: Record<string, unknown> = {};
    const chain = () => q;
    q.select = chain;
    q.eq = chain;
    q.in = chain;
    q.order = chain;
    q.limit = chain;
    q.single = () => Promise.resolve(failed);
    q.maybeSingle = () => Promise.resolve(failed);
    q.then = (onF: (v: SupabaseResult) => unknown, onR?: (e: unknown) => unknown) => {
      if (table !== "menu_items") return Promise.resolve(failed).then(onF, onR);
      return (hoisted.state.catalogGate ?? Promise.resolve())
        .then(() => ({ data: hoisted.state.clientRows, error: null }))
        .then(onF, onR);
    };
    return q;
  }
  return { supabase: { from: (table: string) => makeQuery(table) } };
});

// Server side: the service-role client inside api/create-order.ts
// (builder shape: createOrderEndpoint.test.ts precedent).
vi.mock("@supabase/supabase-js", () => {
  function makeBuilder(result: () => SupabaseResult) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.insert = (row: unknown) => {
      hoisted.state.inserted.push(row);
      return builder;
    };
    builder.update = chain;
    builder.single = () => Promise.resolve(result());
    builder.then = (onF: (v: SupabaseResult) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(onF, onR);
    return builder;
  }

  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === "menu_items") {
          return makeBuilder(() => ({
            data: hoisted.state.serverRows ?? hoisted.state.clientRows,
            error: null,
          }));
        }
        if (table === "orders") return makeBuilder(() => ({ data: { id: "order-parity" }, error: null }));
        return makeBuilder(() => ({ data: [], error: null }));
      },
    }),
  };
});

// Side channels, not the subject: GA4 and the Bankart card SDK (cash orders only).
vi.mock("./analytics");
vi.mock("./bankartPaymentJs");

import handler from "../../api/create-order";
import {
  crustSizeForItem as serverCrustSizeForItem,
  stuffedCrustSizeOf as serverStuffedCrustSizeOf,
} from "../../api/_shared/stuffed-crust";
import { displayNameOfMenuRow, pizzaSizeOfName } from "../../api/_shared/menu-display";
import {
  DELIVERY_ZONES as SERVER_DELIVERY_ZONES,
  formatDeliveryFee,
} from "../../api/_shared/delivery-zones";
import { DELIVERY_ZONES } from "./config";
import CartDrawer from "../components/CartDrawer";
import MenuItemDetailSheet from "../components/MenuItemDetailSheet";
import { CartProvider } from "../context/CartProvider";
import { useCart } from "../context/useCart";
import type { CartAddon, CartContextType, CartItem, PizzaSize } from "../context/CartContext";
import {
  addonsForPizzaSize,
  formatFeeEurShort,
  parsePizzaSizeFromName,
  remapStuffedCrustForSize,
  stripPizzaSizeFromName,
  stuffedCrustSizeOf,
} from "./cartDrawerHelpers";
import { formatEUR } from "./money";

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
    const request = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
    await handler({ method: "POST", headers: {}, body: request }, c.res);
    hoisted.state.serverCalls.push({ status: c.statusCode, body: c.body, request });
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
 * in the DOM), while CartProvider above it keeps the cart. CartDrawer is the
 * real checkout; it renders nothing until the cart is opened.
 */
function App({ sheetKey }: { sheetKey: number }) {
  return (
    <CartProvider>
      <CartProbe />
      <Sheet key={sheetKey} />
      <CartDrawer />
    </CartProvider>
  );
}

function currentCart(): CartContextType {
  if (!cartRef.current) throw new Error("cart not mounted");
  return cartRef.current;
}

/** Lets pending catalog reads resolve and React settle. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Lets the closed sheet's catalog load, then taps the pizza — the sheet picks
 * its default size on open, from the variants it has at that moment.
 */
async function sheetReady() {
  await flush();
  await userEvent.click(screen.getByRole("button", { name: "Otvori picu" }));
  await screen.findByRole("button", { name: /^50 cm/ });
  await screen.findByText("Bbq");
}

async function pickSize(size: PizzaSize) {
  await userEvent.click(screen.getByRole("button", { name: new RegExp(`^${size} cm`) }));
}

async function pickAddon(name: string) {
  await userEvent.click(screen.getByText(name));
}

function ctaButton() {
  return screen.getByRole("button", { name: /^(Dodaj u porudžbinu|Sačuvaj izmene)/ });
}

/** The CTA reads "<label> — <total>"; formatEUR uses a no-break space. */
function expectCtaTotal(cents: number) {
  const collapse = (s: string) => s.replace(/\s+/g, " ").trim();
  const shown = collapse(ctaButton().textContent ?? "").split(" — ")[1];
  expect(shown).toBe(collapse(formatEUR(cents)));
}

async function confirmSheet() {
  await userEvent.click(ctaButton());
}

/**
 * Checks the cart out through the real CartDrawer (cash) and returns what the
 * server answered. `payDelivery` takes the "Doplati" path for a zone whose
 * free-delivery minimum the cart does not reach.
 */
async function checkout(zone: RegExp = /budva/i, payDelivery = false): Promise<ServerCall> {
  hoisted.state.serverCalls.length = 0;
  await act(async () => {
    currentCart().openCart();
  });

  await userEvent.click(await screen.findByRole("button", { name: /poruči/i }));
  await userEvent.type(screen.getByPlaceholderText("Npr. Petar Petrovic"), "Petar Petrovic");
  await userEvent.type(screen.getByPlaceholderText("+382..."), "+38269000000");
  await userEvent.type(screen.getByPlaceholderText("Ulica i broj"), "Slobode 10");
  await userEvent.click(screen.getByRole("button", { name: /izaberi zonu/i }));
  await userEvent.click(screen.getByRole("option", { name: zone }));
  if (payDelivery) await userEvent.click(screen.getByRole("button", { name: /doplati/i }));

  const form = document.querySelector("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form!);

  await waitFor(() => expect(hoisted.state.serverCalls).toHaveLength(1));
  return hoisted.state.serverCalls[0];
}

function expectAccepted(call: ServerCall, totalCents: number) {
  expect(call.request.total_eur_cents).toBe(totalCents);
  expect(call.body).toEqual(expect.objectContaining({ ok: true }));
  expect(call.status).toBe(200);
}

function lastAddons() {
  const items = currentCart().items;
  return items[items.length - 1]?.addons ?? [];
}

beforeEach(() => {
  hoisted.state.clientRows = [...MENU_ROWS];
  hoisted.state.serverRows = null;
  hoisted.state.catalogGate = null;
  hoisted.state.serverCalls.length = 0;
  hoisted.state.inserted.length = 0;
  cartRef.current = null;
  vi.stubGlobal("fetch", vi.fn(bridgeFetch));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("B23a — sheet, cart, checkout and server agree on what a cart costs", () => {
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

    expectAccepted(await checkout(), expected);
  });

  it("50 cm × 2 with crust and a sauce: the sheet shows (base + addons) × qty, same as checkout and server", async () => {
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

    expectAccepted(await checkout(), expected);
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

    expectAccepted(await checkout(), expected);
  });

  it("33 cm + stuffed crust with a paid delivery: crust row and delivery fee both match the server", async () => {
    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("33");
    expect(screen.queryByText("Ivice punjene sirom 50 cm")).toBeNull();
    await pickAddon("Ivice punjene sirom");

    const subtotal = 900 + 200;
    expectCtaTotal(subtotal);

    await confirmSheet();
    expect(lastAddons()).toEqual([
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 },
    ]);

    // Bečići: 3 € delivery below the 15 € free-delivery minimum.
    expectAccepted(await checkout(/bečići/i, true), subtotal + 300);
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
    const expected = 900 + 200 + 1600 + 400;
    expect(currentCart().totalPrice).toBe(expected);

    expectAccepted(await checkout(), expected);
  });

  it("negative control: when the client's price for a row differs from the server's, checkout is rejected", async () => {
    // The B23a bug class: the client believes the 50 cm crust costs 4 €, the
    // server's menu_items row says 2 €.
    hoisted.state.serverRows = MENU_ROWS.map((r) =>
      r.id === CRUST_50.id ? { ...r, price: 200, price_eur_cents: 200 } : r,
    );

    render(<App sheetKey={1} />);
    await sheetReady();
    await pickSize("50");
    await pickAddon("Ivice punjene sirom 50 cm");
    await confirmSheet();

    const call = await checkout();
    expect(call.status).toBe(400);
    expect(call.body).toEqual(expect.objectContaining({ error: "Total mismatch" }));
  });

  it("no 50 cm crust row in the menu: crust is not offered on 50 cm, still offered on 33 cm", async () => {
    hoisted.state.clientRows = MENU_ROWS.filter((r) => r.id !== CRUST_50.id);

    render(<App sheetKey={1} />);
    await sheetReady();

    await pickSize("50");
    expect(screen.queryByText(/Ivice punjene sirom/)).toBeNull();

    await pickSize("33");
    expect(screen.getByText("Ivice punjene sirom")).toBeInTheDocument();
  });
});

// ─── Edit-reopen (CartDrawer → sheet pre-filled from a cart row) ─────────────

const EDITED_50: { size: PizzaSize; addons: CartAddon[] } = {
  size: "50",
  addons: [{ id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 }],
};

/**
 * What CartDrawer passes when a 50 cm + crust row is edited: the row as a menu
 * item (size-stripped name, its own base price) plus its size and addons. The
 * sheet wrapper is mounted closed; tapping "Uredi" opens it.
 */
function EditSheet({ onConfirm }: { onConfirm: (ci: CartItem) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Uredi
      </button>
      <MenuItemDetailSheet
        item={open ? { ...PIZZA_50, name: "Kapričoza" } : null}
        isHalal={false}
        onClose={() => setOpen(false)}
        onConfirm={onConfirm}
        editingCartItemId="row-1"
        initialSize={EDITED_50.size}
        initialQty={1}
        initialAddons={EDITED_50.addons}
        initialNote=""
      />
    </>
  );
}

describe("B23a — edit-reopen keeps the crust matched to the size", () => {
  it("50 cm variant gone from the menu: the sheet opens on 33 cm and the crust moves to the 33 cm row", async () => {
    hoisted.state.clientRows = MENU_ROWS.filter((r) => r.id !== PIZZA_50.id);
    const onConfirm = vi.fn();

    render(<EditSheet onConfirm={onConfirm} />);
    await flush();
    await userEvent.click(screen.getByRole("button", { name: "Uredi" }));
    await screen.findByText("Bbq");

    expect(screen.queryByText("Ivice punjene sirom 50 cm")).toBeNull();
    expect(screen.getByText("Ivice punjene sirom")).toBeInTheDocument();
    expectCtaTotal(900 + 200);

    await confirmSheet();
    const confirmed = onConfirm.mock.calls[0][0] as CartItem;
    expect(confirmed.addons).toEqual([
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 },
    ]);
  });

  it("edit opened before the catalog loaded: the crust the row carries stays listed and selected", async () => {
    let release: () => void = () => {};
    hoisted.state.catalogGate = new Promise<void>((resolve) => {
      release = resolve;
    });

    render(<EditSheet onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Uredi" }));
    await act(async () => {
      release();
    });
    await screen.findByText("Bbq");

    // The 50 cm crust the row carries is the one listed (selected → stepper);
    // the 33 cm crust is not offered next to it.
    expect(screen.getByText("Ivice punjene sirom 50 cm")).toBeInTheDocument();
    expect(screen.queryByText("Ivice punjene sirom")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Smanji" })).toHaveLength(2); // pizza + crust
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
      { id: "krofne", name: "Krofne", price: 200, quantity: 1 },
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 2 },
    ]);
    // Already on the right row: unchanged.
    expect(remapStuffedCrustForSize(selected, catalog, "33")).toEqual(selected);
  });

  it("remapStuffedCrustForSize never replaces a crust already on a row for the size", () => {
    const withKulen = [...catalog, { id: "crust-kulen", name: "Punjene ivice sa kulenom", price: 300 }];
    const selected = [{ id: "crust-kulen", name: "Punjene ivice sa kulenom", price: 300, quantity: 1 }];
    expect(remapStuffedCrustForSize(selected, withKulen, "33")).toEqual(selected);
  });

  it("remapStuffedCrustForSize drops the crust when the new size has no row, and never duplicates an id", () => {
    const without50 = catalog.filter((a) => a.id !== CRUST_50.id);
    const selected = [{ id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 }];
    expect(remapStuffedCrustForSize(selected, without50, "50")).toEqual([]);

    // The row that already matched wins over the remapped duplicate.
    const both = [
      { id: "crust-33", name: "Ivice punjene sirom", price: 200, quantity: 1 },
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 3 },
    ];
    expect(remapStuffedCrustForSize(both, catalog, "50")).toEqual([
      { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 3 },
    ]);
  });
});

describe("B23b — client and server read crust and pizza sizes the same way", () => {
  // The server refuses a crust that does not fit the pizza (api/_shared/
  // stuffed-crust.ts), with its own copy of the cart's name rules — api/ never
  // imports from src/. If the copies drift, the server refuses carts the
  // client built in good faith, or lets a mismatched crust through.
  const NAMES = [
    "Ivice punjene sirom",
    "Ivice punjene sirom 50 cm",
    "  IVICE   PUNJENE sirom  50cm ",
    "Punjene ivice sa kulenom",
    "Punjena ivica",
    "Ivica punjena 50 cm",
    "Rub",
    "Rub pizza",
    "Ivice punjene 150 cm",
    "Kapričoza 33 cm",
    "Kapričoza 50 cm",
    "Quattro formaggi 50cm",
    "Papricciosa",
    "Coca-Cola 0,33 l",
    "Bbq",
    "Krofne",
    "",
  ];

  it.each(NAMES)("stuffed crust size of %j", (name) => {
    expect(serverStuffedCrustSizeOf(name)).toBe(stuffedCrustSizeOf(name));
  });

  it.each(NAMES)("crust size that fits the item %j", (name) => {
    // The cart sizes a menu row by its name and offers the 50 cm crust on 50 cm
    // only (addonsForPizzaSize).
    const clientFits = parsePizzaSizeFromName(name) === "50" ? "50" : "33";
    expect(serverCrustSizeForItem(name)).toBe(clientFits);
  });

  it("the server refuses the 33 cm crust on a 50 cm pizza from this menu", async () => {
    const c = makeRes();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          customer_name: "Test Kupac",
          customer_phone: "0671234567",
          customer_address: "Jadranski put 1, Budva",
          payment_method: "cash",
          delivery_zone: "budva",
          items: [
            {
              cart_id: "kap-50",
              menu_item_id: PIZZA_50.id,
              name: PIZZA_50.name,
              size: "50",
              quantity: 1,
              price_per_item: 1800,
              addons: [{ id: CRUST_33.id, name: CRUST_33.name, price: 200, quantity: 1 }],
            },
          ],
          total_eur_cents: 1800,
        },
      },
      c.res,
    );

    expect(c.statusCode).toBe(400);
    expect((c.body as Record<string, unknown>).code).toBe("crust_size_mismatch");
  });
});

describe("B23d — the server stores what an honest cart sends, read from the menu rows", () => {
  // The server rewrites each row's name, size, addon names and prices from
  // menu_items (api/_shared/menu-display.ts). For the cart that must be a
  // no-op: Telegram keeps reading "1x Kapričoza (50)" and the same addons.
  const NAMES = [
    "Kapričoza 33 cm",
    "Kapričoza 50 cm",
    "Diavolo 50 cm",
    "Anatoli pizza 33 cm",
    "Piroška 33 cm",
    "Quattro formaggi 50cm",
    "Ivice punjene sirom 50 cm",
    "Papricciosa",
    "Coca-Cola 0,33 l",
    "Slatko Ljuti ",
    "Kečap",
    "",
  ];

  it.each(NAMES)("display name and size of %j", (name) => {
    expect(displayNameOfMenuRow(name)).toBe(stripPizzaSizeFromName(name));
    expect(pizzaSizeOfName(name)).toBe(parsePizzaSizeFromName(name));
  });

  function isMeta(row: unknown) {
    return (row as Record<string, unknown>).cart_id === "meta";
  }

  function storedItems(): unknown[] {
    expect(hoisted.state.inserted).toHaveLength(1);
    return (hoisted.state.inserted[0] as { items: unknown[] }).items;
  }

  it("50 cm + crust + sauce next to a plain 33 cm: stored rows equal the rows sent", async () => {
    const view = render(<App sheetKey={1} />);
    await sheetReady();
    await pickSize("50");
    await pickAddon("Ivice punjene sirom 50 cm");
    await pickAddon("Bbq");
    await confirmSheet();

    view.rerender(<App sheetKey={2} />);
    await sheetReady();
    await pickSize("33");
    await confirmSheet();

    await waitFor(() => expect(currentCart().items).toHaveLength(2));
    const call = await checkout();
    expectAccepted(call, 1600 + 400 + 100 + 900);

    const sent = (call.request.items as unknown[]).filter((r) => !isMeta(r));
    const stored = storedItems().filter((r) => !isMeta(r));
    expect(stored).toEqual(sent);
    expect(stored).toEqual([
      expect.objectContaining({
        name: "Kapričoza",
        size: "50",
        base_price: 1600,
        price_per_item: 2100,
        addons: [
          { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 },
          { id: "sauce-bbq", name: "Bbq", price: 100, quantity: 1 },
        ],
      }),
      expect.objectContaining({ name: "Kapričoza", size: "33", base_price: 900, price_per_item: 900, addons: [] }),
    ]);
  });
});

describe("B23e — client and server hold the same delivery zones", () => {
  // The server charges delivery from its own copy of the zone table
  // (api/_shared/delivery-zones.ts). If the copies drift, the server rejects
  // honest carts with "Total mismatch" or charges a fee the customer never saw.
  it("same keys, labels, minimums and fees, in the same order", () => {
    expect(SERVER_DELIVERY_ZONES.map((z) => ({ ...z }))).toEqual(DELIVERY_ZONES.map((z) => ({ ...z })));
  });

  it.each(DELIVERY_ZONES.map((z) => [z.key, z.feeCents] as const))(
    "the kitchen reads the same fee text for %s",
    (_key, fee) => {
      expect(formatDeliveryFee(fee)).toBe(formatFeeEurShort(fee));
      expect(formatDeliveryFee(0)).toBe(formatFeeEurShort(0));
    },
  );
});
