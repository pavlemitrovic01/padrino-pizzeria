import { useMemo } from "react";
import type { ReactNode } from "react";
import { FaWhatsapp, FaViber, FaInstagram } from "react-icons/fa";
import { SiGooglemaps } from "react-icons/si";

const PHONE_DISPLAY = "+382 67 603 780";
const PHONE_E164 = "+38267603780";

const EMAIL = "padrinobudva@gmail.com";
const ADDRESS_LINE = "Jadranski put BB (Kotorski Semafori)";
const HOURS = "12–00";

const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";
const INSTAGRAM_URL = "https://www.instagram.com/"; // po potrebi stavi tačan profil

const WHATSAPP_WEB_URL = "https://wa.me/38267603780";
const VIBER_URL = `viber://chat?number=${PHONE_E164.replace("+", "")}`;

type SocialItem = {
  label: string;
  href: string;
  icon: ReactNode; // ✅ FIX: ne koristimo JSX.Element
  accentHex: string;
  iconClass: string;
  glowBg: string; // CSS background-image string
};

export default function Contact() {
  const social = useMemo<SocialItem[]>(
    () => [
      {
        label: "Instagram",
        href: INSTAGRAM_URL,
        icon: <FaInstagram size={18} />,
        accentHex: "#E1306C",
        iconClass: "text-[#E1306C]",
        glowBg:
          "radial-gradient(ellipse at 28% 38%, rgba(225,48,108,0.22), transparent 58%)," +
          "radial-gradient(ellipse at 72% 22%, rgba(253,29,29,0.16), transparent 60%)," +
          "radial-gradient(ellipse at 58% 78%, rgba(252,176,69,0.16), transparent 62%)," +
          "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.30))",
      },
      {
        label: "Viber",
        href: VIBER_URL,
        icon: <FaViber size={18} />,
        accentHex: "#7360F2",
        iconClass: "text-[#7360F2]",
        glowBg:
          "radial-gradient(ellipse at 28% 38%, rgba(115,96,242,0.22), transparent 58%)," +
          "radial-gradient(ellipse at 72% 22%, rgba(255,255,255,0.10), transparent 60%)," +
          "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.30))",
      },
      {
        label: "WhatsApp",
        href: WHATSAPP_WEB_URL,
        icon: <FaWhatsapp size={18} />,
        accentHex: "#25D366",
        iconClass: "text-[#25D366]",
        glowBg:
          "radial-gradient(ellipse at 28% 38%, rgba(37,211,102,0.22), transparent 58%)," +
          "radial-gradient(ellipse at 72% 22%, rgba(255,255,255,0.10), transparent 60%)," +
          "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.30))",
      },
      {
        label: "Maps",
        href: MAPS_URL,
        icon: <SiGooglemaps size={18} />,
        accentHex: "#EA4335",
        iconClass: "text-[#EA4335]",
        glowBg:
          "radial-gradient(ellipse at 28% 38%, rgba(234,67,53,0.22), transparent 58%)," +
          "radial-gradient(ellipse at 72% 22%, rgba(66,133,244,0.14), transparent 62%)," +
          "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.30))",
      },
    ],
    []
  );

  const yellowBubble =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-[#f2b400] px-6 py-2.5 min-w-[150px] text-sm font-extrabold text-black hover:brightness-105 transition text-center";

  return (
    <section
      id="kontakt"
      className="relative overflow-hidden bg-black text-white scroll-mt-20"
    >
      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/sections/contact.webp"
          alt="Kontakt Padrino"
          className="h-full w-full object-cover object-[55%_45%] sm:object-[52%_50%] md:object-[50%_50%]"
          draggable={false}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.9)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-24 md:py-28">
        <div className="text-center">
          <div className="p-kicker mb-4">Kontakt</div>
          <h2 className="p-title text-4xl md:text-5xl">Tu smo za vas</h2>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto leading-relaxed">
            Pozovite, pišite ili nas posetite uživo — odgovaramo brzo i sa
            osmijehom.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* LEFT */}
          <div className="p-glass p-glass-hover p-8 sm:p-10 space-y-6">
            {/* TELEFON */}
            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Telefon
              </div>

              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white/92 font-semibold text-lg">
                  {PHONE_DISPLAY}
                </div>

                <a href={`tel:${PHONE_E164}`} className={yellowBubble}>
                  Pozovi nas
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            {/* EMAIL */}
            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Email
              </div>

              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <a
                  href={`mailto:${EMAIL}`}
                  className="text-white/92 font-semibold text-lg hover:text-[#f2b400] transition"
                >
                  {EMAIL}
                </a>

                <a href={`mailto:${EMAIL}`} className={yellowBubble}>
                  E-mail
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            {/* ADRESA */}
            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Adresa
              </div>
              <div className="mt-2 text-white/85 font-semibold">
                {ADDRESS_LINE}
              </div>
            </div>

            {/* RADNO VREME */}
            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Radno vreme
              </div>
              <div className="mt-2 text-white/85 font-semibold">{HOURS}</div>
            </div>
          </div>

          {/* RIGHT — SOCIAL GLASS (BRAND GLOW) */}
          <div className="space-y-4">
            {social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className={[
                  "group relative overflow-hidden",
                  "flex items-center justify-between",
                  "px-6 py-5",
                  "rounded-[28px]",
                  "border border-white/10",
                  "bg-black/40 backdrop-blur-xl",
                  "shadow-[0_25px_90px_rgba(0,0,0,0.75)]",
                  "transition-all duration-300",
                  "hover:-translate-y-[1px]",
                ].join(" ")}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    `${s.accentHex}66`;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.borderColor =
                    "rgba(255,255,255,0.10)";
                }}
              >
                {/* BRAND GLOW LAYER (hover) */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-[28px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundImage: s.glowBg }}
                />
                {/* INNER VIGNETTE */}
                <div className="pointer-events-none absolute inset-0 rounded-[28px] shadow-[inset_0_0_120px_rgba(0,0,0,0.78)]" />

                <div className="relative flex items-center gap-4">
                  {/* ICON BUBBLE */}
                  <div
                    className={[
                      "h-12 w-12 rounded-full grid place-items-center",
                      "bg-white/5",
                      "border border-white/10",
                      "shadow-[0_14px_40px_rgba(0,0,0,0.55)]",
                      "transition-all duration-300",
                      "group-hover:bg-white/6",
                    ].join(" ")}
                  >
                    <span
                      className={[
                        s.iconClass,
                        "transition-all duration-300",
                      ].join(" ")}
                      style={{
                        filter:
                          "drop-shadow(0 0 14px rgba(0,0,0,0.22))",
                      }}
                      aria-hidden="true"
                    >
                      {s.icon}
                    </span>
                  </div>

                  <span className="text-white/92 font-semibold text-lg">
                    {s.label}
                  </span>
                </div>

                {/* CHEVRON BUBBLE */}
                <div
                  className={[
                    "relative",
                    "h-10 w-10 rounded-full grid place-items-center",
                    "bg-white/5",
                    "border border-white/10",
                    "text-white/70",
                    "transition-all duration-300",
                    "group-hover:bg-white/6",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  <span className="text-xl leading-none translate-x-[1px]">
                    ›
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
