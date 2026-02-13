import { useMemo, useState } from "react";

const PHONE_DISPLAY = "+382 67 603 780"; // ✅ razmak umesto crtica
const PHONE_E164 = "+38267603780";

const EMAIL = "padrinobudva@gmail.com";
const ADDRESS_LINE = "Jadranski put BB (Kotorski Semafori)";
const HOURS = "12–00";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// WhatsApp web fallback (radi svuda)
const WHATSAPP_WEB_URL = "https://wa.me/38267603780";

// Viber deeplink (bez predefinisane poruke/linka)
const VIBER_URL = `viber://chat?number=${PHONE_E164.replace("+", "")}`;

export default function Contact() {
  const [copied, setCopied] = useState<null | "phone">(null);

  const social = useMemo(
    () => [
      {
        label: "WhatsApp",
        href: WHATSAPP_WEB_URL,
        hint: "Otvori chat",
      },
      {
        label: "Viber",
        href: VIBER_URL,
        hint: "Otvori chat",
      },
      {
        label: "Google Maps",
        href: MAPS_URL,
        hint: "Otvori lokaciju",
      },
    ],
    []
  );

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
          className="h-full w-full object-cover object-[55%_45%] sm:object-[52%_50%] md:object-[50%_50%] lg:object-[50%_50%]"
          draggable={false}
          loading="lazy"
        />

        <div className="absolute inset-0 bg-black/23" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_20%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_160px_rgba(0,0,0,0.88)]" />
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
          <div className="p-glass p-glass-hover p-8 sm:p-10">
            <div className="space-y-6">
              {/* PHONE */}
              <div>
                <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                  Telefon
                </div>

                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <a
                    href={`tel:${PHONE_E164}`}
                    className="text-white/92 font-semibold text-lg hover:text-[#f2b400] transition"
                  >
                    {PHONE_DISPLAY}
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(PHONE_DISPLAY);
                      setCopied("phone");
                      window.setTimeout(() => setCopied(null), 1200);
                    }}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-extrabold text-white/85 hover:bg-white/10 transition"
                  >
                    {copied === "phone" ? "Kopirano" : "Kopiraj"}
                  </button>
                </div>
              </div>

              <div className="h-px w-full bg-white/10" />

              {/* EMAIL — vraćen mailto */}
              <div>
                <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                  Email
                </div>

                <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <a
                    href={`mailto:${EMAIL}`}
                    className="text-white/92 font-semibold text-lg hover:text-[#f2b400] transition"
                  >
                    {EMAIL}
                  </a>

                  <a
                    href={`mailto:${EMAIL}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/10 bg-[#f2b400] px-5 py-2 text-sm font-extrabold text-black hover:brightness-105 transition"
                  >
                    Pošalji email
                  </a>
                </div>
              </div>

              <div className="h-px w-full bg-white/10" />

              {/* ADDRESS */}
              <div>
                <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                  Adresa
                </div>
                <div className="mt-2 text-white/85 font-semibold">
                  {ADDRESS_LINE}
                </div>
              </div>

              {/* HOURS */}
              <div>
                <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                  Radno vreme
                </div>
                <div className="mt-2 text-white/85 font-semibold">{HOURS}</div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-glass p-glass-hover p-8 sm:p-10">
            <div className="text-xs tracking-[0.22em] uppercase text-white/50">
              Brzi linkovi
            </div>

            <div className="mt-5 grid gap-3">
              {social.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center justify-between gap-4 rounded-[22px] border border-white/10 bg-white/5 px-5 py-4 hover:bg-white/8 hover:border-white/15 transition"
                >
                  <div>
                    <div className="text-white/92 font-extrabold">
                      {s.label}
                    </div>
                    <div className="text-xs text-white/60 mt-1">{s.hint}</div>
                  </div>

                  <div className="h-10 w-10 rounded-full border border-white/10 bg-white/5 grid place-items-center text-white/70 group-hover:bg-white/10 transition">
                    <span className="text-xl leading-none translate-x-[1px]">
                      ›
                    </span>
                  </div>
                </a>
              ))}
            </div>

            <div className="mt-8 rounded-[22px] border border-white/10 bg-black/25 p-5">
              <div className="text-xs tracking-[0.22em] uppercase text-white/50">
                Napomena
              </div>
              <div className="mt-2 text-white/75 leading-relaxed text-sm">
                Ako želite dostavu, poručite direktno preko menija — ili nas
                pozovite za brzu potvrdu.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
