import { describe, expect, it } from "vitest";
import {
  SITE_URL,
  DEFAULT_BILLING_CITY,
  DEFAULT_BILLING_POSTCODE,
  DELIVERY_ZONES,
} from "./config";

describe("config (src/) shape contract", () => {
  it("SITE_URL is a non-empty https URL", () => {
    expect(typeof SITE_URL).toBe("string");
    expect(SITE_URL.length).toBeGreaterThan(0);
    expect(SITE_URL.startsWith("https://")).toBe(true);
  });

  it("DEFAULT_BILLING_CITY and DEFAULT_BILLING_POSTCODE are non-empty strings", () => {
    expect(typeof DEFAULT_BILLING_CITY).toBe("string");
    expect(DEFAULT_BILLING_CITY.length).toBeGreaterThan(0);
    expect(typeof DEFAULT_BILLING_POSTCODE).toBe("string");
    expect(DEFAULT_BILLING_POSTCODE.length).toBeGreaterThan(0);
  });

  it("DELIVERY_ZONES has exactly 8 entries", () => {
    expect(DELIVERY_ZONES.length).toBe(8);
  });

  it("each delivery zone has correctly-typed fields with non-negative cents", () => {
    for (const zone of DELIVERY_ZONES) {
      expect(typeof zone.key).toBe("string");
      expect(zone.key.length).toBeGreaterThan(0);
      expect(typeof zone.label).toBe("string");
      expect(zone.label.length).toBeGreaterThan(0);
      expect(typeof zone.minCents).toBe("number");
      expect(typeof zone.feeCents).toBe("number");
      expect(zone.minCents).toBeGreaterThanOrEqual(0);
      expect(zone.feeCents).toBeGreaterThanOrEqual(0);
    }
  });

  it("DELIVERY_ZONES includes the 'budva' default zone", () => {
    const keys = DELIVERY_ZONES.map((z) => z.key);
    expect(keys).toContain("budva");
  });
});
