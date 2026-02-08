const INSTAGRAM_URL = "https://www.instagram.com/padrino_budva/";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// deep links (DIRECT CHAT)
const WHATSAPP_URL = "https://wa.me/38267603780";
const VIBER_URL = "viber://chat?number=38267603780";

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black text-white">
      {/* ambience */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/75 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_22%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_150px_rgba(0,0,0,0.88)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-12 md:grid-cols-3 items-start">
          {/* LEFT */}
          <div>
            <h3 className="text-2xl font-serif tracking-wide text-white/92">
              Padrino
            </h3>

            <div className="mt-4 h-px w-16 bg-gradient-to-r from-[#f2b400]/45 to-transparent" />

            <p className="mt-5 text-white/60 text-sm max-w-sm leading-relaxed">
              Porodična pizzeria nastala iz ljubavi prema autentičnim italijanskim
              ukusima i brzoj dostavi.
            </p>
          </div>

          {/* CENTER */}
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45 mb-6">
              Navigacija
            </p>

            <ul className="space-y-3 text-white/65 text-sm">
              <li>
                <a href="#o-nama" className="hover:text-white transition">
                  O nama
                </a>
              </li>
              <li>
                <a href="#meni" className="hover:text-white transition">
                  Meni
                </a>
              </li>
              <li>
                <a href="#delivery" className="hover:text-white transition">
                  Dostava
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-white transition">
                  Kontakt
                </a>
              </li>
            </ul>
          </div>

          {/* RIGHT */}
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-white/45 mb-6">
              Kontakt brzo
            </p>

            {/* STARI RASPORED + PREMIUM OUTLINE */}
            <div className="grid grid-cols-2 gap-4 max-w-[320px]">
              {/* Instagram */}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[22px] p-4 bg-black/25 backdrop-blur-md border border-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.55)] hover:border-white/15 hover:bg-black/30 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-white/90">
                    Instagram
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    IG
                  </div>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-[#f2b400]/25 via-white/10 to-transparent" />
                <div className="mt-2 text-xs text-white/55 group-hover:text-white/70 transition">
                  @padrino_budva →
                </div>
              </a>

              {/* WhatsApp */}
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[22px] p-4 bg-black/25 backdrop-blur-md border border-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.55)] hover:border-white/15 hover:bg-black/30 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-white/90">
                    WhatsApp
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    WA
                  </div>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-[#f2b400]/25 via-white/10 to-transparent" />
                <div className="mt-2 text-xs text-white/55 group-hover:text-white/70 transition">
                  Direktna poruka →
                </div>
              </a>

              {/* Maps */}
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[22px] p-4 bg-black/25 backdrop-blur-md border border-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.55)] hover:border-white/15 hover:bg-black/30 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-white/90">
                    Mape
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    📍
                  </div>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-[#f2b400]/25 via-white/10 to-transparent" />
                <div className="mt-2 text-xs text-white/55 group-hover:text-white/70 transition">
                  Lokacija →
                </div>
              </a>

              {/* Viber */}
              <a
                href={VIBER_URL}
                className="group rounded-[22px] p-4 bg-black/25 backdrop-blur-md border border-white/10 shadow-[0_18px_70px_rgba(0,0,0,0.55)] hover:border-white/15 hover:bg-black/30 transition"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold text-white/90">
                    Viber
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    VB
                  </div>
                </div>
                <div className="mt-3 h-px w-full bg-gradient-to-r from-[#f2b400]/25 via-white/10 to-transparent" />
                <div className="mt-2 text-xs text-white/55 group-hover:text-white/70 transition">
                  Direktna poruka →
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* bottom */}
        <div className="mt-14 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-white/45 text-xs tracking-[0.22em] uppercase">
              © {new Date().getFullYear()} Padrino Pizzeria — Sva prava zadržana
            </div>

            <div className="text-white/45 text-xs tracking-[0.22em] uppercase">
              Budva • Jadranska magistrala
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
