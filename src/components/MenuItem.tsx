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
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="
        group
        flex gap-4
        bg-[#1b1b1b]
        rounded-2xl
        p-4
        border border-white/5
        hover:border-yellow-500/40
        hover:shadow-[0_10px_30px_rgba(0,0,0,0.6)]
        transition
      "
    >
      {/* IMAGE */}
      <div className="relative w-24 h-24 flex-shrink-0 overflow-hidden rounded-xl">
        <motion.img
          src={image}
          alt={name}
          className="w-full h-full object-cover"
          whileHover={{ scale: 1.08 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />

        {/* subtle overlay */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition" />
      </div>

      {/* CONTENT */}
      <div className="flex flex-col justify-between flex-1">
        <div>
          <h4 className="text-lg font-semibold text-white leading-snug">
            {name}
          </h4>

          <p className="text-sm text-gray-400 mt-1">
            {description}
          </p>
        </div>

        <div className="flex items-center justify-between mt-4">
          <span className="text-yellow-400 font-bold">
            {price} RSD
          </span>

          <motion.button
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.05 }}
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
            className="
              px-4 py-1.5
              rounded-full
              bg-yellow-500
              text-black
              text-sm
              font-semibold
              hover:bg-yellow-400
              transition
            "
          >
            Dodaj
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
