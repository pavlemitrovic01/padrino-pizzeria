import { ReactNode, useMemo, useState } from "react";
import {
  CartAddon,
  CartContext,
  CartItem,
  PizzaSize,
  PizzaVariant,
  isPizzaSize,
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

function pickBestSize(
  variants?: Partial<Record<PizzaSize, PizzaVariant>>
): PizzaSize | null {
  // stabilno: uvijek prvo 33, pa 50 (ako postoji)
  if (variants?.["33"]) return "33";
  if (variants?.["50"]) return "50";
  return null;
}

/**
 * Base price mora uvijek biti "osnovna cijena" BEZ dodataka.
 * Ako basePrice fali, izračunaj ga iz price - addonsTotal (sa guard-om).
 */
function getBasePrice(item: CartItem): number {
  if (typeof item.basePrice === "number" && Number.isFinite(item.basePrice)) {
    return item.basePrice;
  }

  const addonsTotal = calcAddonsTotal(item.addons);
  const derived = (item.price ?? 0) - addonsTotal;

  if (Number.isFinite(derived)) return derived;
  return item.price ?? 0;
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
      size: null,
      baseKey: item.baseKey ?? item.name,
      menuItemId: item.menuItemId ?? item.id,
      variants: item.variants ?? undefined,
      basePrice,
      addons: normalizedAddons,
      price: finalPrice,
      note: item.note ?? "",
    };
  }

  // Pizza: canonical baseKey + stabilan id
  const baseKey = item.baseKey ?? stripSizeFromName(item.name);

  // detekcija veličine (ako dolazi)
  const detected = item.size ?? parsePizzaSizeFromText(item.name);
  const detectedSize: PizzaSize | null = isPizzaSize(detected) ? detected : null;

  const incomingMenuItemId = item.menuItemId ?? item.id;

  const incomingBasePrice = item.basePrice ?? item.price;

  // merge variants (ako postoje)
  const variants: Partial<Record<PizzaSize, PizzaVariant>> = {
    ...(item.variants ?? {}),
  };

  if (detectedSize) {
    variants[detectedSize] = {
      menuItemId: incomingMenuItemId,
      price: incomingBasePrice,
      category: item.category,
    };
  }

  // odredi final size (single source of truth)
  const finalSize = detectedSize ?? pickBestSize(variants);

  // odredi final variant (ako postoji)
  const chosenVariant = finalSize ? variants[finalSize] : undefined;

  // basePrice mora biti cijena iz izabrane varijante (kad je imamo)
  const basePrice = chosenVariant?.price ?? incomingBasePrice;

  // menuItemId mora pratiti izabranu varijantu (kad je imamo)
  const menuItemId = chosenVariant?.menuItemId ?? incomingMenuItemId;

  // category iz varijante (da UI/checkout bude konzistentan)
  const category = chosenVariant?.category ?? item.category;

  const finalPrice = basePrice + calcAddonsTotal(normalizedAddons);

  return {
    ...item,
    id: baseKey,
    name: baseKey,
    baseKey,
    size: finalSize,
    menuItemId,
    variants,
    basePrice,
    addons: normalizedAddons,
    price: finalPrice,
    category,
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

          const mergedVariants: Partial<Record<PizzaSize, PizzaVariant>> = {
            ...(i.variants ?? {}),
            ...(item.variants ?? {}),
          };

          // zadržavamo dodatke i napomenu na postojećem item-u
          const addons = i.addons ?? [];

          // ako imamo size (ili možemo da ga odredimo), osiguraj basePrice/menuItemId iz varijante
          const candidateSize: PizzaSize | null =
            (isPizzaLike(i.category, i.name) ? (i.size ?? null) : null) ?? null;

          const bestSize: PizzaSize | null =
            (candidateSize && isPizzaSize(candidateSize) ? candidateSize : null) ??
            pickBestSize(mergedVariants);

          const chosenVariant = bestSize ? mergedVariants[bestSize] : undefined;

          const nextBasePrice =
            chosenVariant?.price ?? i.basePrice ?? item.basePrice ?? getBasePrice(i);

          const nextMenuItemId =
            chosenVariant?.menuItemId ?? i.menuItemId ?? item.menuItemId ?? i.id;

          const nextCategory = chosenVariant?.category ?? i.category;

          const finalPrice = nextBasePrice + calcAddonsTotal(addons);

          return {
            ...i,
            quantity: i.quantity + 1,
            variants: Object.keys(mergedVariants).length ? mergedVariants : i.variants,
            size: isPizzaLike(i.category, i.name) ? bestSize : null,
            basePrice: nextBasePrice,
            menuItemId: nextMenuItemId,
            category: nextCategory,
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

      const mergedVariants: Partial<Record<PizzaSize, PizzaVariant>> = {
        ...(current.variants ?? {}),
        [size]: next,
      };

      const basePrice = next.price;
      const finalPrice = basePrice + calcAddonsTotal(addons);

      return prev.map((i) => {
        if (i.id !== id) return i;

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

        const basePrice = getBasePrice(i);
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

        const basePrice = getBasePrice(i);
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
          .map((a) => (a.id === addonId ? { ...a, quantity: a.quantity - 1 } : a))
          .filter((a) => a.quantity > 0);

        const basePrice = getBasePrice(i);
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

        const basePrice = getBasePrice(i);
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
