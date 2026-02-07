import { motion } from "framer-motion";

export default function Hero() {
  function openMenu() {
    // Otvara bubble meni (bez hash-a, bez auto-open na load)
    window.dispatchEvent(
      new CustomEvent("padrino:open-menu", { detail: { category: "pizza" } })
    );
  }

  return (
    <section
      id="top"
      className="relative min-h-[92vh] flex items-center overflow-hidden pt-16"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/menu/padrino.png"
          alt="Padrino"
          className="h-full w-full object-cover scale-105 opacity-60"
          draggable={false}
        />

        {/* Premium darkening + vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_70%_25%,rgba(234,179,8,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="flex w-full items-center">
          {/* Left aligned on desktop, centered on mobile */}
          <div className="w-full md:w-auto md:max-w-lg">
            <motion.button
              type="button"
              onClick={openMenu}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: "easeOut" }}
              className={[
                "group inline-flex items-center justify-center gap-3",
                "rounded-[22px] px-10 py-4",
                "border border-yellow-200/25",
                "bg-black/35 backdrop-blur-md",
                "shadow-[0_18px_55px_rgba(0,0,0,0.55)]",
                "hover:bg-black/45 hover:border-yellow-200/35",
                "transition-all",
                "text-center",
                "w-full md:w-auto",
              ].join(" ")}
              aria-label="Pogledaj meni"
            >
              <span className="text-[22px] font-semibold tracking-wide text-white/90">
                Pogledaj meni
              </span>

              <span
                className={[
                  "inline-flex h-9 w-9 items-center justify-center",
                  "rounded-full",
                  "border border-yellow-200/25",
                  "bg-yellow-200/10",
                  "text-white/85",
                  "transition-all",
                  "group-hover:bg-yellow-200/15 group-hover:border-yellow-200/35",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className="text-xl leading-none translate-x-[1px]">›</span>
              </span>
            </motion.button>

            {/* breathing room */}
            <div className="h-12" />
          </div>
        </div>
      </div>
    </section>
  );
}
