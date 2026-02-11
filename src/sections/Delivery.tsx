import { motion } from "framer-motion";

export default function Delivery() {
  const items = [
    {
      icon: "🍕",
      title: "Svježe pripremljeno",
      text:
        "Tijesto se mijesi svakodnevno, a sastojci se pažljivo biraju kako bi svaki zalogaj bio savršen.",
    },
    {
      icon: "⏱️",
      title: "Do 30 minuta",
      text:
        "Prosječno vrijeme dostave je oko 30 minuta — brzo, efikasno i bez kompromisa.",
    },
    {
      icon: "🛵",
      title: "Pouzdana dostava",
      text:
        "Naši dostavljači poznaju grad i uvijek stižu s osmijehom — toplo i sigurno.",
    },
  ];

  return (
    <section
      id="delivery"
      className="relative overflow-hidden bg-black py-24 md:py-32"
    >
      {/* BACKGROUND (final) */}
      <div className="absolute inset-0">
        <img
          src="/sections/delivery.webp"
          alt="Dostava Padrino"
          className="h-full w-full object-cover object-center"
          draggable={false}
          loading="lazy"
        />

        {/* cinematic overlays (match About/Hero language) */}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_20%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.88)]" />

        {/* SEAMLESS GLOW (top/bottom) */}
        <div className="pointer-events-none absolute -top-24 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.12),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        {/* Header */}
        <div className="mb-16 text-center">
          <div className="p-kicker mb-4">Dostava</div>
          <h2 className="p-title text-4xl md:text-5xl">Brzo. Vruće. Pouzdano.</h2>
          <p className="mt-4 text-white/65 max-w-xl mx-auto">
            Svaka narudžba se priprema svježe i stiže na vaša vrata u rekordnom
            roku — jer kvalitet ne trpi čekanje.
          </p>
        </div>

        {/* Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {items.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: "easeOut", delay: i * 0.06 }}
              className={[
                "p-glass p-glass-hover",
                "group",
                "px-6 py-10 md:py-12",
                "text-center",
                "focus-within:ring-2 focus-within:ring-[#f2b400]/40",
              ].join(" ")}
            >
              {/* Icon */}
              <div
                className={[
                  "mx-auto mb-6",
                  "h-14 w-14",
                  "grid place-items-center",
                  "rounded-2xl",
                  "bg-black/30",
                  "border border-white/10",
                  "text-2xl",
                  "transition-all duration-300 ease-out",
                  "group-hover:bg-black/40 group-hover:border-white/20",
                ].join(" ")}
              >
                {item.icon}
              </div>

              {/* Title */}
              <h3 className="font-serif text-2xl text-white/90 mb-3">
                {item.title}
              </h3>

              {/* Text */}
              <p className="text-white/65 leading-relaxed">{item.text}</p>
            </motion.div>
          ))}
        </div>

        {/* Bottom info */}
        <div className="mt-16">
          <div className="p-glass px-6 py-6 text-center">
            <div className="text-xs tracking-[0.22em] uppercase text-white/50 mb-2">
              Zona dostave
            </div>
            <div className="text-white/85 font-semibold">
              Budva • centar • okolina
            </div>

            <div className="mt-4 text-xs tracking-[0.22em] uppercase text-white/50">
              Napomena
            </div>
            <div className="text-white/70 mt-1">Pozvati prije dolaska (ako treba)</div>
          </div>
        </div>
      </div>
    </section>
  );
}
