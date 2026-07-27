// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Infrastructure mock — prevents import-time throw when supabase client
// construction reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (absent in tests).
// loadCatalogs useEffect uses this; with null data the effect returns early via
// the `if (!mounted || error)` guard — catalogs remain empty, no UI impact.
vi.mock("../lib/supabaseClient", () => {
  const end = Promise.resolve({ data: null, error: new Error("mocked") });
  const q: Record<string, () => unknown> = {};
  q.select = () => q;
  q.eq = () => q;
  q.order = () => end;
  q.maybeSingle = () => end;
  return { supabase: { from: () => q } };
});

// Behavior mock 1: cart context
vi.mock("../context/useCart");
// Behavior mock 2: Bankart PaymentJS factory
vi.mock("../lib/bankartPaymentJs");
// Behavior mock 3: createOrder network call
vi.mock("../lib/createOrder");

import CartDrawer from "./CartDrawer";
import { useCart } from "../context/useCart";
import { createOrder } from "../lib/createOrder";
import { createBankartPaymentJs } from "../lib/bankartPaymentJs";
import type { CartContextType, CartItem } from "../context/CartContext";

const mockUseCart = vi.mocked(useCart);
const mockCreateOrder = vi.mocked(createOrder);
const mockCreateBankartPaymentJs = vi.mocked(createBankartPaymentJs);

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

const SUCCESS_RESULT = {
  success: true as const,
  orderId: "ord-test-1",
  flow: "cash" as const,
  paymentMethod: "cash" as const,
  paymentStatus: null,
  redirectUrl: null,
};

describe("CartDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  // ─── Group A: Render per cart-state ────────────────────────────────────────

  describe("A: render per cart-state", () => {
    it("A1: renders nothing when isOpen is false", () => {
      mockUseCart.mockReturnValue(makeCart({ isOpen: false }));
      const { container } = render(<CartDrawer />);
      expect(container.firstChild).toBeNull();
    });

    it("A2: empty cart shows 'Korpa je prazna'", () => {
      mockUseCart.mockReturnValue(makeCart({ items: [], totalItems: 0, totalPrice: 0 }));
      render(<CartDrawer />);
      expect(screen.getByText("Korpa je prazna")).toBeInTheDocument();
    });

    it("A3: cart with item renders item name and item count", () => {
      const item = makeCartItem();
      mockUseCart.mockReturnValue(
        makeCart({ items: [item], totalItems: 1, totalPrice: 800 }),
      );
      render(<CartDrawer />);
      expect(screen.getByText("Margherita")).toBeInTheDocument();
      expect(screen.getByText(/1 stavki/)).toBeInTheDocument();
    });
  });

  // ─── Group B: Form-validation gating ───────────────────────────────────────

  describe("B: form-validation gating", () => {
    it("B1: submitting with empty fields shows name/phone/address errors; createOrder not called", async () => {
      const item = makeCartItem();
      mockUseCart.mockReturnValue(
        makeCart({ items: [item], totalItems: 1, totalPrice: 800 }),
      );
      mockCreateOrder.mockResolvedValue(SUCCESS_RESULT);

      render(<CartDrawer />);

      // Navigate to checkout
      await userEvent.click(screen.getByRole("button", { name: /poruči/i }));

      // Submit without filling any fields
      const form = document.querySelector("form");
      expect(form).not.toBeNull();
      fireEvent.submit(form!);

      // After submitAttempted=true, required-field errors appear
      await waitFor(() => {
        expect(screen.getByText("Unesi ime i prezime.")).toBeInTheDocument();
      });
      expect(screen.getByText("Unesi broj telefona.")).toBeInTheDocument();
      expect(screen.getByText("Unesi adresu dostave.")).toBeInTheDocument();
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });

    it("B2: valid name/phone/address but no delivery zone blocks submit", async () => {
      const item = makeCartItem();
      mockUseCart.mockReturnValue(
        makeCart({ items: [item], totalItems: 1, totalPrice: 800 }),
      );
      mockCreateOrder.mockResolvedValue(SUCCESS_RESULT);

      render(<CartDrawer />);
      await userEvent.click(screen.getByRole("button", { name: /poruči/i }));

      await userEvent.type(
        screen.getByPlaceholderText("Npr. Petar Petrovic"),
        "Petar Petrovic",
      );
      await userEvent.type(screen.getByPlaceholderText("+382..."), "+38269000000");
      await userEvent.type(
        screen.getByPlaceholderText("Ulica i broj"),
        "Slobode 10",
      );

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText("Izaberi zonu dostave.")).toBeInTheDocument();
      });
      expect(mockCreateOrder).not.toHaveBeenCalled();
    });
  });

  // ─── Group C: Submit-branch contract ───────────────────────────────────────

  describe("C: submit-branch contract", () => {
    async function fillAndSelectBudva() {
      await userEvent.click(screen.getByRole("button", { name: /poruči/i }));

      await userEvent.type(
        screen.getByPlaceholderText("Npr. Petar Petrovic"),
        "Petar Petrovic",
      );
      await userEvent.type(screen.getByPlaceholderText("+382..."), "+38269000000");
      await userEvent.type(
        screen.getByPlaceholderText("Ulica i broj"),
        "Slobode 10",
      );

      // Open zone dropdown and select Budva (feeCents: 0 — free delivery)
      const zoneBtn = screen.getByRole("button", { name: /izaberi zonu/i });
      await userEvent.click(zoneBtn);
      await userEvent.click(screen.getByRole("option", { name: /budva/i }));
    }

    it("C1: cash payment — createOrder called with payment_method 'cash'", async () => {
      const item = makeCartItem();
      mockUseCart.mockReturnValue(
        makeCart({
          items: [item],
          totalItems: 1,
          totalPrice: 800,
          checkout: { paymentMethod: "cash", status: "draft" },
        }),
      );
      mockCreateOrder.mockResolvedValue(SUCCESS_RESULT);

      render(<CartDrawer />);
      await fillAndSelectBudva();

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateOrder.mock.calls[0]?.[0];
      expect(payload?.payment_method).toBe("cash");
      expect(payload?.customer_name).toBe("Petar Petrovic");
      expect(mockCreateBankartPaymentJs).not.toHaveBeenCalled();
    });

    it("C2: card payment (PaymentJS feature flag off) — createOrder called with payment_method 'card'; no tokenize", async () => {
      const item = makeCartItem();
      mockUseCart.mockReturnValue(
        makeCart({
          items: [item],
          totalItems: 1,
          totalPrice: 800,
          checkout: { paymentMethod: "card", status: "draft" },
        }),
      );
      // redirectUrl null → card_redirect block skipped (no window.location.assign)
      mockCreateOrder.mockResolvedValue({
        ...SUCCESS_RESULT,
        flow: "card_redirect",
        paymentMethod: "card",
        redirectUrl: null,
      });

      render(<CartDrawer />);
      await fillAndSelectBudva();

      const form = document.querySelector("form");
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(mockCreateOrder).toHaveBeenCalledTimes(1);
      });

      const payload = mockCreateOrder.mock.calls[0]?.[0];
      expect(payload?.payment_method).toBe("card");
      // Without PaymentJS feature flag, no tokenize — transaction_token absent
      expect(payload?.transaction_token).toBeUndefined();
      expect(mockCreateBankartPaymentJs).not.toHaveBeenCalled();
    });
  });
});
