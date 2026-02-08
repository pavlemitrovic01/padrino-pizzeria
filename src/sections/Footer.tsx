const INSTAGRAM_URL = "https://www.instagram.com/padrino_budva/";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// +382/67-603-780  -> digits for deep links
const PHONE_E164 = "+38267603780";
const PHONE_DIGITS = "38267603780";

const WHATSAPP_URL = `https://wa.me/${PHONE_DIGITS}`;
const VIBER_URL = `viber://chat?number=${encodeURIComponent(PHONE_E164)}`;

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-zinc-950 text-white border-t border-white/10">
      {/* ambience (same language) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_35%,rgba(242,180,0,0.10),transparent_55%),radial-gradient(circle_at_78%_30%,rgba(255,255,255,0.06),transparent_55%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3 items-start">
          {/* LEFT */}
          <div>
            <h3 className="text-2xl font-serif tracking-wide text-white/90">
              Padrino
            </h3>

            <div className="mt-4 h-px w-24 bg-gradient-to-r from-[#f2b400]/45 to-transparent" />

            <p className="mt-4 text-sm text-zinc-300/70 max-w-sm leading-relaxed">
              Porodična pizzeria nastala iz ljubavi prema autentičnim italijanskim
              ukusima i brzoj dostavi — premium kvalitet, bez buke.
            </p>

            <div className="mt-6 text-xs text-white/55 space-y-1">
              <div>
                <span className="text-white/65 font-semibold">Radno vrijeme:</span>{" "}
                12-00
              </div>
              <div>
                <span className="text-white/65 font-semibold">Adresa:</span>{" "}
                Jadranski put BB (Kotorski Semafori)
              </div>
            </div>
          </div>

          {/* CENTER */}
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-6">
              Navigacija
            </p>

            <ul className="space-y-3 text-zinc-300/70 text-sm">
              <li>
                <a
                  href="#menu"
                  className="hover:text-white transition inline-flex items-center gap-2"
                >
                  <span className="h-px w-6 bg-white/15" />
                  Meni
                </a>
              </li>
              <li>
                <a
                  href="#delivery"
                  className="hover:text-white transition inline-flex items-center gap-2"
                >
                  <span className="h-px w-6 bg-white/15" />
                  Dostava
                </a>
              </li>
              <li>
                <a
                  href="#o-nama"
                  className="hover:text-white transition inline-flex items-center gap-2"
                >
                  <span className="h-px w-6 bg-white/15" />
                  O nama
                </a>
              </li>
              <li>
                <a
                  href="#contact"
                  className="hover:text-white transition inline-flex items-center gap-2"
                >
                  <span className="h-px w-6 bg-white/15" />
                  Kontakt
                </a>
              </li>
            </ul>

            <div className="mt-8 rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                Direktno
              </div>

              <div className="mt-3 space-y-1 text-sm text-white/80">
                <a
                  href="tel:+38267603780"
                  className="hover:text-white transition"
                >
                  +382/67-603-780
                </a>
                <div className="text-white/25">•</div>
                <a
                  href="mailto:padrinobudva@gmail.com"
                  className="hover:text-white transition"
                >
                  padrinobudva@gmail.com
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-500 mb-6">
              Kontakt & Linkovi
            </p>

            {/* 2x2 grid (ravnomerno) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Instagram */}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4 hover:border-[#f2b400]/35 hover:bg-black/30 transition"
                aria-label="Instagram"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    {/* IG icon */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-[#f2b400]"
                    >
                      <path
                        d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M17.5 6.5h.01"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white/90">
                      Instagram
                    </div>
                    <div className="text-xs text-white/55 group-hover:text-white/70 transition">
                      @padrino_budva
                    </div>
                  </div>
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4 hover:border-[#f2b400]/35 hover:bg-black/30 transition"
                aria-label="WhatsApp"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    {/* WhatsApp icon (simple bubble) */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-[#f2b400]"
                    >
                      <path
                        d="M20 11.5a8 8 0 1 1-15.6 2.7L3 21l6.9-1.3A8 8 0 0 1 20 11.5Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M9.2 9.3c.3-.8.6-.8 1-.8h.7c.2 0 .4 0 .5.3l.8 2c.1.2 0 .5-.1.6l-.5.6c-.2.2-.1.5.1.7.6.7 1.3 1.3 2.1 1.7.2.1.5 0 .7-.2l.6-.5c.2-.1.4-.2.6-.1l2 .8c.2.1.3.3.3.5v.7c0 .4 0 .7-.8 1-.8.4-2.3.2-3.8-.6-1.5-.8-3-2.2-3.9-3.7-.8-1.5-1-3-.6-3.8Z"
                        fill="currentColor"
                        opacity="0.9"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white/90">
                      WhatsApp
                    </div>
                    <div className="text-xs text-white/55 group-hover:text-white/70 transition">
                      Brza poruka
                    </div>
                  </div>
                </div>
              </a>

              {/* Maps */}
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4 hover:border-[#f2b400]/35 hover:bg-black/30 transition"
                aria-label="Google Mape"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    {/* Pin icon */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-[#f2b400]"
                    >
                      <path
                        d="M12 22s7-4.4 7-12a7 7 0 1 0-14 0c0 7.6 7 12 7 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white/90">
                      Mape
                    </div>
                    <div className="text-xs text-white/55 group-hover:text-white/70 transition">
                      Otvori pin
                    </div>
                  </div>
                </div>
              </a>

              {/* Viber */}
              <a
                href={VIBER_URL}
                className="group rounded-3xl border border-white/10 bg-black/25 backdrop-blur-md p-4 hover:border-[#f2b400]/35 hover:bg-black/30 transition"
                aria-label="Viber"
              >
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    {/* Viber-ish phone icon */}
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                      className="text-[#f2b400]"
                    >
                      <path
                        d="M21 16.5v3a2 2 0 0 1-2.2 2c-9.2-.9-16.4-8.1-17.3-17.3A2 2 0 0 1 3.5 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.8l-1.4 1.4a16 16 0 0 0 6.8 6.8l1.4-1.4a2 2 0 0 1 1.8-.6l3 .5a2 2 0 0 1 1.7 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-white/90">
                      Viber
                    </div>
                    <div className="text-xs text-white/55 group-hover:text-white/70 transition">
                      Direktno
                    </div>
                  </div>
                </div>
              </a>
            </div>

            <p className="mt-6 text-xs text-white/45 leading-relaxed">
              Klik na WhatsApp/Viber otvara direktan chat (ako je aplikacija instalirana).
            </p>
          </div>
        </div>

        {/* bottom */}
        <div className="mt-14">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="mt-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-xs tracking-[0.22em] uppercase text-white/45">
              © {new Date().getFullYear()} Padrino Pizzeria — Sva prava zadržana
            </div>

            <a
              href="#top"
              className="text-xs tracking-[0.22em] uppercase text-white/45 hover:text-white/70 transition"
            >
              Nazad na vrh
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
