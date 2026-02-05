import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section id="top" className="relative min-h-[92vh] flex items-center px-6 overflow-hidden pt-16">
      {/* Background image (koristimo postojeći asset iz /public/menu) */}
      <div className="absolute inset-0">
        <img
          src="/menu/padrino.png"
          alt="Padrino pizza"
          className="w-full h-full object-cover scale-110 opacity-35 blur-[1px]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(234,179,8,0.12),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.07),transparent_45%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto w-full">
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-6"
        >
          Padrino{" "}
          <span className="text-white/70 font-semibold italic">Pizzeria</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mb-10"
        >
          Porodična pizzeria u Budvi — brza dostava, kvalitetni sastojci i pizza koja stiže
          topla, kao da je iz peći pravo na sto.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-col sm:flex-row gap-4"
        >
          <a
            href="/#menu"
            className="bg-yellow-500 text-black px-10 py-4 rounded-full font-extrabold uppercase tracking-widest text-xs sm:text-sm hover:bg-yellow-400 transition-all shadow-xl text-center"
          >
            Pogledaj meni
          </a>

          <a
            href="/#delivery"
            className="border border-white/25 px-10 py-4 rounded-full font-extrabold uppercase tracking-widest text-xs sm:text-sm hover:border-white/45 hover:text-white transition-all backdrop-blur-sm text-center"
          >
            Dostava i zona
          </a>
        </motion.div>

        {/* Mini trust row */}
        <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl">
          {[
            { k: "Brza dostava", v: "Budva i okolina" },
            { k: "Svježe tijesto", v: "svaki dan" },
            { k: "Plaćanje", v: "keš / kartica" },
            { k: "Podrška", v: "telefon / WhatsApp" },
          ].map((x) => (
            <div
              key={x.k}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur"
            >
              <p className="text-xs font-extrabold text-white">{x.k}</p>
              <p className="text-xs text-white/70 mt-1">{x.v}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
