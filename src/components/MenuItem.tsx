import { motion } from "framer-motion";
import { useCart } from "../context/useCart";
import type { PizzaSize } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";

type PizzaVariantsProp = Partial<
  Record<"33" | "50", { id: string; price: number; category: string }>
>;

type MenuItemProps = {
  id: string;
  name: string;
  description: string;
  // IMPORTANT: EUR cente (int)
  price: number;
  image: string;
  category: string;

  // novo (dolazi iz Menu.tsx)
  pizzaSize?: PizzaSize;
  baseKey?: string;
  variants?: PizzaVariantsProp;
};

export default function MenuItem({
  id,
  name,
  description,
  price,
  image,
  category,
  pizzaSize,
  baseKey,
  variants,
}: MenuItemProps) {
  const { addToCart } = useCart();

  const safePrice = toSafeInt(price, 0);
  const canAdd = Number.isFinite(safePrice) && safePrice >= 0;

  const handleAddToCart = () => {
    if (!canAdd) return;

    addToCart({
      id,
      name,
      description,
      price: safePrice,
      image,
      category,
      quantity: 1,

      // novo (CartProvider normalizuje ovo i pamti varijante)
      size: pizzaSize ?? null,
      baseKey: baseKey,
      menuItemId: id,
      variants: variants
        ? {
            ...(variants["33"]
              ? {
                  "33": {
                    menuItemId: variants["33"].id,
                    price: toSafeInt(variants["33"].price, 0),
                    category: variants["33"].category,
                  },
                }
              : {}),
            ...(variants["50"]
              ? {
                  "50": {
                    menuItemId: variants["50"].id,
                    price: toSafeInt(variants["50"].price, 0),
                    category: variants["50"].category,
                  },
                }
              : {}),
          }
        : undefined,
    });
  };

  return (
    <motion.div
      initial={false}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="group flex gap-4 rounded-2xl p-4 bg-[#1b1b1b] shadow-md hover:shadow-xl border border-white/5 hover:border-yellow-500/30 transition-colors"
    >
      <div className="overflow-hidden rounded-xl w-24 h-24 flex-shrink-0 bg-black/20">
        <motion.img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          initial={false}
          whileHover={{ scale: 1.06 }}
          transition={{ duration: 0.22 }}
          loading="lazy"
        />
      </div>

      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div>
          <h4 className="text-lg font-semibold text-white truncate">{name}</h4>
          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{description}</p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-yellow-400 font-bold">{formatEUR(safePrice)}</span>

          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.92 }}
            onClick={handleAddToCart}
            disabled={!canAdd}
            className="px-4 py-1.5 rounded-full bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400 transition shadow-sm group-hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Dodaj ${name} u korpu`}
          >
            Dodaj
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
