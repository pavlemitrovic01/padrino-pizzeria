// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  trackAddToCart,
  trackRemoveFromCart,
  trackBeginCheckout,
  trackAddPaymentInfo,
  trackPurchase,
} from "./analytics";

describe("GA4 enhanced ecommerce helpers", () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    vi.stubGlobal("gtag", gtagSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("trackAddToCart fires add_to_cart with EUR value", () => {
    trackAddToCart({ item_id: "p1", item_name: "Margherita", price: 8.5, quantity: 1 });
    expect(gtagSpy).toHaveBeenCalledWith("event", "add_to_cart", expect.objectContaining({
      currency: "EUR",
      value: 8.5,
    }));
  });

  it("trackRemoveFromCart fires remove_from_cart with EUR value", () => {
    trackRemoveFromCart({ item_id: "p2", item_name: "Prosciutto", price: 10, quantity: 2 });
    expect(gtagSpy).toHaveBeenCalledWith("event", "remove_from_cart", expect.objectContaining({
      currency: "EUR",
      value: 20,
    }));
  });

  it("trackBeginCheckout converts cents to EUR", () => {
    trackBeginCheckout([], 1500);
    expect(gtagSpy).toHaveBeenCalledWith("event", "begin_checkout", expect.objectContaining({
      currency: "EUR",
      value: 15,
    }));
  });

  it("trackAddPaymentInfo fires with payment_type and EUR value", () => {
    trackAddPaymentInfo("card", 2000);
    expect(gtagSpy).toHaveBeenCalledWith("event", "add_payment_info", expect.objectContaining({
      payment_type: "card",
      currency: "EUR",
      value: 20,
    }));
  });

  it("trackPurchase fires with transaction_id and EUR value", () => {
    trackPurchase("order-abc-123", 1800, "cash");
    expect(gtagSpy).toHaveBeenCalledWith("event", "purchase", expect.objectContaining({
      transaction_id: "order-abc-123",
      currency: "EUR",
      value: 18,
    }));
  });
});
