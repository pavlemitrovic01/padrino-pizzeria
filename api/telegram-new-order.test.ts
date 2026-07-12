import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── hoisted state — available inside vi.mock factory ─────────────────
// Simulates the `orders.telegram_notified_at` column so the atomic claim
// (UPDATE ... WHERE telegram_notified_at IS NULL) can be exercised for real:
// the FIRST claim on a NULL row wins (returns the id), later claims get 0 rows.

const hoisted = vi.hoisted(() => {
  const state = {
    orders: {} as Record<string, Record<string, unknown>>,
    forceClaimError: false,
    updatePatches: [] as Record<string, unknown>[],
  };

  function readResult(id: string | null) {
    const row = id ? state.orders[id] : undefined;
    return row ? { data: row, error: null } : { data: null, error: { message: "not found" } };
  }

  // .update(patch).eq("id", id).is("telegram_notified_at", null).select("id")
  function applyClaim(id: string | null, patch: Record<string, unknown>) {
    if (state.forceClaimError) return { data: null, error: { message: "claim boom" } };
    const row = id ? state.orders[id] : undefined;
    if (!row) return { data: [], error: null };
    if (row.telegram_notified_at == null) {
      row.telegram_notified_at = patch.telegram_notified_at; // NULL -> now()
      return { data: [{ id: row.id }], error: null };
    }
    return { data: [], error: null }; // already claimed
  }

  // .update(patch).eq("id", id)  — release/reset path (patch.telegram_notified_at === null)
  function applyReset(id: string | null, patch: Record<string, unknown>) {
    const row = id ? state.orders[id] : undefined;
    if (row) row.telegram_notified_at = patch.telegram_notified_at;
    return { data: null, error: null };
  }

  return { state, readResult, applyClaim, applyReset };
});

vi.mock("@supabase/supabase-js", () => {
  function makeBuilder(): Record<string, unknown> {
    const ctx: { patch: Record<string, unknown> | null; id: string | null } = { patch: null, id: null };
    const b: Record<string, unknown> = {};

    b.select = (_cols?: string) => {
      // A .select() AFTER an .update() is the terminal of the claim query.
      if (ctx.patch) return Promise.resolve(hoisted.applyClaim(ctx.id, ctx.patch));
      return b; // read path: .select("*").eq().single()
    };
    b.eq = (col: string, val: string) => {
      if (col === "id") ctx.id = val;
      return b;
    };
    b.is = () => b;
    b.in = () => b;
    b.single = () => Promise.resolve(hoisted.readResult(ctx.id));
    b.maybeSingle = () => Promise.resolve(hoisted.readResult(ctx.id));
    b.update = (patch: Record<string, unknown>) => {
      ctx.patch = { ...patch };
      hoisted.state.updatePatches.push({ ...patch });
      return b;
    };
    // Terminal await with no trailing .select() → reset (update.eq) path.
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const res = ctx.patch ? hoisted.applyReset(ctx.id, ctx.patch) : hoisted.readResult(ctx.id);
      return Promise.resolve(res).then(onF, onR);
    };
    return b;
  }

  return {
    createClient: () => ({
      from: (_table: string) => makeBuilder(),
      auth: { getUser: vi.fn() },
    }),
  };
});

import handler from "./telegram-new-order.js";

// ─── fetch mock (Telegram sendMessage) ────────────────────────────────

let fetchCount = 0;
let telegramOk = true;

function installFetch() {
  fetchCount = 0;
  telegramOk = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      fetchCount++;
      return { ok: telegramOk, status: telegramOk ? 200 : 500 } as Response;
    }),
  );
}

// ─── req/res fakes ────────────────────────────────────────────────────

type ResMock = {
  statusCode: number;
  body: string | null;
  status: (c: number) => ResMock;
  setHeader: (n: string, v: string) => void;
  send: (b: string) => void;
};

function buildReq(body: unknown, headers: Record<string, string> = {}) {
  return { method: "POST", headers, body };
}

function buildRes(): ResMock {
  const res: ResMock = {
    statusCode: 0,
    body: null,
    status(c: number) {
      this.statusCode = c;
      return this;
    },
    setHeader() {},
    send(b: string) {
      this.body = b;
    },
  };
  return res;
}

function seedOrder(id: string, notified: string | null = null) {
  hoisted.state.orders[id] = {
    id,
    customer_name: "Test Kupac",
    customer_phone: "069123456",
    customer_address: "Jadranska 1",
    status: "pending",
    total_eur_cents: 1500,
    items: [{ cart_id: "c1", name: "Margarita", category: "pizza", quantity: 1 }],
    note: "",
    telegram_notified_at: notified,
  };
}

describe("telegram-new-order — idempotent claim", () => {
  beforeEach(() => {
    hoisted.state.orders = {};
    hoisted.state.forceClaimError = false;
    hoisted.state.updatePatches = [];
    process.env.TELEGRAM_BOT_TOKEN = "test-bot-token";
    process.env.TELEGRAM_CHAT_ID = "test-chat-id";
    installFetch();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("first call sends, second call for same order is an idempotent no-op", async () => {
    seedOrder("order-1");

    const res1 = buildRes();
    await handler(buildReq({ order_id: "order-1" }) as never, res1 as never);
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body ?? "{}")).toMatchObject({ ok: true, telegram: "sent" });
    expect(fetchCount).toBe(1);

    // Second caller (e.g. webhook after the poll already sent) must NOT re-send.
    const res2 = buildRes();
    await handler(buildReq({ order_id: "order-1" }) as never, res2 as never);
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.body ?? "{}")).toMatchObject({ ok: true, telegram: "already_sent" });
    expect(fetchCount).toBe(1); // still 1 — no duplicate Telegram message
  });

  it("an already-notified order (claimed earlier) does not send again", async () => {
    seedOrder("order-2", "2026-07-12T10:00:00.000Z");

    const res = buildRes();
    await handler(buildReq({ order_id: "order-2" }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ telegram: "already_sent" });
    expect(fetchCount).toBe(0);
  });

  it("fail-open: a claim (DB) error still sends — never blocks the notification", async () => {
    seedOrder("order-3");
    hoisted.state.forceClaimError = true;

    const res = buildRes();
    await handler(buildReq({ order_id: "order-3" }) as never, res as never);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body ?? "{}")).toMatchObject({ ok: true, telegram: "sent" });
    expect(fetchCount).toBe(1);
  });

  it("send failure releases the claim (reset to null) so a retry can deliver", async () => {
    seedOrder("order-4");
    telegramOk = false;

    const res = buildRes();
    await handler(buildReq({ order_id: "order-4" }) as never, res as never);
    expect(res.statusCode).toBe(502);
    // claim was taken then released → column back to null for retry/admin resend
    expect(hoisted.state.orders["order-4"].telegram_notified_at).toBeNull();
    const resetPatch = hoisted.state.updatePatches.at(-1);
    expect(resetPatch).toMatchObject({ telegram_notified_at: null });
  });

  it("missing order_id → 400", async () => {
    const res = buildRes();
    await handler(buildReq({}) as never, res as never);
    expect(res.statusCode).toBe(400);
    expect(fetchCount).toBe(0);
  });
});
