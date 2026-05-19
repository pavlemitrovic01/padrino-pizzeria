import { describe, expect, it } from "vitest";
import {
  BANKART_FALLBACK_EMAIL,
  BANKART_FALLBACK_CITY,
  BANKART_FALLBACK_POSTCODE,
  BANKART_DESCRIPTION_PREFIX,
  DEFAULT_PUBLIC_HOST,
} from "./config";

// NOTE: These tests DELIBERATELY do not assert literal values.
// Asserting "padrinobudva@gmail.com" would make config.ts brittle —
// every template-swap (Padrino → app#2) would need to re-pay this
// test cost for no gain. We only assert shape contracts that the
// rest of the code depends on (non-empty strings of the right form).

describe("api/_shared/config — Padrino template-swap point", () => {
  it("BANKART_FALLBACK_EMAIL is a non-empty email-shaped string", () => {
    expect(typeof BANKART_FALLBACK_EMAIL).toBe("string");
    expect(BANKART_FALLBACK_EMAIL.length).toBeGreaterThan(0);
    expect(BANKART_FALLBACK_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it("BANKART_FALLBACK_CITY is a non-empty string", () => {
    expect(typeof BANKART_FALLBACK_CITY).toBe("string");
    expect(BANKART_FALLBACK_CITY.trim().length).toBeGreaterThan(0);
  });

  it("BANKART_FALLBACK_POSTCODE is a non-empty string", () => {
    expect(typeof BANKART_FALLBACK_POSTCODE).toBe("string");
    expect(BANKART_FALLBACK_POSTCODE.trim().length).toBeGreaterThan(0);
  });

  it("BANKART_DESCRIPTION_PREFIX is a non-empty string", () => {
    expect(typeof BANKART_DESCRIPTION_PREFIX).toBe("string");
    expect(BANKART_DESCRIPTION_PREFIX.trim().length).toBeGreaterThan(0);
  });

  it("DEFAULT_PUBLIC_HOST is a non-empty https URL with no trailing slash", () => {
    expect(typeof DEFAULT_PUBLIC_HOST).toBe("string");
    expect(DEFAULT_PUBLIC_HOST.startsWith("https://")).toBe(true);
    expect(DEFAULT_PUBLIC_HOST.endsWith("/")).toBe(false);
  });
});
