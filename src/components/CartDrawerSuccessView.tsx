import type { PaymentMethod } from "../context/CartContext";
import { formatEUR } from "../lib/money";
import { formatFeeEurShort } from "../lib/cartDrawerHelpers";
import type { BankartOrderPaymentStatus } from "../lib/bankartReturnStorage";

type SuccessSummary = {
  totalCents: number;
  zoneLabel: string;
  feeCents: number;
};

function paymentLabel(m: PaymentMethod) {
  return m === "card" ? "kartica" : "gotovina";
}

type CartDrawerSuccessViewProps = {
  title: string;
  subtitle: string;
  statusNote: string | null;
  orderId: string | null;
  copied: boolean;
  checking: boolean;
  paymentMethod: PaymentMethod;
  paymentStatus: BankartOrderPaymentStatus;
  summary: SuccessSummary | null;
  onClose: () => void;
  onGoToMenu: () => void;
  onCopyOrderId: () => void;
};

export function CartDrawerSuccessView({
  title,
  subtitle,
  statusNote,
  orderId,
  copied,
  checking,
  paymentMethod,
  paymentStatus,
  summary,
  onClose,
  onGoToMenu,
  onCopyOrderId,
}: CartDrawerSuccessViewProps) {
  return (
    <div className="mt-5 p-glass p-5 p-glass-hover relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-[#f2b400]/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#f2b400]/10 blur-3xl" />

      <button
        type="button"
        onClick={onClose}
        aria-label="Zatvori"
        className="absolute right-4 top-4 z-10 h-10 w-10 rounded-full border border-[#f2b400]/25 bg-black/35 text-[#f2b400] hover:bg-black/45 hover:border-[#f2b400]/35 transition flex items-center justify-center"
      >
        <span className="text-[18px] leading-none">×</span>
      </button>

      <div className="flex justify-center">
        <div className="relative mt-1 mb-4">
          <div className="absolute inset-0 rounded-full bg-[#f2b400]/35 blur-xl" aria-hidden="true" />
          <div className="relative h-16 w-16 rounded-full bg-[#f2b400]/20 ring-1 ring-[#f2b400]/35 flex items-center justify-center">
            <div className="h-12 w-12 rounded-full bg-[#f2b400] text-black flex items-center justify-center shadow-[0_18px_60px_rgba(242,180,0,0.25)]">
              {checking ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-[2.5px] border-black/30 border-t-black" />
              ) : paymentMethod === "card" && paymentStatus !== "paid" ? (
                <span className="text-[24px] font-black leading-none">!</span>
              ) : (
                <span className="text-[26px] font-black leading-none">✓</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="text-white/95 font-extrabold text-[22px] text-center leading-tight">{title}</p>
      <div className="mt-1 text-sm font-semibold text-white/70 text-center">{subtitle}</div>

      {statusNote ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-center text-sm text-white/75">
          {statusNote}
        </div>
      ) : null}

      {orderId ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/70">ID porudžbine:</div>

            <div className="min-w-0 flex items-center gap-2">
              <div className="truncate font-mono text-[12px] text-white/85">{orderId}</div>

              <button
                type="button"
                onClick={onCopyOrderId}
                className="shrink-0 h-8 w-8 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center"
                aria-label="Kopiraj ID porudžbine"
                title="Kopiraj"
              >
                {copied ? (
                  <span className="text-[14px] text-[#f2b400] font-black">✓</span>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-white/80">
                    <path
                      d="M9 9V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M13 15v3a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/65 text-center">Porudžbina je evidentirana.</p>
      )}

      {summary ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/70">Ukupno</div>
            <div className="text-sm font-extrabold text-white/90">{formatEUR(summary.totalCents)}</div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/70">Zona</div>
            <div className="text-sm font-extrabold text-white/85">{summary.zoneLabel}</div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="text-xs font-semibold text-white/70">Dostava</div>
            <div className="text-sm font-extrabold text-white/85">{formatFeeEurShort(summary.feeCents)}</div>
          </div>

          <div className="mt-3 h-px bg-white/10" />
          <div className="mt-3 text-xs text-white/65">Plaćanje: {paymentLabel(paymentMethod)}</div>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3">
        <button
          onClick={onGoToMenu}
          className="w-full h-12 text-sm font-extrabold rounded-full bg-[#f2b400] text-black hover:brightness-110 shadow-[0_0_0px_rgba(242,180,0,0.35)] hover:shadow-[0_0_35px_rgba(242,180,0,0.55)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 ease-out disabled:opacity-50 disabled:hover:scale-100"
        >
          Nazad na meni
        </button>

        <button
          type="button"
          onClick={onClose}
          className="w-full h-12 text-sm font-extrabold rounded-full border border-white/10 bg-white/5 hover:bg-white/10 text-white/85 transition"
        >
          Zatvori
        </button>
      </div>
    </div>
  );
}
