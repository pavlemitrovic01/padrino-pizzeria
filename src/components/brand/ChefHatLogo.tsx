import { useState } from "react";

type ChefHatLogoProps = {
  className?: string;
  alt?: string;
};

const WEBP_SRC = "/logo/chef-hat-stroke.webp";
const PNG_SRC = "/logo/chef-hat-stroke.png";

export default function ChefHatLogo({ className, alt = "Padrino" }: ChefHatLogoProps) {
  const [imgOk, setImgOk] = useState(true);
  const [src, setSrc] = useState<string>(WEBP_SRC);

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
        // Sizing dolazi isključivo iz className override-a (npr. Navbar
        // pass-uje h-16 sm:h-20 w-auto). Bez baseline-a → nema Tailwind
        // class conflict-a.
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
        decoding="async"
        onError={() => {
          // 1) Ako webp ne postoji / fail-uje → probaj png
          if (src === WEBP_SRC) {
            setSrc(PNG_SRC);
            return;
          }
          // 2) Ako i png fail-uje → tekst fallback
          setImgOk(false);
        }}
        className="h-full w-auto object-contain block select-none"
      />
    </div>
  );
}
