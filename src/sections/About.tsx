import { useMemo, useState } from "react";
import { ExternalLink, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const GOOGLE_REVIEWS_URL =
  "https://www.google.com/search?rlz=1C1GCEA_enRS1106RS1106&sca_esv=cc509cf985bd090a&sxsrf=ANbL-n5qsrVE7idZOtLazsTwpBuVN6CK1Q:1770504064951&q=padrino+budva&si=AL3DRZEsmMGCryMMFSHJ3StBhOdZ2-6yYkXd_doETEE1OR-qOTstmithlT6_yzaw3xsvTnC1bNtccvxR2BKegTnKSkMCS7hPLXN-5Mr0fB6G9VNn9bJjBoJ43ivqZUzM_1bWzTr1Vq1oSeSuKH5f9D1CqL1rQ2cY_4JdZp3fo1sH6hE0bVdt5oZl-p69S-2h_taM0nQJ9H0IYQx3eQ%3D%3D&sa=X&ved=2ahUKEwiEoP2f8qWLAxXbRPEDHXxqF0AQk8gLegQIIRAB&biw=1536&bih=730&dpr=1.25";

const COPY = {
  kicker: "O nama",
  title: "Porodična pizzerija u srcu Budve",
  subtitle:
    "Padrino je porodična pizzerija u Budvi, nastala 2021. godine iz čiste ljubavi prema pizzi.",
  leftTitle: "Porodična pizzerija koja je počela iz ljubavi",
  leftBody: [
    "Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je mi najviše volimo — domaćinski, jednostavno i od najboljih sastojaka.",
    "Sve je počelo u našem domu, u jednoj maloj kuhinji koju smo uredili samo za tu svrhu, radili smo isključivo dostavu. Svaka pizza izlazila je iz ruku ljudi koji vole ono što rade — i to se, izgleda, osjetilo. Gosti su prepoznali kvalitet, a vrlo brzo su počeli da dolaze i lično.",
  ],
  rightBody: [
    "U dvorištu smo imali svega dva stola, namijenjena onima koji su dolazili po porudžbine. Ipak, gosti su ostajali, sjedjeli, razgovarali, družili se i provodili kvalitetno vrijeme sa nama. Neki su čak mislili da dolaze u luksuzni restoran, vođeni ocjenama i preporukama koje su nas iskreno iznenadile i obradovale.",
    "Od prvog dana, teta Milka koristi ljubav kao glavni sastojak za pravljenje tijesta. Vjerujemo da dobro tijesto nema tajne — samo vrijeme, pažnja i ljubav.",
    "Kako je Padrino rastao, postalo je jasno da naš mali dom više ne može da primi svu tu ljubav. Korak po korak, bez žurbe, odlučili smo da napravimo sledeći potez. Danas se nalazimo u srcu Budve, na Jadranskoj magistrali — u prostoru koji smo stvorili kao malo mjesto za sve koji cijene dobru pizzu, toplu atmosferu i porodične vrijednosti.",
  ],
  closing:
    "Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.",
};

function BodyParagraphs({ lines }: { lines: string[] }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-white/75">
      {lines.map((t, i) => (
        <p key={i}>{t}</p>
      ))}
    </div>
  );
}

function AboutStoryModal({
  open,
  onClose,
  title,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-modal="true"
          role="dialog"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute inset-0 bg-black/70"
            aria-label="Zatvori"
          />
          <motion.div
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative mx-auto w-full rounded-t-[28px] border border-white/10 bg-black/70 shadow-[0_40px_140px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:max-w-2xl sm:rounded-[28px]"
          >
            <div className="px-6 pb-4 pt-6 sm:px-8 sm:pt-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-white/50">
                    Naša priča
                  </div>
                  <div className="mt-2 text-xl font-extrabold text-white/92 sm:text-2xl">
                    {title}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white/75 transition hover:bg-white/10"
                  aria-label="Zatvori"
                >
                  ✕
                </button>
              </div>

              <div className="mt-5 h-px w-full bg-white/10" />
            </div>

            <div className="max-h-[70vh] overflow-auto px-6 pb-8 sm:px-8">
              <div className="space-y-5 text-sm leading-relaxed text-white/75">
                {COPY.leftBody.map((p, i) => (
                  <p key={`m1-${i}`}>{p}</p>
                ))}
                {COPY.rightBody.map((p, i) => (
                  <p key={`m2-${i}`}>{p}</p>
                ))}
                <p className="font-semibold text-white/85">{COPY.closing}</p>
              </div>
            </div>

            <div className="px-6 pb-6 sm:px-8">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-white/10 bg-white/8 px-6 py-3 font-extrabold text-white/80 transition hover:bg-white/10"
              >
                Zatvori
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function StoryCard({
  eyebrow,
  title,
  lines,
  closing,
  className,
}: {
  eyebrow: string;
  title: string;
  lines: string[];
  closing?: string;
  className?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-[28px] border border-white/10 bg-black/38 p-7 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.65)] xl:p-8",
        className ?? "",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-60 w-60 rounded-full bg-white/5 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-[#f2b400]/6 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />

      <div className="relative">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45">
          {eyebrow}
        </div>
        <h3 className="mt-3 text-xl font-extrabold text-white/92">{title}</h3>
        <div className="mt-4">
          <BodyParagraphs lines={lines} />
        </div>
        {closing ? <p className="mt-4 font-semibold text-white/85">{closing}</p> : null}
      </div>
    </div>
  );
}

function ReviewsCard({ className }: { className?: string }) {
  return (
    <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className={className}>
      <div className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-black/45 p-5 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.65)] transition hover:border-white/15">
        <div className="pointer-events-none absolute -top-20 -left-20 h-56 w-56 rounded-full bg-white/6 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -right-28 h-72 w-72 rounded-full bg-[#f2b400]/6 blur-3xl" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />

        <div className="relative flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/92">
            <Star className="h-4 w-4 text-[#f2b400]" />
            <span className="text-sm font-extrabold tracking-wide">Google Reviews</span>
          </div>
          <ExternalLink className="h-4 w-4 text-white/65" />
        </div>

        <p className="relative mt-2 text-xs leading-relaxed text-white/65">
          Pogledaj iskustva gostiju i utiske o Padrinu.
        </p>

        <div className="relative mt-4 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Google ocjena</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-lg font-black text-white/92">★★★★★</span>
              <span className="text-sm font-semibold text-white/72">klik za recenzije</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-white/55 transition group-hover:text-white/72">
            Preporuke →
          </span>
        </div>
      </div>
    </a>
  );
}

export default function About() {
  const [storyOpen, setStoryOpen] = useState(false);

  const candidates = useMemo(() => ["/sections/about.webp"], []);
  const [imgIdx, setImgIdx] = useState(0);
  const bgSrc = candidates[Math.min(imgIdx, candidates.length - 1)];

  const POS = useMemo(() => {
    return {
      titleTop: 112,
      contentTop: 318,
      cardWidth: 430,
      sideInset: 48,
      reviewWidth: 390,
      reviewLeftInset: 62,
      reviewTop: 708,
      pillsBottom: 36,
    };
  }, []);

  return (
    <section id="o-nama" className="relative overflow-hidden bg-black scroll-mt-20">
      <div className="absolute inset-0 bg-black">
        <img
          src={bgSrc}
          alt="Padrino lokal"
          className={[
            "h-full w-full object-contain sm:object-cover",
            "brightness-110 sm:brightness-100",
            "object-[55%_50%]",
            "sm:object-[52%_50%]",
            "md:object-[50%_50%]",
            "lg:object-[50%_50%]",
          ].join(" ")}
          draggable={false}
          onError={() => setImgIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
        />

        <div className="absolute inset-0 bg-black/12 sm:bg-black/26" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-black/45 sm:from-black/60 sm:via-black/18 sm:to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/42 via-transparent to-black/06 sm:from-black/52 sm:to-black/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_28%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(circle_at_78%_20%,rgba(242,180,0,0.12),transparent_50%)]" />
        <div className="absolute inset-0 shadow-[inset_0_0_135px_rgba(0,0,0,0.78)]" />

        <div className="pointer-events-none absolute -top-24 left-0 right-0 h-48 bg-[radial-gradient(ellipse_at_center,rgba(242,180,0,0.11),transparent_60%)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 right-0 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08),transparent_62%)] blur-3xl" />
      </div>

      <div className="relative z-10 min-h-[920px] lg:min-h-[980px] xl:min-h-[1020px]">
        <div
          className="absolute left-1/2 hidden w-full -translate-x-1/2 px-4 text-center sm:block"
          style={{ top: POS.titleTop }}
        >
          <div className="p-kicker">{COPY.kicker}</div>

          <h2 className="p-title mt-4 text-3xl leading-[1.05] text-white/92 md:text-5xl">
            Porodična pizzerija
            <br className="hidden sm:block" /> u srcu Budve
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            {COPY.subtitle}
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#f2b400]/35" />
            <span className="text-xs uppercase tracking-[0.22em] text-white/45">
              since 2021
            </span>
            <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#f2b400]/35" />
          </div>
        </div>

        <div className="hidden lg:block">
          <motion.div
            className="absolute"
            style={{
              left: POS.sideInset,
              top: POS.contentTop,
              width: POS.cardWidth,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            <StoryCard
              eyebrow="Naš početak"
              title={COPY.leftTitle}
              lines={COPY.leftBody}
              className="min-h-[360px]"
            />
          </motion.div>

          <motion.div
            className="absolute"
            style={{
              left: POS.reviewLeftInset,
              top: POS.reviewTop,
              width: POS.reviewWidth,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.05 }}
          >
            <ReviewsCard className="block" />
          </motion.div>

          <motion.div
            className="absolute"
            style={{
              right: POS.sideInset,
              top: POS.contentTop,
              width: POS.cardWidth,
            }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.35, ease: "easeOut", delay: 0.08 }}
          >
            <StoryCard
              eyebrow="Danas"
              title="Od male kuhinje do mjesta kome se vraćaš"
              lines={COPY.rightBody}
              closing={COPY.closing}
              className="min-h-[430px]"
            />
          </motion.div>

          <div
            className="absolute left-1/2 w-full -translate-x-1/2 px-6"
            style={{ bottom: POS.pillsBottom }}
          >
            <div className="mx-auto max-w-6xl">
              <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-black/25 px-6 py-4 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.55)]">
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent" />
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
                  <span className="ml-auto hidden text-xs text-white/55 xl:inline-flex">
                    premium • porodično • domaće
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex min-h-[920px] flex-col px-4 pt-6 pb-12 lg:hidden">
          <div className="mx-auto flex w-full max-w-xl flex-1 flex-col space-y-6">
            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/35 p-5 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold tracking-wide text-white/85">
                  O nama
                </span>
              </div>
            </div>

            <ReviewsCard className="block" />

            <div className="relative overflow-hidden rounded-[26px] border border-white/10 bg-black/35 p-5 backdrop-blur-md shadow-[0_30px_120px_rgba(0,0,0,0.60)]">
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

          <div className="mt-auto pt-6">
            <p className="mb-3 text-center text-sm font-semibold leading-relaxed text-white/80">
              Padrino je porodična pizzerija koja je počela iz čiste ljubavi prema pizzi —
              domaćinski, iskreno i bez kompromisa u kvalitetu.
            </p>

            <button
              type="button"
              onClick={() => setStoryOpen(true)}
              className="w-full rounded-full bg-[#f2b400] px-6 py-4 text-sm font-extrabold text-black shadow-[0_22px_70px_rgba(242,180,0,0.22)] transition hover:brightness-105"
            >
              NAŠA PRIČA
            </button>

            <p className="mt-3 text-center text-xs text-white/60">
              Klikni da pročitaš kako je sve počelo.
            </p>
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
