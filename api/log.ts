/**
 * api/log.ts — Server-side log sink for client error events.
 *
 * Accepts a batch of ClientLogEvent objects from the browser and writes
 * them to the Vercel Runtime Log via console.error/console.warn so they
 * appear in the Vercel dashboard (Functions → Runtime Logs).
 *
 * No auth required: logs contain no secrets. CORS only limits browsers —
 * anyone can POST here with curl — so every field is size-capped (B25,
 * audit #12): an event is at most ~6 KB of log output, a request at most
 * MAX_EVENTS_PER_REQUEST events. No DB write — console output only.
 *
 * Also the CSP report sink (`report-uri /api/log` in vercel.json): a browser
 * POSTs { "csp-report": { … } } with content-type application/csp-report.
 */

import { applyCors } from "./_shared/cors.js";
import { isPlainObject } from "./_shared/parsing.js";
import { json } from "./_shared/http.js";

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  body?: unknown;
  on?: (event: string, listener: (arg?: unknown) => void) => unknown;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

export type LogLevel = "info" | "warn" | "error";

export type ClientLogEvent = {
  ts: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

const MAX_EVENTS_PER_REQUEST = 20;
const MAX_MESSAGE_CHARS = 2000;
const MAX_CONTEXT_CHARS = 4000;
const MAX_CSP_FIELD_CHARS = 500;

function isLogLevel(v: unknown): v is LogLevel {
  return v === "info" || v === "warn" || v === "error";
}

function normalizeEvent(raw: unknown): ClientLogEvent | null {
  if (!isPlainObject(raw)) return null;

  const ts = typeof raw.ts === "number" && Number.isFinite(raw.ts) ? Math.trunc(raw.ts) : null;
  const level = isLogLevel(raw.level) ? raw.level : null;
  const message = typeof raw.message === "string" ? raw.message.slice(0, MAX_MESSAGE_CHARS) : null;

  if (ts === null || level === null || message === null) return null;

  return { ts, level, message, ...cappedContext(raw.context) };
}

function cappedContext(raw: unknown): { context?: Record<string, unknown> } {
  if (!isPlainObject(raw)) return {};
  let text: string;
  try {
    text = JSON.stringify(raw);
  } catch {
    return {};
  }
  if (text.length <= MAX_CONTEXT_CHARS) return { context: raw as Record<string, unknown> };
  return { context: { truncated: true, preview: text.slice(0, MAX_CONTEXT_CHARS) } };
}

/** A CSP violation report, reduced to the fields worth reading, each capped. */
function cspReportFrom(body: Record<string, unknown>): Record<string, string> | null {
  const report = body["csp-report"];
  if (!isPlainObject(report)) return null;
  const pick = (k: string) => (typeof report[k] === "string" ? (report[k] as string).slice(0, MAX_CSP_FIELD_CHARS) : "");
  return {
    documentUri: pick("document-uri"),
    violatedDirective: pick("violated-directive") || pick("effective-directive"),
    blockedUri: pick("blocked-uri"),
    sourceFile: pick("source-file"),
    disposition: pick("disposition"),
  };
}

function parseBody(req: ReqLike): unknown {
  // application/csp-report is not parsed as JSON by the runtime: it arrives as
  // a string or a Buffer (which isPlainObject would accept as an object).
  const text = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
  if (isPlainObject(text)) return text;

  if (typeof text === "string") {
    if (text.length > MAX_BODY_BYTES) return null;
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  }

  return null;
}

function emitEvent(evt: ClientLogEvent): void {
  const ts = new Date(evt.ts).toISOString();
  const payload = {
    source: "client",
    ts,
    level: evt.level,
    message: evt.message,
    ...(evt.context !== undefined ? { context: evt.context } : {}),
  };

  if (evt.level === "error") {
    console.error("[client-log]", JSON.stringify(payload));
  } else if (evt.level === "warn") {
    console.warn("[client-log]", JSON.stringify(payload));
  } else {
    console.log("[client-log]", JSON.stringify(payload));
  }
}

const MAX_BODY_BYTES = 64 * 1024;

function isCspReportRequest(req: ReqLike): boolean {
  const raw = req.headers?.["content-type"];
  const type = (Array.isArray(raw) ? raw[0] : raw ?? "").toLowerCase();
  return type.includes("csp-report") || type.includes("reports+json");
}

/**
 * The runtime parses req.body only for JSON / text / form / octet-stream, so a
 * CSP report (application/csp-report) is read from the request stream — the
 * same way api/bankart-callback.ts reads its raw body. Capped at 64 KB.
 */
async function readRawBody(req: ReqLike): Promise<string | null> {
  if (typeof req.on !== "function") return null;
  return await new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on?.("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += buf.length;
      if (size <= MAX_BODY_BYTES) chunks.push(buf);
    });
    req.on?.("end", () => resolve(size > MAX_BODY_BYTES ? null : Buffer.concat(chunks).toString("utf8")));
    req.on?.("error", () => resolve(null));
  });
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "POST" });

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = isCspReportRequest(req) && req.body === undefined
    ? parseBody({ body: (await readRawBody(req)) ?? undefined })
    : parseBody(req);
  if (!isPlainObject(body)) {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const csp = cspReportFrom(body);
  if (csp) {
    console.warn("[csp-report]", JSON.stringify(csp));
    return json(res, 200, { ok: true, received: 1 });
  }

  const rawEvents = Array.isArray(body.events) ? body.events : [];
  const capped = rawEvents.slice(0, MAX_EVENTS_PER_REQUEST);
  const valid: ClientLogEvent[] = [];

  for (const raw of capped) {
    const evt = normalizeEvent(raw);
    if (evt !== null) valid.push(evt);
  }

  for (const evt of valid) {
    emitEvent(evt);
  }

  return json(res, 200, { ok: true, received: valid.length });
}
