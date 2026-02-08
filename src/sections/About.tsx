import { useMemo, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function About() {
  /**
   * BACKGROUND IMAGE (robustan fallback)
   * Pošto kod tebe slika već postoji ali ime može biti različito,
   * ovo automatski proba više putanja bez ikakvih ručnih promena.
   */
  const candidates = useMemo(
    () => [
      "/about/storefront.png",
      "/about/storefront.jpg",
      "/about/padrino-storefront.png",
      "/about/padrino-storefront.jpg",
      "/about/padrino-lokal.png",
      "/about/padrino-lokal.jpg",
      "/about/about-bg.png",
      "/about/about-bg.jpg",
    ],
    []
  );

  const [imgIdx, setImgIdx] = useState(0);
  const bgSrc = candidates[Math.min(imgIdx, candidates.length - 1)];

  /**
   * DESKTOP POZICIJE — PIXEL CONTROL (kao što si hteo)
   * Ove vrednosti su namerno čiste px / vw da bude “Figma feeling”.
   */
  const POS = {
    titleTop: 34,

    leftCard: { left: 44, top: 140, width: 420 },
    rightCard: { right: 44, top: 220, width: 420 },

    // KVADRATI (ono što si nacrtao crveno)
    leftBottomSlot: { left: 64, bottom: 54, width: 420 },
    rightTopSlot: { right: 64, top: 96, width: 360 },
  };

  return (
    <section id="o-nama" className="relative overflow-hidden bg-black">
      {/* BACKGROUND (full-bleed) */}
      <div className="absolute inset-0">
        <img
          src={bgSrc}
          alt="Padrino lokal"
          className="h-full w-full object-cover object-center"
          draggable={false}
          onError={() => {
            // probaj sledeći kandidat dok ne nađe postojeći fajl
            setImgIdx((i) => (i < candidates.length - 1 ? i + 1 : i));
          }}
        />

        {/* cinematic overlays for readability */}
        <div className="absolute inset-0 bg-black/40" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
      </div>

      {/* STAGE (relativan anchor za apsolutno pozicioniranje) */}
      <div className="relative z-10 min-h-[900px] lg:min-h-[940px]">
        {/* TITLE (kvadrat 1) */}
        <div
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 text-center w-full px-4"
          style={{ top: POS.titleTop }}
        >
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-yellow-500/35" />
            <h2 className="font-serif tracking-[0.28em] text-zinc-100 text-3xl md:text-5xl">
              O NAMA
            </h2>
            <span className="h-px w-12 bg-yellow-500/35" />
          </div>
          <p className="mt-3 text-zinc-200/80 italic text-sm md:text-base">
            Porodična pizzerija u srcu Budve
          </p>
        </div>

        {/* DESKTOP: FREE POSITION LAYOUT */}
        <div className="hidden lg:block">
          {/* RIGHT TOP SLOT (Google Reviews / trust CTA) */}
          <motion.a
            href="https://www.google.com/search?q=Padrino+Pizzeria+Budva+reviews"
            target="_blank"
            rel="noreferrer"
            className="absolute"
            style={{
              right: POS.rightTopSlot.right,
              top: POS.rightTopSlot.top,
              width: POS.rightTopSlot.width,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="group rounded-2xl border border-white/10 bg-black/55 backdrop-blur-md p-5 shadow-[0_20px_90px_rgba(0,0,0,0.55)] hover:border-white/15">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-semibold tracking-wide">
                      Google Reviews
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-zinc-200/75 leading-relaxed">
                    Pogledaj iskustva gostiju i utiske o Padrinu.
                  </p>
                </div>

                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Otvori <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1 text-yellow-300/90">
                  <span className="text-xs">★★★★★</span>
                  <span className="ml-2 text-xs text-zinc-200/70">
                    (klik za recenzije)
                  </span>
                </div>

                <div className="h-px flex-1 mx-3 bg-yellow-500/20" />

                <div className="text-xs text-zinc-200/70 group-hover:text-zinc-100/85">
                  Preporuke → 
                </div>
              </div>
            </div>
          </motion.a>

          {/* LEFT CARD (kvadrat 2) */}
          <motion.div
            className="absolute"
            style={{
              left: POS.leftCard.left,
              top: POS.leftCard.top,
              width: POS.leftCard.width,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/62 backdrop-blur-md p-9 shadow-[0_20px_90px_rgba(0,0,0,0.60)]">
              <h3 className="font-serif text-3xl leading-tight text-white">
                Porodična pizzerija
                <br />
                koja je počela iz ljubavi
              </h3>

              <div className="mt-4 h-px w-24 bg-yellow-500/35" />

              <div className="mt-6 space-y-4 text-zinc-200/85 leading-relaxed text-[15px]">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz
                  čiste ljubavi prema pizzi.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako
                  je mi najviše volimo — domaćinski, jednostavno i od najboljih
                  sastojaka.
                </p>
                <p>
                  Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo
                  uredili samo za tu svrhu, radili smo isključivo dostavu. Svaka
                  pizza izlazila je iz ruku ljudi koji vole ono što rade — i to se,
                  izgleda, osjetilo. Gosti su prepoznali kvalitet, a vrlo brzo su
                  počeli da dolaze i lično.
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT CARD (kvadrat 3) */}
          <motion.div
            className="absolute"
            style={{
              right: POS.rightCard.right,
              top: POS.rightCard.top,
              width: POS.rightCard.width,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/62 backdrop-blur-md p-9 shadow-[0_20px_90px_rgba(0,0,0,0.60)]">
              <div className="space-y-4 text-zinc-200/85 leading-relaxed text-[15px]">
                <p>
                  U dvorištu smo imali svega dva stola, namijenjena onima koji su
                  dolazili po porudžbine. Ipak, gosti su ostajali, sjedjeli,
                  razgovarali, družili se i provodili kvalitetno vrijeme sa nama.
                  Neki su čak mislili da dolaze u luksuzni restoran, vođeni ocenama i
                  preporukama koje su nas iskreno iznenadile i obradovale.
                </p>

                <p>
                  Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za
                  pravljenje tijesta. Vjerujemo da dobro tijesto nema tajne — samo vrijeme,
                  pažnju i ljubav.
                </p>

                <p>
                  Kako je Padrino rastao, postalo je jasno da naš mali dom više ne može da primi
                  svu tu ljubav. Korak po korak, bez žurbe, odlučili smo da napravimo sledeći
                  potez. Danas se nalazimo u srcu Budve, na Jadranskoj magistrali — u prostoru
                  koji smo stvorili kao malo mjesto za sve koji cijene dobru pizzu, toplu
                  atmosferu i porodične vrijednosti.
                </p>

                <div className="pt-4 border-t border-white/10">
                  <p className="italic text-white/90">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* LEFT BOTTOM SLOT (premium tags / decor) */}
          <motion.div
            className="absolute"
            style={{
              left: POS.leftBottomSlot.left,
              bottom: POS.leftBottomSlot.bottom,
              width: POS.leftBottomSlot.width,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.06 }}
          >
            <div className="rounded-2xl border border-white/10 bg-black/48 backdrop-blur-md p-5 shadow-[0_20px_90px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Since 2021
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Tijesto sa ljubavlju
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Budva • Jadranska magistrala
                </span>

                <span className="ml-auto hidden xl:inline-flex items-center gap-2 text-xs text-zinc-200/70">
                  <span className="h-px w-10 bg-yellow-500/25" />
                  premium • porodično • domaće
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* MOBILE: clean stack + mini review */}
        <div className="lg:hidden relative z-10 px-4 pt-28 pb-10">
          <div className="mx-auto max-w-xl space-y-6">
            <a
              href="https://www.google.com/search?rlz=1C1GCEA_enRS1106RS1106&sca_esv=cc509cf985bd090a&sxsrf=ANbL-n5qsrVE7idZOtLazsTwpBuVN6CK1Q:1770504064951&q=padrino+budva&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOTstmithlT6_yzLrxpkdpuvm3NPUbexX9EoyngovVydPcRXbsXNl5pLZR4PsZHs0KqPE2yTk_Tlna6Z0q3viI3pAey-f59JI_3WnJJU7y6v82BoQqrLzLywHe8Q23vXqDxewGLk%3D&sa=X&ved=2ahUKEwiVoPXOuciSAxU1OBAIHVI8M10QrrQLegQIHhAA&biw=1097&bih=544&dpr=1.75"
              target="_blank"
              rel="noreferrer"
              className="block"
            >
              <div className="rounded-2xl border border-white/10 bg-black/55 backdrop-blur-md p-5 shadow-[0_20px_90px_rgba(0,0,0,0.55)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-semibold tracking-wide">
                      Google Reviews
                    </span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-200/70" />
                </div>
                <p className="mt-2 text-xs text-zinc-200/75">
                  Otvori recenzije i utiske gostiju.
                </p>
              </div>
            </a>

            <div className="rounded-2xl border border-white/10 bg-black/62 backdrop-blur-md p-6 shadow-[0_20px_90px_rgba(0,0,0,0.60)]">
              <h3 className="font-serif text-2xl leading-tight text-white">
                Porodična pizzerija koja je počela iz ljubavi
              </h3>
              <div className="mt-4 h-px w-20 bg-yellow-500/35" />
              <div className="mt-5 space-y-4 text-zinc-200/85 leading-relaxed text-[14px]">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz
                  čiste ljubavi prema pizzi.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je mi
                  najviše volimo — domaćinski, jednostavno i od najboljih sastojaka.
                </p>
                <p>
                  Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo uredili samo
                  za tu svrhu, radili smo isključivo dostavu. Svaka pizza izlazila je iz
                  ruku ljudi koji vole ono što rade — i to se, izgleda, osjetilo. Gosti su
                  prepoznali kvalitet, a vrlo brzo su počeli da dolaze i lično.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/62 backdrop-blur-md p-6 shadow-[0_20px_90px_rgba(0,0,0,0.60)]">
              <div className="space-y-4 text-zinc-200/85 leading-relaxed text-[14px]">
                <p>
                  U dvorištu smo imali svega dva stola, namijenjena onima koji su dolazili
                  po porudžbine. Ipak, gosti su ostajali, sjedjeli, razgovarali, družili se
                  i provodili kvalitetno vrijeme sa nama.
                </p>
                <p>
                  Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za pravljenje
                  tijesta. Vjerujemo da dobro tijesto nema tajne — samo vrijeme, pažnju i ljubav.
                </p>
                <p>
                  Kako je Padrino rastao, postalo je jasno da naš mali dom više ne može da primi
                  svu tu ljubav. Danas se nalazimo u srcu Budve, na Jadranskoj magistrali — u prostoru
                  koji smo stvorili kao malo mjesto za sve koji cijene dobru pizzu, toplu atmosferu
                  i porodične vrijednosti.
                </p>
                <div className="pt-4 border-t border-white/10">
                  <p className="italic text-white/90">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/48 backdrop-blur-md p-5 shadow-[0_20px_90px_rgba(0,0,0,0.55)]">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Since 2021
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Tijesto sa ljubavlju
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-zinc-100/90">
                  Budva • Jadranska magistrala
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
