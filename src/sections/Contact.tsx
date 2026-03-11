import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FaWhatsapp, FaViber, FaInstagram } from "react-icons/fa";
import { SiGooglemaps } from "react-icons/si";
import { supabase } from "../lib/supabaseClient";

type SiteSettings = {
  id: number;
  phone_display: string;
  phone_e164: string;
  email: string;
  address_line: string;
  hours_display: string;
  maps_url: string;
  instagram_url: string;
  whatsapp_url: string;
  viber_url: string;
  default_city: string;
  default_postcode: string;
};

const DEFAULT_SETTINGS: SiteSettings = {
  id: 1,
  phone_display: "+382 67 603 780",
  phone_e164: "+38267603780",
  email: "padrinobudva@gmail.com",
  address_line: "Jadranski put BB (Kotorski Semafori)",
  hours_display: "12–00",
  maps_url: "https://maps.app.goo.gl/ouqBC1P8rD62qij99",
  instagram_url: "https://www.instagram.com/padrino_budva",
  whatsapp_url: "https://wa.me/38267603780",
  viber_url: "viber://chat?number=38267603780",
  default_city: "Budva",
  default_postcode: "85310",
};

type SocialItem = {
  label: string;
  href: string;
  icon: ReactNode;
  accentHex: string;
  iconClass: string;
  glowBg: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toSafeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function normalizeSettings(raw: unknown): SiteSettings | null {
  if (!isRecord(raw)) return null;

  const id = toSafeInt(raw.id);
  if (id !== 1) return null;

  return {
    id,
    phone_display: toStr(raw.phone_display) || DEFAULT_SETTINGS.phone_display,
    phone_e164: toStr(raw.phone_e164) || DEFAULT_SETTINGS.phone_e164,
    email: toStr(raw.email) || DEFAULT_SETTINGS.email,
    address_line: toStr(raw.address_line) || DEFAULT_SETTINGS.address_line,
    hours_display: toStr(raw.hours_display) || DEFAULT_SETTINGS.hours_display,
    maps_url: toStr(raw.maps_url) || DEFAULT_SETTINGS.maps_url,
    instagram_url: toStr(raw.instagram_url) || DEFAULT_SETTINGS.instagram_url,
    whatsapp_url: toStr(raw.whatsapp_url) || DEFAULT_SETTINGS.whatsapp_url,
    viber_url: toStr(raw.viber_url) || DEFAULT_SETTINGS.viber_url,
    default_city: toStr(raw.default_city) || DEFAULT_SETTINGS.default_city,
    default_postcode: toStr(raw.default_postcode) || DEFAULT_SETTINGS.default_postcode,
  };
}

export default function Contact() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const { data, error } = await supabase
        .from("site_settings")
        .select(
          "id, phone_display, phone_e164, email, address_line, hours_display, maps_url, instagram_url, whatsapp_url, viber_url, default_city, default_postcode"
        )
        .eq("id", 1)
        .maybeSingle();

      if (cancelled || error) return;

      const normalized = normalizeSettings(data);
      if (!normalized) return;

      setSettings(normalized);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const social = useMemo<SocialItem[]>(
    () => [
      {
        label: "Instagram",
        href: settings.instagram_url,
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
        href: settings.viber_url,
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
        href: settings.whatsapp_url,
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
        href: settings.maps_url,
        icon: <SiGooglemaps size={18} />,
        accentHex: "#EA4335",
        iconClass: "text-[#EA4335]",
        glowBg:
          "radial-gradient(ellipse at 28% 38%, rgba(234,67,53,0.22), transparent 58%)," +
          "radial-gradient(ellipse at 72% 22%, rgba(66,133,244,0.14), transparent 62%)," +
          "linear-gradient(to bottom, rgba(255,255,255,0.05), rgba(0,0,0,0.30))",
      },
    ],
    [settings.instagram_url, settings.maps_url, settings.viber_url, settings.whatsapp_url]
  );

  const yellowBubble =
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-[#f2b400] px-6 py-2.5 min-w-[150px] text-sm font-extrabold text-black hover:brightness-105 transition text-center";

  return (
    <section
      id="kontakt"
      className="relative overflow-hidden bg-black text-white scroll-mt-20"
    >
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/sections/contact.webp"
          alt="Kontakt Padrino"
          className="h-full w-full object-cover object-[55%_45%] sm:object-[52%_50%] md:object-[50%_50%]"
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;

            if (!target.src.includes("/sections/contact.jpg")) {
              target.src = "/sections/contact.jpg";
              return;
            }

            if (!target.src.includes("/sections/contact.png")) {
              target.src = "/sections/contact.png";
              return;
            }

            if (!target.src.includes("/sections/contact.jpeg")) {
              target.src = "/sections/contact.jpeg";
            }
          }}
        />

        <div className="absolute inset-0 bg-black/25" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/20" />
        <div className="absolute inset-0 shadow-[inset_0_0_180px_rgba(0,0,0,0.9)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-14 md:py-28">
        <div className="text-center">
          <div className="p-kicker mb-4">Kontakt</div>
          <h2 className="p-title text-4xl md:text-5xl">Tu smo za vas</h2>
          <p className="mt-4 text-white/65 max-w-2xl mx-auto leading-relaxed">
            Pozovite, pišite ili nas posetite uživo — odgovaramo brzo i sa
            osmijehom.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          <div className="p-glass p-glass-hover p-8 sm:p-10 space-y-6">
            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Telefon
              </div>

              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white/92 font-semibold text-lg">
                  {settings.phone_display}
                </div>

                <a href={`tel:${settings.phone_e164}`} className={yellowBubble}>
                  Pozovi nas
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Email
              </div>

              <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-white/92 font-semibold text-lg">
                  {settings.email}
                </div>

                <a
                  href={`mailto:${settings.email}?subject=Porudžbina%20-%20Padrino%20Pizzeria%20Budva&body=Zdravo%2C%0A%0AŽelim%20da%20poručim%3A%0A-%20%0A%0AAdresa%3A%20%0ATelefon%3A%20%0A%0AHvala!`}
                  className={yellowBubble}
                >
                  Pošalji mail
                </a>
              </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Adresa
              </div>
              <div className="mt-2 text-white/92 font-semibold text-lg">
                {settings.address_line}
              </div>
            </div>

            <div className="h-px w-full bg-white/10" />

            <div>
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Radno vreme
              </div>
              <div className="mt-2 text-white/92 font-semibold text-lg">
                {settings.hours_display}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="group relative p-glass p-glass-hover overflow-hidden"
                style={{
                  backgroundImage: s.glowBg,
                }}
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="relative flex items-center justify-between p-6 sm:p-7">
                  <div className="flex items-center gap-4">
                    <div
                      className={[
                        "h-10 w-10 rounded-full border border-white/10 bg-black/35 grid place-items-center",
                        s.iconClass,
                      ].join(" ")}
                    >
                      {s.icon}
                    </div>

                    <div className="text-white/92 font-extrabold">
                      {s.label}
                    </div>
                  </div>

                  <div className="h-10 w-10 rounded-full border border-white/10 bg-black/35 grid place-items-center text-white/70 group-hover:text-white transition">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden="true"
                    >
                      <path
                        d="M9 6l6 6-6 6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}