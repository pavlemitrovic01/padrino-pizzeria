import { useEffect, useState } from "react";
import { FaMoneyBill1Wave } from "react-icons/fa6";
import { FOOTER_ADDRESS_FALLBACK, toStr } from "../lib/publicBusinessSettings";
import { supabase } from "../lib/supabaseClient";

const NAV_LINKS = [
  { label: "Meni", href: "#meni" },
  { label: "O nama", href: "#o-nama" },
  { label: "Dostava", href: "#dostava" },
  { label: "Kontakt", href: "#kontakt" },
  { label: "FAQ", href: "/faq" },
];

const PAYMENT_LOGOS = [
  { label: "Visa", src: "/payments/visa.webp" },
  { label: "Mastercard", src: "/payments/mastercard.webp" },
  { label: "NLB Banka", src: "/payments/nlb.webp" },
  { label: "Bankart", src: "/payments/bankart.webp" },
];

export default function Footer() {
  const [addressLine, setAddressLine] = useState(FOOTER_ADDRESS_FALLBACK);

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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent" />

      <div className="relative mx-auto max-w-3xl px-6 pb-8 pt-12 sm:px-8 text-center">

        {/* Kicker */}
        <div className="p-kicker mb-6">Padrino Budva</div>

        {/* Serif tagline */}
        <p className="p-serif text-2xl sm:text-3xl xl:text-4xl font-medium italic text-white/72 leading-snug">
          Tijesto sa ljubavlju, od 2021.
        </p>

        {/* Quick nav */}
        <nav
          aria-label="Footer navigacija"
          className="mt-8 flex flex-wrap items-center justify-center gap-y-2 text-sm text-white/50"
        >
          {NAV_LINKS.map((link, i) => (
            <span key={link.label} className="inline-flex items-center">
              <a
                href={link.href}
                className="px-2 transition duration-200 hover:text-white"
              >
                {link.label}
              </a>
              {i < NAV_LINKS.length - 1 && (
                <span className="text-white/25 select-none" aria-hidden="true">·</span>
              )}
            </span>
          ))}
        </nav>

        {/* Payment row */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {PAYMENT_LOGOS.map((logo) => (
            <img
              key={logo.label}
              src={logo.src}
              alt={logo.label}
              draggable={false}
              className="h-8 sm:h-9 w-auto rounded-md object-contain"
            />
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#f2b400]/20 bg-[#f2b400]/10 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#f2b400]/80">
            <FaMoneyBill1Wave size={13} />
            Gotovina
          </span>
        </div>

        {/* Bottom row */}
        <div className="mt-10 flex flex-col gap-2 border-t border-white/10 pt-5 text-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="text-white/44">© 2026 Padrino Pizzeria Budva</div>
          <div className="text-white/36">{addressLine}</div>
        </div>

      </div>
    </footer>
  );
}
