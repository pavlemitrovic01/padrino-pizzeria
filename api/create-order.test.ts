import { describe, expect, it, vi } from "vitest";

// Module-top-level supabase init mock (B4 precedent — required because
// create-order.ts calls buildSupabaseAdmin() at module load time).
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  })),
}));

import { clientSafeError } from "./create-order";

describe("clientSafeError", () => {
  it("sanitizes Postgres unique constraint error for order_create kind", () => {
    const err = new Error(
      'duplicate key value violates unique constraint "orders_pkey"',
    );
    expect(clientSafeError(err, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });

  it("sanitizes Bankart network error for payment_init kind", () => {
    const err = new Error("Bankart init network error (fetch failed)");
    expect(clientSafeError(err, "payment_init")).toBe(
      "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.",
    );
  });

  it("handles non-Error values (string) without leaking content", () => {
    expect(clientSafeError("raw string error" as unknown, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });

  it("handles undefined and null without crashing", () => {
    expect(clientSafeError(undefined, "payment_init")).toBe(
      "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.",
    );
    expect(clientSafeError(null, "order_create")).toBe(
      "Greška pri kreiranju porudžbine. Pokušajte ponovo.",
    );
  });
});
