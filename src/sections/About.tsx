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
            className="absolute inset-0 bg-black/80 backdrop-blur-none sm:backdrop-blur-sm"
            onClick={onClose}
          />

          {/* modal */}
          <motion.div
            className="relative w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/10 bg-black/55 shadow-[0_40px_140px_rgba(0,0,0,0.85)]"
            initial={{ y: 16, scale: 0.985, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.99, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {/* ambience */}
            <div className="pointer-events-none absolute -top-32 -left-40 h-96 w-96 rounded-full bg-white/6 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-40 -right-44 h-[520px] w-[520px] rounded-full bg-[#f2b400]/10 blur-3xl" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

            {/* header */}
            <div className="relative flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6 sm:py-5">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">
                  O nama
                </div>
                <div className="mt-2 text-lg sm:text-xl font-extrabold text-white/92 truncate">
                  {title}
                </div>
                <div className="mt-1 text-xs text-white/55">Since 2021</div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-11 w-11 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition"
                aria-label="Zatvori"
              >
                ×
              </button>
            </div>

            {/* body */}
            <div className="relative max-h-[72vh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] px-5 py-5 sm:px-6 sm:py-6">
              <div className="grid gap-6 md:grid-cols-2">
                {/* left column */}
                <div className="space-y-4 text-white/72 leading-relaxed text-[14px] sm:text-[15px]">
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

                {/* right column */}
                <div className="space-y-4 text-white/72 leading-relaxed text-[14px] sm:text-[15px]">
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
                </div>
              </div>

              <div className="mt-6 rounded-[22px] border border-white/10 bg-white/5 px-5 py-4">
                <p className="italic text-white/90">
                  Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between text-xs text-white/55">
                <span>ESC za zatvaranje</span>
                <span className="text-[#f2b400]/90">Padrino • premium</span>
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
    <section id="o-nama" className="relative overflow-hidden bg-black">
      {/* BACKGROUND */}
      <div className="absolute inset-0">
        <img
          src={bgSrc}
          alt="Padrino lokal"
          className="h-full w-full object-cover object-center"
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
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          >
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/45 backdrop-blur-md p-9 shadow-[0_30px_120px_rgba(0,0,0,0.70)]">
              <div className="pointer-events-none absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />

              <div className="relative space-y-4 text-white/70 leading-relaxed text-[15px]">
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

                <div className="pt-5 border-t border-white/10">
                  <p className="italic text-white/90">
                    Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* LEFT BOTTOM SLOT — tags */}
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
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/35 backdrop-blur-md p-5 shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/0 to-black/25" />

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

                <span className="ml-auto hidden xl:inline-flex items-center gap-2 text-xs text-white/55">
                  <span className="h-px w-10 bg-[#f2b400]/25" />
                  premium • porodično • domaće
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* MOBILE: CTA ostaje, ali se spušta pri dnu sekcije */}
        <div className="lg:hidden relative z-10 px-4 pt-44 pb-12 min-h-[920px] flex flex-col">
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
              className="w-full h-11 rounded-full bg-[#f2b400] text-black font-extrabold hover:brightness-105 active:brightness-95 transition shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
            >
              SAZNAJ VIŠE
            </button>
          </div>
        </div>
      </div>

      {/* STORY MODAL */}
      <AboutStoryModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title="Iz naših srca, do vaših osmjeha."
      />
    </section>
  );
}
  