import { useState } from "react";

type ChefHatLogoProps = {
  className?: string;
  alt?: string;
};

export default function ChefHatLogo({ className, alt = "Padrino" }: ChefHatLogoProps) {
  const [imgOk, setImgOk] = useState(true);

  const src = "/logo/chef-hat-stroke.png";

  if (!imgOk) {
    return (
      <span
        className={[
          "text-white font-extrabold tracking-wide select-none",
          "leading-none",
          className ?? "",
        ].join(" ")}
      >
        PADRINO
      </span>
    );
  }

  return (
    <div
      className={[
        // ✅ logo "slot" u navbaru
        "h-16 w-[210px] sm:w-[240px]",
        // ✅ crop ali poravnaj ULEVO (ne centar)
        "overflow-hidden",
        "flex items-center justify-start",
        "leading-none",
        className ?? "",
      ].join(" ")}
      aria-label={alt}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        onError={() => setImgOk(false)}
        className={[
          // ✅ manje uvećanje da stane ceo znak
          "h-[170px] w-auto object-contain",
          // ✅ pomeri malko nadole da lepo sedne u navbar
          "translate-y-[8px]",
          // ✅ povuci još ulevo da vizuelno “upadne” u levu zonu
          "-translate-x-[14px]",
          "block select-none",
        ].join(" ")}
      />
    </div>
  );
}
