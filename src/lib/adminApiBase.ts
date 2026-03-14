/**
 * Admin API base URL for browser-side admin fetches.
 * - Dev: full origin (https://padrinobudva.com) for CORS when frontend runs on localhost
 * - Prod: "" (relative, same origin)
 */
export function getAdminApiBase(): string {
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.DEV === true;

  return isDev ? "https://padrinobudva.com" : "";
}
