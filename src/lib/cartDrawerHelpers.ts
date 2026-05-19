import type { PizzaSize } from "../context/CartContext";
import { DEFAULT_BILLING_CITY, DEFAULT_BILLING_POSTCODE } from "./config";
import { normalizeText } from "./parsing";
export { normalizeText };

type SiteSettingsCheckoutDefaults = {
  default_city: string;
  default_postcode: string;
};

export function formatFeeEurShort(cents: number) {
  const n = Number(cents);
  const v = Number.isFinite(n) ? Math.round(n / 100) : 0;
  return `${v}€`;
}

export function envFlagEnabled(value: string | undefined) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function normalizeCategory(value: string) {
  return normalizeText(value);
}

export function toSiteSettingsCheckoutDefaults(value: unknown): SiteSettingsCheckoutDefaults {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const defaultCity = typeof raw.default_city === "string" ? raw.default_city.trim() : "";
  const defaultPostcode = typeof raw.default_postcode === "string" ? raw.default_postcode.trim() : "";

  return {
    default_city: defaultCity || DEFAULT_BILLING_CITY,
    default_postcode: defaultPostcode || DEFAULT_BILLING_POSTCODE,
  };
}

export function isDrinkCategory(category: string) {
  const c = normalizeCategory(category);
  return c.includes("pica") || c.includes("pice") || c.includes("napici") || c.includes("napitci");
}

export function isSauceCategory(category: string) {
  const c = normalizeCategory(category);
  return c === "sosevi" || c === "sosovi" || c === "sos";
}

export function hasEurPrice(row: { price_eur_cents: number | null }) {
  const n =
    typeof row.price_eur_cents === "number" ? row.price_eur_cents : Number(row.price_eur_cents);
  return Number.isFinite(n);
}

export function isSaucesPlaceholder(name: string) {
  const n = normalizeText(name);
  return n === "sosevi" || n === "sosovi" || n === "sos";
}

export function isSauceItemName(name: string) {
  const n = normalizeText(name);
  if (!n) return false;
  if (isSaucesPlaceholder(n)) return false;
  if (n.includes("sos")) return true;

  const keywords = [
    "bbq",
    "barbecue",
    "ketchup",
    "kecap",
    "kečap",
    "majonez",
    "mayonnaise",
    "tartar",
    "tzatziki",
    "beli luk",
    "garlic",
    "ljuti",
    "chili",
    "čili",
    "sriracha",
    "sweet chili",
    "slatko ljuti",
    "pavlaka",
    "pelat",
    "garlik",
  ];

  return keywords.some((k) => n.includes(normalizeText(k)));
}

export function normalizeAddonName(value: string) {
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

export function isStuffedCrustAddonName(addonName: string) {
  const n = normalizeAddonName(addonName);
  if (!n) return false;

  if (n.includes("ivice punjene")) return true;
  if (n.includes("punjene ivice")) return true;
  if (n.includes("ivica punjena")) return true;
  if (n.includes("punjena ivica")) return true;

  if (n === "rub") return true;

  return false;
}

export function stuffedCrustPriceForSize(size: PizzaSize | string | number | null | undefined): number {
  const s = String(size ?? "").toLowerCase();
  return s.includes("50") ? 400 : 200;
}

export function parsePizzaSizeFromName(name: string): PizzaSize | null {
  const t = normalizeText(name);
  if (/\b50\s*cm\b/.test(t)) return "50";
  if (/\b33\s*cm\b/.test(t)) return "33";
  return null;
}

export function stripPizzaSizeFromName(name: string): string {
  return String(name ?? "")
    .replace(/33\s*cm/gi, "")
    .replace(/50\s*cm/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPizzaRow(row: { category?: string; name?: string }): boolean {
  const cat = normalizeCategory(row.category ?? "");
  const nm = normalizeText(row.name ?? "");
  return nm.includes("33 cm") || nm.includes("50 cm") || cat.includes("pizza");
}

export function stripSizeFromAnyName(name: string) {
  return String(name ?? "")
    .replace(/\b(33|50)\s*cm\b/gi, "")
    .replace(/\b(33|50)cm\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export const NAME_TO_FILE: Record<string, string> = {
  // pizze / izuzeci
  "quattro formaggi": "quattro.webp",
  "don pesto": "pesto.webp",
  "don pamidoro": "pomodoro.webp",

  // sosevi
  garlik: "garlik.webp",
  kecap: "kecap.webp",
  "kečap": "kecap.webp",
  majonez: "majonez.webp",
  pelat: "pelat.webp",
  "slatko ljuti": "slatko ljuti.webp",
  "ljuti sos": "ljuti sos.webp",
  bbq: "bbq.webp",

  // dodaci
  krofne: "krofna.webp",
  krofna: "krofna.webp",
  "ivice punjene sirom": "rub.webp",
  "ivice punjene sir": "rub.webp",
  "punjene ivice sirom": "rub.webp",

  // pića
  "coca cola": "coca-cola.webp",
  "coca-cola": "coca-cola.webp",
  "coca cola zero": "coca-zero.webp",
  "coca zero": "coca-zero.webp",
  "coca-cola zero": "coca-zero.webp",
  fanta: "fanta.webp",
  sprite: "sprite.webp",
  heineken: "heineken.webp",
  jabuka: "jabuka.webp",
  narandza: "narandza.webp",
  "naranđa": "narandza.webp",
  knjaz: "knjaz.webp",
  "knjaz milos": "knjaz.webp",
  "knjaz miloš": "knjaz.webp",
  montenegro: "montenegro.webp",

  // spec slučajevi (brend + ukus)
  "bravo jabuka": "jabuka.webp",
  "bravo narandza": "narandza.webp",
  "bravo naranđa": "narandza.webp",
  "knjaz kisela": "knjaz.webp",
  "knjaz kisela voda": "knjaz.webp",
  "rosa voda": "rosa.webp",
  rosa: "rosa.webp",
};

export function buildFileCandidatesFromFilename(file: string): string[] {
  const f = String(file ?? "").trim();
  if (!f) return [];

  const lower = f.toLowerCase();

  const encodedFile = encodeURIComponent(f).replaceAll("%2F", "/");
  const encodedLower = encodeURIComponent(lower).replaceAll("%2F", "/");

  const spaceTo20 = f.replaceAll(" ", "%20");
  const spaceTo20Lower = lower.replaceAll(" ", "%20");

  const uniq = new Set<string>([
    `/menu/${f}`,
    `/menu/${lower}`,
    `/menu/${encodedFile}`,
    `/menu/${encodedLower}`,
    `/menu/${spaceTo20}`,
    `/menu/${spaceTo20Lower}`,
  ]);

  return [...uniq];
}

export function buildFileCandidatesFromName(name: string): string[] {
  const raw = stripSizeFromAnyName(name);

  const cleanedRaw = String(raw ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:l|ml|cl)\b/gi, " ")
    .replace(/\b(0\.?33|0\.?5|0\.?25)\b/gi, " ")
    .replace(/[^a-zA-Z0-9čćšžđČĆŠŽĐ\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const n = normalizeText(cleanedRaw);
  if (!n) return [];

  const direct = NAME_TO_FILE[n] ?? NAME_TO_FILE[n.replaceAll("-", " ")];
  if (direct) return buildFileCandidatesFromFilename(direct);

  if (n.startsWith("bravo ")) {
    const withoutBrand = n.replace(/^bravo\s+/, "");
    const mapped = NAME_TO_FILE[withoutBrand] ?? NAME_TO_FILE[withoutBrand.replaceAll("-", " ")];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  if (n.startsWith("knjaz ")) {
    const mapped = NAME_TO_FILE["knjaz"];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  if (n.startsWith("rosa ")) {
    const mapped = NAME_TO_FILE["rosa voda"] ?? NAME_TO_FILE["rosa"];
    if (mapped) return buildFileCandidatesFromFilename(mapped);
  }

  const withDash = n.replaceAll(" ", "-");
  const withSpace = n;
  const noDash = withDash.replaceAll("-", "");

  const candidates = [`${withDash}.webp`, `${withSpace}.webp`, `${noDash}.webp`];

  const djToD = withDash.replaceAll("dj", "d");
  if (djToD !== withDash) candidates.push(`${djToD}.webp`);

  const uniq = new Set<string>();
  for (const file of candidates) {
    for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }
  return [...uniq];
}

export function buildImageCandidates(image: string | null | undefined, name: string): string[] {
  const uniq = new Set<string>();

  const raw = String(image ?? "").trim();
  if (raw) {
    uniq.add(raw);
    try {
      uniq.add(encodeURI(raw));
    } catch {
      // ignore
    }
  }

  if (raw && !raw.startsWith("/menu/")) {
    const parts = raw.split("/").filter(Boolean);
    const file = parts.length ? parts[parts.length - 1] : "";
    if (file) for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }

  for (const c of buildFileCandidatesFromName(name)) uniq.add(c);

  uniq.add("/menu/padrino.webp");
  uniq.add("/menu/padrino.png");

  return [...uniq];
}
