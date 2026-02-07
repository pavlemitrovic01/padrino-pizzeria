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

export type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  totalPrice: number;
  totalItems: number;

  openCart: () => void;
  closeCart: () => void;

  addToCart: (item: CartItem, options?: AddToCartOptions) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  removeFromCart: (id: string) => void;

  changeSize: (id: string, size: PizzaSize, next: PizzaVariant) => void;

  addAddonToItem: (id: string, addon: Omit<CartAddon, "quantity">) => void;
  increaseAddonQuantity: (id: string, addonId: string) => void;
  decreaseAddonQuantity: (id: string, addonId: string) => void;
  removeAddonFromItem: (id: string, addonId: string) => void;

  setItemNote: (id: string, note: string) => void;

  clearCart: () => void;
  resetCart: () => void;
};

export const CartContext = createContext<CartContextType | null>(null);
