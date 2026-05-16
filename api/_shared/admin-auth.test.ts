import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminFromDb } from "./admin-auth";

// getAdminFromDb takes the supabase client as a parameter, so (unlike the
// module-load-mocked handler tests) we just inject a minimal fake that
// reproduces the .from().select().eq().maybeSingle() chain.
function makeSupabase(result: { data?: unknown; error?: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as SupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAdminFromDb — empty email guard", () => {
  it("returns non-admin without touching the DB for empty email", async () => {
    const sb = makeSupabase({ data: null, error: null });
    const r = await getAdminFromDb(sb.client, "");
    expect(r).toEqual({ table: "ok", isAdmin: false, role: null });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("returns non-admin without touching the DB for whitespace email", async () => {
    const sb = makeSupabase({ data: null, error: null });
    const r = await getAdminFromDb(sb.client, "   ");
    expect(r).toEqual({ table: "ok", isAdmin: false, role: null });
    expect(sb.from).not.toHaveBeenCalled();
  });
});

describe("getAdminFromDb — email normalization", () => {
  it("trims and lowercases the email before querying", async () => {
    const sb = makeSupabase({ data: { enabled: true, role: "staff" }, error: null });
    await getAdminFromDb(sb.client, "  Admin@EXAMPLE.com  ");
    expect(sb.from).toHaveBeenCalledWith("admin_users");
    expect(sb.eq).toHaveBeenCalledWith("email", "admin@example.com");
  });
});

describe("getAdminFromDb — missing table fallback", () => {
  it("grants owner when admin_users is missing and email is the fallback admin", async () => {
    vi.stubEnv("ADMIN_FALLBACK_EMAIL", "boss@padrino.me");
    const sb = makeSupabase({
      data: null,
      error: { message: 'relation "admin_users" does not exist' },
    });
    const r = await getAdminFromDb(sb.client, "boss@padrino.me");
    expect(r).toEqual({ table: "missing", isAdmin: true, role: "owner" });
  });

  it("denies when admin_users is missing and email is NOT the fallback admin", async () => {
    vi.stubEnv("ADMIN_FALLBACK_EMAIL", "boss@padrino.me");
    const sb = makeSupabase({
      data: null,
      error: { message: 'relation "admin_users" does not exist' },
    });
    const r = await getAdminFromDb(sb.client, "intruder@example.com");
    expect(r).toEqual({ table: "missing", isAdmin: false, role: null });
  });

  it("denies when admin_users is missing and no fallback env is set", async () => {
    vi.stubEnv("ADMIN_FALLBACK_EMAIL", "");
    const sb = makeSupabase({
      data: null,
      error: { message: 'relation "admin_users" does not exist' },
    });
    const r = await getAdminFromDb(sb.client, "boss@padrino.me");
    expect(r).toEqual({ table: "missing", isAdmin: false, role: null });
  });
});

describe("getAdminFromDb — generic DB error", () => {
  it("returns error state for a non-missing-table error", async () => {
    const sb = makeSupabase({
      data: null,
      error: { message: "connection timeout" },
    });
    const r = await getAdminFromDb(sb.client, "user@example.com");
    expect(r).toEqual({ table: "error", isAdmin: false, role: null });
  });
});

describe("getAdminFromDb — row resolution", () => {
  it("denies when the user row is not found (data null)", async () => {
    const sb = makeSupabase({ data: null, error: null });
    const r = await getAdminFromDb(sb.client, "user@example.com");
    expect(r).toEqual({ table: "ok", isAdmin: false, role: null });
  });

  it("denies a disabled admin row", async () => {
    const sb = makeSupabase({ data: { enabled: false, role: "owner" }, error: null });
    const r = await getAdminFromDb(sb.client, "user@example.com");
    expect(r).toEqual({ table: "ok", isAdmin: false, role: null });
  });

  it("grants an enabled owner", async () => {
    const sb = makeSupabase({ data: { enabled: true, role: "owner" }, error: null });
    const r = await getAdminFromDb(sb.client, "owner@example.com");
    expect(r).toEqual({ table: "ok", isAdmin: true, role: "owner" });
  });

  it("grants an enabled staff", async () => {
    const sb = makeSupabase({ data: { enabled: true, role: "staff" }, error: null });
    const r = await getAdminFromDb(sb.client, "staff@example.com");
    expect(r).toEqual({ table: "ok", isAdmin: true, role: "staff" });
  });

  it("coerces an invalid/missing role to staff for an enabled row", async () => {
    const sb = makeSupabase({ data: { enabled: true, role: "superadmin" }, error: null });
    const r = await getAdminFromDb(sb.client, "weird@example.com");
    expect(r).toEqual({ table: "ok", isAdmin: true, role: "staff" });
  });
});
