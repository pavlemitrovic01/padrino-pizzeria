import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SupabaseResult = { data: unknown; error: unknown };
type Call = { table: string; op: string };

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
      hoisted.calls.push({ table, op: "insert" });
      void args;
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
