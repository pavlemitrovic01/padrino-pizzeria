import { motion } from "framer-motion";

const DELIVERY_PILLS = [
  { icon: "📍", stat: "8 zona", label: "Lastva – Sveti Stefan" },
  { icon: "⏱️", stat: "~30 min", label: "Do vaših vrata" },
  { icon: "🛵", stat: "Besplatno", label: "Dostava u Budvi" },
];

export default function Delivery() {
  return (
    <section
      id="delivery"
      className="relative overflow-hidden bg-black py-16 md:py-24"
      aria-labelledby="delivery-title"
    >
      {/* TOP FADE — eliminates sharp seam from hero section */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black to-transparent z-[5]" />

      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <img
          src="/sections/delivery.webp"
          alt="Dostava pizze u Budvi - Padrino Pizzeria"
          className={[
            "h-full w-full object-cover",
            "object-[50%_40%]",
            "sm:object-[50%_45%]",
            "md:object-[50%_50%]",
            "lg:object-[50%_50%]",
          ].join(" ")}
          draggable={false}
          loading="lazy"
          decoding="async"
          width={1920}
          height={1080}
        />

        {/* 2 overlay layers (down from 5 + inset shadow) */}
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

        {/* Seamless glow — kept for inter-section blending */}
        <div className="pointer-events-none absolute -top-24 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.12),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-10 md:mb-12 text-center">
          <div className="p-kicker mb-4">Dostava</div>

          <h2 id="delivery-title" className="p-title text-4xl md:text-5xl">
            Brzo. Vruće. Pouzdano.
          </h2>

          <p className="mt-4 text-white/65 max-w-xl mx-auto leading-relaxed">
            Pripremamo svježe, dostavljamo toplo — širom Budvanske rivijere.
          </p>
        </div>

        {/* Stat pills — grid-cols-3 works on mobile too (compact) */}
        <div className="grid grid-cols-3 gap-4 md:gap-6">
          {DELIVERY_PILLS.map((pill, i) => (
            <motion.div
              key={pill.stat}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.06 }}
              className={[
                "p-glass p-glass-hover",
                "group",
                "px-3 py-6 md:px-6 md:py-8",
                "text-center",
              ].join(" ")}
            >
              {/* Icon */}
              <div
                className={[
                  "mx-auto mb-3",
                  "h-11 w-11",
                  "grid place-items-center",
                  "rounded-xl",
                  "bg-black/30",
                  "border border-white/10",
                  "text-xl",
                  "transition-all duration-300 ease-out",
                  "group-hover:bg-black/40 group-hover:border-white/20",
                ].join(" ")}
                aria-hidden="true"
              >
                {pill.icon}
              </div>

              {/* Stat */}
              <div className="font-serif text-xl md:text-2xl text-white/90 mb-1">
                {pill.stat}
              </div>

              {/* Label */}
              <p className="text-xs md:text-sm text-white/55 leading-snug">
                {pill.label}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Zona dostave panel */}
        <div className="mt-10 md:mt-12">
          <div className="p-glass px-6 py-7 text-center">
            <div className="text-xs tracking-[0.22em] uppercase text-white/50 mb-2">
              Zona dostave
            </div>
            <div className="text-white/85 font-semibold">
              Budva, Bečići, Sv. Stefan + 5 lokacija duž rivijere
            </div>

            <p className="mt-3 text-sm text-white/55 max-w-lg mx-auto leading-relaxed">
              Pokrivamo celu Budvansku rivijeru — od Jaza do Sv. Stefana.
              Ako niste sigurni, pozovite i dogovaramo se za minut.
            </p>

            <div className="mt-5 text-xs tracking-[0.22em] uppercase text-white/50">
              Napomena
            </div>
            <div className="text-white/70 mt-1">
              Pozvati prije dolaska (ako treba)
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
