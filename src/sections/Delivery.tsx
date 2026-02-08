function Delivery() {
  return (
    <section id="delivery" className="relative overflow-hidden bg-black text-white">
      {/* Background ambience (same language as Hero/About/Menu/Cart) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_30%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_22%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-24 md:py-32">
        {/* Header */}
        <div className="text-center">
          <span className="p-kicker">Dostava</span>

          <h2 className="p-title mt-4 text-4xl md:text-6xl leading-[1.05] text-white/92">
            Brzo. Vruće. Pouzdano.
          </h2>

          <p className="mt-6 mx-auto max-w-2xl text-white/65 leading-relaxed">
            Svaka narudžba se priprema svježe i stiže na vaša vrata u rekordnom roku — jer
            kvalitet ne trpi čekanje.
          </p>

          <div className="mt-10 mx-auto h-px w-56 bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent" />
        </div>

        {/* Feature cards */}
        <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-8">
          {/* Card 1 */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/30 backdrop-blur-md p-8 shadow-[0_28px_110px_rgba(0,0,0,0.65)]">
            <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#f2b400]/10 blur-3xl" />

            <div className="flex items-center justify-center">
              <div className="h-14 w-14 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                <span className="text-xl" aria-hidden="true">
                  🍕
                </span>
              </div>
            </div>

            <h3 className="mt-6 text-center font-serif text-xl text-white/92">
              Svježe pripremljeno
            </h3>

            <p className="mt-3 text-center text-sm leading-relaxed text-white/65">
              Tijesto se mijesi svakodnevno, a sastojci se pažljivo biraju kako bi svaki
              zalogaj bio savršen.
            </p>

            <div className="mt-6 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent" />
          </div>

          {/* Card 2 */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/30 backdrop-blur-md p-8 shadow-[0_28px_110px_rgba(0,0,0,0.65)]">
            <div className="pointer-events-none absolute -top-20 -right-20 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-[#f2b400]/10 blur-3xl" />

            <div className="flex items-center justify-center">
              <div className="h-14 w-14 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                <span className="text-xl" aria-hidden="true">
                  ⏱️
                </span>
              </div>
            </div>

            <h3 className="mt-6 text-center font-serif text-xl text-white/92">
              Do 30 minuta
            </h3>

            <p className="mt-3 text-center text-sm leading-relaxed text-white/65">
              Prosječno vrijeme dostave je oko 30 minuta — brzo, efikasno i bez kompromisa.
            </p>

            <div className="mt-6 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent" />
          </div>

          {/* Card 3 */}
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/30 backdrop-blur-md p-8 shadow-[0_28px_110px_rgba(0,0,0,0.65)]">
            <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-[#f2b400]/10 blur-3xl" />

            <div className="flex items-center justify-center">
              <div className="h-14 w-14 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                <span className="text-xl" aria-hidden="true">
                  🛵
                </span>
              </div>
            </div>

            <h3 className="mt-6 text-center font-serif text-xl text-white/92">
              Pouzdana dostava
            </h3>

            <p className="mt-3 text-center text-sm leading-relaxed text-white/65">
              Naši dostavljači poznaju grad i uvijek stižu s osmijehom — toplo i sigurno.
            </p>

            <div className="mt-6 mx-auto h-px w-16 bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent" />
          </div>
        </div>

        {/* Bottom strip */}
        <div className="mt-14 rounded-[30px] border border-white/10 bg-black/25 backdrop-blur-md px-6 py-6 shadow-[0_28px_110px_rgba(0,0,0,0.55)]">
          <div className="grid gap-5 md:grid-cols-3 md:gap-6 items-center">
            <div className="text-center md:text-left">
              <div className="text-xs tracking-[0.22em] uppercase text-white/45">
                Zona dostave
              </div>
              <div className="mt-2 text-sm font-extrabold text-white/85">
                Budva • centar • okolina
              </div>
            </div>

            <div className="hidden md:block h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            <div className="text-center md:text-right">
              <div className="text-xs tracking-[0.22em] uppercase text-white/45">
                Napomena
              </div>
              <div className="mt-2 text-sm font-extrabold text-white/85">
                Pozvati prije dolaska (ako treba)
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Delivery;
