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

  it("env wins over Origin and Host", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://padrinobudva.com");
    const headers = { origin: "https://attacker.example.com", host: "preview.vercel.app" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });
});

function clearSiteEnv() {
  vi.stubEnv("PUBLIC_SITE_URL", "");
  vi.stubEnv("SITE_URL", "");
  vi.stubEnv("APP_URL", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
}

describe("resolvePublicBaseUrl — Origin is never trusted (B22, audit #5)", () => {
  it("ignores an attacker Origin and uses the Host header", () => {
    clearSiteEnv();
    const headers = { origin: "https://attacker.example.com", host: "padrinobudva.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });

  it("ignores an attacker Origin even with no Host — falls back to the default", () => {
    clearSiteEnv();
    const headers = { origin: "https://attacker.example.com" };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });

  it("ignores x-forwarded-host and x-forwarded-proto", () => {
    clearSiteEnv();
    const headers = {
      "x-forwarded-proto": "http",
      "x-forwarded-host": "attacker.example.com",
      host: "padrinobudva.com",
    };
    expect(resolvePublicBaseUrl(headers)).toBe("https://padrinobudva.com");
  });
});

describe("resolvePublicBaseUrl — Host fallback", () => {
  it("builds an https URL from the Host header", () => {
    clearSiteEnv();
    expect(resolvePublicBaseUrl({ host: "padrino-pizzeria-git-b22.vercel.app" })).toBe(
      "https://padrino-pizzeria-git-b22.vercel.app",
    );
  });

  it("keeps an explicit port and lowercases the host", () => {
    clearSiteEnv();
    expect(resolvePublicBaseUrl({ host: "LocalHost:5173" })).toBe("https://localhost:5173");
  });

  it("accepts the header key case-insensitively", () => {
    clearSiteEnv();
    expect(resolvePublicBaseUrl({ Host: "padrinobudva.com" })).toBe("https://padrinobudva.com");
  });

  it("rejects a malformed Host (path, userinfo, scheme) and uses the default", () => {
    clearSiteEnv();
    for (const host of ["evil.com/x", "user@evil.com", "https://evil.com", "a b"]) {
      expect(resolvePublicBaseUrl({ host })).toBe("https://padrinobudva.com");
    }
  });
});

describe("resolvePublicBaseUrl — final hardcoded fallback", () => {
  it("returns https://padrinobudva.com when all sources are absent", () => {
    clearSiteEnv();
    expect(resolvePublicBaseUrl(undefined)).toBe("https://padrinobudva.com");
  });

  it("returns https://padrinobudva.com for empty headers object", () => {
    clearSiteEnv();
    expect(resolvePublicBaseUrl({})).toBe("https://padrinobudva.com");
  });
});

describe("buildTelegramPayload", () => {
  it("returns correct shape with notify_url suffix", () => {
    vi.stubEnv("PUBLIC_SITE_URL", "https://padrinobudva.com");
    const result = buildTelegramPayload({}, "order-123");
    expect(result).toEqual({
      order_id: "order-123",
      notify_url: "https://padrinobudva.com/api/telegram-new-order",
    });
  });

  it("never points notify_url at the Origin header", () => {
    clearSiteEnv();
    const headers = { origin: "https://attacker.example.com", host: "padrinobudva.com" };
    const result = buildTelegramPayload(headers, "order-789");
    expect(result.notify_url).not.toContain("attacker");
    expect(result.notify_url).toBe("https://padrinobudva.com/api/telegram-new-order");
  });
});
