/**
 * Env-driven CORS allowlist for api/ handlers.
 *
 * Usage:
 *   applyCors(req, res, { methods: "POST" });
 *   applyCors(req, res, { methods: "POST", allowHeaders: "content-type, x-my-header" });
 *
 * Reads process.env.ALLOWED_ORIGINS (comma-separated list of exact Origin values).
 * Preview deploys: if VERCEL_ENV==="preview" and VERCEL_URL is set, that origin
 * is added automatically (Vercel injects VERCEL_URL per deployment).
 *
 * Security contract: if Origin is absent or not in allowlist, Access-Control-Allow-Origin
 * is NOT set — the browser's CORS check will block the request.
 * Vary: Origin is always set so caches don't serve a CORS response to the wrong origin.
 */

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

export type ReqLike = {
  headers?: HeadersLike;
};

export type ResLike = {
  setHeader: (name: string, value: string) => void;
};

export type ApplyCorsOpts = {
  /** HTTP methods to advertise (OPTIONS is always appended). E.g. "POST" or "GET, POST" */
  methods: string;
  /** Override Allow-Headers. Defaults to "content-type, x-requested-with" */
  allowHeaders?: string;
};

const DEFAULT_ALLOW_HEADERS = "content-type, x-requested-with";

function headerValue(req: ReqLike, name: string): string {
  const headers = req.headers ?? ({} as HeadersLike);
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) {
      const v = headers[key];
      if (typeof v === "string") return v.trim();
      if (Array.isArray(v) && typeof v[0] === "string") return v[0].trim();
    }
  }
  return "";
}

export function parseAllowedOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

function buildRuntimeAllowlist(): string[] {
  const list = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL) {
    const previewOrigin = `https://${process.env.VERCEL_URL}`;
    if (!list.includes(previewOrigin)) list.push(previewOrigin);
  }
  return list;
}

export function applyCors(req: ReqLike, res: ResLike, opts: ApplyCorsOpts): void {
  const origin = headerValue(req, "origin");
  const allowlist = buildRuntimeAllowlist();
  if (origin && allowlist.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", `${opts.methods}, OPTIONS`);
  res.setHeader(
    "Access-Control-Allow-Headers",
    opts.allowHeaders ?? DEFAULT_ALLOW_HEADERS,
  );
  res.setHeader("Access-Control-Max-Age", "86400");
}
