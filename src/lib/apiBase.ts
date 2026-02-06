/**
 * Jedan izvor istine za API base.
 *
 * Cilj (stabilizacija > feature):
 * - U produkciji (Vercel): koristi relativno "/api" (isto porijeklo)
 * - U dev (localhost): koristi Vercel domen da Vite ne baca 404 za /api/*
 *
 * Nema nagađanja, nema CORS preflight-a: gađamo HTTPS Vercel endpoint.
 */
export function getApiBase(): string {
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.DEV === true;

  if (!isDev) return "/api";

  // Dev: direktno Vercel prod domen (jedan izvor istine)
  // Ako promijeniš domen u budućnosti, mijenja se samo ovdje.
  return "https://padrino-pizzeria.vercel.app/api";
}
