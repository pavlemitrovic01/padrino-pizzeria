import { useContext } from "react";
import { CartContextType, CartContext } from "./CartContext";

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart mora biti korišćen unutar CartProvider-a");
  }
  return context;
}
