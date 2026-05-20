export interface BillingFieldsProps {
  paymentJsRequested: boolean;
  billingCity: string;
  billingPostcode: string;
  onBillingCityChange: (value: string) => void;
  onBillingPostcodeChange: (value: string) => void;
  billingCityError: string | null;
  billingPostcodeError: string | null;
}

export default function BillingFields(props: BillingFieldsProps) {
  if (!props.paymentJsRequested) return null;

  return (
    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-extrabold text-white/90">Podaci za naplatu</div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/45">Billing</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-white/80">Grad</label>
          <input
            value={props.billingCity}
            onChange={(e) => props.onBillingCityChange(e.target.value)}
            className={[
              "p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
              props.billingCityError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
            ].join(" ")}
            placeholder="Budva"
          />
          {props.billingCityError ? <div className="mt-1 text-xs font-medium text-red-300">{props.billingCityError}</div> : null}
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-white/80">Poštanski broj</label>
          <input
            value={props.billingPostcode}
            onChange={(e) => props.onBillingPostcodeChange(e.target.value)}
            inputMode="numeric"
            className={[
              "p-input border border-white/10 bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
              props.billingPostcodeError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
            ].join(" ")}
            placeholder="85310"
          />
          {props.billingPostcodeError ? <div className="mt-1 text-xs font-medium text-red-300">{props.billingPostcodeError}</div> : null}
        </div>
      </div>
    </div>
  );
}
