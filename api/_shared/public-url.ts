// api/_shared/public-url.ts
//
// Shared public-base-URL resolver and Telegram payload builder.
// Consolidates 3 prior copies: api/create-order.ts,
// api/bankart-order-status.ts, api/bankart-callback.ts (B8).
//
// SECURITY (locked, DECISIONS 2026-05-16 + 2026-05-17): bankart-callback
// MUST NOT trust the browser-controlled Origin header when building
// notify_url. trustOriginHeader defaults to FALSE (safe). Browser-facing
// endpoints (create-order, bankart-order-status) pass trustOriginHeader: true.
//
// Signature: DECISIONS-locked resolvePublicBaseUrl(req, …) refined to
// resolvePublicBaseUrl(headers, …) — caller passes req.headers, not the
// whole request. Matches api/_shared/admin-auth.ts pattern; lowers TS
// structural-compat risk under Vercel nodenext. Repo > docs (RULES §SoT).
//
// Self-contained: inlines getEnv / headerString / headerStringCI so the
// callers' local copies (used elsewhere in each handler) stay untouched.

export type HeaderValue = string | string[] | undefined;
export type HeadersLike = Record<string, HeaderValue>;

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function headerString(headers: HeadersLike | undefined, key: string): string {
  const raw = headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function headerStringCI(headers: HeadersLike | undefined, key: string): string {
  return (
    headerString(headers, key) ||
    headerString(headers, key.toLowerCase()) ||
    headerString(headers, key.toUpperCase())
  );
}

export function resolvePublicBaseUrl(
  headers: HeadersLike | undefined,
  opts: { trustOriginHeader?: boolean } = {},
): string {
  const { trustOriginHeader = false } = opts;

  const envSite =
    getEnv("PUBLIC_SITE_URL") ||
    getEnv("SITE_URL") ||
    getEnv("APP_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL");
  if (envSite) return envSite.replace(/\/+$/, "");

  if (trustOriginHeader) {
    const origin = headerStringCI(headers, "origin");
    if (origin) return origin.replace(/\/+$/, "");
  }

  const proto = headerStringCI(headers, "x-forwarded-proto") || "https";
  const host =
    headerStringCI(headers, "x-forwarded-host") || headerStringCI(headers, "host");
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return "https://padrinobudva.com";
}

export function buildTelegramPayload(
  headers: HeadersLike | undefined,
  orderId: string,
  opts: { trustOriginHeader?: boolean } = {},
): { order_id: string; notify_url: string } {
  const url = resolvePublicBaseUrl(headers, opts);
  return { order_id: orderId, notify_url: `${url}/api/telegram-new-order` };
}
