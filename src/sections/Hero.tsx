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
          src="/sections/hero.webp"
          alt="Padrino"
          className="h-full w-full object-cover scale-105 opacity-60"
          draggable={false}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1080}
          onError={(e) => {
            // fallback 1: ako hero.webp ne postoji
            const target = e.currentTarget as HTMLImageElement;

            // probaj hero.png ako postoji
            if (!target.src.includes("/sections/hero.png")) {
              target.src = "/sections/hero.png";
              return;
            }

            // fallback 2: ultimate fallback (tvoj stari asset)
            if (!target.src.includes("/menu/padrino.png")) {
              target.src = "/menu/padrino.png";
            }
          }}
        />

        {/* Premium darkening + vignette (OPT: 3 layer-a -> 1 layer) */}
        <div
          className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]"
          style={{
            backgroundImage: [
              // from-black via-black/45 to-black/15 (to top)
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%)",
              // radial ambience
              "radial-gradient(circle at 30% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%)",
              "radial-gradient(circle at 70% 25%, rgba(234,179,8,0.10) 0%, rgba(234,179,8,0) 50%)",
            ].join(", "),
          }}
        />
      </div>

      {/* Brand signature (zona 1) */}
      <div
        className={[
          "pointer-events-none absolute z-10",
          "hidden md:block",
          "right-10 lg:right-16",
          "top-1/2 -translate-y-1/2",
          "max-w-[520px]",
          "text-right",
        ].join(" ")}
        aria-hidden="true"
      >
        <div
          className={[
            "inline-block",
            "px-6 py-4",
            "rounded-[28px]",
            "bg-black/15",
            "backdrop-blur-sm",
            "border border-white/10",
            "shadow-[0_30px_90px_rgba(0,0,0,0.55)]",
          ].join(" ")}
        >
          <div
            className={[
              "font-serif uppercase",
              "tracking-[0.22em]",
              "text-[42px] lg:text-[52px]",
              "leading-[1.05]",
              "text-yellow-50/85",
              "drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]",
            ].join(" ")}
            style={{
              textShadow:
                "0 2px 18px rgba(0,0,0,0.75), 0 0 22px rgba(234,179,8,0.08)",
            }}
          >
            Padrino Pizzeria
          </div>

          <div className="mt-3 h-px w-full bg-gradient-to-r from-transparent via-yellow-200/20 to-transparent" />
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6">
        <div className="flex w-full items-center">
          {/* Left aligned on desktop, centered on mobile */}
          <div className="w-full md:w-auto md:max-w-lg">
            <button
              type="button"
              onClick={openMenu}
              className={[
                "group inline-flex items-center justify-center gap-3",
                "rounded-[22px] px-10 py-4",
                "border border-yellow-200/25",
                "bg-black/35 backdrop-blur-md",
                "shadow-[0_18px_55px_rgba(0,0,0,0.55)]",
                "hover:bg-black/45 hover:border-yellow-200/35",
                "active:bg-black/50",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[1px] active:translate-y-0",
                "text-center",
                "w-full md:w-auto",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
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
                  "transition-all duration-300 ease-out",
                  "group-hover:bg-yellow-200/15 group-hover:border-yellow-200/35",
                  "group-active:bg-yellow-200/20",
                ].join(" ")}
                aria-hidden="true"
              >
                <span className="text-xl leading-none translate-x-[1px]">›</span>
              </span>
            </button>

            {/* breathing room */}
            <div className="h-12" />
          </div>
        </div>
      </div>
    </section>
  );
}
