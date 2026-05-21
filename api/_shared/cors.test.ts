import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseAllowedOrigins, applyCors } from "./cors.js";
import type { ReqLike, ResLike } from "./cors.js";

// ── helpers ──────────────────────────────────────────────────────────────────

function stubReq(origin?: string): ReqLike {
  return { headers: origin ? { origin } : {} };
}

function stubRes(): ResLike & { headers: Record<string, string> } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
  };
}

// ── parseAllowedOrigins ───────────────────────────────────────────────────────

describe("parseAllowedOrigins", () => {
  it("returns [] for undefined", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });

  it("returns [] for empty string", () => {
    expect(parseAllowedOrigins("")).toEqual([]);
  });

  it("returns single origin", () => {
    expect(parseAllowedOrigins("https://example.com")).toEqual(["https://example.com"]);
  });

  it("returns multiple origins", () => {
    expect(parseAllowedOrigins("https://a.com,https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("trims whitespace around origins", () => {
    expect(parseAllowedOrigins(" https://a.com , https://b.com ")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });

  it("deduplicates repeated origins", () => {
    const result = parseAllowedOrigins("https://a.com,https://a.com");
    expect(result).toEqual(["https://a.com"]);
  });

  it("preserves trailing slash (exact match per RFC 6454)", () => {
    expect(parseAllowedOrigins("https://a.com/")).toEqual(["https://a.com/"]);
  });

  it("skips blank segments from double commas", () => {
    expect(parseAllowedOrigins("https://a.com,,https://b.com")).toEqual([
      "https://a.com",
      "https://b.com",
    ]);
  });
});

// ── applyCors ─────────────────────────────────────────────────────────────────

const PROD_ORIGIN = "https://example.com";
const OTHER_ORIGIN = "https://evil.com";

describe("applyCors", () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = {
      ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_URL: process.env.VERCEL_URL,
    };
    delete process.env.VERCEL_ENV;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it("echoes Origin when it is in the allowlist", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Access-Control-Allow-Origin"]).toBe(PROD_ORIGIN);
  });

  it("does NOT set ACAO for disallowed origin", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(OTHER_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("does NOT set ACAO when Origin header is absent", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(), res, { methods: "POST" });
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("does NOT set ACAO when ALLOWED_ORIGINS is empty", () => {
    process.env.ALLOWED_ORIGINS = "";
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "GET" });
    expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
  });

  it("always sets Vary: Origin", () => {
    process.env.ALLOWED_ORIGINS = "";
    const res = stubRes();
    applyCors(stubReq(OTHER_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Vary"]).toBe("Origin");
  });

  it("includes OPTIONS in Allow-Methods for POST method", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("POST, OPTIONS");
  });

  it("includes OPTIONS in Allow-Methods for GET method", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "GET" });
    expect(res.headers["Access-Control-Allow-Methods"]).toBe("GET, OPTIONS");
  });

  it("sets default Allow-Headers", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Access-Control-Allow-Headers"]).toBe(
      "content-type, x-requested-with",
    );
  });

  it("uses custom allowHeaders when provided", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, {
      methods: "POST",
      allowHeaders: "content-type, x-requested-with, x-telegram-secret",
    });
    expect(res.headers["Access-Control-Allow-Headers"]).toBe(
      "content-type, x-requested-with, x-telegram-secret",
    );
  });

  it("sets Access-Control-Max-Age to 86400", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    applyCors(stubReq(PROD_ORIGIN), res, { methods: "POST" });
    expect(res.headers["Access-Control-Max-Age"]).toBe("86400");
  });

  it("handles case-insensitive Origin header key", () => {
    process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
    const res = stubRes();
    // Some proxies/runtimes uppercase or titlecase the header key
    const req: ReqLike = { headers: { Origin: PROD_ORIGIN } };
    applyCors(req, res, { methods: "GET" });
    expect(res.headers["Access-Control-Allow-Origin"]).toBe(PROD_ORIGIN);
  });

  describe("preview deploy auto-injection", () => {
    it("allows VERCEL_URL origin in preview env", () => {
      process.env.VERCEL_ENV = "preview";
      process.env.VERCEL_URL = "my-app-abc123.vercel.app";
      process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
      const previewOrigin = "https://my-app-abc123.vercel.app";
      const res = stubRes();
      applyCors(stubReq(previewOrigin), res, { methods: "POST" });
      expect(res.headers["Access-Control-Allow-Origin"]).toBe(previewOrigin);
    });

    it("does NOT inject preview origin when VERCEL_ENV is not preview", () => {
      process.env.VERCEL_ENV = "production";
      process.env.VERCEL_URL = "my-app-abc123.vercel.app";
      process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
      const previewOrigin = "https://my-app-abc123.vercel.app";
      const res = stubRes();
      applyCors(stubReq(previewOrigin), res, { methods: "POST" });
      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("does NOT inject when VERCEL_URL is absent", () => {
      process.env.VERCEL_ENV = "preview";
      delete process.env.VERCEL_URL;
      process.env.ALLOWED_ORIGINS = PROD_ORIGIN;
      const res = stubRes();
      applyCors(stubReq("https://my-app.vercel.app"), res, { methods: "POST" });
      expect(res.headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });
  });
});
