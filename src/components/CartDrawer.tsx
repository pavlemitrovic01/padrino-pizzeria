import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "../context/useCart";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    increase,
    decrease,
    removeFromCart,
    totalPrice,
  } = useCart();

  const isEmpty = items.length === 0;

  const handleGoToMenu = () => {
    closeCart();
    const el = document.getElementById("menu");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            className="fixed inset-0 bg-black/60 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.aside
            className="fixed right-0 top-0 h-full w-full max-w-md bg-[#121212] z-50 flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-bold text-white">
                Tvoja narudžba
              </h3>
              <button
                onClick={closeCart}
                className="text-gray-400 hover:text-white text-xl"
                aria-label="Zatvori korpu"
              >
                ✕
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <AnimatePresence>
                {isEmpty && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center mt-16 space-y-4"
                  >
                    <p className="text-gray-400">
                      Korpa je trenutno prazna.
                    </p>
                    <button
                      onClick={handleGoToMenu}
                      className="inline-flex items-center justify-center px-5 py-2 rounded-full bg-yellow-500 text-black font-semibold hover:bg-yellow-400"
                    >
                      Pogledajte izbornik
                    </button>
                  </motion.div>
                )}

                {!isEmpty &&
                  items.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 50 }}
                      transition={{ duration: 0.25 }}
                      className="flex gap-4 bg-[#1b1b1b] rounded-xl p-4"
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg"
                      />

                      <div className="flex-1">
                        <h4 className="text-white font-semibold">
                          {item.name}
                        </h4>
                        <p className="text-sm text-gray-400">
                          {item.price} RSD
                        </p>

                        <div className="flex items-center gap-3 mt-3">
                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => decrease(item.id)}
                            className="w-7 h-7 rounded-full bg-gray-700 text-white"
                            aria-label="Smanji količinu"
                          >
                            −
                          </motion.button>

                          <span className="text-white">
                            {item.quantity}
                          </span>

                          <motion.button
                            whileTap={{ scale: 0.85 }}
                            onClick={() => increase(item.id)}
                            className="w-7 h-7 rounded-full bg-gray-700 text-white"
                            aria-label="Povećaj količinu"
                          >
                            +
                          </motion.button>
                        </div>
                      </div>

                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-gray-500 hover:text-red-400"
                        aria-label="Ukloni stavku"
                      >
                        ✕
                      </button>
                    </motion.div>
                  ))}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700">
              <div className="flex justify-between text-white font-bold mb-4">
                <span>Ukupno</span>
                <span>{totalPrice} RSD</span>
              </div>

              <button
                disabled={isEmpty}
                className={`w-full py-3 rounded-full font-semibold transition
                  ${
                    isEmpty
                      ? "bg-gray-600 text-gray-300 cursor-not-allowed opacity-70"
                      : "bg-yellow-500 text-black hover:bg-yellow-400"
                  }`}
              >
                Nastavi s narudžbom
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}







