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

/* ─── Sub-components ──────────────────────────────────────────────────────── */

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
            className="relative mx-auto w-full overflow-hidden rounded-t-[28px] border border-white/8 bg-[#111111] shadow-[0_40px_140px_rgba(0,0,0,0.95)] sm:max-w-2xl sm:rounded-[28px]"
          >
            {/* Gold accent stripe */}
            <div className="h-[3px] bg-gradient-to-r from-[#f2b400]/70 via-[#f2b400]/25 to-transparent" />

            {/* Subtle top glow */}
            <div className="pointer-events-none absolute top-0 left-0 right-0 h-40 bg-[radial-gradient(ellipse_at_15%_0%,rgba(242,180,0,0.06),transparent_60%)]" />

            {/* Header */}
            <div className="relative px-6 pb-4 pt-6 sm:px-8 sm:pt-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.26em] text-[#f2b400]/55">
                    Naša priča
                  </div>
                  <div className="p-serif mt-2 text-xl font-semibold text-white/95 sm:text-2xl">
                    {title}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-sm text-white/55 transition hover:bg-white/10 hover:text-white/80"
                  aria-label="Zatvori"
                >
                  ✕
                </button>
              </div>
              <div className="mt-5 h-px bg-gradient-to-r from-[#f2b400]/20 via-white/8 to-transparent" />
            </div>

            {/* Scroll body */}
            <div className="max-h-[62vh] overflow-auto px-6 pb-6 sm:px-8">
              <div className="space-y-4 text-[0.875rem] leading-relaxed text-white/68">
                {COPY.leftBody.map((p, i) => (
                  <p key={`m1-${i}`}>{p}</p>
                ))}
                {COPY.rightBody.map((p, i) => (
                  <p key={`m2-${i}`}>{p}</p>
                ))}
              </div>
              {/* Closing in serif italic */}
              <p className="p-serif mt-6 text-base font-medium italic text-[#f2b400]/70">
                "{COPY.closing}"
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 pt-4 sm:px-8">
              <div className="mb-4 h-px bg-white/6" />
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-white/6 px-6 py-3.5 text-sm font-extrabold text-white/70 ring-1 ring-white/8 transition hover:bg-white/[0.1] hover:text-white/90"
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

function ReviewsCard({ className }: { className?: string }) {
  return (
    <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noreferrer" className={className}>
      <div className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-black/45 p-5 backdrop-blur-md transition hover:border-white/15">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white/92">
            <Star className="h-4 w-4 text-[#f2b400]" />
            <span className="text-sm font-extrabold tracking-wide">Google Reviews</span>
          </div>
          <ExternalLink className="h-4 w-4 text-white/65" />
        </div>

        <p className="mt-2 text-xs leading-relaxed text-white/65">
          Pogledaj iskustva gostiju i utiske o Padrinu.
        </p>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              Google ocjena
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-base font-black text-white/92">★★★★★</span>
              <span className="text-xs font-semibold text-white/70">klik za recenzije</span>
            </div>
          </div>
          <span className="text-xs font-semibold text-white/55 transition group-hover:text-white/70">
            Preporuke →
          </span>
        </div>
      </div>
    </a>
  );
}

function TagStrip({ className }: { className?: string }) {
  return (
    <div className={["flex flex-wrap gap-2", className].filter(Boolean).join(" ")}>
      {["Since 2021", "Tijesto sa ljubavlju", "Budva • Jadranska magistrala"].map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/* ─── Main Section ────────────────────────────────────────────────────────── */

export default function About() {
  const [storyOpen, setStoryOpen] = useState(false);

  const candidates = useMemo(() => ["/sections/about.webp"], []);
  const [imgIdx, setImgIdx] = useState(0);
  const bgSrc = candidates[Math.min(imgIdx, candidates.length - 1)];

  const handleImgError = () =>
    setImgIdx((i) => (i < candidates.length - 1 ? i + 1 : i));

  return (
    <section
      id="o-nama"
      className="p-section-editorial relative bg-black scroll-mt-20"
      aria-label="O nama"
    >
      {/* ══════════════════════════════════════════════════════════════
          MOBILE  (< lg) — stacked natural flow
      ══════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden">
        {/* Header */}
        <div className="px-6 pt-14 pb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-kicker">{COPY.kicker}</div>
          </div>
          <h2 className="p-serif text-3xl font-semibold leading-tight text-white/95 sm:text-4xl">
            {COPY.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-white/60 sm:max-w-sm">
            {COPY.subtitle}
          </p>
        </div>

        {/* Photo preview — image breathes in rounded container */}
        <div className="px-4">
          <div className="relative overflow-hidden rounded-2xl" style={{ aspectRatio: "4/3" }}>
            <img
              src={bgSrc}
              alt="Padrino lokal — ulaz u piceriju"
              className="h-full w-full object-cover object-[50%_50%]"
              draggable={false}
              loading="lazy"
              decoding="async"
              onError={handleImgError}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        </div>

        {/* Teaser · CTA · Tags · Reviews */}
        <div className="space-y-5 px-6 pt-7 pb-12">
          <p className="text-center text-sm leading-relaxed text-white/70">
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

          <p className="text-center text-xs text-white/50">
            Klikni da pročitaš kako je sve počelo.
          </p>

          <TagStrip className="justify-center" />

          {/* Reviews at bottom — social proof after teaser */}
          <ReviewsCard className="block" />
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          DESKTOP  (≥ lg) — Cinematic asymmetric grid  1.3fr / 1fr
      ══════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid lg:grid-cols-[1.3fr_1fr] min-h-[760px] xl:min-h-[820px]">

        {/* LEFT — image panel (~57% width) */}
        <div className="relative overflow-hidden">
          <img
            src={bgSrc}
            alt="Padrino lokal — ulaz u piceriju"
            className="absolute inset-0 h-full w-full object-cover object-[50%_50%]"
            draggable={false}
            loading="lazy"
            decoding="async"
            onError={handleImgError}
          />
          {/* Subtle base darken */}
          <div className="absolute inset-0 bg-black/18" />
          {/* Right-edge fade → smooth seam into text panel */}
          <div
            className="absolute inset-0"
            style={{ background: "linear-gradient(to right, transparent 45%, black)" }}
          />
          {/* Bottom-edge vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

          {/* Since 2021 stamp */}
          <div className="absolute bottom-8 left-8 flex items-center gap-2.5">
            <span className="h-px w-8 bg-[#f2b400]/50" aria-hidden="true" />
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/50 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              since 2021
            </span>
          </div>
        </div>

        {/* RIGHT — text column (~43% width) */}
        <motion.div
          className="flex flex-col justify-center bg-black py-16 pl-10 pr-12 xl:pl-14 xl:pr-20"
          initial={{ opacity: 0, x: 14 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        >
          {/* Kicker */}
          <div className="p-kicker mb-5 self-start">{COPY.kicker}</div>

          {/* Title — Cormorant Garamond */}
          <h2 className="p-serif text-4xl font-semibold leading-tight text-white/95 xl:text-[2.75rem]">
            {COPY.title}
          </h2>

          {/* Subtitle — Inter */}
          <p className="mt-4 text-sm leading-relaxed text-white/60 xl:text-[0.9375rem]">
            {COPY.subtitle}
          </p>

          {/* ── Naš početak ── */}
          <div className="mt-8">
            <div className="mb-3.5 flex items-center gap-3">
              <span className="p-eyebrow">Naš početak</span>
              <span
                className="h-px flex-1 bg-gradient-to-r from-[#f2b400]/45 to-transparent"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-white/65">
              {COPY.leftBody.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* ── Danas ── */}
          <div className="mt-7">
            <div className="mb-3.5 flex items-center gap-3">
              <span className="p-eyebrow">Danas</span>
              <span
                className="h-px flex-1 bg-gradient-to-r from-[#f2b400]/45 to-transparent"
                aria-hidden="true"
              />
            </div>
            <div className="space-y-3 text-sm leading-relaxed text-white/65">
              {COPY.rightBody.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>

          {/* Closing — serif pull-quote, matches title size */}
          <p className="p-serif mt-7 text-[1.375rem] font-medium italic leading-snug text-[#f2b400]/80 xl:text-[1.6rem]">
            "{COPY.closing}"
          </p>

          {/* Bottom: tags + reviews (no glass containers) */}
          <div className="mt-8 space-y-4">
            <TagStrip />
            <ReviewsCard className="block" />
          </div>
        </motion.div>
      </div>

      <AboutStoryModal
        open={storyOpen}
        onClose={() => setStoryOpen(false)}
        title="Kako je sve počelo"
      />
    </section>
  );
}
