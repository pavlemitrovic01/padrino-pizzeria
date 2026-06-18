import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * E1 — api/create-order.ts hostile-input characterization (server-side).
 *
 * Drives the exported default handler with a fake req/res and a mocked
 * Supabase client. Proves the price-validation defense
 * (api/create-order.ts:1037-1090) actually rejects tampered input:
 * tampered total, invalid items, unknown menu id, bad payment_method.
 *
 * No source file is modified (api/create-order.ts is LOCK ZONE).
 * Rate limiting is inert because UPSTASH_* env is intentionally unset
 * (getRatelimit() -> null). Cash path only -> no Bankart config touched.
 */

type SupabaseResult = { data: unknown; error: unknown };

const hoisted = vi.hoisted(() => {
  // buildSupabaseAdmin() runs at module import and throws without these.
  process.env.SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";

  const tableResults: Record<string, SupabaseResult> = {};

  return { tableResults };
});

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
    builder.then = (
      onF: (v: SupabaseResult) => unknown,
      onR?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onF, onR);
    return builder;
  }

  return {
    createClient: () => ({
      from: (table: string) =>
        makeBuilder(hoisted.tableResults[table] ?? { data: [], error: null }),
    }),
  };
});

import handler from "../../api/create-order";

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

type Body = Record<string, unknown>;

function makeReq(body: Body, method = "POST") {
  return { method, headers: {} as Record<string, string>, body };
}

const validItem = {
  cart_id: "cart-1",
  menu_item_id: "item-1",
  name: "Pizza Margherita",
  quantity: 2,
  price_per_item: 1000,
  addons: [],
};

function validBody(overrides: Partial<Body> = {}): Body {
  return {
    customer_name: "Test Kupac",
    customer_phone: "0671234567",
    customer_address: "Jadranski put 1, Budva",
    payment_method: "cash",
    items: [validItem],
    total_eur_cents: 2000, // 2 x 1000
    ...overrides,
  };
}

function setMenuPrice(id: string, priceEurCents: number) {
  hoisted.tableResults.menu_items = {
    data: [{ id, price_eur_cents: priceEurCents }],
    error: null,
  };
}

function bodyOf(captured: CapturedRes): Record<string, unknown> {
  return captured.body as Record<string, unknown>;
}

beforeEach(() => {
  for (const k of Object.keys(hoisted.tableResults)) {
    delete hoisted.tableResults[k];
  }
  hoisted.tableResults.orders = {
    data: { id: "order-test-id" },
    error: null,
  };
  // Telegram best-effort fetch on the cash success path — keep it inert.
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
  );
});

describe("create-order handler — method + transport guards", () => {
  it("rejects non-POST with 405", async () => {
    const c = makeRes();
    await handler(makeReq(validBody(), "GET"), c.res);
    expect(c.statusCode).toBe(405);
    expect(bodyOf(c).ok).toBe(false);
  });

  it("answers OPTIONS preflight with 204", async () => {
    const c = makeRes();
    await handler(makeReq({}, "OPTIONS"), c.res);
    expect(c.statusCode).toBe(204);
  });
});

describe("create-order handler — hostile input is rejected (price-validation defense)", () => {
  it("rejects unknown payment_method with 400", async () => {
    setMenuPrice("item-1", 1000);
    const c = makeRes();
    await handler(makeReq(validBody({ payment_method: "crypto" })), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Invalid payment_method");
  });

  it("rejects short/empty customer fields with 400 Invalid payload", async () => {
    const c = makeRes();
    await handler(
      makeReq(validBody({ customer_name: "X", customer_phone: "1", customer_address: "" })),
      c.res,
    );
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Invalid payload");
  });

  it("rejects empty cart with 400 Invalid payload", async () => {
    const c = makeRes();
    await handler(makeReq(validBody({ items: [] })), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Invalid payload");
  });

  it("rejects item that looks real but has no menu_item_id with 400 Invalid item structure", async () => {
    const c = makeRes();
    const badItem = { name: "Phantom Pizza", quantity: 1 };
    await handler(makeReq(validBody({ items: [badItem] })), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Invalid item structure");
  });

  it("rejects unknown / inactive menu_item_id with 400", async () => {
    // Price map intentionally empty -> id is "missing".
    hoisted.tableResults.menu_items = { data: [], error: null };
    const c = makeRes();
    await handler(makeReq(validBody()), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Inactive or invalid menu item");
  });

  it("rejects tampered total (client sends lower total than server recomputes) with 400 Total mismatch", async () => {
    setMenuPrice("item-1", 1000); // server: 2 x 1000 = 2000 cents
    const c = makeRes();
    // Attacker lowers the price they pay.
    await handler(makeReq(validBody({ total_eur_cents: 100 })), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Total mismatch");
  });

  it("rejects tampered per-item price by recomputing from DB (Total mismatch)", async () => {
    setMenuPrice("item-1", 1000); // real price 1000 cents/item
    const c = makeRes();
    // Attacker rewrites price_per_item to 1 and matches the fake total.
    await handler(
      makeReq(
        validBody({
          items: [{ ...validItem, price_per_item: 1 }],
          total_eur_cents: 2, // matches the tampered 2 x 1, NOT the real 2000
        }),
      ),
      c.res,
    );
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Total mismatch");
  });
});

describe("create-order handler — negative control (well-formed input is accepted)", () => {
  it("accepts a well-formed cash order whose total matches server recompute", async () => {
    setMenuPrice("item-1", 1000); // 2 x 1000 = 2000 cents == body total
    const c = makeRes();
    await handler(makeReq(validBody({ total_eur_cents: 2000 })), c.res);
    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).ok).toBe(true);
    expect(bodyOf(c).flow).toBe("cash");
    expect(bodyOf(c).orderId).toBe("order-test-id");
  });

  it("accepts when client omits total entirely (server-computed total is authoritative)", async () => {
    setMenuPrice("item-1", 1000);
    const c = makeRes();
    const body = validBody();
    delete body.total_eur_cents;
    await handler(makeReq(body), c.res);
    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).ok).toBe(true);
  });
});

describe("create-order handler — B17: active free (zero-price) addon is valid", () => {
  // Regression for "Inactive or invalid menu item" 400 triggered by free
  // addons (Kečap/Majonez/Pelat — active in menu_items but price_eur_cents = 0).
  // The price map must include active rows regardless of price so the existence
  // check does not flag a free addon as missing.

  function setMenuPrices(rows: { id: string; price_eur_cents: number }[]) {
    hoisted.tableResults.menu_items = { data: rows, error: null };
  }

  const itemWithFreeAddon = {
    cart_id: "cart-1",
    menu_item_id: "item-1",
    name: "Pizza Margherita",
    quantity: 2,
    price_per_item: 1000,
    addons: [{ id: "sauce-free", name: "Kečap", price: 0, quantity: 1 }],
  };

  it("accepts a pizza + free addon (does NOT return 'Inactive or invalid menu item')", async () => {
    // item-1 priced, sauce-free active at 0 cents.
    setMenuPrices([
      { id: "item-1", price_eur_cents: 1000 },
      { id: "sauce-free", price_eur_cents: 0 },
    ]);
    const c = makeRes();
    // Server subtotal = 2 x 1000 (base) + 2 x 0 (addon) = 2000.
    await handler(makeReq(validBody({ items: [itemWithFreeAddon], total_eur_cents: 2000 })), c.res);
    expect(bodyOf(c).error).not.toBe("Inactive or invalid menu item");
    expect(c.statusCode).toBe(200);
    expect(bodyOf(c).ok).toBe(true);
  });

  it("still rejects a free addon whose id is NOT in the active menu set", async () => {
    // Only the base item is active; the addon id is absent -> genuinely missing.
    setMenuPrices([{ id: "item-1", price_eur_cents: 1000 }]);
    const c = makeRes();
    await handler(makeReq(validBody({ items: [itemWithFreeAddon], total_eur_cents: 2000 })), c.res);
    expect(c.statusCode).toBe(400);
    expect(bodyOf(c).error).toBe("Inactive or invalid menu item");
  });
});
