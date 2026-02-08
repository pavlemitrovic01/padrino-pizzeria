function Delivery() {
  return (
    <section id="delivery" className="relative overflow-hidden bg-black text-white">
      {/* Background ambience (same language as Hero/About) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_70%_25%,rgba(234,179,8,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-28 md:py-32">
        {/* Header */}
        <div className="text-center">
          <span className="p-kicker">Dostava</span>

          <h2 className="p-title mt-4 text-4xl md:text-6xl leading-[1.05]">
            Brzo. Vruće. Pouzdano.
          </h2>

          <p className="mt-6 mx-auto max-w-2xl text-zinc-200/70">
            Svaka narudžba se priprema svježe i stiže na vaša vrata u rekordnom roku – jer
            kvalitet ne trpi čekanje.
          </p>
        </div>

        {/* Cards */}
        <div className="mt-16 grid gap-8 md:grid-cols-3 md:gap-10">
          <div className="p-glass p-glass-hover p-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-2xl text-yellow-400">
              🍕
            </div>
            <h3 className="font-serif text-xl text-white">Svježe pripremljeno</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200/70">
              Tijesto se mijesi svakodnevno, a sastojci se pažljivo biraju kako bi svaki
              zalogaj bio savršen.
            </p>
          </div>

          <div className="p-glass p-glass-hover p-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-2xl text-yellow-400">
              ⏱️
            </div>
            <h3 className="font-serif text-xl text-white">Do 30 minuta</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200/70">
              Prosječno vrijeme dostave je oko 30 minuta – brzo, efikasno i bez kompromisa.
            </p>
          </div>

          <div className="p-glass p-glass-hover p-10 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10 text-2xl text-yellow-400">
              🛵
            </div>
            <h3 className="font-serif text-xl text-white">Pouzdana dostava</h3>
            <p className="mt-3 text-sm leading-relaxed text-zinc-200/70">
              Naši dostavljači poznaju grad i uvijek stižu s osmijehom – toplo i sigurno.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Delivery;
