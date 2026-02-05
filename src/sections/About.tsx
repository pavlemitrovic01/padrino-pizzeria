
import { motion } from "framer-motion";
import { Heart, MapPin, Phone } from "lucide-react";

export default function About() {
  return (
    <section id="o-nama" className="py-20 bg-gradient-to-b from-black to-[#111111]">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl mx-auto text-center"
        >
          <h2 className="text-4xl font-bold text-white mb-6">O nama</h2>
          <p className="text-gray-300 text-lg mb-12">
            Padrino je porodična pizzerija u Budvi, gdje se tradicija i kvalitet
            spajaju u savršen zalogaj. Svaku pizzu pripremamo sa ljubavlju,
            koristeći pažljivo birane sastojke i autentične recepte.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800"
            >
              <Heart className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Kvalitet</h3>
              <p className="text-gray-400">
                Samo najbolji sastojci i domaće tijesto
              </p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800"
            >
              <MapPin className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Lokacija</h3>
              <p className="text-gray-400">Budva, Crna Gora</p>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              className="bg-[#1a1a1a] p-6 rounded-xl border border-gray-800"
            >
              <Phone className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Dostava</h3>
              <p className="text-gray-400">Brza dostava na tvoju adresu</p>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="relative rounded-2xl overflow-hidden"
          >
            <img
              src="/menu/anatoli.png"
              alt="Padrino pizza"
              className="w-full h-64 object-cover opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-left">
              <h3 className="text-2xl font-bold text-white mb-2">
                Ljubav na kućnu adresu
              </h3>
              <p className="text-gray-300">
                Naruči online i uživaj u autentičnom ukusu Padrino pice
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}







