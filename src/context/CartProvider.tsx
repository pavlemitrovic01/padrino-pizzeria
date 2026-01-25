import { ReactNode, useMemo, useState } from "react";
import {
  CartAddon,
  CartContext,
  CartItem,
  PizzaSize,
  PizzaVariant,
} from "./CartContext";

function parsePizzaSizeFromText(text: string): PizzaSize | null {
  const t = text.toLowerCase();
  if (t.includes("50 cm")) return "50";
  if (t.includes("33 cm")) return "33";
  return null;
}

function stripSizeFromName(name: string) {
  return name
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isPizzaLike(category: string, name: string) {
  return (
    category === "Pizza 33 cm" ||
    category === "Pizza 50 cm" ||
    /pizza/i.test(category) ||
    /33\s*cm|50\s*cm/i.test(name)
  );
}

function calcAddonsTotal(addons?: CartAddon[]) {
  if (!addons || addons.length === 0) return 0;
  return addons.reduce((sum, a) => sum + a.price * a.quantity, 0);
}

function normalizeIncomingItem(item: CartItem): CartItem {
  const looksLikePizza = isPizzaLike(item.category, item.name);

  const normalizedAddons: CartAddon[] = (item.addons ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    price: a.price,
    quantity: a.quantity && a.quantity > 0 ? a.quantity : 1,
  }));

  if (!looksLikePizza) {
    const basePrice = item.basePrice ?? item.price;
    const finalPrice = basePrice + calcAddonsTotal(normalizedAddons);

    return {
      ...item,
      size: item.size ?? null,
      baseKey: item.baseKey ?? item.name,
      menuItemId: item.menuItemId ?? item.id,
      variants: item.variants ?? undefined,
      basePrice,
      addons: normalizedAddons,
      price: finalPrice,
      note: item.note ?? "",
    };
  }

  const detectedSize = (item.size ?? parsePizzaSizeFromText(item.name)) as
    | PizzaSize
    | null;
  const baseKey = item.baseKey ?? stripSizeFromName(item.name);
  const menuItemId = item.menuItemId ?? item.id;

  const variants: Partial<Record<PizzaSize, PizzaVariant>> = {
    ...(item.variants ?? {}),
  };

  const basePrice = item.basePrice ?? item.price;

  if (detectedSize) {
    variants[detectedSize] = {
      menuItemId,
      price: basePrice,
      category: item.category,
    };
  }

  const finalPrice = basePrice + calcAddonsTotal(normalizedAddons);

  return {
    ...item,
    id: baseKey,
    name: baseKey,
    baseKey,
    size: detectedSize,
    menuItemId,
    variants,
    basePrice,
    addons: normalizedAddons,
    price: finalPrice,
    note: item.note ?? "",
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addToCart = (rawItem: CartItem) => {
    const item = normalizeIncomingItem(rawItem);

    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) => {
          if (i.id !== item.id) return i;

          const mergedVariants = {
            ...(i.variants ?? {}),
            ...(item.variants ?? {}),
          };

          const addons = i.addons ?? [];
          const nextBasePrice = i.basePrice ?? item.basePrice ?? i.price;
          const finalPrice = nextBasePrice + calcAddonsTotal(addons);

          return {
            ...i,
            quantity: i.quantity + 1,
            variants: Object.keys(mergedVariants).length ? mergedVariants : i.variants,
            basePrice: nextBasePrice,
            addons,
            price: finalPrice,
            note: i.note ?? "",
          };
        });
      }

      return [...prev, item];
    });

    setIsOpen(true);
  };

  const increase = (id: string) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity: i.quantity + 1 } : i))
    );
  };

  const decrease = (id: string) => {
    setItems((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const changeSize = (id: string, size: PizzaSize, next: PizzaVariant) => {
    setItems((prev) => {
      const current = prev.find((i) => i.id === id);
      if (!current) return prev;

      const baseKey = current.baseKey ?? current.name;
      const addons = current.addons ?? [];
      const basePrice = next.price;
      const finalPrice = basePrice + calcAddonsTotal(addons);

      return prev.map((i) => {
        if (i.id !== id) return i;

        const existingVariants = i.variants ?? {};
        const mergedVariants = { ...existingVariants, [size]: next };

        return {
          ...i,
          baseKey,
          id: baseKey,
          name: baseKey,
          size,
          menuItemId: next.menuItemId,
          category: next.category,
          variants: mergedVariants,
          basePrice,
          addons,
          price: finalPrice,
          note: i.note ?? "",
        };
      });
    });
  };

  // ✅ Dodaj dodatak: ako postoji -> quantity + 1
  const addAddonToItem = (id: string, addon: Omit<CartAddon, "quantity">) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        const found = existing.find((a) => a.id === addon.id);

        let nextAddons: CartAddon[];
        if (found) {
          nextAddons = existing.map((a) =>
            a.id === addon.id ? { ...a, quantity: a.quantity + 1 } : a
          );
        } else {
          nextAddons = [...existing, { ...addon, quantity: 1 }];
        }

        const basePrice = i.basePrice ?? i.price;
        const finalPrice = basePrice + calcAddonsTotal(nextAddons);

        return {
          ...i,
          addons: nextAddons,
          basePrice,
          price: finalPrice,
          note: i.note ?? "",
        };
      })
    );
  };

  const increaseAddonQuantity = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        const nextAddons = existing.map((a) =>
          a.id === addonId ? { ...a, quantity: a.quantity + 1 } : a
        );

        const basePrice = i.basePrice ?? i.price;
        const finalPrice = basePrice + calcAddonsTotal(nextAddons);

        return { ...i, addons: nextAddons, basePrice, price: finalPrice };
      })
    );
  };

  const decreaseAddonQuantity = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        const nextAddons = existing
          .map((a) =>
            a.id === addonId ? { ...a, quantity: a.quantity - 1 } : a
          )
          .filter((a) => a.quantity > 0);

        const basePrice = i.basePrice ?? i.price;
        const finalPrice = basePrice + calcAddonsTotal(nextAddons);

        return { ...i, addons: nextAddons, basePrice, price: finalPrice };
      })
    );
  };

  // ❌ Ukloni potpuno (X)
  const removeAddonFromItem = (id: string, addonId: string) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;

        const existing = i.addons ?? [];
        const nextAddons = existing.filter((a) => a.id !== addonId);

        const basePrice = i.basePrice ?? i.price;
        const finalPrice = basePrice + calcAddonsTotal(nextAddons);

        return {
          ...i,
          addons: nextAddons,
          basePrice,
          price: finalPrice,
        };
      })
    );
  };

  const setItemNote = (id: string, note: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)));
  };

  const clearCart = () => setItems([]);
  const resetCart = () => setItems([]);

  const totalItems = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () => items.reduce((sum, i) => sum + i.price * i.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        isOpen,
        totalItems,
        totalPrice,
        openCart,
        closeCart,
        addToCart,
        increase,
        decrease,
        removeFromCart,
        changeSize,
        addAddonToItem,
        increaseAddonQuantity,
        decreaseAddonQuantity,
        removeAddonFromItem,
        setItemNote,
        clearCart,
        resetCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
