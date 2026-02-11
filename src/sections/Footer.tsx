const INSTAGRAM_URL = "https://www.instagram.com/padrino_budva/";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// deep links (DIRECT CHAT)
const WHATSAPP_URL = "https://wa.me/38267603780";
const VIBER_URL = "viber://chat?number=38267603780";

function Footer() {
  return (
    <footer className="relative overflow-hidden bg-black text-white">
      {/* BACKGROUND + AMBIENCE (SVETLIJE ~10–15%) */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/sections/contact.webp"
          alt="Padrino ambience"
          className="h-full w-full object-cover object-center"
          draggable={false}
          loading="lazy"
        />

        {/* LIGHTENED cinematic overlays */}
        <div className="absolute inset-0 bg-black/28" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/55" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_75%_20%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.80)]" />

        {/* SEAMLESS GLOW (top) */}
        <div className="pointer-events-none absolute -top-28 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.10),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-24">
        {/* Top */}
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3">
              <img
                src="/logo/chef-hat.png"
                alt="Padrino"
                className="h-10 w-10"
                draggable={false}
              />
              <span className="text-xl font-extrabold tracking-wide">
                Padrino
              </span>
            </div>

            <p className="mt-6 max-w-sm text-white/65 leading-relaxed">
              Autentična porodična pizzeria u srcu Budve. Svaki zalogaj pravimo
              sa istom pažnjom kao prvog dana.
            </p>
          </div>

          {/* Links */}
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/45 mb-4">
              Linkovi
            </div>

            <ul className="space-y-3 text-white/75">
              <li>
                <a href="#hero" className="hover:text-white transition">
                  Početna
                </a>
              </li>
              <li>
                <a href="#menu" className="hover:text-white transition">
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

          {/* Contact quick */}
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-white/45 mb-4">
              Kontakt
            </div>

            <div className="space-y-3 text-white/75">
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-white transition"
              >
                WhatsApp
              </a>
              <a
                href={VIBER_URL}
                className="block hover:text-white transition"
              >
                Viber
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-white transition"
              >
                Instagram
              </a>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noreferrer"
                className="block hover:text-white transition"
              >
                Google Maps
              </a>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-14 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/55">
          <div>© {new Date().getFullYear()} Padrino Pizzeria Budva</div>
          <div className="tracking-[0.22em] uppercase">
            Since 2021
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
