import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import type { ServerResponse, IncomingMessage } from "node:http";

// Must be hoisted before module load — bankart-callback.ts calls buildSupabaseAdmin() at top level.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}));

import {
  createBankartSignature,
  safeEqualSignature,
  isDateFresh,
  verifyBankartCallbackSignature,
  type ReqLike,
} from "./bankart-callback";

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

const SECRET = "test-bankart-secret";
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
    const { default: handler } = await import("./bankart-callback");
    const res = buildResMock();
    await handler(buildReq({ method: "GET" }), res as unknown as ServerResponse<IncomingMessage>);
    expect(res.statusCode).toBe(405);
  });
});
