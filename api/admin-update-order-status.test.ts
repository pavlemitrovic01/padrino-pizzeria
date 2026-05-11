import { describe, it, expect, vi } from "vitest";

// Must be hoisted before module load — admin-update-order-status.ts calls buildSupabaseAdmin() at top level.
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}));

import { canTransition, isOrderStatus } from "./admin-update-order-status";

type HandlerRes = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => HandlerRes;
  send: (body: string) => void;
};

// ─── isOrderStatus ────────────────────────────────────────────
describe("isOrderStatus", () => {
  it("returns true for 'pending'", () => {
    expect(isOrderStatus("pending")).toBe(true);
  });

  it("returns true for 'preparing'", () => {
    expect(isOrderStatus("preparing")).toBe(true);
  });

  it("returns true for 'done'", () => {
    expect(isOrderStatus("done")).toBe(true);
  });

  it("returns true for 'cancelled'", () => {
    expect(isOrderStatus("cancelled")).toBe(true);
  });

  it("returns false for unknown string", () => {
    expect(isOrderStatus("shipped")).toBe(false);
    expect(isOrderStatus("")).toBe(false);
    expect(isOrderStatus("PENDING")).toBe(false);
  });

  it("returns false for null/undefined/number/object", () => {
    expect(isOrderStatus(null)).toBe(false);
    expect(isOrderStatus(undefined)).toBe(false);
    expect(isOrderStatus(42)).toBe(false);
    expect(isOrderStatus({})).toBe(false);
  });
});

// ─── canTransition matrix ─────────────────────────────────────
describe("canTransition", () => {
  // Identity (idempotent)
  it("pending → pending: allowed", () => {
    expect(canTransition("pending", "pending")).toBe(true);
  });

  it("done → done: allowed", () => {
    expect(canTransition("done", "done")).toBe(true);
  });

  // From pending
  it("pending → preparing: allowed", () => {
    expect(canTransition("pending", "preparing")).toBe(true);
  });

  it("pending → done: allowed", () => {
    expect(canTransition("pending", "done")).toBe(true);
  });

  it("pending → cancelled: allowed", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
  });

  // From preparing
  it("preparing → done: allowed", () => {
    expect(canTransition("preparing", "done")).toBe(true);
  });

  it("preparing → cancelled: allowed", () => {
    expect(canTransition("preparing", "cancelled")).toBe(true);
  });

  it("preparing → pending: REJECTED (no backward)", () => {
    expect(canTransition("preparing", "pending")).toBe(false);
  });

  // From done (terminal)
  it("done → pending: REJECTED (terminal)", () => {
    expect(canTransition("done", "pending")).toBe(false);
  });

  it("done → preparing: REJECTED (terminal)", () => {
    expect(canTransition("done", "preparing")).toBe(false);
  });

  it("done → cancelled: REJECTED (terminal)", () => {
    expect(canTransition("done", "cancelled")).toBe(false);
  });

  // From cancelled (terminal)
  it("cancelled → pending: REJECTED (terminal)", () => {
    expect(canTransition("cancelled", "pending")).toBe(false);
  });

  it("cancelled → preparing: REJECTED (terminal)", () => {
    expect(canTransition("cancelled", "preparing")).toBe(false);
  });

  it("cancelled → done: REJECTED (terminal)", () => {
    expect(canTransition("cancelled", "done")).toBe(false);
  });
});

// ─── handler smoke ────────────────────────────────────────────
describe("handler (smoke)", () => {
  it("returns 405 on GET method", async () => {
    const { default: handler } = await import("./admin-update-order-status");
    let capturedStatus = 0;
    const res: HandlerRes = {
      status(code) { capturedStatus = code; return this; },
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    await handler({ method: "GET", headers: {} }, res);
    expect(capturedStatus).toBe(405);
  });

  it("returns 401 when no Bearer token present", async () => {
    const { default: handler } = await import("./admin-update-order-status");
    let capturedStatus = 0;
    const res: HandlerRes = {
      status(code) { capturedStatus = code; return this; },
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    await handler({ method: "POST", headers: {} }, res);
    expect(capturedStatus).toBe(401);
  });
});
