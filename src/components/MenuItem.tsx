import { motion } from "framer-motion";
import { useCart } from "../context/useCart";

type MenuItemProps = {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
};

export default function MenuItem({
  id,
  name,
  description,
  price,
  image,
  category,
}: MenuItemProps) {
  const { addToCart } = useCart();

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="flex gap-4 bg-[#1b1b1b] rounded-xl p-4"
    >
      <img
        src={image}
        alt={name}
        className="w-24 h-24 object-cover rounded-lg"
      />

      <div className="flex-1">
        <h4 className="text-lg font-semibold text-white">
          {name}
        </h4>

        <p className="text-sm text-gray-400 mt-1">
          {description}
        </p>

        <div className="flex items-center justify-between mt-4">
          <span className="text-yellow-400 font-bold">
            {price} RSD
          </span>

          <button
            onClick={() =>
              addToCart({
                id,
                name,
                description,
                price,
                image,
                category,
                quantity: 1,
              })
            }
            className="px-4 py-1.5 rounded-full bg-yellow-500 text-black text-sm font-semibold hover:bg-yellow-400"
          >
            Dodaj
          </button>
        </div>
      </div>
    </motion.div>
  );
}
