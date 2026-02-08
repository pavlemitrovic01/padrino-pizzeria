function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative overflow-hidden bg-black text-white border-t border-white/10">
      {/* Background ambience (same language as the rest) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_80%_10%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative z-10 p-container py-16 md:py-20">
        <div className="grid gap-12 md:grid-cols-3 md:gap-16 items-start">
          {/* LEFT */}
          <div className="min-w-0">
            <div className="p-kicker">Padrino</div>
            <h3 className="mt-3 text-2xl md:text-3xl font-extrabold text-white/92 tracking-wide">
              Padrino Pizzeria
            </h3>

            <p className="mt-4 text-sm md:text-[15px] leading-relaxed text-white/65 max-w-sm">
              Porodična pizzeria nastala iz ljubavi prema autentičnim italijanskim ukusima i brzoj
              dostavi.
            </p>

            <div className="mt-6 h-px w-40 bg-gradient-to-r from-[#f2b400]/35 to-transparent" />

            <div className="mt-6 text-sm text-white/70 space-y-1">
              <div>
                <span className="text-white/50">Radno vrijeme:</span>{" "}
                <span className="font-semibold text-white/80">12–00</span>
              </div>
              <div>
                <span className="text-white/50">Telefon:</span>{" "}
                <a
                  className="font-semibold text-white/85 hover:text-white transition"
                  href="tel:+38267603780"
                >
                  +382/67-603-780
                </a>
              </div>
              <div>
                <span className="text-white/50">E-mail:</span>{" "}
                <a
                  className="font-semibold text-white/85 hover:text-white transition"
                  href="mailto:padrinobudva@gmail.com"
                >
                  padrinobudva@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* CENTER */}
          <div>
            <p className="p-eyebrow">Navigacija</p>

            <ul className="mt-5 space-y-3 text-sm text-white/70">
              <li>
                <a
                  href="#o-nama"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-[#f2b400]/60" />
                  O nama
                </a>
              </li>
              <li>
                <a
                  href="#meni"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-[#f2b400]/60" />
                  Meni
                </a>
              </li>
              <li>
                <a
                  href="#delivery"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-[#f2b400]/60" />
                  Dostava
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="inline-flex items-center gap-2 hover:text-white transition"
                >
                  <span className="h-[6px] w-[6px] rounded-full bg-[#f2b400]/60" />
                  Kontakt
                </a>
              </li>
            </ul>
          </div>

          {/* RIGHT */}
          <div>
            <p className="p-eyebrow">Pratite nas</p>

            <div className="mt-5 flex flex-wrap gap-3">
              {/* Instagram */}
              <a
                href="https://www.instagram.com/padrino_budva/"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                aria-label="Instagram"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/10">
                  {/* IG glyph */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-90 group-hover:opacity-100 transition"
                  >
                    <path
                      d="M7 2H17C20.3137 2 23 4.68629 23 8V16C23 19.3137 20.3137 22 17 22H7C3.68629 22 1 19.3137 1 16V8C1 4.68629 3.68629 2 7 2Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M12 16.2C14.3196 16.2 16.2 14.3196 16.2 12C16.2 9.6804 14.3196 7.8 12 7.8C9.6804 7.8 7.8 9.6804 7.8 12C7.8 14.3196 9.6804 16.2 12 16.2Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                    <path
                      d="M17.6 6.4H17.61"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                Instagram
              </a>

              {/* Call (replaces FB) */}
              <a
                href="tel:+38267603780"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                aria-label="Pozovi"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/10">
                  {/* Phone */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-90 group-hover:opacity-100 transition"
                  >
                    <path
                      d="M6.6 3.5L9.2 6.1C9.9 6.8 10.1 7.8 9.7 8.7L8.8 10.6C10 12.9 11.9 14.8 14.2 16L16.1 15.1C17 14.7 18 14.9 18.7 15.6L21.3 18.2C22.1 19 22.1 20.3 21.2 21C20.1 21.9 18.8 22.4 17.4 22.4C10.2 22.4 4.4 16.6 4.4 9.4C4.4 8 4.9 6.7 5.8 5.6C6.5 4.7 7.8 4.7 8.6 5.5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                Pozovi
              </a>

              {/* Maps (replaces X) */}
              <a
                href="https://maps.app.goo.gl/ouqBC1P8rD62qij99"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-extrabold text-white/85 hover:bg-white/10 hover:border-white/20 transition"
                aria-label="Google mape"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/10">
                  {/* Map pin */}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-90 group-hover:opacity-100 transition"
                  >
                    <path
                      d="M12 21s7-4.4 7-11a7 7 0 10-14 0c0 6.6 7 11 7 11z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M12 13.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    />
                  </svg>
                </span>
                Mape
              </a>
            </div>

            <div className="mt-6 text-sm text-white/60">
              <div className="text-white/50">Adresa</div>
              <div className="mt-1 font-semibold text-white/80">Jadranski put BB (Kotorski Semafori)</div>
            </div>
          </div>
        </div>

        <div className="mt-14 p-divider" />

        {/* Bottom */}
        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs tracking-widest uppercase text-white/45">
            © {year} Padrino Pizzeria — Sva prava zadržana
          </div>

          <div className="text-xs text-white/45">
            Dizajn &amp; iskustvo:{" "}
            <span className="text-white/60 font-semibold">Premium Edition</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
