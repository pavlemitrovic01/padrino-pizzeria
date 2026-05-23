export interface CardFieldsProps {
  // PaymentJS state flags (5)
  paymentJsRequested: boolean;
  paymentJsMissingKey: boolean;
  paymentJsLoading: boolean;
  paymentJsInitError: string | null;
  paymentJsStateError: string | null;
  // Form values (4)
  customerEmail: string;
  cardholder: string;
  expMonth: string;
  expYear: string;
  // Form setters (4)
  onCustomerEmailChange: (value: string) => void;
  onCardholderChange: (value: string) => void;
  onExpMonthChange: (value: string) => void;
  onExpYearChange: (value: string) => void;
  // Form errors (4)
  customerEmailError: string | null;
  cardholderError: string | null;
  expMonthError: string | null;
  expYearError: string | null;
  // DOM IDs + CSS (3)
  numberDivId: string;
  cvvDivId: string;
  polishCss: string;
}

export default function CardFields(props: CardFieldsProps) {
  return (
    <div className="mt-4 space-y-4 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_38%,rgba(255,255,255,0.02)_100%)] p-4 shadow-[0_24px_56px_rgba(0,0,0,0.22)] backdrop-blur-xl">
      <div className="rounded-2xl border border-white/10 bg-black/15 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-white/85">
            <span className="mr-1.5" aria-hidden="true">🔒</span>
            Plaćanje kroz Bankart — sigurno i šifrovano
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {["VISA", "Mastercard", "Maestro"].map((label) => (
              <span
                key={label}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/70"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {props.paymentJsRequested ? (
        <>
          <style>{props.polishCss}</style>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Email</label>
              <input
                value={props.customerEmail}
                onChange={(e) => props.onCustomerEmailChange(e.target.value)}
                type="email"
                autoComplete="email"
                className={[
                  "p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                  props.customerEmailError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
                ].join(" ")}
                placeholder="npr. ime@domen.com"
              />
              {props.customerEmailError ? <div className="mt-1 text-xs font-medium text-red-300">{props.customerEmailError}</div> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Vlasnik kartice</label>
              <input
                value={props.cardholder}
                onChange={(e) => props.onCardholderChange(e.target.value)}
                autoComplete="cc-name"
                className={[
                  "p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                  props.cardholderError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
                ].join(" ")}
                placeholder="Ime i prezime sa kartice"
              />
              {props.cardholderError ? <div className="mt-1 text-xs font-medium text-red-300">{props.cardholderError}</div> : null}
            </div>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="mb-3 text-sm font-extrabold text-white/90">Detalji kartice</div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Broj kartice</label>
              <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[#f2b400]/40 focus-within:ring-2 focus-within:ring-[#f2b400]/20">
                <div id={props.numberDivId} className="w-full" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_140px]">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">Mesec</label>
                <input
                  value={props.expMonth}
                  onChange={(e) => props.onExpMonthChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                  inputMode="numeric"
                  autoComplete="cc-exp-month"
                  className={[
                    "p-input border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                    props.expMonthError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
                  ].join(" ")}
                  placeholder="MM"
                />
                {props.expMonthError ? <div className="mt-1 text-xs font-medium text-red-300">{props.expMonthError}</div> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">Godina</label>
                <input
                  value={props.expYear}
                  onChange={(e) => props.onExpYearChange(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                  inputMode="numeric"
                  autoComplete="cc-exp-year"
                  className={[
                    "p-input border border-white/10 bg-black/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
                    props.expYearError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
                  ].join(" ")}
                  placeholder="YY ili YYYY"
                />
                {props.expYearError ? <div className="mt-1 text-xs font-medium text-red-300">{props.expYearError}</div> : null}
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white/80">CVV</label>
                <div className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition focus-within:border-[#f2b400]/40 focus-within:ring-2 focus-within:ring-[#f2b400]/20">
                  <div id={props.cvvDivId} className="w-full" />
                </div>
              </div>
            </div>
          </div>

          {props.paymentJsLoading ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">Učitavam sigurna Bankart polja…</div> : null}
          {props.paymentJsInitError ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{props.paymentJsInitError}</div> : null}
          {props.paymentJsStateError && !props.paymentJsInitError ? <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{props.paymentJsStateError}</div> : null}
        </>
      ) : null}
    </div>
  );
}
