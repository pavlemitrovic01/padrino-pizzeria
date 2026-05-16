import { afterEach, describe, expect, it, vi } from "vitest";
import { resolvePublicBaseUrl, buildTelegramPayload } from "./public-url";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolvePublicBaseUrl — env precedence", () => {
  it("returns PUBLIC_SITE_URL when set, stripping trailing slash", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://padrinobudva.com/");
    expect(resolvePublicBaseUrl({})).toBe("https://padrinobudva.com");
  });

  it("falls back to SITE_URL when PUBLIC_SITE_URL is absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "https://site.example.com");
    expect(resolvePublicBaseUrl({})).toBe("https://site.example.com");
  });

  it("falls back to APP_URL when prior env vars are absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "https://app.example.com");
    expect(resolvePublicBaseUrl({})).toBe("https://app.example.com");
  });

  it("falls back to NEXT_PUBLIC_SITE_URL last among env vars", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://next.example.com");
    expect(resolvePublicBaseUrl({})).toBe("https://next.example.com");
  });

  it("env wins over Origin even when trustOriginHeader is true", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://padrinobudva.com");
    const headers = { origin: "https://attacker.example.com" };
    expect(resolvePublicBaseUrl(headers, { trustOriginHeader: true })).toBe("https://padrinobudva.com");
  });
});

describe("resolvePublicBaseUrl — trustOriginHeader: true (browser-facing endpoints)", () => {
  it("uses Origin when no env is set and trustOriginHeader is true", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { origin: "https://padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers, { trustOriginHeader: true })).toBe("https://padrinobudva.com");
  });

  it("strips trailing slash from Origin", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { origin: "https://padrinobudva.com/" };
    expect(resolvePublicBaseUrl(headers, { trustOriginHeader: true })).toBe("https://padrinobudva.com");
  });
});

describe("resolvePublicBaseUrl — trustOriginHeader: false (callback security invariant)", () => {
  it("ignores Origin when trustOriginHeader is false", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = {
      origin: "https://attacker.example.com",
      "x-forwarded-proto": "https",
      "x-forwarded-host": "padrinobudva.com",
    };
    expect(resolvePublicBaseUrl(headers, { trustOriginHeader: false })).toBe("https://padrinobudva.com");
  });

  it("ignores Origin when trustOriginHeader is omitted (safe default)", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { origin: "https://attacker.example.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });
});

describe("resolvePublicBaseUrl — x-forwarded fallback", () => {
  it("builds URL from x-forwarded-proto and x-forwarded-host", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { "x-forwarded-proto": "https", "x-forwarded-host": "padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });

  it("falls back to host header when x-forwarded-host is absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { "x-forwarded-proto": "https", host: "padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });

  it("defaults proto to https when x-forwarded-proto is absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { host: "padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });

  it("accepts header keys case-insensitively (CI lookup)", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { "X-Forwarded-Proto": "https", "X-Forwarded-Host": "padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });
});

describe("resolvePublicBaseUrl — final hardcoded fallback", () => {
  it("returns https://padrinobudva.com when all sources are absent", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(resolvePublicBaseUrl(undefined)).toBe("https://padrinobudva.com");
  });

  it("returns https://padrinobudva.com for empty headers object", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    expect(resolvePublicBaseUrl({})).toBe("https://padrinobudva.com");
  });
});

describe("buildTelegramPayload", () => {
  it("returns correct shape with notify_url suffix", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://padrinobudva.com");
    const result = buildTelegramPayload({}, "order-123", { trustOriginHeader: true });
    expect(result).toEqual({
      order_id: "order-123",
      notify_url: "https://padrinobudva.com/api/telegram-new-order",
    });
  });

  it("passes trustOriginHeader through to resolvePublicBaseUrl", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { origin: "https://padrinobudva.com" };
    const result = buildTelegramPayload(headers, "order-456", { trustOriginHeader: true });
    expect(result.notify_url).toBe("https://padrinobudva.com/api/telegram-new-order");
  });

  it("ignores Origin when trustOriginHeader is false (callback invariant)", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    const headers = { origin: "https://attacker.example.com" };
    const result = buildTelegramPayload(headers, "order-789", { trustOriginHeader: false });
    expect(result.notify_url).not.toContain("attacker");
    expect(result.notify_url).toBe("https://padrinobudva.com/api/telegram-new-order");
  });
});
