import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient.ts";
import { useCart } from "../../context/useCart";
import type { PizzaSize, PizzaVariant } from "../../context/CartContext";
import { toSafeInt } from "../../lib/money";
import {
  buildImageCandidates,
  hasEurPrice,
  isDrinkCategory,
  isPizzaRow,
  isSauceCategory,
  isSauceItemName,
  isSaucesPlaceholder,
  normalizeCategory,
  parsePizzaSizeFromName,
  stripPizzaSizeFromName,
} from "../../lib/cartDrawerHelpers";

type MenuItemData = {
  id: string;
  name: string;
  price_eur_cents: number | null;
  price: number | null;
  category: string;
};

export type PizzaVariantsMap = Record<string, Partial<Record<PizzaSize, PizzaVariant>>>;

export function useCatalogData(opts?: { onError?: () => void }) {
  const { addToCart, changeSize } = useCart();

  // Stable ref so the effect closure doesn't need onError in deps
  const onErrorRef = useRef(opts?.onError);
  useEffect(() => {
    onErrorRef.current = opts?.onError;
  });

  const [addonsCatalog, setAddonsCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);

  const [saucesCatalog, setSaucesCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string }[]
  >([]);

  const [drinksCatalog, setDrinksCatalog] = useState<
    { id: string; name: string; price: number; imageKey: string; category: string }[]
  >([]);

  const [pizzaVariantsByBaseKey, setPizzaVariantsByBaseKey] = useState<PizzaVariantsMap>({});

  const sauceIdSet = useMemo(() => {
    return new Set<string>((saucesCatalog ?? []).map((s) => s.id));
  }, [saucesCatalog]);

  const setPizzaSizeSafe = (itemId: string, itemName: string, nextSize: PizzaSize) => {
    const baseKey = stripPizzaSizeFromName(itemName);
    const variants = pizzaVariantsByBaseKey[baseKey];
    const next = variants?.[nextSize];
    if (!next) return;
    changeSize(itemId, nextSize, next);
  };

  const addDrinkToCart = (d: { id: string; name: string; price: number; imageKey: string; category: string }) => {
    addToCart({
      id: `${d.id}-${Date.now()}`,
      name: d.name,
      price: d.price,
      image: buildImageCandidates(null, d.imageKey)[0] ?? "/menu/padrino.webp",
      description: "",
      category: d.category,
      quantity: 1,
      size: null,
      baseKey: d.name,
      menuItemId: d.id,
    });
  };

  useEffect(() => {
    let mounted = true;

    async function loadCatalogs() {
      try {
        const { data, error } = await supabase
          .from("menu_items")
          .select("id,name,price,price_eur_cents,category,is_active")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (!mounted || error) return;

        const rows = ((data ?? []) as MenuItemData[]).filter(hasEurPrice);

        const nextPizzaVariants: PizzaVariantsMap = {};
        for (const r of rows) {
          if (!isPizzaRow(r)) continue;

          const size = parsePizzaSizeFromName(r.name);
          if (!size) continue;

          const baseKey = stripPizzaSizeFromName(r.name);
          if (!baseKey) continue;

          const variant: PizzaVariant = {
            menuItemId: r.id,
            price: toSafeInt(r.price_eur_cents, 0),
            category: r.category ?? "",
          };

          if (!nextPizzaVariants[baseKey]) nextPizzaVariants[baseKey] = {};
          nextPizzaVariants[baseKey][size] = variant;
        }
        setPizzaVariantsByBaseKey(nextPizzaVariants);

        const addonRows = rows.filter((r) => normalizeCategory(r.category ?? "") === "dodaci");
        const sauceRows = rows.filter((r) => isSauceCategory(r.category ?? "") || isSauceItemName(r.name));

        const nextAddons = addonRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0), imageKey: r.name }));

        const nextSauces = sauceRows
          .filter((r) => !isSaucesPlaceholder(r.name))
          .map((r) => ({ id: r.id, name: r.name, price: toSafeInt(r.price_eur_cents, 0), imageKey: r.name }));

        const drinkRows = rows.filter((r) => isDrinkCategory(r.category ?? ""));
        const nextDrinks = drinkRows.map((r) => ({
          id: r.id,
          name: r.name,
          price: toSafeInt(r.price_eur_cents, 0),
          imageKey: r.name,
          category: r.category ?? "",
        }));

        setDrinksCatalog(nextDrinks);
        setSaucesCatalog(nextSauces);
        setAddonsCatalog(nextAddons);
      } catch {
        if (!mounted) return;
        setAddonsCatalog([]);
        setSaucesCatalog([]);
        setDrinksCatalog([]);
        setPizzaVariantsByBaseKey({});
        onErrorRef.current?.();
      }
    }

    void loadCatalogs();
    return () => {
      mounted = false;
    };
  }, []); // one-shot loader on mount; onError captured via ref

  return {
    pizzaVariantsByBaseKey,
    drinksCatalog,
    saucesCatalog,
    addonsCatalog,
    sauceIdSet,
    setPizzaSizeSafe,
    addDrinkToCart,
  };
}
