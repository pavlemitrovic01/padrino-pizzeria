/**
 * Jedan izvor istine za API base.
 *
 * Stabilno ponašanje:
 * - Produkcija (Vercel): koristi relativno "/api"
 * - Dev (localhost): koristi ENV ako postoji, inače fallback na Vercel prod domen
 *
 * ENV:
 * - VITE_API_BASE_URL (npr. "https://padrino-pizzeria.vercel.app/api")
 */
export function getApiBase(): string {
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.DEV === true;

  if (!isDev) return "/api";

  const envBase = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";
  const trimmed = envBase.trim();

  if (trimmed.length > 0) return trimmed;

  // Fallback (radi odmah i bez env-a)
  return "https://padrino-pizzeria.vercel.app/api";
}
