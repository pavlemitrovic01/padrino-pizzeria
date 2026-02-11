import { useEffect, useMemo, useState } from "react";

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

function stripDrinkNoise(name: string) {
  return normalizeText(name)
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:l|ml|cl)\b/g, "")
    .replace(/\b(0\.?33|0\.?5|0\.?25)\b/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildCandidates(name: string): string[] {
  const base = stripDrinkNoise(name);
  if (!base) return [];

  const dash = base.replaceAll(" ", "-");
  const nodash = dash.replaceAll("-", "");

  return [
    `/menu/${dash}.webp`,
    `/menu/${base}.webp`,
    `/menu/${nodash}.webp`,
    `/menu/${dash}.png`,
    `/menu/${base}.png`,
  ];
}

export default function SmartMiniAddonImage({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);

  const sources = useMemo(() => {
    return [
      ...buildCandidates(name),
      "/menu/padrino.webp", // ✅ SIGURAN fallback (POSTOJI)
    ];
  }, [name]);

  useEffect(() => {
    setIndex(0);
  }, [name]);

  const src = sources[index];

  return (
    <img
      src={src}
      alt=""
      aria-hidden
      loading="lazy"
      className={className ?? "h-10 w-10 rounded-xl object-cover ring-1 ring-white/10"}
      onError={() => {
        if (index < sources.length - 1) {
          setIndex(index + 1);
        }
      }}
    />
  );
}
