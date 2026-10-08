import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";
import handler from "./log";

function makeRes() {
  const out = { statusCode: 0, body: undefined as unknown };
  const res = {
    setHeader: () => {},
    status(code: number) {
      out.statusCode = code;
      return res;
    },
    send(raw: string) {
      out.body = JSON.parse(raw) as unknown;
    },
  };
  return { out, res };
}

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  for (const level of ["log", "warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(" "));
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("api/log — size caps (B25, audit #12)", () => {
  it("logs a normal client event", async () => {
    const { out, res } = makeRes();
    await handler({ method: "POST", headers: {}, body: { events: [{ ts: 1, level: "error", message: "boom", context: { a: 1 } }] } }, res);

    expect(out.statusCode).toBe(200);
    expect(logged.some((l) => l.includes('"message":"boom"') && l.includes('"a":1'))).toBe(true);
  });

  it("caps a huge context and a huge message", async () => {
    const { res } = makeRes();
    const context = { blob: "x".repeat(100_000) };
    await handler({ method: "POST", headers: {}, body: { events: [{ ts: 1, level: "warn", message: "m".repeat(50_000), context }] } }, res);

    expect(logged).toHaveLength(1);
    expect(logged[0].length).toBeLessThan(7_000);
    expect(logged[0]).toContain('"truncated":true');
  });

  it("logs at most 20 events per request", async () => {
    const { out, res } = makeRes();
    const events = Array.from({ length: 100 }, (_, i) => ({ ts: i, level: "info", message: `e${i}` }));
    await handler({ method: "POST", headers: {}, body: { events } }, res);

    expect((out.body as { received: number }).received).toBe(20);
    expect(logged).toHaveLength(20);
  });
});

describe("api/log — CSP report sink (B25)", () => {
  const report = {
    "csp-report": {
      "document-uri": "https://padrinobudva.com/",
      "violated-directive": "script-src-elem",
      "blocked-uri": "https://evil.example/x.js",
      "source-file": "https://padrinobudva.com/",
      disposition: "report",
      "script-sample": "y".repeat(10_000),
    },
  };

  it("logs the useful fields of a report sent as application/csp-report (string or Buffer body)", async () => {
    for (const body of [JSON.stringify(report), Buffer.from(JSON.stringify(report))]) {
      logged = [];
      const { out, res } = makeRes();
      await handler({ method: "POST", headers: { "content-type": "application/csp-report" }, body }, res);

      expect(out.statusCode).toBe(200);
      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain("[csp-report]");
      expect(logged[0]).toContain("https://evil.example/x.js");
      expect(logged[0]).not.toContain("yyyy");
    }
  });

  it("reads a real application/csp-report request from its stream (the runtime leaves req.body unset)", async () => {
    const { out, res } = makeRes();
    const req = Object.assign(Readable.from([Buffer.from(JSON.stringify(report))]), {
      method: "POST",
      headers: { "content-type": "application/csp-report" },
      body: undefined,
    });
    await handler(req as never, res);

    expect(out.statusCode).toBe(200);
    expect(logged.some((l) => l.includes("[csp-report]") && l.includes("https://evil.example/x.js"))).toBe(true);
  });

  it("refuses a body over 64 KB", async () => {
    const { out, res } = makeRes();
    await handler({ method: "POST", headers: {}, body: "z".repeat(70 * 1024) }, res);
    expect(out.statusCode).toBe(400);
  });
});
