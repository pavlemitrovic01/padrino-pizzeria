import { createContext, useContext, useState } from "react";

export type CartItem = {
  id: string;
  name: string;
  price: number;

  // 🔧 OVO REŠAVA BUILD GREŠKE
  quantity?: number;
  description?: string;
  image_url?: string;
  category?: string;
};

export type CartContextType = {
  items: CartItem[];
  totalPrice: number;
  totalItems: number;
  isOpen: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (id: string) => void;
  increase: (id: string) => void;
  decrease: (id: string) => void;
  clearCart: () => void;
  resetCart: () => void;
  openCart: () => void;
  closeCart: () => void;
};

export const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  function addToCart(item: CartItem) {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);

      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: (i.quantity ?? 1) + 1 }
            : i
        );
      }

      return [
        ...prev,
        {
          ...item,
          quantity: item.quantity ?? 1,
        },
      ];
    });

    setIsOpen(true);
  }

  function removeFromCart(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function increase(id: string) {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, quantity: (i.quantity ?? 1) + 1 }
          : i
      )
    );
  }

  function decrease(id: string) {
    setItems((prev) =>
      prev
        .map((i) =>
          i.id === id
            ? { ...i, quantity: (i.quantity ?? 1) - 1 }
            : i
        )
        .filter((i) => (i.quantity ?? 0) > 0)
    );
  }

  function clearCart() {
    setItems([]);
  }

  function resetCart() {
    setItems([]);
    setIsOpen(false);
  }

  function openCart() {
    setIsOpen(true);
  }

  function closeCart() {
    setIsOpen(false);
  }

  const totalPrice = items.reduce(
    (sum, item) => sum + item.price * (item.quantity ?? 1),
    0
  );

  const totalItems = items.reduce(
    (sum, item) => sum + (item.quantity ?? 1),
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        totalPrice,
        totalItems,
        isOpen,
        addToCart,
        removeFromCart,
        increase,
        decrease,
        clearCart,
        resetCart,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}





























