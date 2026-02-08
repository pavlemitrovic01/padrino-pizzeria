const PHONE_DISPLAY = "+382/67-603-780";
const PHONE_TEL = "+38267603780";
const EMAIL = "padrinobudva@gmail.com";
const ADDRESS = "Jadranski put BB (Kotorski Semafori)";
const HOURS = "12-00";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

function Contact() {
  return (
    <section id="contact" className="relative overflow-hidden bg-black text-white">
      {/* ambience (same theme) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-black/70 to-black" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_22%,rgba(242,180,0,0.10),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_140px_rgba(0,0,0,0.85)]" />
      </div>

      <div className="relative mx-auto w-full max-w-7xl px-6 py-24 md:py-32">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16 items-start">
          {/* LEFT – INFO */}
          <div>
            <span className="p-kicker">Kontakt</span>

            <h2 className="p-title mt-4 text-4xl md:text-6xl leading-[1.05] text-white/92">
              Javite nam se
            </h2>

            <p className="mt-6 text-white/65 max-w-xl leading-relaxed">
              Imate pitanje, sugestiju ili želite saradnju? Pišite nam — brzo odgovaramo.
            </p>

            <div className="mt-10 rounded-[30px] border border-white/10 bg-black/25 backdrop-blur-md p-6 shadow-[0_28px_110px_rgba(0,0,0,0.6)]">
              <div className="grid gap-5">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    <span aria-hidden="true">☎️</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Telefon
                    </div>
                    <a
                      href={`tel:${PHONE_TEL}`}
                      className="mt-2 block text-lg font-extrabold text-white/90 hover:text-white transition"
                    >
                      {PHONE_DISPLAY}
                    </a>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    <span aria-hidden="true">✉️</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                      E-mail
                    </div>
                    <a
                      href={`mailto:${EMAIL}`}
                      className="mt-2 block text-lg font-extrabold text-white/90 hover:text-white transition break-words"
                    >
                      {EMAIL}
                    </a>
                  </div>
                </div>

                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-2xl bg-[#f2b400]/10 ring-1 ring-white/10 flex items-center justify-center">
                    <span aria-hidden="true">📍</span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                      Lokacija
                    </div>
                    <a
                      href={MAPS_URL}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-lg font-extrabold text-white/90 hover:text-white transition"
                    >
                      {ADDRESS}
                    </a>
                    <div className="mt-2 text-sm text-white/55">
                      Radno vrijeme:{" "}
                      <span className="text-white/80 font-semibold">{HOURS}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="h-11 px-5 rounded-full bg-white/10 text-white/85 font-extrabold hover:bg-white/15 transition"
                >
                  Otvori mape
                </a>

                <a
                  href={`tel:${PHONE_TEL}`}
                  className="h-11 px-5 rounded-full bg-[#f2b400] text-black font-extrabold shadow-[0_18px_60px_rgba(0,0,0,0.45)] hover:brightness-105 active:brightness-95 transition"
                >
                  Pozovi
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT – FORM (premium look, but no backend wiring) */}
          <form className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black/25 backdrop-blur-md p-7 md:p-10 shadow-[0_28px_110px_rgba(0,0,0,0.6)]">
            <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

            <div className="relative">
              <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                Poruka
              </div>

              <h3 className="mt-2 text-2xl md:text-3xl font-extrabold text-white/92">
                Napišite nam par riječi
              </h3>

              <p className="mt-3 text-sm text-white/60 leading-relaxed">
                Forma je vizuelno spremna. Ako želiš, sledeći korak je da je spojimo na email
                ili direktno na WhatsApp/Viber.
              </p>

              <div className="mt-8 space-y-5">
                <div>
                  <label className="block text-xs uppercase tracking-[0.22em] text-white/45 mb-2">
                    Ime
                  </label>
                  <input
                    type="text"
                    placeholder="Vaše ime"
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/60 placeholder:text-white/30 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.22em] text-white/45 mb-2">
                    E-mail
                  </label>
                  <input
                    type="email"
                    placeholder="Vaš e-mail"
                    className="w-full rounded-2xl bg-black/30 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/60 placeholder:text-white/30 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-[0.22em] text-white/45 mb-2">
                    Poruka
                  </label>
                  <textarea
                    rows={5}
                    placeholder="Vaša poruka"
                    className="w-full resize-none rounded-2xl bg-black/30 px-4 py-3 text-white outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-[#f2b400]/60 placeholder:text-white/30 transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 rounded-full bg-[#f2b400] text-black font-extrabold shadow-[0_18px_60px_rgba(0,0,0,0.45)] hover:brightness-105 active:brightness-95 transition"
                >
                  Pošaljite poruku
                </button>

                <div className="text-xs text-white/45 leading-relaxed">
                  * Trenutno vizuelno (bez slanja). Ako želiš funkcionalno slanje, reci mi da li
                  hoćeš: <span className="text-white/65 font-semibold">email</span>,{" "}
                  <span className="text-white/65 font-semibold">WhatsApp</span> ili{" "}
                  <span className="text-white/65 font-semibold">Viber</span>.
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default Contact;
