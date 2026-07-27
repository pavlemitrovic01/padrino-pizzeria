// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Infrastructure mock — prevents import-time throw when supabase client
// reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (absent in tests).
vi.mock("../lib/supabaseClient", () => {
  const end = Promise.resolve({ data: null, error: new Error("mocked") });
  const q: Record<string, () => unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.order = () => end;
  q.maybeSingle = () => end;
  return { supabase: { from: () => q } };
});

// Behavior mocks — narrow: createOrder is NOT mocked (real lib under test)
vi.mock("../context/useCart");
vi.mock("../lib/bankartPaymentJs");

import CartDrawer from "./CartDrawer";
import { useCart } from "../context/useCart";
import type { CartContextType, CartItem } from "../context/CartContext";

const mockUseCart = vi.mocked(useCart);

function makeCart(overrides: Partial<CartContextType> = {}): CartContextType {
  return {
    items: [],
    isOpen: true,
    totalPrice: 0,
    totalItems: 0,
    openCart: vi.fn(),
    closeCart: vi.fn(),
    addToCart: vi.fn(),
    increase: vi.fn(),
    decrease: vi.fn(),
    removeFromCart: vi.fn(),
    clearCart: vi.fn(),
    resetCart: vi.fn(),
    checkout: { paymentMethod: "cash", status: "draft" },
    setPaymentMethod: vi.fn(),
    setCheckoutStatus: vi.fn(),
    setCheckoutError: vi.fn(),
    createOrderSnapshot: vi.fn().mockReturnValue({
      id: "snap-1",
      createdAt: new Date().toISOString(),
      items: [],
      totalItems: 0,
      totalPrice: 0,
      paymentMethod: "cash",
      status: "draft",
    }),
    resetCheckout: vi.fn(),
    ...overrides,
  };
}

function makeCartItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: "pizza-1",
    name: "Margherita",
    price: 800,
    image: "/menu/margherita.webp",
    description: "Classic pizza",
    category: "pizze",
    quantity: 1,
    size: "33",
    basePrice: 800,
    ...overrides,
  };
}

let assignMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  assignMock = vi.fn();
  // window.location.assign throws "Not implemented" in jsdom — stub the whole
  // location object; retain pathname/search so CartDrawer init reads don't break.
  vi.stubGlobal("location", {
    pathname: "/",
    search: "",
    href: "http://localhost/",
    assign: assignMock,
    replace: vi.fn(),
    reload: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function fillAndSelectBudva() {
  await userEvent.click(screen.getByRole("button", { name: /poruči/i }));
  await userEvent.type(screen.getByPlaceholderText("Npr. Petar Petrovic"), "Petar Petrovic");
  await userEvent.type(screen.getByPlaceholderText("+382..."), "+38269000000");
  await userEvent.type(screen.getByPlaceholderText("Ulica i broj"), "Slobode 10");
  const zoneBtn = screen.getByRole("button", { name: /izaberi zonu/i });
  await userEvent.click(zoneBtn);
  await userEvent.click(screen.getByRole("option", { name: /budva/i }));
}

describe("CartDrawer — E5 golden-path E2E", () => {
  it("G1: card-redirect — real createOrder calls fetch; window.location.assign fired with redirectUrl", async () => {
    const item = makeCartItem();
    mockUseCart.mockReturnValue(
      makeCart({
        items: [item],
        totalItems: 1,
        totalPrice: 800,
        checkout: { paymentMethod: "card", status: "draft" },
      }),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ok: true,
          id: "ord-e5-card",
          flow: "card_redirect",
          redirect_url: "https://gateway.test/pay/abc123",
          payment_method: "card",
          payment_status: "pending",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CartDrawer />);
    await fillAndSelectBudva();

    const form = document.querySelector("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/create-order$/);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.payment_method).toBe("card");

    await waitFor(() => {
      expect(assignMock).toHaveBeenCalledTimes(1);
    });
    expect(assignMock).toHaveBeenCalledWith("https://gateway.test/pay/abc123");
  });

  it("G2: cash golden path — real createOrder calls fetch; no redirect", async () => {
    const item = makeCartItem();
    mockUseCart.mockReturnValue(
      makeCart({
        items: [item],
        totalItems: 1,
        totalPrice: 800,
        checkout: { paymentMethod: "cash", status: "draft" },
      }),
    );

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          ok: true,
          id: "ord-e5-cash",
          flow: "cash",
          payment_method: "cash",
          payment_status: null,
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CartDrawer />);
    await fillAndSelectBudva();

    const form = document.querySelector("form");
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/create-order$/);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.payment_method).toBe("cash");
    expect(assignMock).not.toHaveBeenCalled();
  });
});
