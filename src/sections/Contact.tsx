import { useMemo, useState } from "react";

const PHONE_DISPLAY = "+382/67-603-780";
const PHONE_E164 = "+38267603780";


const EMAIL = "padrinobudva@gmail.com";
const ADDRESS_LINE = "Jadranski put BB (Kotorski Semafori)";
const HOURS = "12–00";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

// WhatsApp web fallback (radi svuda)
const WHATSAPP_WEB_URL = "https://wa.me/38267603780";
// WhatsApp app deep link (pokuša da otvori aplikaciju)
const WHATSAPP_DEEP_URL = "whatsapp://send?phone=38267603780";

// Viber deep link (prazan chat)
const VIBER_DEEP_URL = "viber://chat?number=%2B38267603780";

function Contact() {
  const [name, setName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sentHint, setSentHint] = useState<
    null | "copiedEmail" | "copiedForm" | "copiedPhone"
  >(null);

  const formText = useMemo(() => {
    return [
      `Padrino — Poruka sa sajta`,
      ``,
      `Ime: ${name || "-"}`,
      `Email: ${fromEmail || "-"}`,
      ``,
      `Poruka:`,
      `${message || "-"}`,
      ``,
      `— Poslato sa Padrino sajta`,
    ].join("\n");
  }, [name, fromEmail, message]);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "true");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  function flashHint(kind: "copiedEmail" | "copiedForm" | "copiedPhone", ms: number) {
    setSentHint(kind);
    window.setTimeout(() => setSentHint(null), ms);
  }

  async function onCopyEmail() {
    const ok = await copyToClipboard(EMAIL);
    if (ok) flashHint("copiedEmail", 1800);
  }

  async function onCopyForm() {
    const ok = await copyToClipboard(formText);
    if (ok) flashHint("copiedForm", 2200);
  }

  async function onCopyPhone() {
    const ok = await copyToClipboard(PHONE_E164);
    if (ok) flashHint("copiedPhone", 1800);
  }

  // ✅ Deep link + fallback + copy broj (bez pop-up/alert)
  async function openWhatsApp() {
    // uvek kopiramo broj kao fallback (ako nema app)
    await onCopyPhone();

    const start = Date.now();
    window.location.href = WHATSAPP_DEEP_URL;

    // ako deep link ne uspe, prebacujemo na web WA posle kratkog delay-a
    window.setTimeout(() => {
      // ako je korisnik već otišao u aplikaciju, ovo neće izvršiti (page background)
      // ako nije, idemo na web link
      if (Date.now() - start < 1800) {
        window.location.href = WHATSAPP_WEB_URL;
      }
    }, 900);
  }

  async function openViber() {
    // uvek kopiramo broj kao fallback
    await onCopyPhone();

    const start = Date.now();
    window.location.href = VIBER_DEEP_URL;

    // Viber nema pouzdan univerzalni web chat fallback kao WA,
    // pa ostaje copy broj + deep link pokušaj.
    window.setTimeout(() => {
      void start; // no-op (samo da je jasno da je timeout nameran)
    }, 650);
  }

  return (
    <section id="contact" className="relative overflow-hidden bg-black text-white">
      {/* BACKGROUND + ambience */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src="/sections/contact.webp"
          alt="Kontakt Padrino"
          className="h-full w-full object-cover object-center"
          draggable={false}
          loading="lazy"
        />

        {/* zatamnjenje kao “sve ostalo” */}
        <div className="absolute inset-0 bg-black/23" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/42 to-black/78" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/56 via-black/16 to-black/56" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/11" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.09),transparent_55%),radial-gradient(circle_at_78%_22%,rgba(242,180,0,0.13),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_125px_rgba(0,0,0,0.80)]" />

        {/* SEAMLESS GLOW */}
        <div className="pointer-events-none absolute -top-24 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.13),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.09),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-28 md:py-32">
        <div className="grid gap-12 md:grid-cols-2 md:gap-14 items-start">
          {/* LEFT — INFO */}
          <div>
            <span className="p-kicker">Kontakt</span>

            <h2 className="p-title mt-4 text-4xl md:text-6xl leading-[1.05]">
              Javite nam se
            </h2>

            <p className="mt-6 max-w-xl text-white/65 leading-relaxed">
              Ako imate pitanje, sugestiju ili želite narudžbu “na brzinu” — tu smo.
              Najbrži put je poziv ili WhatsApp/Viber.
            </p>

            <div className="mt-10 grid gap-4">
              {/* phone */}
              <div className="rounded-[26px] border border-white/10 bg-black/25 backdrop-blur-md p-5 shadow-[0_22px_80px_rgba(0,0,0,0.60)]">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Telefon
                    </div>
                    <div className="mt-2 text-xl font-extrabold text-white/92">
                      {PHONE_DISPLAY}
                    </div>

                    <div className="mt-2 text-sm text-white/60">
                      Radno vrijeme:{" "}
                      <span className="text-white/80 font-semibold">{HOURS}</span>
                    </div>
                  </div>

                  <a
                    href={`tel:${PHONE_E164}`}
                    className="shrink-0 h-11 px-5 rounded-full bg-[#f2b400] text-black font-extrabold hover:brightness-105 active:brightness-95 transition shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                  >
                    Pozovi
                  </a>
                </div>

                <div className="mt-4 h-px w-full bg-gradient-to-r from-[#f2b400]/25 via-white/10 to-transparent" />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={openWhatsApp}
                    className="h-11 rounded-full bg-white/10 text-white/85 font-extrabold hover:bg-white/15 transition border border-white/10 flex items-center justify-center gap-2"
                  >
                    <span aria-hidden="true">WA</span>
                    WhatsApp
                  </button>

                  <button
                    type="button"
                    onClick={openViber}
                    className="h-11 rounded-full bg-white/10 text-white/85 font-extrabold hover:bg-white/15 transition border border-white/10 flex items-center justify-center gap-2"
                  >
                    <span aria-hidden="true">VB</span>
                    Viber
                  </button>
                </div>

                {sentHint === "copiedPhone" ? (
                  <div className="mt-3 text-xs text-white/65">
                    Broj je kopiran:{" "}
                    <span className="text-white/85 font-semibold">{PHONE_E164}</span>
                  </div>
                ) : null}
              </div>

              {/* address */}
              <div className="rounded-[26px] border border-white/10 bg-black/25 backdrop-blur-md p-5 shadow-[0_22px_80px_rgba(0,0,0,0.60)]">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  Lokacija
                </div>

                <div className="mt-2 text-lg font-extrabold text-white/92">
                  {ADDRESS_LINE}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="h-11 px-5 rounded-full bg-white/10 text-white/85 font-extrabold hover:bg-white/15 transition border border-white/10 flex items-center gap-2"
                  >
                    <span aria-hidden="true">📍</span>
                    Otvori mape
                  </a>

                  <button
                    type="button"
                    onClick={onCopyEmail}
                    className="h-11 px-5 rounded-full bg-white/10 text-white/85 font-extrabold hover:bg-white/15 transition border border-white/10 flex items-center gap-2"
                  >
                    <span aria-hidden="true">✉️</span>
                    Kopiraj email
                  </button>
                </div>

                {sentHint === "copiedEmail" ? (
                  <div className="mt-3 text-xs text-white/65">
                    Email je kopiran:{" "}
                    <span className="text-white/85 font-semibold">{EMAIL}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* RIGHT — FORM */}
          <div className="rounded-[30px] border border-white/10 bg-black/25 backdrop-blur-md shadow-[0_28px_110px_rgba(0,0,0,0.70)] overflow-hidden">
            <div className="h-px w-full bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent" />

            <div className="p-6 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    Brza poruka
                  </div>
                  <div className="mt-2 text-2xl font-extrabold text-white/92">
                    Pišite nam
                  </div>
                  <div className="mt-2 text-sm text-white/60">
                    Ne otvaramo mail aplikaciju — poruku kopirate i pošaljete iz Gmail-a/Outlook-a.
                  </div>
                </div>

                <div className="hidden sm:flex h-12 w-12 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 items-center justify-center text-[#f2b400] font-black">
                  ✦
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/45">
                    Ime
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl bg-black/25 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/35 transition placeholder:text-white/30"
                    placeholder="Vaše ime"
                    autoComplete="name"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/45">
                    Email
                  </label>
                  <input
                    value={fromEmail}
                    onChange={(e) => setFromEmail(e.target.value)}
                    className="w-full rounded-2xl bg-black/25 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/35 transition placeholder:text-white/30"
                    placeholder="Vaš email"
                    autoComplete="email"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs uppercase tracking-[0.22em] text-white/45">
                    Poruka
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-2xl bg-black/25 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/35 transition placeholder:text-white/30"
                    placeholder="Napišite poruku…"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onCopyForm}
                    className="block w-full text-center rounded-full bg-[#f2b400] px-6 py-4 text-sm font-extrabold text-black hover:brightness-105 active:brightness-95 transition shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
                  >
                    Kopiraj poruku
                  </button>

                  {sentHint === "copiedForm" ? (
                    <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-3 text-sm text-white/65">
                      Poruka je kopirana. Zalijepite je u Gmail/Outlook i pošaljite na{" "}
                      <span className="text-white/80 font-semibold">{EMAIL}</span>.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="text-xs text-white/50 leading-relaxed">
                  Tip: Za narudžbe i brze izmjene — koristite{" "}
                  <span className="text-white/70 font-semibold">WhatsApp/Viber</span>.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex justify-center">
          <div className="h-px w-[240px] bg-gradient-to-r from-transparent via-[#f2b400]/25 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export default Contact;
