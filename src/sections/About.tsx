import { useMemo, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { motion } from "framer-motion";

const GOOGLE_REVIEWS_LINK =
  "https://www.google.com/search?rlz=1C1GCEA_enRS1106RS1106&sca_esv=cc509cf985bd090a&sxsrf=ANbL-n5qsrVE7idZOtLazsTwpBuVN6CK1Q:1770504064951&q=padrino+budva&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOTstmithlT6_yzLrxpkdpuvm3NPUbexX9EoyngovVydPcRXbsXNl5pLZR4PsZHs0KqPE2yTk_Tlna6Z0q3viI3pAey-f59JI_3WnJJU7y6v82BoQqrLzLywHe8Q23vXqDxewGLk%3D&sa=X&ved=2ahUKEwiVoPXOuciSAxU1OBAIHVI8M10QrrQLegQIHhAA&biw=1097&bih=544&dpr=1.75";

export default function About() {
  /**
   * BACKGROUND IMAGE
   * (želiš da ostane ista — ovo samo obezbjeđuje fallback ako dođe do promjene imena fajla)
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
   * Responsive “absolute editorial layout” (desktop)
   * – stabilan, ali se prilagođava širini ekrana (clamp)
   */
  const POS = {
    titleTop: 34,
    gutter: "clamp(20px, 4vw, 64px)",
    cardW: "clamp(360px, 33vw, 460px)",
    leftTop: 150,
    rightTop: 210,
    tagsBottom: 54,
  } as const;

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
            setImgIdx((i) => (i < candidates.length - 1 ? i + 1 : i));
          }}
        />

        {/* cinematic overlays for readability (match Hero/Delivery language) */}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
        <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />
      </div>

      {/* STAGE */}
      <div className="relative z-10 min-h-[920px] lg:min-h-[980px]">
        {/* TITLE */}
        <div
          className="pointer-events-none absolute left-1/2 w-full -translate-x-1/2 px-4 text-center"
          style={{ top: POS.titleTop }}
        >
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-yellow-500/25" />
            <h2 className="p-title text-3xl md:text-5xl tracking-[0.28em]">O NAMA</h2>
            <span className="h-px w-12 bg-yellow-500/25" />
          </div>
          <p className="mt-3 text-sm italic text-zinc-200/80 md:text-base">
            Porodična pizzerija u srcu Budve
          </p>
        </div>

        {/* DESKTOP */}
        <div className="hidden lg:block">
          {/* LEFT STORY */}
          <motion.div
            className="absolute"
            style={{ left: POS.gutter, top: POS.leftTop, width: POS.cardW }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <div className="p-glass p-9">
              <h3 className="font-serif text-3xl leading-tight text-white">
                Porodična pizzerija
                <br />
                koja je počela iz ljubavi
              </h3>
              <div className="mt-4 h-px w-24 bg-yellow-500/35" />
              <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-zinc-200/85">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz čiste
                  ljubavi prema pizzi.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je mi najviše
                  volimo — domaćinski, jednostavno i od najboljih sastojaka.
                </p>
                <p>
                  Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo uredili samo za
                  tu svrhu, radili smo isključivo dostavu. Svaka pizza izlazila je iz ruku
                  ljudi koji vole ono što rade — i to se, izgleda, osjetilo. Gosti su
                  prepoznali kvalitet, a vrlo brzo su počeli da dolaze i lično.
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT STORY + TRUST BADGE (aligned as one unit) */}
          <motion.div
            className="absolute"
            style={{ right: POS.gutter, top: POS.rightTop, width: POS.cardW }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          >
            {/* Trust */}
            <a href={GOOGLE_REVIEWS_LINK} target="_blank" rel="noreferrer" className="block">
              <div className="group p-glass-soft p-glass-hover mb-4 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-white">
                      <Star className="h-4 w-4 text-yellow-400" />
                      <span className="text-sm font-semibold tracking-wide">Google Reviews</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-200/75">
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
                    <span className="ml-2 text-xs text-zinc-200/70">(klik za recenzije)</span>
                  </div>

                  <div className="mx-3 h-px flex-1 bg-yellow-500/20" />

                  <div className="text-xs text-zinc-200/70 group-hover:text-zinc-100/85">
                    Preporuke →
                  </div>
                </div>
              </div>
            </a>

            {/* Story */}
            <div className="p-glass p-9">
              <div className="space-y-4 text-[15px] leading-relaxed text-zinc-200/85">
                <p>
                  U dvorištu smo imali svega dva stola, namijenjena onima koji su dolazili po
                  porudžbine. Ipak, gosti su ostajali, sjedjeli, razgovarali, družili se i
                  provodili kvalitetno vrijeme sa nama. Neki su čak mislili da dolaze u
                  luksuzni restoran, vođeni ocenama i preporukama koje su nas iskreno
                  iznenadile i obradovale.
                </p>

                <p>
                  Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za pravljenje
                  tijesta. Vjerujemo da dobro tijesto nema tajne — samo vrijeme, pažnju i
                  ljubav.
                </p>

                <p>
                  Kako je Padrino rastao, postalo je jasno da naš mali dom više ne može da
                  primi svu tu ljubav. Korak po korak, bez žurbe, odlučili smo da napravimo
                  sledeći potez. Danas se nalazimo u srcu Budve, na Jadranskoj magistrali —
                  u prostoru koji smo stvorili kao malo mjesto za sve koji cijene dobru
                  pizzu, toplu atmosferu i porodične vrijednosti.
                </p>

                <div className="border-t border-white/10 pt-4">
                  <p className="italic text-white/90">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* DECOR TAGS (bottom left) */}
          <motion.div
            className="absolute"
            style={{ left: POS.gutter, bottom: POS.tagsBottom, width: POS.cardW }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.06 }}
          >
            <div className="p-glass-soft p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="p-chip">Since 2021</span>
                <span className="p-chip">Tijesto sa ljubavlju</span>
                <span className="p-chip">Budva • Jadranska magistrala</span>

                <span className="ml-auto hidden xl:inline-flex items-center gap-2 text-xs text-zinc-200/70">
                  <span className="h-px w-10 bg-yellow-500/25" />
                  premium • porodično • domaće
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* MOBILE: stacked, same card language */}
        <div className="relative z-10 px-4 pb-10 pt-28 lg:hidden">
          <div className="mx-auto max-w-xl space-y-6">
            <a href={GOOGLE_REVIEWS_LINK} target="_blank" rel="noreferrer" className="block">
              <div className="p-glass-soft p-glass-hover p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-semibold tracking-wide">Google Reviews</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-zinc-200/70" />
                </div>
                <p className="mt-2 text-xs text-zinc-200/75">Otvori recenzije i utiske gostiju.</p>
              </div>
            </a>

            <div className="p-glass p-6">
              <h3 className="font-serif text-2xl leading-tight text-white">
                Porodična pizzerija koja je počela iz ljubavi
              </h3>
              <div className="mt-4 h-px w-20 bg-yellow-500/35" />
              <div className="mt-5 space-y-4 text-[14px] leading-relaxed text-zinc-200/85">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz čiste
                  ljubavi prema pizzi.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je mi najviše
                  volimo — domaćinski, jednostavno i od najboljih sastojaka.
                </p>
                <p>
                  Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo uredili samo za
                  tu svrhu, radili smo isključivo dostavu. Svaka pizza izlazila je iz ruku
                  ljudi koji vole ono što rade — i to se, izgleda, osjetilo. Gosti su
                  prepoznali kvalitet, a vrlo brzo su počeli da dolaze i lično.
                </p>
              </div>
            </div>

            <div className="p-glass p-6">
              <div className="space-y-4 text-[14px] leading-relaxed text-zinc-200/85">
                <p>
                  U dvorištu smo imali svega dva stola, namijenjena onima koji su dolazili po
                  porudžbine. Ipak, gosti su ostajali, sjedjeli, razgovarali, družili se i
                  provodili kvalitetno vrijeme sa nama.
                </p>
                <p>
                  Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za pravljenje
                  tijesta. Vjerujemo da dobro tijesto nema tajne — samo vrijeme, pažnju i
                  ljubav.
                </p>
                <p>
                  Kako je Padrino rastao, postalo je jasno da naš mali dom više ne može da primi
                  svu tu ljubav. Danas se nalazimo u srcu Budve, na Jadranskoj magistrali — u
                  prostoru koji smo stvorili kao malo mjesto za sve koji cijene dobru pizzu,
                  toplu atmosferu i porodične vrijednosti.
                </p>
                <div className="border-t border-white/10 pt-4">
                  <p className="italic text-white/90">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-glass-soft p-5">
              <div className="flex flex-wrap gap-2">
                <span className="p-chip">Since 2021</span>
                <span className="p-chip">Tijesto sa ljubavlju</span>
                <span className="p-chip">Budva • Jadranska magistrala</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
