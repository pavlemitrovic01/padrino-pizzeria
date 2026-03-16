export default function Hero() {
  function openMenu() {
    window.dispatchEvent(
      new CustomEvent("padrino:open-menu", { detail: { category: "pizza" } })
    );
  }

  return (
    <section
      id="top"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24 sm:pt-28 md:pt-32"
    >
      <div className="absolute inset-0">
        <img
          src="/sections/hero.webp"
          srcSet="/sections/hero-mobile.webp 768w, /sections/hero.webp 1920w"
          sizes="(max-width: 768px) 100vw, 100vw"
          alt="Padrino Pizzeria Budva dostava pizze"
          className={[
            "h-full w-full object-cover",
            "object-[70%_50%] sm:object-[64%_50%] md:object-[60%_50%] lg:object-[56%_48%]",
            "scale-[1.06] opacity-70",
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
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.26) 24%, rgba(0,0,0,0.72) 72%, rgba(0,0,0,0.96) 100%)",
              "radial-gradient(circle at 50% 28%, rgba(242,180,0,0.16) 0%, rgba(242,180,0,0.05) 22%, rgba(242,180,0,0) 54%)",
              "radial-gradient(circle at 22% 24%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 42%)",
              "radial-gradient(circle at 78% 22%, rgba(242,180,0,0.12) 0%, rgba(242,180,0,0) 40%)",
            ].join(", "),
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-black" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[calc(100svh-7rem)] max-w-4xl -translate-y-8 flex-col items-center justify-center pb-8 text-center sm:min-h-[calc(100svh-8rem)] sm:-translate-y-10 sm:pb-10 md:-translate-y-16 md:pb-12 lg:-translate-y-20">
          <div className="p-kicker shadow-[0_16px_34px_-24px_rgba(242,180,0,0.6)]">
            Premium pizza u Budvi
          </div>

          <h1
            className={[
              "mt-6 font-serif uppercase text-yellow-50/95",
              "tracking-[0.16em] sm:tracking-[0.18em] md:tracking-[0.2em]",
              "text-[34px] leading-[1.02] sm:text-[46px] md:text-[62px] lg:text-[76px]",
              "drop-shadow-[0_8px_28px_rgba(0,0,0,0.9)]",
            ].join(" ")}
            style={{
              textShadow:
                "0 4px 22px rgba(0,0,0,0.82), 0 0 26px rgba(242,180,0,0.08)",
            }}
          >
            Padrino Pizzeria
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-white/78 sm:text-[17px] sm:leading-8 md:text-[19px]">
            Premium picerija u Budvi sa brzom dostavom, pažljivo biranim sastojcima
            i pizzom koja stiže svježa, topla i spremna za uživanje.
          </p>

          <div className="mt-9 flex w-full justify-center">
            <button
              type="button"
              onClick={openMenu}
              className="p-btn-gold min-h-[56px] px-7 text-[1rem] shadow-[0_24px_48px_-26px_rgba(242,180,0,0.9)]"
              aria-label="Poruči pizzu online"
            >
              Poruči odmah
              <span
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/15 text-base"
                aria-hidden="true"
              >
                ›
              </span>
            </button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <div className="p-glass p-glass-hover px-4 py-2.5 text-sm font-semibold text-white/82">
              Brza dostava
            </div>
            <div className="p-glass p-glass-hover px-4 py-2.5 text-sm font-semibold text-white/82">
              Svježe pripremljeno
            </div>
            <div className="p-glass p-glass-hover px-4 py-2.5 text-sm font-semibold text-white/82">
              Online poručivanje
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}