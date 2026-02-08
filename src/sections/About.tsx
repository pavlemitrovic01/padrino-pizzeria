import { useMemo, useState } from "react";
import { motion } from "framer-motion";

export default function About() {
  const [imgError, setImgError] = useState(false);

  // Vite-safe: radi i kad app nije na rootu (BASE_URL)
  const bgSrc = useMemo(() => {
    const base = import.meta.env.BASE_URL || "/";
    return `${base}about/storefront.jpg`;
  }, []);

  return (
    <section id="o-nama" className="relative overflow-hidden bg-black py-16 md:py-24">
      {/* BACKGROUND (slika + overlays) */}
      <div className="absolute inset-0">
        {/* Background image */}
        <img
          src={bgSrc}
          alt="Padrino lokal"
          className="h-full w-full object-cover"
          draggable={false}
          onError={() => setImgError(true)}
          onLoad={() => setImgError(false)}
        />

        {/* Ako slika NE postoji, pokaži jasno (da nema nagađanja) */}
        {imgError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-2xl border border-white/15 bg-black/70 backdrop-blur px-6 py-4 text-center shadow-[0_20px_80px_rgba(0,0,0,0.6)]">
              <div className="text-white font-semibold">Slika se ne učitava</div>
              <div className="mt-1 text-zinc-300 text-sm">
                Očekujem fajl na:
                <span className="ml-2 font-mono text-zinc-100">{bgSrc}</span>
              </div>
              <div className="mt-2 text-zinc-400 text-xs">
                Proveri da li fajl stvarno postoji u{" "}
                <span className="font-mono text-zinc-200">public/about/storefront.jpg</span>
              </div>
            </div>
          </div>
        )}

        {/* Cinematic overlays (ne ubijaju centar, samo čitljivost po ivicama) */}
        <div className="absolute inset-0 bg-black/35" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-black/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/15" />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 mx-auto max-w-7xl px-4">
        {/* HEADER */}
        <div className="mb-12 text-center">
          <div className="flex items-center justify-center gap-4">
            <span className="h-px w-12 bg-yellow-500/35" />
            <h2 className="font-serif tracking-[0.28em] text-zinc-100 text-3xl md:text-5xl">
              O NAMA
            </h2>
            <span className="h-px w-12 bg-yellow-500/35" />
          </div>
          <p className="mt-3 text-zinc-200/80 italic">Porodična pizzerija u srcu Budve</p>
        </div>

        {/* TWO EQUAL TEXT BLOCKS (left / right), center stays clean */}
        <div className="relative min-h-[520px] md:min-h-[620px] lg:min-h-[640px]">
          {/* LEFT */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="
              lg:absolute lg:left-6 lg:top-1/2 lg:-translate-y-1/2
              w-full lg:w-[380px]
            "
          >
            <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <h3 className="font-serif text-3xl md:text-4xl leading-tight text-white">
                Porodična pizzerija
                <br />
                koja je počela iz ljubavi
              </h3>

              <div className="mt-4 h-px w-24 bg-yellow-500/35" />

              <div className="mt-6 space-y-4 text-zinc-200/85 leading-relaxed">
                <p>
                  Padrino je porodična pizzerija u Budvi, nastala iz čiste ljubavi prema pizzi —
                  jednostavno, domaćinski i od najboljih sastojaka.
                </p>
                <p>
                  Ne iz velikog plana, već iz želje da pravimo pizzu onako kako je mi najviše volimo —
                  pažljivo, mirno i dosledno.
                </p>
              </div>
            </div>
          </motion.div>

          {/* RIGHT */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.08 }}
            className="
              mt-6 lg:mt-0
              lg:absolute lg:right-6 lg:top-1/2 lg:-translate-y-1/2
              w-full lg:w-[380px]
            "
          >
            <div className="rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
              <div className="space-y-4 text-zinc-200/85 leading-relaxed">
                <p>Svaka pizza izlazi iz ruku ljudi koji vole ono što rade — i to se osjeti.</p>
                <p>
                  Danas smo u srcu Budve, na Jadranskoj magistrali — u prostoru koji smo stvorili kao
                  malo mjesto za sve koji cijene dobru pizzu, toplu atmosferu i porodične vrijednosti.
                </p>
              </div>

              <div className="mt-7 pt-6 border-t border-white/10">
                <p className="italic text-white/90">
                  Ako jednom dođete kao gosti, vjerujemo da ćete se vratiti kao prijatelji.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
