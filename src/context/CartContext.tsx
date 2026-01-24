import { createContext } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  quantity: number;
};

export type CartContextType = {
  items: CartItem[];
  isOpen: boolean;
  totalPrice: number;
  totalItems: number;

  openCart: () => void;
  closeCart: () => void;

  addToCart: (item: CartItem) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  resetCart: () => void;
};

export const CartContext = createContext<CartContextType | null>(null);





































