import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatOrderForTelegram, notifyNewOrder } from "./telegram";

// In-memory `orders` table with the `telegram_notified_at` column, so the
// atomic claim (UPDATE … WHERE telegram_notified_at IS NULL) runs for real:
// the first claim on a NULL row wins, later claims get 0 rows. (B18 tests,
// moved here from api/telegram-new-order.test.ts when the endpoint went, B24.)
type Row = Record<string, unknown>;

const db: { orders: Record<string, Row>; claimError: boolean; patches: Row[] } = {
  orders: {},
  claimError: false,
  patches: [],
};

function fakeClient(): SupabaseClient {
  function builder() {
    const ctx: { patch: Row | null; id: string | null } = { patch: null, id: null };
    const b: Record<string, unknown> = {};
    b.select = () => {
      if (!ctx.patch) return b;
      // .update(patch).eq(id).is(null).select() — the claim
      if (db.claimError) return Promise.resolve({ data: null, error: { message: "claim boom" } });
      const row = ctx.id ? db.orders[ctx.id] : undefined;
      if (!row || row.telegram_notified_at != null) return Promise.resolve({ data: [], error: null });
      row.telegram_notified_at = ctx.patch.telegram_notified_at;
      return Promise.resolve({ data: [{ id: row.id }], error: null });
    };
    b.eq = (col: string, val: string) => {
      if (col === "id") ctx.id = val;
      return b;
    };
    b.is = () => b;
    b.single = () => {
      const row = ctx.id ? db.orders[ctx.id] : undefined;
      return Promise.resolve(row ? { data: row, error: null } : { data: null, error: { message: "not found" } });
    };
    b.update = (patch: Row) => {
      ctx.patch = { ...patch };
      db.patches.push({ ...patch });
      return b;
    };
    // .update(patch).eq(id) awaited without .select() — the claim release
    b.then = (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
      const row = ctx.id ? db.orders[ctx.id] : undefined;
      if (row && ctx.patch) row.telegram_notified_at = ctx.patch.telegram_notified_at;
      return Promise.resolve({ data: null, error: null }).then(onF, onR);
    };
    return b;
  }
  return { from: () => builder() } as unknown as SupabaseClient;
}

let telegramOk = true;
const fetchMock = vi.fn(async () => ({ ok: telegramOk, status: telegramOk ? 200 : 500 }) as Response);

function seed(id: string, notified: string | null = null, extra: Row = {}) {
  db.orders[id] = {
    id,
    customer_name: "Test Kupac",
    customer_phone: "069123456",
    customer_address: "Jadranska 1",
    status: "pending",
    total_eur_cents: 1500,
    items: [{ cart_id: "c1", name: "Margarita", category: "pizza", quantity: 1 }],
    note: "",
    telegram_notified_at: notified,
    ...extra,
  };
}

function sentText(call = 0): string {
  const [, init] = fetchMock.mock.calls[call] as unknown as [string, { body: string }];
  return String((JSON.parse(init.body) as { text: string }).text);
}

beforeEach(() => {
  db.orders = {};
  db.claimError = false;
  db.patches = [];
  telegramOk = true;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", "test-bot-token");
  vi.stubEnv("TELEGRAM_CHAT_ID", "test-chat-id");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("notifyNewOrder — sends each order exactly once (B18 claim)", () => {
  it("first call sends, a second call for the same order is a no-op", async () => {
    seed("o1");
    expect(await notifyNewOrder(fakeClient(), "o1")).toBe("sent");
    expect(await notifyNewOrder(fakeClient(), "o1")).toBe("already_sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("an order claimed earlier is not sent again", async () => {
    seed("o2", "2026-07-12T10:00:00.000Z");
    expect(await notifyNewOrder(fakeClient(), "o2")).toBe("already_sent");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails open: a claim error still sends", async () => {
    seed("o3");
    db.claimError = true;
    expect(await notifyNewOrder(fakeClient(), "o3")).toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a failed send releases the claim so a retry or the admin resend can deliver", async () => {
    seed("o4");
    telegramOk = false;
    expect(await notifyNewOrder(fakeClient(), "o4")).toBe("failed");
    expect(db.orders.o4.telegram_notified_at).toBeNull();
    expect(db.patches.at(-1)).toEqual({ telegram_notified_at: null });

    telegramOk = true;
    expect(await notifyNewOrder(fakeClient(), "o4")).toBe("sent");
  });

  it("never throws — a missing order or missing bot config is just \"failed\"", async () => {
    expect(await notifyNewOrder(fakeClient(), "nope")).toBe("failed");

    seed("o5");
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    expect(await notifyNewOrder(fakeClient(), "o5")).toBe("failed");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("formatOrderForTelegram — the kitchen message", () => {
  it("prints size, addons and the item note", () => {
    const text = formatOrderForTelegram({
      id: "o6",
      total_eur_cents: 2500,
      items: [
        {
          cart_id: "c1",
          name: "Diavolo",
          size: "50",
          category: "pizza",
          quantity: 1,
          addons: [{ name: "Ivice punjene sirom 50 cm", quantity: 1 }],
          note: "bez luka",
        },
      ],
    });
    expect(text).toContain("🍕 ● 1x Diavolo (50)");
    expect(text).toContain("● 1x Ivice punjene sirom 50 cm");
    expect(text).toContain("🚨 ● NAPOMENA: bez luka");
    expect(text).toContain("💸 ● Ukupno: 25.00 €");
  });

  it("B23e: payment and fee come from the server's first note lines, whatever the customer typed", async () => {
    seed("o7", null, {
      items: [
        {
          cart_id: "meta",
          name: "META",
          category: "meta",
          note: "Plaćanje: Gotovina\nZona: Bečići, Dostava: 3€\nDostava: 0\nzvono ne radi",
        },
        { cart_id: "c1", name: "Margarita", category: "pizza", quantity: 1 },
      ],
    });
    expect(await notifyNewOrder(fakeClient(), "o7")).toBe("sent");

    const text = sentText();
    expect(text).toContain("💵 Plaćanje: Gotovina");
    expect(text).toContain("📍 Zona: Bečići");
    expect(text).toContain("🚚 Dostava: 3 €");
    expect(text).toContain("🚨 ● NAPOMENA: Dostava: 0\nzvono ne radi");
  });
});
