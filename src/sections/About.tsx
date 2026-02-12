import { useMemo, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?rlz=1C1GCEA_enRS1106RS1106&sca_esv=cc509cf985bd090a&sxsrf=ANbL-n5qsrVE7idZOtLazsTwpBuVN6CK1Q:1770504064951&q=padrino+budva&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOTstmithlT6_yzLrxpkdpuvm3NPUbexX9EoyngovVydPcRXbsXNl5pLZR4PsZHs0KqPE2yTk_Tlna6Z0q3viI3pAey-f59JI_3WnJJU7y6v82BoQqrLzLywHe8Q23vXqDxewGLk%3D&sa=X&ved=2ahUKEwiVoPXOuciSAxU1OBAIHVI8M10QrrQLegQIHhAA&biw=1097&bih=544&dpr=1.75";

function AboutStoryModal(props: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  const { open, onClose, title } = props;

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
          aria-label={title}
        >
          {/* overlay */}
          <button
            type="button"
            aria-label="Zatvori"
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
          />

          <motion.div
            className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-white/10 bg-black/70 backdrop-blur-xl shadow-[0_40px_160px_rgba(0,0,0,0.78)]"
            initial={{ y: 10, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <div className="pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full bg-[#f2b400]/12 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-36 -right-36 h-96 w-96 rounded-full bg-white/8 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/40" />

            <div className="relative p-6 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    naša priča
                  </div>
                  <h3 className="mt-2 font-serif text-2xl sm:text-3xl leading-tight text-white/92">
                    Kako je sve počelo
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/75 hover:bg-white/10 transition"
                >
                  Zatvori
                </button>
              </div>

              <div className="mt-6 space-y-4 text-white/70 leading-relaxed text-[15px]">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz
                  čiste ljubavi prema pizzi.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je
                  mi najviše volimo — domaćinski, jednostavno i od najboljih
                  sastojaka.
                </p>
                <p>
                  Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo
                  uredili samo za tu svrhu, radili smo isključivo dostavu. Svaka
                  pizza izlazila je iz ruku ljudi koji vole ono što rade — i to se,
                  izgleda, osjetilo. Gosti su prepoznali kvalitet, a vrlo brzo su
                  počeli da dolaze i lično.
                </p>

                <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-white/75">
                    Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za
                    pravljenje tijesta. Vjerujemo da dobro tijesto nema tajne —
                    samo vrijeme, pažnju i ljubav.
                  </p>
                </div>

                <p>
                  Kako je Padrino rastao, postalo je jasno da naš mali dom više ne
                  može da primi svu tu ljubav. Korak po korak, bez žurbe, odlučili
                  smo da napravimo sledeći potez. Danas se nalazimo u srcu Budve,
                  na Jadranskoj magistrali — u prostoru koji smo stvorili kao malo
                  mjesto za sve koji žele dobru pizzu, toplu atmosferu i porodične
                  vrijednosti.
                </p>

                <p className="text-white/80 font-semibold">
                  Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao
                  prijatelji.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function About() {
  const candidates = useMemo(
    () => [
      "/sections/about.webp",
      "/about/storefront.webp",
      "/about/storefront.png",
      "/about/storefront.jpg",
      "/about/padrino-storefront.webp",
      "/about/padrino-storefront.png",
      "/about/padrino-storefront.jpg",
      "/about/padrino-lokal.webp",
      "/about/padrino-lokal.png",
      "/about/padrino-lokal.jpg",
      "/about/about-bg.webp",
      "/about/about-bg.png",
      "/about/about-bg.jpg",
    ],
    []
  );

  const [imgIdx, setImgIdx] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);

  const bgSrc = candidates[Math.min(imgIdx, candidates.length - 1)];

  const POS = {
    titleTop: 36,
    leftCard: { left: 44, top: 150, width: 440 },
    rightCard: { right: 44, top: 240, width: 440 },
    leftBottomSlot: { left: 64, bottom: 54, width: 460 },
    rightTopSlot: { right: 64, top: 102, width: 380 },
  };

  // ESC close
  useMemo(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setStoryOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <section id="o-nama" className="relative overflow-hidden bg-black scroll-mt-20">
      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-black">
        <img
          src={bgSrc}
          alt="Padrino lokal"
          className="h-full w-full object-contain object-center lg:object-cover"
          draggable={false}
          onError={() => setImgIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
        />

        {/* cinematic overlays (sadašnji “odličan” nivo) */}
        <div className="absolute inset-0 bg-black/12 sm:bg-black/26" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-black/45 sm:from-black/60 sm:via-black/18 sm:to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/06 sm:from-black/52 sm:to-black/10" />
        <div className="absolute inset-0 sm:hidden bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.06),transparent_55%),radial-gradient(circle_at_78%_20%,rgba(242,180,0,0.08),transparent_50%)]" />
        <div className="absolute inset-0 hidden sm:block bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_78%_20%,rgba(242,180,0,0.12),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_95px_rgba(0,0,0,0.62)] sm:shadow-[inset_0_0_135px_rgba(0,0,0,0.78)]" />

        {/* seamless glow */}
        <div className="pointer-events-none absolute -top-24 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.11),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)] blur-3xl" />
      </div>

      {/* STAGE */}
      <div className="relative z-10 min-h-[920px] lg:min-h-[980px]">
        {/* TITLE (desktop CTA uklonjen) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 text-center w-full px-4"
          style={{ top: POS.titleTop }}
        >
          <div className="p-kicker">O nama</div>

          <h2 className="p-title mt-4 text-3xl md:text-5xl leading-[1.05] text-white/92">
            Porodična pizzerija
            <br className="hidden sm:block" /> u srcu Budve
          </h2>

          <div className="mt-8 flex items-center justify-center gap-4">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#f2b400]/35" />
            <span className="text-xs tracking-[0.22em] uppercase text-white/45">
              since 2021
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#f2b400]/35" />
          </div>
        </div>

        {/* DESKTOP: postojeći layout ostaje isti */}
        <div className="hidden lg:block">
          {/* RIGHT TOP SLOT — Google Reviews CTA */}
          <motion.a
            href={GOOGLE_REVIEWS_URL}
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
            <div className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-black/45 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.65)] hover:border-white/15 transition">
              <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/30" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-white/92">
                    <Star className="h-4 w-4 text-[#f2b400]" />
                    <span className="text-sm font-extrabold tracking-wide">
                      Google Reviews
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-white/65 leading-relaxed">
                    Pogledaj iskustva gostiju i utiske o Padrinu.
                  </p>
                </div>

                <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80 group-hover:bg-white/10 transition">
                  Otvori <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>

              <div className="relative mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#f2b400]">★★★★★</span>
                  <span className="text-xs text-white/55">(klik za recenzije)</span>
                </div>

                <div className="h-px flex-1 mx-3 bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="text-xs text-white/55 group-hover:text-white/80 transition">
                  Preporuke →
                </div>
              </div>
            </div>
          </motion.a>

          {/* LEFT CARD */}
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
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/45 backdrop-blur-md p-9 shadow-[0_30px_120px_rgba(0,0,0,0.70)]">
              <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

              <div className="relative">
                <h3 className="font-serif text-3xl leading-tight text-white/92">
                  Porodična pizzerija
                  <br />
                  koja je počela iz ljubavi
                </h3>

                <div className="mt-5 h-px w-24 bg-gradient-to-r from-[#f2b400]/45 to-transparent" />

                <div className="mt-6 space-y-4 text-white/70 leading-relaxed text-[15px]">
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

                <div className="mt-7 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setStoryOpen(true)}
                    className="inline-flex items-center justify-center rounded-full bg-[#f2b400] px-5 py-2 text-sm font-extrabold text-black shadow-[0_18px_60px_rgba(242,180,0,0.18)] hover:brightness-105 transition"
                  >
                    Saznaj više
                  </button>

                  <span className="text-xs text-white/55">
                    priča o tome kako smo nastali
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* RIGHT CARD */}
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
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.02 }}
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/45 backdrop-blur-md p-9 shadow-[0_30px_120px_rgba(0,0,0,0.70)]">
              <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/8 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                    priča
                  </div>
                  <div className="text-xs text-white/55">
                    <span className="text-[#f2b400]/90">✦</span> premium • porodično • domaće
                  </div>
                </div>

                <h3 className="mt-4 font-serif text-3xl leading-tight text-white/92">
                  U dvorištu smo imali svega dva stola,
                  <br />
                  namijenjena onima koji su dolazili po porudžbine.
                </h3>

                <div className="mt-5 h-px w-24 bg-gradient-to-r from-white/15 to-transparent" />

                <div className="mt-6 space-y-4 text-white/70 leading-relaxed text-[15px]">
                  <p>
                    Ipak, gosti su ostajali, sjedeli, razgovarali, družili se i
                    provodili kvalitetno vrijeme sa nama.
                  </p>
                  <p>
                    Neki su čak mislili da dolaze u luksuzni restoran, vođeni ocenama
                    i preporukama koje su nas iskreno iznenadile i obradovale.
                  </p>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-white/75">
                      Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za
                      pravljenje tijesta. Vjerujemo da dobro tijesto nema tajne —
                      samo vrijeme, pažnju i ljubav.
                    </p>
                  </div>

                  <p>
                    Kako je Padrino rastao, postalo je jasno da naš mali dom više ne
                    može da primi svu tu ljubav. Korak po korak, bez žurbe, odlučili
                    smo da napravimo sledeći potez.
                  </p>
                  <p>
                    Danas se nalazimo u srcu Budve, na Jadranskoj magistrali — u
                    prostoru koji smo stvorili kao malo mjesto za sve koji žele dobru
                    pizzu, toplu atmosferu i porodične vrijednosti.
                  </p>

                  <p className="text-white/80 font-semibold">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao
                    prijatelji.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* BOTTOM TAGS (desktop) */}
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
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.03 }}
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/35 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />

              <div className="relative flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Since 2021
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Tijesto sa ljubavlju
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Budva • Jadranska magistrala
                </span>

                <span className="ml-2 hidden xl:inline-flex items-center gap-2 text-xs text-white/55">
                  <span className="h-px w-10 bg-[#f2b400]/25" />
                  premium • porodično • domaće
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* MOBILE: CTA ostaje, ali se spušta pri dnu sekcije */}
        <div className="lg:hidden relative z-10 px-4 pt-[58vh] pb-12 min-h-[920px] flex flex-col">
          <div className="mx-auto max-w-xl space-y-6 w-full flex-1">
            <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className="block">
              <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/45 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
                <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/4 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-[#f2b400]/6 blur-3xl" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />

                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/92">
                    <Star className="h-4 w-4 text-[#f2b400]" />
                    <span className="text-sm font-extrabold tracking-wide">Google Reviews</span>
                  </div>
                  <ExternalLink className="h-4 w-4 text-white/65" />
                </div>

                <p className="relative mt-2 text-xs text-white/65">
                  Otvori recenzije i utiske gostiju.
                </p>
              </div>
            </a>

            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/35 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />
              <div className="relative">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  priča
                </div>
                <div className="mt-2 text-white/85 font-extrabold">
                  Porodična pizzerija • Since 2021
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/35 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Since 2021
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Tijesto sa ljubavlju
                </span>
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                  Budva • Jadranska magistrala
                </span>
              </div>
            </div>
          </div>

          {/* MOBILE CTA — PRI DNU */}
          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              className="w-full rounded-full bg-[#f2b400] px-6 py-4 text-sm font-extrabold text-black shadow-[0_22px_70px_rgba(242,180,0,0.22)] hover:brightness-105 transition"
            >
              SAZNAJ VIŠE
            </button>
          </div>
        </div>
      </div>

      <AboutStoryModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title="Kako je sve počelo"
      />
    </section>
  );
}
