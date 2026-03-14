import { useCallback, useEffect, useState } from "react";
import { FOOTER_ADDRESS_FALLBACK, toStr } from "../lib/publicBusinessSettings";
import { supabase } from "../lib/supabaseClient";

const PAYMENT_BADGES = [
  { label: "Bankart", accent: "gold" as const },
  { label: "VISA", accent: "light" as const },
  { label: "Mastercard", accent: "light" as const },
  { label: "Maestro", accent: "light" as const },
];

function scrollToTop() {
  const hero = document.getElementById("top");
  if (hero) {
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function PaymentBadge({
  label,
  accent,
}: {
  label: string;
  accent: "gold" | "light";
}) {
  const className =
    accent === "gold"
      ? "border-[#f2b400]/30 bg-[#f2b400]/10 text-[#f2b400]/90"
      : "border-white/10 bg-white/5 text-white/78";

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em]",
        className,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export default function Footer() {
  const [addressLine, setAddressLine] = useState(FOOTER_ADDRESS_FALLBACK);

  const onTop = useCallback(() => {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    scrollToTop();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const { data, error } = await supabase
        .from("site_settings")
        .select("id, address_line")
        .eq("id", 1)
        .maybeSingle();

      if (cancelled || error || typeof data !== "object" || data === null || Array.isArray(data)) return;

      const nextAddress = toStr((data as { address_line?: unknown }).address_line);
      if (!nextAddress) return;

      setAddressLine(nextAddress);
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <footer className="relative overflow-hidden border-t border-white/10 bg-black text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(242,180,0,0.12),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_24%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 pb-8 pt-10 sm:px-8 lg:pt-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-end">
          <div className="space-y-4">
            <div className="p-kicker">Padrino Budva</div>

            <div className="max-w-xl">
              <h3 className="text-2xl font-extrabold tracking-tight text-white/94 sm:text-3xl">
                Dobra pizza, sigurna porudžbina i jasan put do nas.
              </h3>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/64 sm:text-[15px]">
                Poručivanje, preuzimanje i online plaćanje su sada objedinjeni u jednom
                čistom iskustvu — bez viška koraka i bez komplikacija.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <a
              href="/faq"
              className="inline-flex min-w-[132px] items-center justify-center rounded-2xl border border-white/12 bg-white/5 px-4 py-3 text-sm font-extrabold text-white/86 transition hover:border-white/20 hover:bg-white/8"
              aria-label="Česta pitanja"
              title="Česta pitanja"
            >
              Česta pitanja
            </a>

            <button
              type="button"
              onClick={onTop}
              className="inline-flex min-w-[132px] items-center justify-center rounded-2xl bg-[#f2b400] px-4 py-3 text-sm font-extrabold text-black shadow-[0_18px_55px_rgba(242,180,0,0.20)] transition hover:brightness-105"
              aria-label="Nazad na vrh"
              title="Nazad na vrh"
            >
              Nazad na vrh
            </button>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.40)] backdrop-blur-md sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-md">
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/46">
                Bezbedno online plaćanje
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
              {PAYMENT_BADGES.map((badge) => (
                <PaymentBadge key={badge.label} label={badge.label} accent={badge.accent} />
              ))}
              <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/52">
                gotovina
              </span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-white/44">© 2026 Padrino Pizzeria Budva</div>
          <div className="text-white/36">{addressLine}</div>
          <div className="uppercase tracking-[0.26em] text-white/34">Since 2021</div>
        </div>
      </div>
    </footer>
  );
}