function Contact() {
  return (
    <section id="contact" className="relative overflow-hidden bg-black text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/80 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(242,180,0,0.12),transparent_52%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]" />
      </div>

      <div className="relative z-10 p-container py-20 sm:py-24 md:py-28">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <div className="p-eyebrow">KONTAKT</div>

          <h2 className="p-title mt-3 text-4xl sm:text-5xl md:text-6xl leading-[1.06]">
            Javite nam se
          </h2>

          <p className="mt-5 text-base sm:text-lg text-white/65 leading-relaxed">
            Imate pitanje, sugestiju ili želite saradnju? Pišite nam — odgovaramo brzo.
          </p>

          <div className="mt-7 flex justify-center">
            <div className="h-px w-44 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
          </div>
        </div>

        {/* Content */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10 items-start">
          {/* Left: info */}
          <div className="p-glass p-6 sm:p-8 md:p-10">
            <div className="text-sm font-extrabold tracking-wide text-white/80">
              Informacije
            </div>

            <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed">
              Najbrži način je poziv ili poruka. Ako pišete putem forme, ostavite tačne
              podatke — javljamo se čim možemo.
            </p>

            <div className="mt-7 p-divider" />

            <div className="mt-7 grid gap-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-[11px] tracking-[0.28em] text-white/45">
                  TELEFON
                </div>
                <a
                  href="tel:+38267603780"
                  className="mt-2 block text-base sm:text-lg font-extrabold text-white/90 hover:underline"
                >
                  +382 / 67 603 780
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-[11px] tracking-[0.28em] text-white/45">
                  E-MAIL
                </div>
                <a
                  href="mailto:padrinobudva@gmail.com"
                  className="mt-2 block text-base sm:text-lg font-extrabold text-white/90 hover:underline"
                >
                  padrinobudva@gmail.com
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-[11px] tracking-[0.28em] text-white/45">
                  ADRESA
                </div>
                <a
                  href="https://maps.app.goo.gl/ouqBC1P8rD62qij99"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-base sm:text-lg font-extrabold text-white/90 hover:underline"
                >
                  Jadranski put BB <br />
                  <span className="text-white/60 font-semibold">
                    (Kotorski semafori, Budva)
                  </span>
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                <div className="text-[11px] tracking-[0.28em] text-white/45">
                  RADNO VRIJEME
                </div>
                <div className="mt-2 text-base sm:text-lg font-extrabold text-white/90">
                  12:00 – 00:00
                </div>
              </div>
            </div>

            <div className="mt-7 p-divider" />

            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                className="p-btn-gold h-12 px-6 text-sm"
                onClick={() => {
                  const el =
                    document.getElementById("meni") ||
                    document.getElementById("menu");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Pogledaj meni
              </button>

              <button
                type="button"
                className="p-btn-ghost h-12 px-6 text-sm font-extrabold"
                onClick={() => {
                  const el = document.getElementById("delivery");
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                Dostava
              </button>
            </div>
          </div>

          {/* Right: form */}
          <form
            className="p-glass p-6 sm:p-8 md:p-10"
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-sm font-extrabold tracking-wide text-white/80">
                  Poruka
                </div>
                <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed">
                  Ostavite ime i kontakt — odgovorićemo u najkraćem roku.
                </p>
              </div>

              <div className="hidden sm:block shrink-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
                <div className="text-[11px] tracking-[0.28em] text-white/45">
                  ODGOVOR
                </div>
                <div className="mt-1 text-sm font-extrabold text-white/80">
                  Brzo
                </div>
              </div>
            </div>

            <div className="mt-7 p-divider" />

            <div className="mt-7 grid gap-4">
              <div>
                <label className="block text-[11px] tracking-[0.28em] text-white/45 mb-2">
                  IME
                </label>
                <input
                  type="text"
                  placeholder="Vaše ime"
                  className="w-full h-12 rounded-2xl bg-black/25 px-4 text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/50 transition"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.28em] text-white/45 mb-2">
                  E-MAIL
                </label>
                <input
                  type="email"
                  placeholder="Vaš e-mail"
                  className="w-full h-12 rounded-2xl bg-black/25 px-4 text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/50 transition"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-[11px] tracking-[0.28em] text-white/45 mb-2">
                  PORUKA
                </label>
                <textarea
                  rows={5}
                  placeholder="Vaša poruka"
                  className="w-full rounded-2xl bg-black/25 px-4 py-3 text-white placeholder:text-white/30 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/50 transition resize-none"
                />
              </div>

              <button type="submit" className="p-btn-gold h-12 w-full text-sm">
                Pošaljite poruku
              </button>

              <div className="text-xs text-white/45 leading-relaxed">
                *Forma je vizuelna. Ako želiš da poruke idu na Telegram ili e-mail,
                sledeći korak je backend povezivanje (radićemo stabilno).
              </div>
            </div>
          </form>
        </div>

        <div className="mt-14">
          <div className="mx-auto h-px w-[92%] max-w-5xl bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default Contact;
