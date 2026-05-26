import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { FaWhatsapp, FaViber, FaInstagram } from "react-icons/fa";
import { SiGooglemaps } from "react-icons/si";
import { DEFAULT_PUBLIC_BUSINESS_SETTINGS, normalizePublicBusinessSettings, type PublicBusinessSettings } from "../lib/publicBusinessSettings";
import { supabase } from "../lib/supabaseClient";

type SocialItem = {
  label: string;
  href: string;
  icon: ReactNode;
  iconClass: string;
};

export default function Contact() {
  const [settings, setSettings] = useState<PublicBusinessSettings>(DEFAULT_PUBLIC_BUSINESS_SETTINGS);

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

      const normalized = normalizePublicBusinessSettings(data);
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
        icon: <FaInstagram size={16} />,
        iconClass: "text-[#E1306C]",
      },
      {
        label: "Viber",
        href: settings.viber_url,
        icon: <FaViber size={16} />,
        iconClass: "text-[#7360F2]",
      },
      {
        label: "WhatsApp",
        href: settings.whatsapp_url,
        icon: <FaWhatsapp size={16} />,
        iconClass: "text-[#25D366]",
      },
      {
        label: "Maps",
        href: settings.maps_url,
        icon: <SiGooglemaps size={16} />,
        iconClass: "text-[#EA4335]",
      },
    ],
    [settings.instagram_url, settings.maps_url, settings.viber_url, settings.whatsapp_url]
  );

  return (
    <section
      id="kontakt"
      className="relative overflow-hidden bg-black text-white scroll-mt-20"
    >
      {/* Background photo */}
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
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 md:py-32 flex flex-col items-center text-center">

        {/* Kicker */}
        <div className="p-kicker mb-6">Kontakt</div>

        {/* Header */}
        <h2 className="p-title text-3xl md:text-4xl mb-2">Tu smo za vas</h2>
        <p className="text-white/55 text-sm leading-relaxed max-w-sm mb-12">
          Pozovite, pišite ili nas posetite uživo — odgovaramo brzo i sa osmijehom.
        </p>

        {/* Hero phone */}
        <a
          href={`tel:${settings.phone_e164}`}
          className="group flex flex-col items-center"
          aria-label={`Pozovite nas: ${settings.phone_display}`}
        >
          <div className="p-eyebrow mb-3">Telefon</div>
          <div className="p-serif text-5xl sm:text-6xl xl:text-7xl font-semibold text-[#f2b400] leading-none tracking-tight group-hover:brightness-110 transition duration-200">
            {settings.phone_display}
          </div>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#f2b400] px-7 py-2.5 text-sm font-extrabold text-black hover:brightness-105 active:brightness-95 transition duration-200">
            Pozovi sada
          </div>
        </a>

        {/* Info strip */}
        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-y-5 gap-x-8 text-center">
          <div>
            <div className="p-eyebrow mb-1.5">Email</div>
            <a
              href={`mailto:${settings.email}?subject=Porudžbina%20-%20Padrino%20Pizzeria%20Budva&body=Zdravo%2C%0A%0AŽelim%20da%20poručim%3A%0A-%20%0A%0AAdresa%3A%20%0ATelefon%3A%20%0A%0AHvala!`}
              className="text-white/75 text-sm hover:text-white transition duration-200"
            >
              {settings.email}
            </a>
          </div>

          <div className="hidden sm:block h-7 w-px bg-white/15" />

          <div>
            <div className="p-eyebrow mb-1.5">Adresa</div>
            <p className="text-white/75 text-sm">{settings.address_line}</p>
          </div>

          <div className="hidden sm:block h-7 w-px bg-white/15" />

          <div>
            <div className="p-eyebrow mb-1.5">Radno Vrijeme</div>
            <p className="text-white/75 text-sm">{settings.hours_display}</p>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-10 h-px w-full max-w-xs bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        {/* Social pills */}
        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          {social.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/[0.07] ring-1 ring-white/10 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/[0.13] hover:ring-white/20 hover:text-white transition-all duration-200"
            >
              <span className={s.iconClass}>{s.icon}</span>
              {s.label}
            </a>
          ))}
        </div>

      </div>
    </section>
  );
}
