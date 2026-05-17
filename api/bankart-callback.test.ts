import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import type { ServerResponse, IncomingMessage } from "node:http";

// ─── hoisted state — available in vi.mock factory ─────────────

const hoisted = vi.hoisted(() => {
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

import handler, {
  createBankartSignature,
  safeEqualSignature,
  isDateFresh,
  verifyBankartCallbackSignature,
  type ReqLike,
} from "./bankart-callback";

// ─── helpers ─────────────────────────────────────────────────

function buildReq(opts: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
}): ReqLike {
  return {
    method: opts.method ?? "POST",
    url: opts.url ?? "/api/bankart-callback",
    headers: opts.headers ?? {},
  } as unknown as ReqLike;
}

function buildResMock() {
  return {
    statusCode: 0,
    setHeader: vi.fn(),
    end: vi.fn(),
  };
}

function makeStreamReq(
  rawBody: string,
  opts: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
  } = {},
): ReqLike {
  const stream = Readable.from([rawBody]);
  return Object.assign(stream, {
    method: opts.method ?? "POST",
    url: opts.url ?? "/api/bankart-callback",
    headers: opts.headers ?? {},
  }) as unknown as ReqLike;
}

const SECRET = "test-bankart-secret"; // matches vitest.setup.ts BANKART_SHARED_SECRET
const BODY = JSON.stringify({ result: "OK", uuid: "test-uuid" });
const CONTENT_TYPE = "application/json";
const URI = "/api/bankart-callback";

function computeSignature(
  secret: string,
  method: string,
  contentType: string,
  dateHeader: string,
  uri: string,
  body: string,
): string {
  const bodyHash = crypto.createHash("sha512").update(body, "utf8").digest("hex");
  const message = [method.toUpperCase(), bodyHash, contentType, dateHeader, uri].join("\n");
  return crypto.createHmac("sha512", secret).update(message, "utf8").digest("base64");
}

function makeSignedReq(rawBody: string): ReqLike {
  const dateHeader = new Date().toUTCString();
  const sig = createBankartSignature(SECRET, "POST", CONTENT_TYPE, dateHeader, URI, rawBody);
  return makeStreamReq(rawBody, {
    headers: { "x-signature": sig, "x-date": dateHeader, "content-type": CONTENT_TYPE },
  });
}

const pendingOrder = {
  id: "order-test-1",
  status: "pending",
  payment_method: "bankart",
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
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
  );
});

// ─── createBankartSignature ───────────────────────────────────
describe("createBankartSignature", () => {
  const now = new Date().toUTCString();

  it("returns deterministic HMAC for identical inputs", () => {
    const a = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    expect(a).toBe(b);
  });

  it("differs when secret differs", () => {
    const a = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = createBankartSignature("other-secret", "POST", CONTENT_TYPE, now, URI, BODY);
    expect(a).not.toBe(b);
  });

  it("differs when body differs by one byte", () => {
    const a = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY + "x");
    expect(a).not.toBe(b);
  });

  it("normalizes method to uppercase", () => {
    const a = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = createBankartSignature(SECRET, "post", CONTENT_TYPE, now, URI, BODY);
    expect(a).toBe(b);
  });

  it("differs when request URI differs", () => {
    const a = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = createBankartSignature(SECRET, "POST", CONTENT_TYPE, now, "/api/other", BODY);
    expect(a).not.toBe(b);
  });
});

// ─── safeEqualSignature ───────────────────────────────────────
describe("safeEqualSignature", () => {
  it("returns true for identical signatures", () => {
    const sig = computeSignature(SECRET, "POST", CONTENT_TYPE, new Date().toUTCString(), URI, BODY);
    expect(safeEqualSignature(sig, sig)).toBe(true);
  });

  it("returns false for same-length differing signatures", () => {
    const now = new Date().toUTCString();
    const a = computeSignature(SECRET, "POST", CONTENT_TYPE, now, URI, BODY);
    const b = computeSignature("different-secret", "POST", CONTENT_TYPE, now, URI, BODY);
    expect(a.length).toBe(b.length);
    expect(safeEqualSignature(a, b)).toBe(false);
  });

  it("returns false for different-length signatures", () => {
    expect(safeEqualSignature("short", "a-much-longer-string-here")).toBe(false);
  });
});

// ─── isDateFresh ──────────────────────────────────────────────
describe("isDateFresh", () => {
  it("returns true for current time", () => {
    expect(isDateFresh(new Date().toUTCString())).toBe(true);
  });

  it("returns true for time 60s in past", () => {
    const past = new Date(Date.now() - 60_000).toUTCString();
    expect(isDateFresh(past)).toBe(true);
  });

  it("returns false for time 400s in past (>300 default skew)", () => {
    const past = new Date(Date.now() - 400_000).toUTCString();
    expect(isDateFresh(past)).toBe(false);
  });

  it("returns false for time 400s in future", () => {
    const future = new Date(Date.now() + 400_000).toUTCString();
    expect(isDateFresh(future)).toBe(false);
  });

  it("returns false for non-parseable date", () => {
    expect(isDateFresh("not-a-date")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isDateFresh("")).toBe(false);
  });
});

// ─── verifyBankartCallbackSignature ───────────────────────────
describe("verifyBankartCallbackSignature", () => {
  it("returns ok=true with valid signature + fresh date", () => {
    const dateHeader = new Date().toUTCString();
    const sig = computeSignature(SECRET, "POST", CONTENT_TYPE, dateHeader, URI, BODY);
    const req = buildReq({
      headers: { "x-signature": sig, "x-date": dateHeader, "content-type": CONTENT_TYPE },
    });
    expect(verifyBankartCallbackSignature(req, BODY)).toEqual({ ok: true });
  });

  it("returns ok=false with reason='Missing x-signature header'", () => {
    const dateHeader = new Date().toUTCString();
    const req = buildReq({ headers: { "x-date": dateHeader } });
    const result = verifyBankartCallbackSignature(req, BODY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Missing x-signature header");
  });

  it("returns ok=false with reason='Missing date header'", () => {
    const req = buildReq({ headers: { "x-signature": "any-value" } });
    const result = verifyBankartCallbackSignature(req, BODY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Missing date header");
  });

  it("returns ok=false with reason='Date header outside allowed skew'", () => {
    const staleDate = new Date(Date.now() - 400_000).toUTCString();
    const sig = computeSignature(SECRET, "POST", CONTENT_TYPE, staleDate, URI, BODY);
    const req = buildReq({
      headers: { "x-signature": sig, "x-date": staleDate, "content-type": CONTENT_TYPE },
    });
    const result = verifyBankartCallbackSignature(req, BODY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Date header outside allowed skew");
  });

  it("returns ok=false with reason='Invalid callback signature'", () => {
    const dateHeader = new Date().toUTCString();
    const req = buildReq({
      headers: {
        "x-signature": "bad-signature",
        "x-date": dateHeader,
        "content-type": CONTENT_TYPE,
      },
    });
    const result = verifyBankartCallbackSignature(req, BODY);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Invalid callback signature");
  });

  it("accepts content-type default 'application/json' when header absent", () => {
    const dateHeader = new Date().toUTCString();
    const sig = computeSignature(SECRET, "POST", "application/json", dateHeader, URI, BODY);
    const req = buildReq({
      headers: { "x-signature": sig, "x-date": dateHeader },
    });
    expect(verifyBankartCallbackSignature(req, BODY)).toEqual({ ok: true });
  });

  it("uses x-date header in preference to date when both present", () => {
    const xDate = new Date().toUTCString();
    const staleDate = new Date(Date.now() - 400_000).toUTCString();
    const sig = computeSignature(SECRET, "POST", CONTENT_TYPE, xDate, URI, BODY);
    const req = buildReq({
      headers: {
        "x-signature": sig,
        "x-date": xDate,
        "date": staleDate,
        "content-type": CONTENT_TYPE,
      },
    });
    expect(verifyBankartCallbackSignature(req, BODY)).toEqual({ ok: true });
  });
});

// ─── handler smoke ────────────────────────────────────────────
describe("handler (smoke)", () => {
  it("returns 405 on GET method", async () => {
    const res = buildResMock();
    await handler(buildReq({ method: "GET" }), res as unknown as ServerResponse<IncomingMessage>);
    expect(res.statusCode).toBe(405);
  });
});

// ─── handler integration (payment→DB flow) ───────────────────
describe("handler integration — Bankart callback payment→DB flow", () => {
  it("DEBIT/OK on pending order: patches payment_status=paid and notifies Telegram once", async () => {
    hoisted.state.tableResults.orders = { data: pendingOrder, error: null };
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "DEBIT",
      merchantTransactionId: pendingOrder.id,
      uuid: "uuid-debit-ok",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(res.end).toHaveBeenCalledWith("OK");
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("paid");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("DEBIT/OK duplicate (already paid): updates DB but does NOT notify Telegram", async () => {
    hoisted.state.tableResults.orders = {
      data: { ...pendingOrder, payment_status: "paid" },
      error: null,
    };
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "DEBIT",
      merchantTransactionId: pendingOrder.id,
      uuid: "uuid-debit-ok-dup",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("paid");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("DEBIT/ERROR: patches payment_status=failed + status=cancelled, no Telegram", async () => {
    hoisted.state.tableResults.orders = { data: pendingOrder, error: null };
    const rawBody = JSON.stringify({
      result: "ERROR",
      transactionType: "DEBIT",
      merchantTransactionId: pendingOrder.id,
      uuid: "uuid-debit-err",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("failed");
    expect(hoisted.state.lastUpdatePatch?.status).toBe("cancelled");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("order not found: returns 200 OK without updating DB or notifying Telegram", async () => {
    // all table lookups return {data:null} by default — no order found
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "DEBIT",
      merchantTransactionId: "no-such-order",
      uuid: "no-such-uuid",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(res.end).toHaveBeenCalledWith("OK");
    expect(hoisted.state.updateCallCount).toBe(0);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});

const paidOrder = {
  id: "order-test-2",
  status: "confirmed",
  payment_method: "bankart",
  payment_status: "paid",
  payment_provider: "bankart",
  payment_reference: "ref-paid",
  payment_meta: null,
};

// ─── handler integration (refund/chargeback flow) ─────────────
describe("handler integration — refund/chargeback flow", () => {
  it("REFUND/OK on paid order: patches payment_status=refunded, no Telegram", async () => {
    hoisted.state.tableResults.orders = { data: paidOrder, error: null };
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "REFUND",
      merchantTransactionId: paidOrder.id,
      uuid: "uuid-refund-ok",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("refunded");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("CHARGEBACK/OK on paid order: patches payment_status=refunded, no Telegram", async () => {
    hoisted.state.tableResults.orders = { data: paidOrder, error: null };
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "CHARGEBACK",
      merchantTransactionId: paidOrder.id,
      uuid: "uuid-chargeback-ok",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("refunded");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("REFUND/ERROR on paid order: DB updated with existing status, no cancellation", async () => {
    hoisted.state.tableResults.orders = { data: paidOrder, error: null };
    const rawBody = JSON.stringify({
      result: "ERROR",
      transactionType: "REFUND",
      merchantTransactionId: paidOrder.id,
      uuid: "uuid-refund-err",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("paid");
    expect(hoisted.state.lastUpdatePatch?.status).toBeUndefined();
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });

  it("CHARGEBACK-REVERSAL/OK on paid order: patches payment_status=paid, no Telegram (already paid)", async () => {
    hoisted.state.tableResults.orders = { data: paidOrder, error: null };
    const rawBody = JSON.stringify({
      result: "OK",
      transactionType: "CHARGEBACK-REVERSAL",
      merchantTransactionId: paidOrder.id,
      uuid: "uuid-reversal-ok",
    });
    const res = buildResMock();
    await handler(makeSignedReq(rawBody), res as unknown as ServerResponse<IncomingMessage>);

    expect(res.statusCode).toBe(200);
    expect(hoisted.state.lastUpdatePatch?.payment_status).toBe("paid");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
  });
});
