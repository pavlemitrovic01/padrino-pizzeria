// api/_shared/public-url.ts
//
// Shared public-base-URL resolver (the Bankart return/callback URLs).
// Consolidates 3 prior copies: api/create-order.ts,
// api/bankart-order-status.ts, api/bankart-callback.ts (B8).
//
// SECURITY (B22, docs/full-audit-2026-10.md #5): the Origin header is NEVER
// used. It is fully client-controlled (curl sets anything), and the result
// became the URL the server POSTed to with x-telegram-secret (that self-call
// is gone since B24) and the Bankart callback/return URLs — trusting it leaked
// the secret to any origin.
// x-forwarded-host / x-forwarded-proto are ignored for the same reason.
// Order: env (PUBLIC_SITE_URL|SITE_URL|APP_URL|NEXT_PUBLIC_SITE_URL) → Host
// header (Vercel only routes a request here when Host is one of this
// project's domains) → DEFAULT_PUBLIC_HOST. Production must set
// PUBLIC_SITE_URL, so prod never reaches the Host fallback (LESSONS L2).
//
// Signature: resolvePublicBaseUrl(headers) — caller passes req.headers, not
// the whole request. Matches api/_shared/admin-auth.ts pattern; lowers TS
// structural-compat risk under Vercel nodenext.
//
// Self-contained: inlines getEnv / headerString / headerStringCI so the
// callers' local copies (used elsewhere in each handler) stay untouched.

import { DEFAULT_PUBLIC_HOST } from "./config.js";

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

// Hostname with an optional port; anything else (scheme, path, spaces,
// userinfo) is rejected so a malformed Host can never shape the URL.
const HOST_PATTERN = /^[a-z0-9.-]+(:\d{1,5})?$/i;

export function resolvePublicBaseUrl(headers: HeadersLike | undefined): string {
  const envSite =
    getEnv("PUBLIC_SITE_URL") ||
    getEnv("SITE_URL") ||
    getEnv("APP_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL");
  if (envSite) return envSite.replace(/\/+$/, "");

  const host = headerStringCI(headers, "host");
  if (host && HOST_PATTERN.test(host)) return `https://${host.toLowerCase()}`;

  return DEFAULT_PUBLIC_HOST;
}
