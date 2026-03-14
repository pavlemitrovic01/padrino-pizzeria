import { describe, it, expect, vi, beforeEach } from "vitest";
import { createOrder, type CreateOrderPayload } from "./createOrder";

const validItem = {
  cart_id: "cart-1",
  menu_item_id: "item-1",
  name: "Pizza",
  size: "33" as const,
  quantity: 1,
  base_price: 1000,
  price_per_item: 1000,
  addons: [],
  note: null,
  image: "https://example.com/pizza.jpg",
  category: "pizza",
};

function validPayload(overrides: Partial<CreateOrderPayload> = {}): CreateOrderPayload {
  return {
    customer_name: "Test User",
    customer_phone: "0671234567",
    customer_address: "Test Address 1",
    items: [validItem],
    total_price: 1000,
    total_items: 1,
    ...overrides,
  };
}

describe("createOrder validation", () => {
  it("throws when customer_name is empty", async () => {
    await expect(createOrder(validPayload({ customer_name: "" }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
    await expect(createOrder(validPayload({ customer_name: "   " }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
  });

  it("throws when customer_phone is empty", async () => {
    await expect(createOrder(validPayload({ customer_phone: "" }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
    await expect(createOrder(validPayload({ customer_phone: "   " }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
  });

  it("throws when customer_address is empty", async () => {
    await expect(createOrder(validPayload({ customer_address: "" }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
    await expect(createOrder(validPayload({ customer_address: "   " }))).rejects.toThrow(
      "Unesite ime, telefon i adresu.",
    );
  });

  it("throws when items is empty", async () => {
    await expect(createOrder(validPayload({ items: [] }))).rejects.toThrow("Korpa je prazna.");
  });

  it("throws when items is not an array", async () => {
    await expect(
      createOrder(validPayload({ items: null as unknown as CreateOrderPayload["items"] })),
    ).rejects.toThrow("Korpa je prazna.");
  });

  it("throws when item has invalid structure (missing cart_id)", async () => {
    const badItem = { ...validItem, cart_id: "" };
    await expect(createOrder(validPayload({ items: [badItem] }))).rejects.toThrow(
      "Invalid item structure",
    );
  });

  it("throws when item has invalid structure (missing name)", async () => {
    const badItem = { ...validItem, name: "" };
    await expect(createOrder(validPayload({ items: [badItem] }))).rejects.toThrow(
      "Invalid item structure",
    );
  });

  it("throws when item has price_per_item <= 0", async () => {
    const badItem = { ...validItem, price_per_item: 0 };
    await expect(createOrder(validPayload({ items: [badItem] }))).rejects.toThrow(
      "Invalid item structure",
    );
  });

  it("throws when item has quantity <= 0", async () => {
    const badItem = { ...validItem, quantity: 0 };
    await expect(createOrder(validPayload({ items: [badItem] }))).rejects.toThrow(
      "Invalid item structure",
    );
  });

  it("throws when total_price <= 0", async () => {
    await expect(createOrder(validPayload({ total_price: 0 }))).rejects.toThrow("Invalid total");
    await expect(createOrder(validPayload({ total_price: -1 }))).rejects.toThrow("Invalid total");
  });

  it("throws when total_items <= 0", async () => {
    await expect(createOrder(validPayload({ total_items: 0 }))).rejects.toThrow("Invalid total");
  });
});

describe("createOrder success path", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            orderId: "test-order-123",
            flow: "cash",
            payment_method: "cash",
          }),
      }),
    );
  });

  it("returns orderId and flow when API succeeds", async () => {
    const result = await createOrder(validPayload());
    expect(result.success).toBe(true);
    expect(result.orderId).toBe("test-order-123");
    expect(result.flow).toBe("cash");
    expect(result.paymentMethod).toBe("cash");
    expect(result.redirectUrl).toBeNull();
  });

  it("parses order_id from snake_case response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            order_id: "snake-order-id",
            flow: "cash",
            payment_method: "cash",
          }),
      }),
    );
    const result = await createOrder(validPayload());
    expect(result.orderId).toBe("snake-order-id");
  });

  it("throws when API returns ok: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ ok: false, error: "Invalid payload" }),
      }),
    );
    await expect(createOrder(validPayload())).rejects.toThrow();
  });

  it("throws when API returns no orderId", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            flow: "cash",
            payment_method: "cash",
          }),
      }),
    );
    await expect(createOrder(validPayload())).rejects.toThrow("ID nije vraćen");
  });
});

describe("createOrder request contract (delivery-zone flow)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            orderId: "test-order-123",
            flow: "cash",
            payment_method: "cash",
          }),
      }),
    );
  });

  it("forwards delivery note into meta item when note is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          orderId: "test-order-123",
          flow: "cash",
          payment_method: "cash",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const deliveryNote = "Zona: Rafailovići, Dostava: 5€";
    await createOrder(validPayload({ note: deliveryNote }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    const items = body.items as unknown[];
    const metaItem = items[0] as Record<string, unknown>;

    expect(metaItem.note).toBe(deliveryNote);
  });

  it("meta item is first in items and has expected structure", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          orderId: "test-order-123",
          flow: "cash",
          payment_method: "cash",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createOrder(validPayload({ note: "Zona: Budva, Dostava: 0€" }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    const items = body.items as unknown[];
    const metaItem = items[0] as Record<string, unknown>;

    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(metaItem.cart_id).toBe("meta");
    expect(metaItem.category).toBe("meta");
  });

  it("request body does not include lat, lng, customer_lat, or customer_lng", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          orderId: "test-order-123",
          flow: "cash",
          payment_method: "cash",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await createOrder(validPayload({ note: "Zona: Bečići, Dostava: 3€" }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;

    expect(body).not.toHaveProperty("lat");
    expect(body).not.toHaveProperty("lng");
    expect(body).not.toHaveProperty("customer_lat");
    expect(body).not.toHaveProperty("customer_lng");
  });

  it("request body includes total_eur_cents", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          ok: true,
          orderId: "test-order-123",
          flow: "cash",
          payment_method: "cash",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const totalCents = 1550;
    await createOrder(validPayload({ total_price: totalCents }));

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;

    expect(body).toHaveProperty("total_eur_cents");
    expect(body.total_eur_cents).toBe(totalCents);
  });
});
