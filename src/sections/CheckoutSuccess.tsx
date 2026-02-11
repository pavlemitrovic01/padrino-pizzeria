import { motion } from "framer-motion";

type CheckoutSuccessProps = {
  onBackToMenu: () => void;
};

export default function CheckoutSuccess({ onBackToMenu }: CheckoutSuccessProps) {
  return (
    <section className="relative bg-black min-h-[60vh] flex items-center justify-center px-6 py-24">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/90 to-black" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative z-10 max-w-xl w-full rounded-3xl border border-white/5 bg-[#121212] shadow-2xl p-8 text-center"
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mx-auto mb-6 flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500 text-black text-4xl font-extrabold"
        >
          ✓
        </motion.div>

        <h2 className="text-3xl font-extrabold text-white">
          Porudžbina je uspješno poslata
        </h2>

        <p className="text-gray-400 mt-4 leading-relaxed">
          Hvala ti na povjerenju! Tvoja porudžbina je zaprimljena i uskoro
          krećemo sa pripremom.
        </p>

        <p className="text-sm text-gray-500 mt-3">
          Ako imaš dodatna pitanja, slobodno nas kontaktiraj telefonom.
        </p>

        <div className="mt-10">
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={onBackToMenu}
            className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-yellow-500 text-black font-semibold hover:bg-yellow-400 transition shadow"
          >
            Nazad na meni
          </motion.button>
        </div>
      </motion.div>
    </section>
  );
}




