export default function Hero() {
  function openMenu() {
    window.dispatchEvent(
      new CustomEvent("padrino:open-menu", { detail: { category: "pizza" } })
    );
  }

  return (
    <section
      id="top"
      className="relative min-h-[92vh] flex items-start overflow-hidden pt-16 md:pt-20"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="/sections/hero.webp"
          alt="Padrino Pizzeria Budva dostava pizze"
          className={[
            "h-full w-full",
            "object-cover",
            "object-[72%_50%]",
            "sm:object-[66%_50%]",
            "md:object-[60%_50%]",
            "lg:object-[58%_50%]",
            "scale-105 opacity-60",
          ].join(" ")}
          draggable={false}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          width={1920}
          height={1080}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;

            if (!target.src.includes("/sections/hero.png")) {
              target.src = "/sections/hero.png";
              return;
            }

            if (!target.src.includes("/menu/padrino.png")) {
              target.src = "/menu/padrino.png";
            }
          }}
        />

        <div
          className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]"
          style={{
            backgroundImage: [
              "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.15) 100%)",
              "radial-gradient(circle at 30% 35%, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 55%)",
              "radial-gradient(circle at 70% 25%, rgba(234,179,8,0.10) 0%, rgba(234,179,8,0) 50%)",
            ].join(", "),
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-8 md:pt-10">
        <div className="flex w-full justify-center">
          <div className="w-full md:max-w-xl text-center">
            {/* H1 */}
            <h1
              className={[
                "font-serif uppercase",
                "tracking-[0.22em]",
                "text-[30px] sm:text-[36px] md:text-[48px] lg:text-[56px]",
                "leading-[1.08]",
                "text-yellow-50/90",
                "drop-shadow-[0_2px_18px_rgba(0,0,0,0.85)]",
                "mx-auto",
              ].join(" ")}
              style={{
                textShadow:
                  "0 2px 18px rgba(0,0,0,0.75), 0 0 22px rgba(234,179,8,0.08)",
              }}
            >
              Padrino Pizzeria
            </h1>

            {/* SEO subtitle */}
            <p className="mt-6 text-white/70 text-base md:text-lg leading-relaxed max-w-xl mx-auto">
              Premium picerija Padrino sa brzom dostavom u Budvi i okolini.
              Poručite online svježu, toplu pizzu pripremljenu od pažljivo
              biranih sastojaka.
            </p>

            <div className="h-8 md:h-10" />

            {/* CTA */}
            <button
              type="button"
              onClick={openMenu}
              className={[
                "group relative inline-flex items-center justify-center gap-3",
                "overflow-hidden",
                "before:absolute before:inset-0 before:rounded-[22px]",
                "before:bg-[radial-gradient(circle_at_25%_20%,rgba(234,179,8,0.22),transparent_60%)]",
                "before:opacity-0 before:transition-opacity before:duration-300",
                "hover:before:opacity-100",
                "rounded-[22px] px-10 py-4",
                "border border-yellow-200/25",
                "bg-black/35 backdrop-blur-md",
                "shadow-[0_18px_55px_rgba(0,0,0,0.55),0_0_40px_rgba(234,179,8,0.10)]",
                "hover:bg-black/45 hover:border-yellow-200/35",
                "active:bg-black/50",
                "transition-all duration-300 ease-out",
                "hover:-translate-y-[1px] active:translate-y-0",
                "text-center",
                "w-full md:w-auto",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
              ].join(" ")}
              aria-label="Poruči pizzu online"
            >
              <span className="text-[22px] font-semibold tracking-wide text-white/90">
                Poruči odmah
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

            <div className="h-10 md:h-12" />
          </div>
        </div>
      </div>
    </section>
  );
}
