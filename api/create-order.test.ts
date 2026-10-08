import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseResult = { data: unknown; error: unknown };
type Call = { table: string; op: string; payload?: unknown };

// Module-top-level supabase init mock (B4 precedent — required because
// create-order.ts calls buildSupabaseAdmin() at module load time).
// Full chainable builder (B19 precedent: createOrderEndpoint.test.ts) so the
// handler can be driven end-to-end, not just the pure clientSafeError export.
const hoisted = vi.hoisted(() => {
  const tableResults: Record<string, SupabaseResult> = {};
  const calls: Call[] = [];
  return { tableResults, calls };
});

vi.mock("@supabase/supabase-js", () => {
  function makeBuilder(table: string, result: SupabaseResult) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    builder.select = chain;
    builder.eq = chain;
    builder.in = chain;
    builder.insert = (...args: unknown[]) => {
      hoisted.calls.push({ table, op: "insert", payload: args[0] });
      return builder;
    };
    builder.update = chain;
    builder.single = () => Promise.resolve(result);
    builder.then = (
      onF: (v: SupabaseResult) => unknown,
      onR?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  return {
    createClient: () => ({
      from: (table: string) =>
        makeBuilder(table, hoisted.tableResults[table] ?? { data: [], error: null }),
      auth: { getUser: vi.fn() },
    }),
  };
});

import handler, { clientSafeError } from "./create-order.js";

describe("clientSafeError", () => {
  it("sanitizes Postgres unique constraint error for order_create kind", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "orders_pkey"',
    );
    expect(clientSafeError(err, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });

  it("sanitizes Bankart network error for payment_init kind", () => {
    const err = new Error("Bankart init network error (fetch failed)");
    expect(clientSafeError(err, "payment_init")).toBe(
      "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.",
    );
  });

  it("handles non-Error values (string) without leaking content", () => {
    expect(clientSafeError("raw string error" as unknown, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });

  it("handles undefined and null without crashing", () => {
    expect(clientSafeError(undefined, "payment_init")).toBe(
      "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.",
    );
    expect(clientSafeError(null, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });
});

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

function makeReq(body: Record<string, unknown>, method = "POST") {
  return { method, headers: {} as Record<string, string>, body };
}

function bodyOf(c: CapturedRes): Record<string, unknown> {
  return c.body as Record<string, unknown>;
}

const validItem = {
  cart_id: "cart-1",
  menu_item_id: "item-1",
  name: "Pizza Margherita",
  quantity: 2,
  price_per_item: 1000,
  addons: [],
};

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    customer_name: "Test Kupac",
    customer_phone: "0671234567",
    customer_address: "Jadranski put 1, Budva",
    payment_method: "cash",
    items: [validItem],
    total_eur_cents: 2000,
    ...overrides,
  };
}

function setSiteSettings(open: string | null, close: string | null, hoursDisplay = "12–00") {
  hoisted.tableResults.site_settings = {
    data: { orders_open_time: open, orders_close_time: close, hours_display: hoursDisplay },
    error: null,
  };
}

function insertedInto(table: string): boolean {
  return hoisted.calls.some((c) => c.table === table && c.op === "insert");
}

describe("create-order handler — business hours gate (B19)", () => {
  beforeEach(() => {
    for (const k of Object.keys(hoisted.tableResults)) delete hoisted.tableResults[k];
    hoisted.calls.length = 0;
    hoisted.tableResults.menu_items = { data: [{ id: "item-1", price_eur_cents: 1000 }], error: null };
    hoisted.tableResults.orders = { data: { id: "order-test-id" }, error: null };
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects a cash order with 409 outside configured hours and never inserts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z")); // 11:00 in Europe/Podgorica (CET)
    setSiteSettings("12:00", "23:00"); // opens at noon — currently closed

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(409);
    expect(bodyOf(c).code).toBe("outside_business_hours");
    expect(bodyOf(c).error).toBe("Trenutno ne primamo porudžbine. Radno vrijeme: 12–00.");
    expect(insertedInto("orders")).toBe(false);
  });

  it("rejects a card order with 409 outside configured hours, never inserts, never calls Bankart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z")); // 11:00 Podgorica
    setSiteSettings("12:00", "23:00");

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    vi.stubGlobal("fetch", fetchSpy);

    const c = makeRes();
    await handler(makeReq(validBody({ payment_method: "card" })), c.res);

    expect(c.statusCode).toBe(409);
    expect(insertedInto("orders")).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled(); // no Bankart debit call, no Telegram notify
  });

  it("accepts a cash order when inside configured hours", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z")); // 11:00 Podgorica
    setSiteSettings("09:00", "23:00"); // open since 09:00 — currently open
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).ok).toBe(true);
    expect(insertedInto("orders")).toBe(true);
  });

  it("handles midnight rollover correctly (12:00-00:00, just before close)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T22:30:00Z")); // 23:30 Podgorica (CET)
    setSiteSettings("12:00", "00:00");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(200);
  });

  it("handles midnight rollover correctly (12:00-00:00, just after close)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-14T23:05:00Z")); // 00:05 Podgorica next day (CET)
    setSiteSettings("12:00", "00:00");

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(409);
    expect(insertedInto("orders")).toBe(false);
  });

  it("fails open when business hours are not configured (both null)", async () => {
    setSiteSettings(null, null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(200);
  });

  it("fails open when the site_settings read errors", async () => {
    hoisted.tableResults.site_settings = { data: null, error: { message: "boom" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(200);
  });

  it("fails open when the site_settings row is missing entirely", async () => {
    // tableResults.site_settings intentionally left unset -> mock default { data: [], error: null }
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));

    const c = makeRes();
    await handler(makeReq(validBody()), c.res);

    expect(c.statusCode).toBe(200);
  });
});

describe("create-order handler — stuffed crust must match the pizza size (B23b)", () => {
  // Same naming as prod: one menu_items row per pizza size, one crust row per size.
  const MENU = [
    { id: "pizza-33", name: "Kapričoza 33 cm", price_eur_cents: 900 },
    { id: "pizza-50", name: "Kapričoza 50 cm", price_eur_cents: 1600 },
    { id: "crust-33", name: "Ivice punjene sirom", price_eur_cents: 200 },
    { id: "crust-50", name: "Ivice punjene sirom 50 cm", price_eur_cents: 400 },
    { id: "sauce-bbq", name: "Bbq", price_eur_cents: 100 },
    { id: "drink", name: "Coca-Cola 0,33 l", price_eur_cents: 250 },
  ];
  const MISMATCH_ERROR = "Punjene ivice ne odgovaraju veličini pice. Ukloni ih iz korpe i dodaj ponovo.";

  function line(menuItemId: string, size: "33" | "50" | null, addonIds: string[], quantity = 1) {
    return {
      cart_id: `cart-${menuItemId}`,
      menu_item_id: menuItemId,
      name: menuItemId,
      size,
      quantity,
      price_per_item: 1, // ignored by the server, which prices by id
      addons: addonIds.map((id) => ({ id, name: id, price: 0, quantity: 1 })),
    };
  }

  beforeEach(() => {
    for (const k of Object.keys(hoisted.tableResults)) delete hoisted.tableResults[k];
    hoisted.calls.length = 0;
    hoisted.tableResults.menu_items = { data: MENU, error: null };
    hoisted.tableResults.orders = { data: { id: "order-test-id" }, error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function submit(items: unknown[], totalCents: number, extra: Record<string, unknown> = {}) {
    const c = makeRes();
    await handler(makeReq(validBody({ items, total_eur_cents: totalCents, ...extra })), c.res);
    return c;
  }

  function expectMismatch(c: CapturedRes) {
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).code).toBe("crust_size_mismatch");
    expect(bodyOf(c).error).toBe(MISMATCH_ERROR);
    expect(insertedInto("orders")).toBe(false);
  }

  it("rejects a 50 cm pizza with the 33 cm crust (2 € under) and never inserts", async () => {
    expectMismatch(await submit([line("pizza-50", "50", ["crust-33"])], 1600 + 200));
  });

  it("rejects a 33 cm pizza with the 50 cm crust", async () => {
    expectMismatch(await submit([line("pizza-33", "33", ["crust-50"])], 900 + 400));
  });

  it("rejects a 50 cm pizza carrying both crust rows", async () => {
    expectMismatch(await submit([line("pizza-50", "50", ["crust-50", "crust-33"])], 1600 + 400 + 200));
  });

  it("takes the size from the pizza's menu row, not the size the client sent", async () => {
    expectMismatch(await submit([line("pizza-50", "33", ["crust-33"])], 1600 + 200));
    expectMismatch(await submit([line("pizza-50", null, ["crust-33"])], 1600 + 200));
  });

  it("rejects a mismatched card order before Bankart is called", async () => {
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");

    const c = await submit([line("pizza-50", "50", ["crust-33"])], 1600 + 200, { payment_method: "card" });

    expectMismatch(c);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("rejects the whole order when only one line mismatches", async () => {
    const items = [line("pizza-33", "33", ["crust-33"]), line("pizza-50", "50", ["crust-33"])];
    expectMismatch(await submit(items, 900 + 200 + 1600 + 200));
  });

  it("accepts a 50 cm pizza with the 50 cm crust (quantity 2)", async () => {
    const c = await submit([line("pizza-50", "50", ["crust-50"], 2)], (1600 + 400) * 2);

    expect(c.statusCode).toBe(200);
    expect(insertedInto("orders")).toBe(true);
  });

  it("accepts a 33 cm pizza with the 33 cm crust next to a non-crust addon", async () => {
    const c = await submit([line("pizza-33", "33", ["crust-33", "sauce-bbq"])], 900 + 200 + 100);

    expect(c.statusCode).toBe(200);
    expect(insertedInto("orders")).toBe(true);
  });

  it("accepts pizzas without crust and items without a size", async () => {
    const items = [line("pizza-50", "50", ["sauce-bbq"]), line("drink", null, [])];
    const c = await submit(items, 1600 + 100 + 250);

    expect(c.statusCode).toBe(200);
  });

  it("mirrors the cart for an item with no size: 33 cm crust accepted, 50 cm crust rejected", async () => {
    const ok = await submit([line("drink", null, ["crust-33"])], 250 + 200);
    expect(ok.statusCode).toBe(200);

    hoisted.calls.length = 0;
    expectMismatch(await submit([line("drink", null, ["crust-50"])], 250 + 400));
  });
});

describe("create-order handler — every row the kitchen sees is priced (B23c)", () => {
  // Telegram and the admin panel list every row that is not "meta" (cart_id,
  // name or category = "meta") and print its quantity as at least 1x. Any row
  // the server lets through without pricing it is food the kitchen makes for free.
  const MENU = [
    { id: "pizza-33", name: "Kapričoza 33 cm", price_eur_cents: 900 },
    { id: "pizza-50", name: "Kapričoza 50 cm", price_eur_cents: 1600 },
    { id: "crust-50", name: "Ivice punjene sirom 50 cm", price_eur_cents: 400 },
    { id: "cola", name: "Coca-Cola 0,33 l", price_eur_cents: 250 },
  ];

  const cola = { cart_id: "c-cola", menu_item_id: "cola", name: "Coca-Cola", quantity: 1, price_per_item: 250, addons: [] };

  function pizza50(overrides: Record<string, unknown> = {}) {
    return {
      cart_id: "c-pizza",
      menu_item_id: "pizza-50",
      name: "Kapričoza 50 cm",
      size: "50",
      quantity: 1,
      price_per_item: 1600,
      addons: [] as unknown[],
      ...overrides,
    };
  }

  function clientMeta(note: string) {
    return {
      cart_id: "meta",
      menu_item_id: null,
      name: "META",
      size: null,
      quantity: 1,
      base_price: null,
      price_per_item: 0,
      addons: [],
      note,
      image: "",
      category: "meta",
    };
  }

  beforeEach(() => {
    for (const k of Object.keys(hoisted.tableResults)) delete hoisted.tableResults[k];
    hoisted.calls.length = 0;
    hoisted.tableResults.menu_items = { data: MENU, error: null };
    hoisted.tableResults.orders = { data: { id: "order-test-id" }, error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function submit(items: unknown[], totalCents?: number) {
    const c = makeRes();
    await handler(makeReq(validBody({ items, total_eur_cents: totalCents })), c.res);
    return c;
  }

  function insertedTotal(): unknown {
    const call = hoisted.calls.find((x) => x.table === "orders" && x.op === "insert");
    return (call?.payload as Record<string, unknown> | undefined)?.total_eur_cents;
  }

  function expectInvalidStructure(c: CapturedRes) {
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Invalid item structure");
    expect(insertedInto("orders")).toBe(false);
  }

  // (a) No price_per_item: the row used to be skipped by pricing but stored.
  it("prices an item sent without price_per_item — a total that leaves it out is a mismatch", async () => {
    const unpriced = pizza50({ quantity: 3, price_per_item: undefined });
    const c = await submit([cola, unpriced], 250);

    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Total mismatch");
    expect(insertedInto("orders")).toBe(false);
  });

  it("prices an item sent without price_per_item — with no client total the stored total includes it", async () => {
    const c = await submit([cola, pizza50({ quantity: 3, price_per_item: undefined })]);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(250 + 3 * 1600);
  });

  // (b) No menu_item_id + price 0 used to pass as "meta", yet the kitchen lists it.
  it("rejects a row with no menu_item_id and price 0 that is not marked meta", async () => {
    const fakeMeta = { cart_id: "c-x", menu_item_id: null, name: "Kapričoza 50 cm", quantity: 2, price_per_item: 0, addons: [] };
    expectInvalidStructure(await submit([cola, fakeMeta], 250));
  });

  // (c) Quantity must be a whole number ≥ 1: the kitchen prints max(1, qty).
  it("rejects a negative quantity that would pull the total down", async () => {
    const minusOne = { ...pizza50(), cart_id: "c-33", menu_item_id: "pizza-33", name: "Kapričoza 33 cm", size: "33", quantity: -1 };
    expectInvalidStructure(await submit([pizza50(), minusOne], 1600 - 900));
  });

  it.each([0, 1.5, "2", null, undefined])("rejects item quantity %j", async (quantity) => {
    expectInvalidStructure(await submit([cola, pizza50({ quantity })]));
  });

  // (d) + (e) Addons: the kitchen prints every addon object, at least 1x.
  it.each([0, -1, 1.5, "1", undefined])("rejects addon quantity %j", async (quantity) => {
    const addon = { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity };
    expectInvalidStructure(await submit([pizza50({ addons: [addon] })]));
  });

  it("rejects an addon with no id", async () => {
    const addon = { name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 };
    expectInvalidStructure(await submit([pizza50({ addons: [addon] })], 1600));
  });

  it("rejects an addon that is not an object, and addons that are not a list", async () => {
    expectInvalidStructure(await submit([pizza50({ addons: ["crust-50"] })], 1600));
    hoisted.calls.length = 0;
    expectInvalidStructure(await submit([pizza50({ addons: { id: "crust-50", quantity: 1 } })], 1600));
  });

  it("rejects a row that is not an object, or an object that is no item and no meta", async () => {
    expectInvalidStructure(await submit([pizza50(), "Kapričoza 50 cm"], 1600));
    hoisted.calls.length = 0;
    expectInvalidStructure(await submit([pizza50(), { foo: 1 }], 1600));
  });

  // Regression: every meta shape the kitchen hides stays unpriced and accepted,
  // and the delivery fee in its note still counts.
  it("accepts the client's meta row and charges the delivery fee from its note", async () => {
    const c = await submit([pizza50(), clientMeta("Zona: Bečići, Dostava: 3 €")], 1600 + 300);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(1600 + 300);
  });

  it.each([
    { cart_id: "c-note", name: "Napomena", category: "Meta", note: "Dostava: 2 €" },
    { cart_id: "c-note", name: "meta", category: "", note: "Dostava: 2 €" },
    { order_note: "Dostava: 2 €", total_items: 1 },
  ])("accepts meta shape %j without pricing it", async (meta) => {
    const c = await submit([pizza50(), meta], 1600 + 200);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(1600 + 200);
  });

  it("still rejects an order that holds nothing but meta", async () => {
    expectInvalidStructure(await submit([clientMeta("Dostava: 3 €")], 300));
  });
});
