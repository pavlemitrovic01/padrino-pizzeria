import { createContext } from "react";

export type PizzaSize = "33" | "50";

export const PIZZA_SIZES: PizzaSize[] = ["33", "50"];

// Guard za PizzaSize
export function isPizzaSize(value: unknown): value is PizzaSize {
  return value === "33" || value === "50";
}

export type PizzaVariant = {
  menuItemId: string;
  price: number;
  category: string;
};

export type CartAddon = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type CartItem = {
  id: string;

  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  quantity: number;

  size?: PizzaSize | null;
  baseKey?: string;
  menuItemId?: string;
  variants?: Partial<Record<PizzaSize, PizzaVariant>>;

  basePrice?: number;
  addons?: CartAddon[];

  note?: string;
};

export type AddToCartOptions = {
  /**
   * Default: true
   * Kada je false, item se doda ali se korpa (drawer) ne otvara automatski.
   */
  openCart?: boolean;
};

/** -------------------- ORDER / PAYMENT (PRE-NLB PREP) -------------------- */
/**
 * Namerno je minimalno i generičko: NLB detalje dodajemo tek kad stignu podaci.
 * Ovo služi da stabilno “zaključamo” order lifecycle i snapshot pre payment-a.
 */
export type PaymentMethod = "cash" | "card";

export type OrderStatus =
  | "draft"
  | "pending_payment"
  | "paid"
  | "failed"
  | "cancelled";

export type OrderSnapshot = {
  id: string; // client-side ID (npr. uuid) — server može kasnije da mapira
  createdAt: string; // ISO string
  items: CartItem[];
  totalItems: number;
  totalPrice: number;

  paymentMethod: PaymentMethod;
  status: OrderStatus;

  // Placeholder polja za NLB / gateway reference (popunjavamo kasnije)
  gateway?: {
    provider: "NLB" | "UNKNOWN";
    transactionId?: string;
    sessionId?: string;
    raw?: Record<string, unknown>;
  };

  note?: string;
};

export type CheckoutState = {
  paymentMethod: PaymentMethod;
  status: OrderStatus;

  // poslednji “zaključani” snapshot (ako postoji)
  snapshot?: OrderSnapshot | null;

  // error poruka za UI
  error?: string | null;
};
/** ----------------------------------------------------------------------- */

export type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  totalPrice: number;
  totalItems: number;

  openCart: () => void;
  closeCart: () => void;

  addToCart: (item: CartItem, options?: AddToCartOptions) => void;
  /**
   * Replace an existing cart item by id with a fully-formed replacement.
   *
   * Pure replacement semantics — does NOT merge quantities or addon unions
   * the way addToCart does. Used by the edit-reopen flow from CartView where
   * the user re-opens MenuItemDetailSheet pre-filled and saves a new
   * snapshot of size/qty/addons/note. No-op + console.warn if id is not in
   * the cart (defensive — shouldn't happen but avoids silent corruption).
   *
   * GA4: edit does NOT fire add_to_cart event (consistent with "edit is not
   * a new conversion"). Tracked separately if delta semantics ever needed.
   */
  updateItemInCart: (id: string, replacement: CartItem) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  removeFromCart: (id: string) => void;

  clearCart: () => void;
  resetCart: () => void;

  /**
   * ✅ Pre-payment priprema (NLB dolazi kasnije).
   * Ova polja su OPTIONAL da ne razbiju build dok ne završimo CartProvider u sledećem koraku.
   */
  checkout?: CheckoutState;

  setPaymentMethod?: (method: PaymentMethod) => void;
  setCheckoutStatus?: (status: OrderStatus) => void;
  setCheckoutError?: (message: string | null) => void;

  /**
   * Zaključava trenutnu korpu u snapshot (id/createdAt/totals + status).
   * Tipično pozivaš kad user klikne “Nastavi na plaćanje”.
   */
  createOrderSnapshot?: () => OrderSnapshot;

  /**
   * Resetuje checkout flow (status/error/snapshot) bez brisanja korpe,
   * ili kao priprema za novi checkout pokušaj.
   */
  resetCheckout?: () => void;
};

export const CartContext = createContext<CartContextType | null>(null);