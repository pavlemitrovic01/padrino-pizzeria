function Delivery() {
  return (
    <section id="delivery" className="relative overflow-hidden bg-black text-white">
      {/* Ambient background (same visual language as Hero/About) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/75 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_75%_20%,rgba(242,180,0,0.12),transparent_52%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.88)]" />
      </div>

      <div className="relative z-10 p-container py-20 sm:py-24 md:py-28">
        {/* Header (editorial) */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="p-eyebrow">DOSTAVA</div>

          <h2 className="p-title mt-3 leading-[1.06] text-4xl sm:text-5xl md:text-6xl">
            Brzo. Vruće. Pouzdano.
          </h2>

          <p className="mt-5 text-base sm:text-lg text-white/65 leading-relaxed">
            Svaka porudžbina se priprema svježe i stiže na vaša vrata bez kompromisa — jer kvalitet
            ne trpi čekanje.
          </p>

          <div className="mt-7 flex justify-center">
            <div className="h-px w-44 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
        </div>

        {/* Two-column editorial layout (mobile-first stacked) */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-10">
          {/* Left: premium narrative + “metrics” */}
          <div className="p-glass p-6 sm:p-8 md:p-10">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-wide text-white/80">
                  Dostava po Budvi
                </div>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-white/92 leading-tight">
                  U prosjeku ~30 minuta
                </div>

                <p className="mt-4 text-sm sm:text-base text-white/60 leading-relaxed">
                  Tijesto se mijesi svakodnevno, sastojci se biraju pažljivo, a porudžbina ide
                  direktno iz rerne u dostavu — zato stiže topla i “kako treba”.
                </p>
              </div>

              {/* Subtle badge */}
              <div className="shrink-0 hidden sm:block">
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-right">
                  <div className="text-[11px] tracking-[0.28em] text-white/45">TRUST</div>
                  <div className="mt-1 text-sm font-extrabold text-white/80">Bez iznenađenja</div>
                </div>
              </div>
            </div>

            <div className="mt-7 p-divider" />

            {/* “Proof points” — premium, no emojis */}
            <div className="mt-7 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-[11px] tracking-[0.22em] text-white/45">TOPLO</div>
                <div className="mt-2 text-sm font-extrabold text-white/85">Direktno iz rerne</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-[11px] tracking-[0.22em] text-white/45">BRZO</div>
                <div className="mt-2 text-sm font-extrabold text-white/85">Efikasna ruta</div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <div className="text-[11px] tracking-[0.22em] text-white/45">SIGURNO</div>
                <div className="mt-2 text-sm font-extrabold text-white/85">Pouzdana isporuka</div>
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="p-btn-gold h-12 px-6 text-sm"
                onClick={() => {
                  const el = document.getElementById("meni") || document.getElementById("menu");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Pogledaj meni
              </button>

              <button
                type="button"
                className="p-btn-ghost h-12 px-6 text-sm font-extrabold"
                onClick={() => {
                  const el = document.getElementById("contact");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Kontakt
              </button>
            </div>
          </div>

          {/* Right: compact cards (same theme) */}
          <div className="grid gap-4">
            <div className="p-glass p-6 sm:p-7">
              <div className="text-[11px] tracking-[0.28em] text-white/45">SVJEŽE</div>
              <div className="mt-2 text-lg font-extrabold text-white/90">Svježe pripremljeno</div>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">
                Svaka porudžbina se pravi “na licu mjesta” — nema prečica, nema čekanja unaprijed.
              </p>
            </div>

            <div className="p-glass p-6 sm:p-7">
              <div className="text-[11px] tracking-[0.28em] text-white/45">VRIJEME</div>
              <div className="mt-2 text-lg font-extrabold text-white/90">Do ~30 minuta</div>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">
                Prosječno vrijeme isporuke u gradu. Ako je gužva — javljamo se, ništa ne krijemo.
              </p>
            </div>

            <div className="p-glass p-6 sm:p-7">
              <div className="text-[11px] tracking-[0.28em] text-white/45">ISPORUKA</div>
              <div className="mt-2 text-lg font-extrabold text-white/90">Pouzdano & pažljivo</div>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">
                Dostavljači poznaju Budvu i vode računa da porudžbina stigne topla, uredna i sigurna.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom divider (rhythm into next section) */}
        <div className="mt-14">
          <div className="mx-auto h-px w-[92%] max-w-5xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default Delivery;
