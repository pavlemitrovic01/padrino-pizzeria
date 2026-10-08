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
  // B24: answers for `.eq("idempotency_key", …)` lookups and for inserts, in
  // order; when a queue is empty the table result above is used.
  const idempotency = { lookups: [] as SupabaseResult[], inserts: [] as SupabaseResult[] };
  return { tableResults, calls, idempotency };
});

vi.mock("@supabase/supabase-js", () => {
  function makeBuilder(table: string, result: SupabaseResult) {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    let byIdempotencyKey = false;
    let inserting = false;
    builder.select = chain;
    builder.eq = (col: string) => {
      if (col === "idempotency_key") byIdempotencyKey = true;
      return builder;
    };
    builder.in = chain;
    builder.is = chain;
    builder.insert = (...args: unknown[]) => {
      hoisted.calls.push({ table, op: "insert", payload: args[0] });
      inserting = true;
      return builder;
    };
    builder.update = (...args: unknown[]) => {
      hoisted.calls.push({ table, op: "update", payload: args[0] });
      return builder;
    };
    builder.single = () =>
      Promise.resolve(inserting ? (hoisted.idempotency.inserts.shift() ?? result) : result);
    builder.then = (
      onF: (v: SupabaseResult) => unknown,
      onR?: (e: unknown) => unknown,
    ) =>
      Promise.resolve(
        byIdempotencyKey ? (hoisted.idempotency.lookups.shift() ?? { data: [], error: null }) : result,
      ).then(onF, onR);
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
    delivery_zone: "budva", // free delivery (B23e: the server prices delivery from the zone)
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

  it("rejects a crust row ordered as an item of its own", async () => {
    const crustLine = { ...line("crust-33", null, []), name: "Ivice punjene sirom" };
    expectMismatch(await submit([line("pizza-50", "50", []), crustLine], 1600 + 200));
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

  async function submit(items: unknown[], totalCents?: number, extra: Record<string, unknown> = {}) {
    const c = makeRes();
    await handler(makeReq(validBody({ items, total_eur_cents: totalCents, ...extra })), c.res);
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

  it.each([0, 1.5, "2", null, undefined, 100, 1e308])("rejects item quantity %j", async (quantity) => {
    expectInvalidStructure(await submit([cola, pizza50({ quantity })]));
  });

  // (d) + (e) Addons: the kitchen prints every addon object, at least 1x.
  it.each([0, -1, 1.5, "1", undefined, 100, 1e308])("rejects addon quantity %j", async (quantity) => {
    const addon = { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity };
    expectInvalidStructure(await submit([pizza50({ addons: [addon] })]));
  });

  it("accepts up to 99 of an item and of an addon", async () => {
    const addon = { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 99 };
    const c = await submit([pizza50({ quantity: 99, addons: [addon] })]);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(99 * (1600 + 99 * 400));
  });

  it("ignores a delivery fee written into the note (B23e: it used to overflow the total)", async () => {
    const c = await submit([pizza50(), clientMeta(`Dostava: 1${"0".repeat(300)} €`)]);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(1600);
  });

  it("rejects an item row without cart_id (Telegram lists only rows that have one)", async () => {
    expectInvalidStructure(await submit([cola, pizza50({ cart_id: undefined })], 250 + 1600));
    hoisted.calls.length = 0;
    expectInvalidStructure(await submit([cola, pizza50({ cart_id: "  " })], 250 + 1600));
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

  // Regression: every meta shape the kitchen hides stays unpriced and accepted;
  // delivery is charged from the zone (B23e), never from the note.
  it("accepts the client's meta row and charges delivery from the zone", async () => {
    const c = await submit([pizza50(), clientMeta("Zona: Lastva, Dostava: 5€")], 1600 + 500, {
      delivery_zone: "lastva",
    });

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(1600 + 500);
  });

  it.each([
    { cart_id: "c-note", name: "Napomena", category: "Meta", note: "Dostava: 2 €" },
    { cart_id: "c-note", name: "meta", category: "", note: "Dostava: 2 €" },
    { order_note: "Dostava: 2 €", total_items: 1 },
  ])("accepts meta shape %j without pricing it or its \"Dostava\" text", async (meta) => {
    const c = await submit([pizza50(), meta], 1600);

    expect(c.statusCode).toBe(200);
    expect(insertedTotal()).toBe(1600);
  });

  it("still rejects an order that holds nothing but meta", async () => {
    expectInvalidStructure(await submit([clientMeta("Dostava: 3 €")], 300));
  });
});

describe("create-order handler — stored rows read as the menu row that was charged (B23d)", () => {
  // Telegram prints "1x {name} ({size})" and each addon by name; the admin
  // panel shows price_per_item and addon prices. The server charges by id, so
  // it stores those fields from the menu rows, not from the request.
  const MENU = [
    { id: "diavolo-33", name: "Diavolo 33 cm", price_eur_cents: 1000 },
    { id: "diavolo-50", name: "Diavolo 50 cm", price_eur_cents: 2000 },
    { id: "bianco-33", name: "Bianco 33 cm", price_eur_cents: 1100 },
    { id: "montenegro-50", name: "Montenegro 50 cm", price_eur_cents: 2000 },
    { id: "crust-50", name: "Ivice punjene sirom 50 cm", price_eur_cents: 400 },
    { id: "pelat", name: "Pelat ", price_eur_cents: 100 }, // trailing space, as on prod
    { id: "kecap", name: "Kečap", price_eur_cents: 0 },
    { id: "cola", name: "Coca-Cola 0,33 l", price_eur_cents: 250 },
  ];

  const CRUST_50 = { id: "crust-50", name: "Ivice punjene sirom 50 cm", price: 400, quantity: 1 };
  const PELAT = { id: "pelat", name: "Pelat", price: 100, quantity: 1 };
  const KECAP = { id: "kecap", name: "Kečap", price: 0, quantity: 1 };

  // A row exactly as CartDrawer sends it.
  function diavolo50(overrides: Record<string, unknown> = {}) {
    return {
      cart_id: "c-diavolo-50",
      menu_item_id: "diavolo-50",
      name: "Diavolo",
      size: "50",
      quantity: 1,
      base_price: 2000,
      price_per_item: 2000 + 400 + 100,
      addons: [CRUST_50, PELAT] as unknown[],
      note: "bez luka",
      image: "/menu/diavolo.webp",
      category: "pizza",
      ...overrides,
    };
  }

  function diavolo33(overrides: Record<string, unknown> = {}) {
    return {
      cart_id: "c-diavolo-33",
      menu_item_id: "diavolo-33",
      name: "Diavolo",
      size: "33",
      quantity: 1,
      base_price: 1000,
      price_per_item: 1000,
      addons: [] as unknown[],
      note: null,
      image: "/menu/diavolo.webp",
      category: "pizza",
      ...overrides,
    };
  }

  const cola = {
    cart_id: "c-cola",
    menu_item_id: "cola",
    name: "Coca-Cola 0,33 l",
    size: null,
    quantity: 1,
    base_price: 250,
    price_per_item: 250,
    addons: [],
    note: null,
    image: "/menu/coca-cola.webp",
    category: "pica",
  };

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

  function storedRows(): Record<string, unknown>[] {
    const call = hoisted.calls.find((x) => x.table === "orders" && x.op === "insert");
    return ((call?.payload as Record<string, unknown> | undefined)?.items ?? []) as Record<string, unknown>[];
  }

  // The item rows; the server always stores its own meta row first (B23e).
  function storedItems(): Record<string, unknown>[] {
    return storedRows().filter((r) => r.cart_id !== "meta");
  }

  it("stores an honest cart row exactly as sent: kitchen reads \"1x Diavolo (50)\"", async () => {
    const sent = [diavolo50(), cola];
    const c = await submit(sent, 2500 + 250);

    expect(c.statusCode).toBe(200);
    expect(storedItems()).toEqual(sent);
  });

  it("stores the charged row's size and name, not the size the client sent", async () => {
    const edited = diavolo33({ name: "Diavolo 50 cm XXL", size: "50" });
    const c = await submit([edited], 1000);

    expect(c.statusCode).toBe(200);
    expect(storedItems()[0]).toMatchObject({ name: "Diavolo", size: "33" });
  });

  it("stores a free addon under its own name, not one the client made up", async () => {
    const renamed = { ...KECAP, name: "Ivice punjene sirom 50 cm" };
    const c = await submit([diavolo33({ addons: [renamed] })], 1000);

    expect(c.statusCode).toBe(200);
    expect(storedItems()[0].addons).toEqual([{ id: "kecap", name: "Kečap", price: 0, quantity: 1 }]);
  });

  it("stores the server's line and addon prices when the client shifts them (total unchanged)", async () => {
    const shiftedA = diavolo50({
      base_price: 1000,
      price_per_item: 1000,
      addons: [{ ...CRUST_50, price: 0 }, { ...PELAT, price: 500 }],
    });
    const shiftedB = diavolo33({ base_price: 2000, price_per_item: 2000, quantity: 2 });
    const c = await submit([shiftedA, shiftedB], 2500 + 2 * 1000);

    expect(c.statusCode).toBe(200);
    const [a, b] = storedItems();
    expect(a).toMatchObject({ base_price: 2000, price_per_item: 2500 });
    expect(a.addons).toEqual([CRUST_50, PELAT]);
    expect(b).toMatchObject({ base_price: 1000, price_per_item: 1000, quantity: 2 });
  });

  it("counts addon quantity in price_per_item, as the cart does", async () => {
    const c = await submit([diavolo50({ addons: [CRUST_50, { ...PELAT, quantity: 3 }], price_per_item: 2700 })], 2700);

    expect(c.statusCode).toBe(200);
    expect(storedItems()[0]).toMatchObject({ base_price: 2000, price_per_item: 2000 + 400 + 3 * 100 });
  });

  it("fixes the two prod rows that read wrong in the kitchen", async () => {
    // 2026-06-23: a 50 cm row sent with size null → "1x Montenegro" with no size.
    const noSize = { ...diavolo50(), cart_id: "c-mn", menu_item_id: "montenegro-50", name: "Montenegro", size: null, addons: [], price_per_item: 2000 };
    // 2026-09-17: the size left in the name → "1x Bianco 33 cm (33)".
    const sizeInName = { ...diavolo33(), cart_id: "c-bi", menu_item_id: "bianco-33", name: "Bianco 33 cm", base_price: 1100, price_per_item: 1100 };
    const c = await submit([noSize, sizeInName], 2000 + 1100);

    expect(c.statusCode).toBe(200);
    const [mn, bi] = storedItems();
    expect(mn).toMatchObject({ name: "Montenegro", size: "50" });
    expect(bi).toMatchObject({ name: "Bianco", size: "33" });
  });

  it("keeps a drink's whole name and stores no size for it", async () => {
    const c = await submit([{ ...cola, name: "Coca", size: "50" }], 250);

    expect(c.statusCode).toBe(200);
    expect(storedItems()[0]).toMatchObject({ name: "Coca-Cola 0,33 l", size: null });
  });

  it("keeps the customer's note and each row's cart_id, note, image, category and quantity", async () => {
    const meta = {
      cart_id: "meta",
      menu_item_id: null,
      name: "META",
      size: null,
      quantity: 1,
      base_price: null,
      price_per_item: 0,
      addons: [],
      note: "zvono ne radi\nPlaćanje: Gotovina\nZona: Budva, Dostava: 0€",
      image: "",
      category: "meta",
    };
    const row = diavolo50({ quantity: 2, note: "dobro pečena", category: "pizza" });
    const c = await submit([meta, row], 2 * 2500);

    expect(c.statusCode).toBe(200);
    const [storedMeta, stored] = storedRows();
    expect(storedMeta).toMatchObject({ cart_id: "meta", name: "META", price_per_item: 0, addons: [] });
    expect(storedMeta.note).toBe("Plaćanje: Gotovina\nZona: Budva, Dostava: 0€\nzvono ne radi");
    expect(stored).toMatchObject({
      cart_id: "c-diavolo-50",
      menu_item_id: "diavolo-50",
      quantity: 2,
      note: "dobro pečena",
      image: "/menu/diavolo.webp",
      category: "pizza",
    });
  });

  it("stores the menu rows on a card order too, before Bankart is called", async () => {
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");
    const bankart = { success: true, returnType: "REDIRECT", redirectUrl: "https://pay.example/r", uuid: "u-1" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(bankart)) }),
    );

    const c = await submit([diavolo33({ name: "Diavolo 50 cm", size: "50" })], 1000, { payment_method: "card" });

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).flow).toBe("card_redirect");
    expect(storedItems()[0]).toMatchObject({ name: "Diavolo", size: "33", price_per_item: 1000 });
  });
});

describe("create-order handler — delivery, status and currency are the server's (B23e)", () => {
  const MENU = [
    { id: "pizza-33", name: "Kapričoza 33 cm", price_eur_cents: 900 },
    { id: "pizza-50", name: "Kapričoza 50 cm", price_eur_cents: 1600 },
  ];

  function pizza(id: "pizza-33" | "pizza-50") {
    return {
      cart_id: `c-${id}`,
      menu_item_id: id,
      name: "Kapričoza",
      size: id === "pizza-50" ? "50" : "33",
      quantity: 1,
      price_per_item: id === "pizza-50" ? 1600 : 900,
      addons: [],
    };
  }

  function meta(note: string) {
    return { cart_id: "meta", menu_item_id: null, name: "META", size: null, quantity: 1, price_per_item: 0, addons: [], note, image: "", category: "meta" };
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

  async function submit(body: Record<string, unknown>) {
    const c = makeRes();
    await handler(makeReq(validBody(body)), c.res);
    return c;
  }

  function inserted(): Record<string, unknown> {
    const call = hoisted.calls.find((x) => x.table === "orders" && x.op === "insert");
    return (call?.payload ?? {}) as Record<string, unknown>;
  }

  function storedMeta(): Record<string, unknown>[] {
    return ((inserted().items ?? []) as Record<string, unknown>[]).filter((r) => r.cart_id === "meta");
  }

  function expectInvalidZone(c: CapturedRes) {
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).code).toBe("invalid_delivery_zone");
    expect(insertedInto("orders")).toBe(false);
  }

  it("stores a cash order as pending in EUR, whatever status and currency the request sends", async () => {
    const c = await submit({ items: [pizza("pizza-50")], total_eur_cents: 1600, status: "done", currency: "RSD" });

    expect(c.statusCode).toBe(200);
    expect(inserted()).toMatchObject({ status: "pending", currency: "EUR" });
  });

  it("charges the zone fee below the zone's minimum — a total without it is a mismatch", async () => {
    const short = await submit({ delivery_zone: "becici", items: [pizza("pizza-33")], total_eur_cents: 900 });
    expect(short.statusCode).toBe(400);
    expect(bodyOf(short).error).toBe("Total mismatch");

    hoisted.calls.length = 0;
    const ok = await submit({ delivery_zone: "becici", items: [pizza("pizza-33")], total_eur_cents: 900 + 300 });
    expect(ok.statusCode).toBe(200);
    expect(inserted().total_eur_cents).toBe(1200);
  });

  it("delivers free from the zone's minimum up", async () => {
    const c = await submit({ delivery_zone: "becici", items: [pizza("pizza-50")], total_eur_cents: 1600 });

    expect(c.statusCode).toBe(200);
    expect(inserted().total_eur_cents).toBe(1600);
  });

  it("audit PoC: a note saying \"Dostava: 0\" does not waive the fee", async () => {
    const c = await submit({
      delivery_zone: "lastva",
      items: [meta("Zona: Lastva, Dostava: 0"), pizza("pizza-50")],
      total_eur_cents: 1600,
    });

    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Total mismatch");
    expect(insertedInto("orders")).toBe(false);
  });

  it("rejects an unknown zone key before anything is stored or charged", async () => {
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");

    const c = await submit({ delivery_zone: "petrovac", payment_method: "card", items: [pizza("pizza-50")], total_eur_cents: 1600 });

    expectInvalidZone(c);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("a cart loaded before B23e (no zone key) is charged from the label in its note", async () => {
    const c = await submit({
      delivery_zone: undefined,
      items: [meta("Plaćanje: Gotovina\nZona: Bečići, Dostava: 0€"), pizza("pizza-33")],
      total_eur_cents: 1200,
    });

    expect(c.statusCode).toBe(200);
    expect(inserted().total_eur_cents).toBe(1200);
  });

  it("rejects a request with no zone key and no zone in its note, or an unknown label", async () => {
    expectInvalidZone(await submit({ delivery_zone: undefined, items: [pizza("pizza-50")], total_eur_cents: 1600 }));
    hoisted.calls.length = 0;
    expectInvalidZone(
      await submit({ delivery_zone: undefined, items: [meta("Zona: Petrovac, Dostava: 0"), pizza("pizza-50")], total_eur_cents: 1600 }),
    );
  });

  it("writes payment, zone and fee first in the note; lines in the cart's format are dropped, other text follows", async () => {
    const note = "Plaćanje: Kartica\nDostava: 0\nzvono ne radi\nPlaćanje: Gotovina\nZona: Bečići, Dostava: 3€";
    const c = await submit({ delivery_zone: "becici", items: [meta(note), pizza("pizza-33")], total_eur_cents: 1200 });

    expect(c.statusCode).toBe(200);
    const rows = storedMeta();
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("Plaćanje: Gotovina\nZona: Bečići, Dostava: 3€\nDostava: 0\nzvono ne radi");
    expect(rows[0].order_note).toBe(rows[0].note);
    expect((inserted().items as unknown[])[0]).toBe(rows[0]);
  });

  it("adds the meta row when the request has none, and keeps a single one when it has several", async () => {
    const none = await submit({ delivery_zone: "budva", items: [pizza("pizza-50")], total_eur_cents: 1600 });
    expect(none.statusCode).toBe(200);
    expect(storedMeta().map((r) => r.note)).toEqual(["Plaćanje: Gotovina\nZona: Budva, Dostava: 0€"]);

    hoisted.calls.length = 0;
    const several = await submit({
      delivery_zone: "budva",
      items: [meta("prvi"), pizza("pizza-50"), { ...meta("drugi"), cart_id: "c-x", name: "Meta" }],
      total_eur_cents: 1600,
    });
    expect(several.statusCode).toBe(200);
    expect(storedMeta().map((r) => r.note)).toEqual(["Plaćanje: Gotovina\nZona: Budva, Dostava: 0€\nprvi"]);
    expect((inserted().items as unknown[]).length).toBe(2);
  });

  it("a card order charges Bankart the total with the fee and notes \"Plaćanje: Kartica\"", async () => {
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");
    const bankart = { success: true, returnType: "REDIRECT", redirectUrl: "https://pay.example/r", uuid: "u-1" };
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(bankart)) });
    vi.stubGlobal("fetch", fetchSpy);

    const c = await submit({ delivery_zone: "becici", payment_method: "card", items: [pizza("pizza-33")], total_eur_cents: 1200 });

    expect(c.statusCode).toBe(200);
    const debit = JSON.parse(String((fetchSpy.mock.calls[0] as [string, { body: string }])[1].body)) as Record<string, unknown>;
    expect(debit.amount).toBe("12.00");
    expect(debit.currency).toBe("EUR");
    expect(String(storedMeta()[0].note).split("\n")[0]).toBe("Plaćanje: Kartica");
  });
});

describe("create-order handler — one checkout attempt is one order (B24)", () => {
  const MENU = [{ id: "pizza-50", name: "Kapričoza 50 cm", price_eur_cents: 1600 }];
  const KEY = "3f1c9a52-7d4e-4b8a-9c21-5e6f7a8b9c0d";
  const line = { cart_id: "c-1", menu_item_id: "pizza-50", name: "Kapričoza", size: "50", quantity: 1, price_per_item: 1600, addons: [] };

  beforeEach(() => {
    for (const k of Object.keys(hoisted.tableResults)) delete hoisted.tableResults[k];
    hoisted.calls.length = 0;
    hoisted.idempotency.lookups.length = 0;
    hoisted.idempotency.inserts.length = 0;
    hoisted.tableResults.menu_items = { data: MENU, error: null };
    hoisted.tableResults.orders = { data: { id: "order-new" }, error: null };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function submit(extra: Record<string, unknown> = {}) {
    const c = makeRes();
    await handler(makeReq(validBody({ items: [line], total_eur_cents: 1600, idempotency_key: KEY, ...extra })), c.res);
    return c;
  }

  function inserts(): Record<string, unknown>[] {
    return hoisted.calls.filter((x) => x.table === "orders" && x.op === "insert").map((x) => x.payload as Record<string, unknown>);
  }

  it("stores the attempt key with a new order", async () => {
    const c = await submit();

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).id).toBe("order-new");
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].idempotency_key).toBe(KEY);
  });

  it("a repeated cash attempt gets the first order back — no second order, no second message", async () => {
    hoisted.idempotency.lookups.push({ data: [{ id: "order-first", payment_method: "cash", payment_status: null }], error: null });

    const c = await submit();

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c)).toMatchObject({ ok: true, id: "order-first", flow: "cash", replayed: true });
    expect(inserts()).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("a repeated card attempt gets its Bankart redirect back, without a second debit", async () => {
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");
    hoisted.idempotency.lookups.push({
      data: [
        {
          id: "order-card",
          payment_method: "card",
          payment_status: "pending",
          payment_meta: { phase: "redirect", response: { redirectUrl: "https://pay.example/r" } },
        },
      ],
      error: null,
    });

    const c = await submit({ payment_method: "card" });

    expect(bodyOf(c)).toMatchObject({ id: "order-card", flow: "card_redirect", redirect_url: "https://pay.example/r" });
    expect(inserts()).toHaveLength(0);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("a card attempt whose payment failed is not repeated — the retry is a new order and takes over the key", async () => {
    hoisted.idempotency.lookups.push({ data: [{ id: "order-failed", payment_method: "card", payment_status: "failed" }], error: null });

    const c = await submit();

    expect(bodyOf(c).id).toBe("order-new");
    expect(inserts()).toHaveLength(1);
    // The key moves to the retry, so a lost response of the retry is still deduplicated.
    expect(inserts()[0].idempotency_key).toBe(KEY);
    expect(hoisted.calls.some((x) => x.table === "orders" && x.op === "update")).toBe(true);
  });

  it("two identical attempts racing: the loser answers with the winner's order", async () => {
    hoisted.idempotency.lookups.push({ data: [], error: null });
    hoisted.idempotency.lookups.push({ data: [{ id: "order-winner", payment_method: "cash", payment_status: null }], error: null });
    hoisted.idempotency.inserts.push({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } });

    const c = await submit();

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c)).toMatchObject({ id: "order-winner", replayed: true });
  });

  it("before the migration (no column) the order is still taken, without the key", async () => {
    hoisted.idempotency.lookups.push({ data: null, error: { code: "42703", message: "column orders.idempotency_key does not exist" } });
    hoisted.idempotency.inserts.push({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'idempotency_key' column of 'orders' in the schema cache" },
    });

    const c = await submit();

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).id).toBe("order-new");
    expect(inserts()).toHaveLength(2);
    expect(inserts()[1].idempotency_key).toBeUndefined();
  });

  it("ignores a key that is not a plausible random id", async () => {
    const c = await submit({ idempotency_key: "short" });

    expect(c.statusCode).toBe(200);
    expect(inserts()[0].idempotency_key).toBeUndefined();
  });
});

describe("create-order handler — code review fixes (B24 review)", () => {
  const MENU = [{ id: "pizza-50", name: "Kapričoza 50 cm", price_eur_cents: 1600 }];
  const KEY = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
  const line = { cart_id: "c-1", menu_item_id: "pizza-50", name: "Kapričoza", size: "50", quantity: 1, price_per_item: 1600, addons: [] };
  const CARD_ERROR = "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.";

  beforeEach(() => {
    for (const k of Object.keys(hoisted.tableResults)) delete hoisted.tableResults[k];
    hoisted.calls.length = 0;
    hoisted.idempotency.lookups.length = 0;
    hoisted.idempotency.inserts.length = 0;
    hoisted.tableResults.menu_items = { data: MENU, error: null };
    hoisted.tableResults.orders = { data: { id: "order-new" }, error: null };
    vi.stubEnv("BANKART_API_KEY", "test-key");
    vi.stubEnv("BANKART_API_USERNAME", "test-user");
    vi.stubEnv("BANKART_API_PASSWORD", "test-pass");
    vi.stubEnv("BANKART_SHARED_SECRET", "test-secret");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function submitCard(extra: Record<string, unknown> = {}) {
    const c = makeRes();
    await handler(
      makeReq(validBody({ items: [line], total_eur_cents: 1600, payment_method: "card", idempotency_key: KEY, ...extra })),
      c.res,
    );
    return c;
  }

  function updates(): Record<string, unknown>[] {
    return hoisted.calls.filter((x) => x.table === "orders" && x.op === "update").map((x) => x.payload as Record<string, unknown>);
  }

  it("a card decline (Bankart's own text, no \"Bankart\" in it) gets the card-payment message", async () => {
    const declined = { success: false, errors: [{ errorMessage: "The transaction was declined" }] };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(declined)) }));

    const c = await submitCard();

    expect(c.statusCode).toBe(500);
    expect(bodyOf(c).error).toBe(CARD_ERROR);
    expect(updates()[0]).toMatchObject({ status: "cancelled", payment_status: "failed" });
  });

  it("a network error on the debit leaves the order pending (outcome unknown), not failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")));

    const c = await submitCard();

    expect(c.statusCode).toBe(500);
    expect(bodyOf(c).error).toBe(CARD_ERROR);
    expect(updates()).toHaveLength(1);
    expect(updates()[0].payment_status).toBeUndefined();
    expect(updates()[0].status).toBeUndefined();
    expect((updates()[0].payment_meta as Record<string, unknown>).phase).toBe("init_network_error");
  });

  it("a retry after closing time still gets the order that was placed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T10:00:00Z")); // 11:00 Podgorica
    hoisted.tableResults.site_settings = { data: { orders_open_time: "12:00", orders_close_time: "23:00", hours_display: "12–23" }, error: null };
    hoisted.idempotency.lookups.push({ data: [{ id: "order-placed", payment_method: "cash", payment_status: null }], error: null });
    vi.stubGlobal("fetch", vi.fn());

    const c = makeRes();
    await handler(makeReq(validBody({ items: [line], total_eur_cents: 1600, idempotency_key: KEY })), c.res);

    expect(c.statusCode).toBe(200);
    expect(bodyOf(c)).toMatchObject({ id: "order-placed", replayed: true });
  });

  it("a race lost to an attempt whose card then failed is reported as failed, never as pending", async () => {
    vi.stubGlobal("fetch", vi.fn());
    hoisted.idempotency.lookups.push({ data: [], error: null });
    hoisted.idempotency.lookups.push({ data: [{ id: "order-a", payment_method: "card", payment_status: "failed" }], error: null });
    hoisted.idempotency.inserts.push({ data: null, error: { code: "23505", message: "duplicate key" } });

    const c = await submitCard();

    expect(c.statusCode).toBe(409);
    expect(bodyOf(c)).toMatchObject({ ok: false, code: "payment_not_completed" });
  });
});
