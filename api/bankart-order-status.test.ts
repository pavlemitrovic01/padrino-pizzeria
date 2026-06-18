import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── hoisted state — available in vi.mock factory ─────────────

const hoisted = vi.hoisted(() => {
  process.env.SUPABASE_URL = "http://supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test-key";
  process.env.BANKART_API_KEY = "test-bankart-api-key";

  const state = {
    tableResults: {} as Record<string, { data: unknown; error: unknown }>,
    lastUpdatePatch: null as Record<string, unknown> | null,
    updateCallCount: 0,
  };
  return { state };
});

// ─── supabase mock ────────────────────────────────────────────

vi.mock("@supabase/supabase-js", () => {
  function makeUpdateEqBuilder(): Record<string, unknown> {
    const b: Record<string, unknown> = {};
    b.eq = () => b;
    b.then = (
      onF: (v: { data: unknown; error: unknown }) => unknown,
      onR?: (e: unknown) => unknown,
    ) => Promise.resolve({ data: null, error: null }).then(onF, onR);
    return b;
  }

  function makeBuilder(result: { data: unknown; error: unknown }): Record<string, unknown> {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.in = () => b;
    b.maybeSingle = () => Promise.resolve(result);
    b.single = () => Promise.resolve(result);
    b.update = (patch: Record<string, unknown>) => {
      hoisted.state.lastUpdatePatch = { ...patch };
      hoisted.state.updateCallCount++;
      return makeUpdateEqBuilder();
    };
    b.then = (
      onF: (v: { data: unknown; error: unknown }) => unknown,
      onR?: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(onF, onR);
    return b;
  }

  return {
    createClient: () => ({
      from: (table: string) =>
        makeBuilder(hoisted.state.tableResults[table] ?? { data: null, error: null }),
      auth: { getUser: vi.fn() },
    }),
  };
});

import handler from "./bankart-order-status.js";

// ─── helpers ─────────────────────────────────────────────────

type Res = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => Res;
  send: (body: string) => void;
};

function makeRes() {
  const captured = { statusCode: 0, body: undefined as unknown };
  const res: Res = {
    setHeader: () => {},
    status(code: number) {
      captured.statusCode = code;
      return res;
    },
    send(raw: string) {
      try {
        captured.body = JSON.parse(raw);
      } catch {
        captured.body = raw;
      }
    },
  };
  return { captured, res };
}

function makeGetReq(orderId: string) {
  return {
    method: "GET",
    url: `/api/bankart-order-status?id=${encodeURIComponent(orderId)}`,
    headers: {},
  };
}

function stubBankartFetch(body: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(JSON.stringify(body)),
    }),
  );
}

const cardPaidOrder = {
  id: "order-status-1",
  status: "confirmed",
  payment_method: "card",
  payment_status: "paid",
  payment_provider: "bankart",
  payment_reference: "ref-paid",
  payment_meta: null,
};

const cashOrder = {
  id: "order-status-2",
  status: "confirmed",
  payment_method: "cash",
  payment_status: "pending",
  payment_provider: null,
  payment_reference: null,
  payment_meta: null,
};

beforeEach(() => {
  hoisted.state.tableResults = {};
  hoisted.state.lastUpdatePatch = null;
  hoisted.state.updateCallCount = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve("{}") }),
  );
});

// ─── shouldSkipStatusRefreshForPaymentStatus gate ─────────────
describe("handler — skip gate (shouldSkipStatusRefreshForPaymentStatus)", () => {
  it("A1: refunded card order is NOT refreshed via Bankart (skip gate)", async () => {
    const refundedOrder = { ...cardPaidOrder, id: "order-a1", payment_status: "refunded" };
    hoisted.state.tableResults.orders = { data: refundedOrder, error: null };
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { captured, res } = makeRes();
    await handler(makeGetReq(refundedOrder.id), res);

    expect(captured.statusCode).toBe(200);
    const body = captured.body as Record<string, unknown>;
    expect(body.source).toBe("db");
    expect(body.refreshed).toBe(false);
    expect(fetchSpy.mock.calls.length).toBe(0);
  });

  it("A2: paid card order IS refreshed via Bankart (ed51537 — paid is not a skip status)", async () => {
    hoisted.state.tableResults.orders = { data: cardPaidOrder, error: null };
    stubBankartFetch({
      success: true,
      transactionStatus: "SUCCESS",
      transactionType: "DEBIT",
      uuid: "uuid-a2",
    });

    const { captured, res } = makeRes();
    await handler(makeGetReq(cardPaidOrder.id), res);

    expect(captured.statusCode).toBe(200);
    const body = captured.body as Record<string, unknown>;
    expect(body.refreshed).toBe(true);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});

// ─── refund-sync status-poll (applyBankartStatusToOrder) ──────
describe("handler — refund-sync status-poll (applyBankartStatusToOrder)", () => {
  it("B1: REFUND/SUCCESS → payment_status updated to refunded", async () => {
    hoisted.state.tableResults.orders = { data: cardPaidOrder, error: null };
    stubBankartFetch({
      success: true,
      transactionStatus: "SUCCESS",
      transactionType: "REFUND",
      uuid: "uuid-b1",
    });

    const { captured, res } = makeRes();
    await handler(makeGetReq(cardPaidOrder.id), res);

    expect(captured.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("refunded");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("B2: CHARGEBACK/SUCCESS → payment_status updated to refunded", async () => {
    hoisted.state.tableResults.orders = { data: cardPaidOrder, error: null };
    stubBankartFetch({
      success: true,
      transactionStatus: "SUCCESS",
      transactionType: "CHARGEBACK",
      uuid: "uuid-b2",
    });

    const { captured, res } = makeRes();
    await handler(makeGetReq(cardPaidOrder.id), res);

    expect(captured.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("refunded");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("B3: cash order returns early — source=db_cash, no Bankart fetch", async () => {
    hoisted.state.tableResults.orders = { data: cashOrder, error: null };
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { captured, res } = makeRes();
    await handler(makeGetReq(cashOrder.id), res);

    expect(captured.statusCode).toBe(200);
    const body = captured.body as Record<string, unknown>;
    expect(body.source).toBe("db_cash");
    expect(body.refreshed).toBe(false);
    expect(fetchSpy.mock.calls.length).toBe(0);
  });
});
