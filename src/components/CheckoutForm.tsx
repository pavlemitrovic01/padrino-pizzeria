export interface CheckoutFormProps {
  name: string;
  phone: string;
  address: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  nameError: string | null;
  phoneError: string | null;
  addressError: string | null;
}

export default function CheckoutForm(props: CheckoutFormProps) {
  return (
    <>
      <div>
        <label className="mb-2 block text-sm font-semibold text-white/80">Ime i prezime</label>
        <input
          value={props.name}
          onChange={(e) => props.onNameChange(e.target.value)}
          className={[
            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
            props.nameError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
          ].join(" ")}
          placeholder="Npr. Petar Petrovic"
          autoComplete="name"
        />
        {props.nameError ? <div className="mt-1 text-xs font-medium text-red-300">{props.nameError}</div> : null}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-semibold text-white/80">Telefon</label>
        <input
          value={props.phone}
          onChange={(e) => props.onPhoneChange(e.target.value)}
          className={[
            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
            props.phoneError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
          ].join(" ")}
          placeholder="+382..."
          autoComplete="tel"
        />
        {props.phoneError ? <div className="mt-1 text-xs font-medium text-red-300">{props.phoneError}</div> : null}
      </div>

      <div className="mt-4">
        <label className="mb-2 block text-sm font-semibold text-white/80">Adresa</label>
        <input
          value={props.address}
          onChange={(e) => props.onAddressChange(e.target.value)}
          className={[
            "p-input border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition",
            props.addressError ? "border-red-500 focus:border-red-500 focus:ring-red-500/20" : "",
          ].join(" ")}
          placeholder="Ulica i broj"
          autoComplete="street-address"
        />
        {props.addressError ? <div className="mt-1 text-xs font-medium text-red-300">{props.addressError}</div> : null}
      </div>
    </>
  );
}
