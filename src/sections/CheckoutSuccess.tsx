import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";

type CheckoutSuccessProps = {
  onBackToMenu: () => void;
};

function forceScrollToHero() {
  // 1) pokušaj poznate id-jeve (najstabilnije)
  const candidates = ["top", "hero", "home", "meni"];
  for (const id of candidates) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
  }

  // 2) fallback: na vrh (radi čak i kad nema target elementa)
  try {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  } catch {
    window.scrollTo(0, 0);
  }

  // 3) dodatni “force” za razne browsere
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function getOrderIdFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return id && id.trim() ? id.trim() : null;
  } catch {
    return null;
  }
}

export default function CheckoutSuccess({ onBackToMenu }: CheckoutSuccessProps) {
  const orderId = useMemo(() => getOrderIdFromUrl(), []);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  async function copyId() {
    if (!orderId) return;

    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
    } catch {
      // fallback
      try {
        const el = document.createElement("textarea");
        el.value = orderId;
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
      } catch {
        // ignore
      }
    }

    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1400);
  }

  function handleBackToMenu() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    onBackToMenu();

    window.requestAnimationFrame(() => {
      forceScrollToHero();
      window.setTimeout(() => forceScrollToHero(), 60);
    });
  }

  return (
    <section className="relative min-h-[70vh] flex items-center justify-center px-6 py-20">
      <div className="absolute inset-0">
        <img
          src="/sections/menu.webp"
          alt=""
          className="h-full w-full object-cover opacity-85"
          draggable={false}
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/40 to-black/70" />
      </div>

      <div className="pointer-events-none absolute -top-36 -left-36 h-96 w-96 rounded-full bg-[#f2b400]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-44 -right-44 h-[520px] w-[520px] rounded-full bg-white/6 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl rounded-[30px] border border-white/10 bg-black/45 backdrop-blur-xl shadow-[0_40px_140px_rgba(0,0,0,0.85)] overflow-hidden"
      >
        <div className="p-7 sm:p-8">
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl" />
              <div className="relative mx-auto flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500 text-black text-4xl font-extrabold shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                ✓
              </div>
            </div>
          </div>

          <h2 className="mt-6 text-3xl font-extrabold text-white text-center">Porudžbina je poslata</h2>
          <p className="mt-3 text-center text-white/75 leading-relaxed">Hvala na poverenju &lt;3</p>

          {orderId ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <div className="text-xs font-semibold text-white/60">ID porudžbine</div>
              <div className="mt-1 flex items-center justify-between gap-3">
                <div className="min-w-0 font-mono text-[12px] text-white/85 truncate">{orderId}</div>
                <button
                  type="button"
                  onClick={copyId}
                  className="shrink-0 h-9 px-3 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/85 text-xs font-extrabold transition"
                >
                  {copied ? "Kopirano" : "Kopiraj"}
                </button>
              </div>
            </div>
          ) : null}

          <p className="mt-5 text-sm text-white/60 text-center">
            Ako imaš dodatna pitanja, slobodno nas kontaktiraj telefonom.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBackToMenu}
              className="inline-flex items-center justify-center h-12 rounded-full bg-[#f2b400] text-black font-extrabold hover:brightness-110 transition shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
            >
              Nazad na meni
            </motion.button>
          </div>
        </div>

        <AnimatePresence>
          {copied ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="absolute left-1/2 bottom-4 -translate-x-1/2 rounded-full border border-white/10 bg-black/60 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-xl"
              aria-live="polite"
            >
              ID kopiran ✅
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}