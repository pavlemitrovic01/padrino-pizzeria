import { useCallback } from "react";

const INSTAGRAM_URL = "https://www.instagram.com/padrino_budva/";
const MAPS_URL = "https://maps.app.goo.gl/ouqBC1P8rD62qij99";

function scrollToTop() {
  const hero = document.getElementById("top");
  if (hero) {
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function Footer() {
  const onTop = useCallback(() => {
    // ne diramo window.location.href (immutability friendly)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    scrollToTop();
  }, []);

  return (
    <footer className="bg-black text-white border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 md:grid-cols-3 md:items-center">
          {/* Brand */}
          <div className="space-y-2">
            <div className="text-lg font-extrabold tracking-wide">Padrino Budva</div>
            <div className="text-sm text-white/60">Pizza • Dostava • Kartice</div>
          </div>

          {/* Payment badges (bez dupliranja kontakt info) */}
          <div className="flex flex-wrap items-center gap-2 md:justify-center">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white/75">
              VISA
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white/75">
              MasterCard
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white/75">
              Maestro
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-extrabold text-white/75">
              Gotovina
            </span>
          </div>

          {/* Minimal actions */}
          <div className="flex flex-wrap items-center gap-3 md:justify-end">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-extrabold text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              Instagram
            </a>

            <a
              href={MAPS_URL}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-extrabold text-white/80 hover:text-white hover:bg-white/10 transition"
            >
              Maps
            </a>

            <button
              type="button"
              onClick={onTop}
              className="rounded-2xl bg-[#f2b400] px-4 py-2 text-sm font-extrabold text-black hover:brightness-105 transition"
              aria-label="Nazad na vrh"
              title="Nazad na vrh"
            >
              ↑ Vrh
            </button>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs text-white/45">© 2026 Padrino Pizzeria Budva</div>
          <div className="text-xs text-white/35 tracking-[0.25em] uppercase">Since 2021</div>
        </div>
      </div>
    </footer>
  );
}