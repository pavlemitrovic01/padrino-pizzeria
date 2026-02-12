import { useCallback, useState } from "react";

const INSTAGRAM_URL = "https://www.instagram.com/padrino_budva/";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// phone
const PHONE_E164 = "+38267603780";
const PHONE_WA = "38267603780";

// deep links (DIRECT CHAT)
const WHATSAPP_URL = `https://wa.me/${PHONE_WA}`;
const VIBER_DEEP_LINK = `viber://chat?number=%2B${PHONE_WA}`;

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToTop() {
  const hero = document.getElementById("top");
  if (hero) {
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearHash() {
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
}

export default function Footer() {
  const [bgOk, setBgOk] = useState(true);

  const onGoHome = useCallback(() => {
    clearHash();
    scrollToTop();
  }, []);

  const onGoSection = useCallback((id: string) => {
    window.history.replaceState(null, "", `/#${id}`);
    scrollToId(id);
  }, []);

  const onOpenViber = useCallback(() => {
    try {
      window.location.href = VIBER_DEEP_LINK;
    } finally {
      window.setTimeout(() => {
        if (!document.hidden && navigator.clipboard?.writeText) {
          navigator.clipboard.writeText(PHONE_E164).catch(() => {});
        }
      }, 800);
    }
  }, []);

  return (
    <footer className="relative overflow-hidden bg-black text-white">
      {/* BACKGROUND + AMBIENCE */}
      <div className="pointer-events-none absolute inset-0">
        {bgOk ? (
          <img
            src="/sections/contact.webp"
            alt="Padrino ambience"
            className="h-full w-full object-cover object-center"
            draggable={false}
            loading="lazy"
            onError={() => setBgOk(false)}
          />
        ) : null}

        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/35 to-black/15" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-black/60" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_30%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_75%_20%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.80)]" />

        <div className="pointer-events-none absolute -top-28 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.10),transparent_60%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 py-20 md:py-24">
        <div className="grid gap-12 md:grid-cols-3 md:gap-10">
          {/* Brand */}
          <div>
            {/* ✅ Logo potpuno uklonjen */}
            <span className="text-xl font-extrabold tracking-wide">
              Padrino
            </span>

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
                <button
                  type="button"
                  onClick={onGoHome}
                  className="hover:text-white transition"
                >
                  Početna
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={onGoHome}
                  className="hover:text-white transition"
                >
                  Meni
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => onGoSection("delivery")}
                  className="hover:text-white transition"
                >
                  Dostava
                </button>
              </li>

              <li>
                <button
                  type="button"
                  onClick={() => onGoSection("contact")}
                  className="hover:text-white transition"
                >
                  Kontakt
                </button>
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

              <button
                type="button"
                onClick={onOpenViber}
                className="block hover:text-white transition text-left"
              >
                Viber
              </button>

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

        <div className="my-14 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-white/55">
          <div>© {new Date().getFullYear()} Padrino Pizzeria Budva</div>
          <div className="tracking-[0.22em] uppercase">Since 2021</div>
        </div>
      </div>
    </footer>
  );
}
