import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * B25 (audit #11): the site had no security headers, while CONTEXT.md said it
 * did. These assert vercel.json keeps them, and that the CSP (Report-Only
 * until it has run ~7 days without real violations) still allows every origin
 * the checkout needs: Bankart payment.js, Supabase, GA4 and Google Fonts.
 */
type HeaderRule = { source: string; headers: { key: string; value: string }[] };

const config = JSON.parse(readFileSync(resolve(__dirname, "../../vercel.json"), "utf8")) as { headers: HeaderRule[] };
const all = config.headers.find((h) => h.source === "/(.*)");
const header = (key: string) => all?.headers.find((h) => h.key.toLowerCase() === key.toLowerCase())?.value ?? "";

describe("vercel.json security headers", () => {
  it("sends the basic hardening headers on every route", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toContain("camera=()");
  });

  it("reports CSP violations to /api/log and allows what the checkout loads", () => {
    const csp = header("Content-Security-Policy-Report-Only");
    expect(csp).toContain("report-uri /api/log");
    expect(csp).toContain("frame-ancestors 'none'");
    for (const origin of [
      "https://gateway.bankart.si",
      "https://*.supabase.co",
      "https://www.googletagmanager.com",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com",
    ]) {
      expect(csp).toContain(origin);
    }
  });
});
