/**
 * Shared parsing utilities for Vercel serverless handlers (api/**).
 *
 * Mirror of src/lib/parsing.ts but separate build context (Vercel
 * serverless vs Vite). L6 mandates `.js` extension on relative
 * imports in api/** (resolves under both nodenext and Bundler).
 *
 * Surface:
 *   isPlainObject — typeof object && !== null && !Array.isArray
 *   normalizeText — lowercase + strip Serbian diacritics + collapse whitespace
 *   safeInt       — finite-int with Math.trunc, default fallback = 0
 *   safeNumber    — finite-number, default fallback = NaN (caller must opt-in to 0)
 *
 * OUT OF SCOPE (intentional, see DECISIONS 2026-05-19 / F3):
 *   - toSafeInt (admin-menu.ts only, 1 site)
 *   - toTrimmedString (5 sites, name/body divergence from src/ safeString)
 */

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeText(value: unknown): string {
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

export function safeInt(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export function safeNumber(v: unknown, fallback: number = Number.NaN): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : fallback;
}
