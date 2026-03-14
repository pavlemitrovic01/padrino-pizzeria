import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("getApiBase", () => {
  it("non-dev branch returns /api", async () => {
    vi.stubEnv("DEV", "");
    vi.resetModules();

    const { getApiBase } = await import("./apiBase");
    expect(getApiBase()).toBe("/api");
  });

  it("dev branch with non-empty VITE_API_BASE_URL returns trimmed env value", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://custom.test/api");
    vi.resetModules();

    const { getApiBase } = await import("./apiBase");
    expect(getApiBase()).toBe("https://custom.test/api");
  });

  it("dev branch with empty VITE_API_BASE_URL returns fallback URL", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "");
    vi.resetModules();

    const { getApiBase } = await import("./apiBase");
    expect(getApiBase()).toBe("https://padrino-pizzeria.vercel.app/api");
  });
});
