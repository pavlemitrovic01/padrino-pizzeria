/**
 * api/log.ts — Server-side log sink for client error events.
 *
 * Accepts a batch of ClientLogEvent objects from the browser and writes
 * them to the Vercel Runtime Log via console.error/console.warn so they
 * appear in the Vercel dashboard (Functions → Runtime Logs).
 *
 * No auth required: logs contain no secrets and CORS origin-allowlist
 * limits browser-side callers to the configured ALLOWED_ORIGINS.
 * No DB write — console output only.
 */

import { applyCors } from "./_shared/cors.js";
import { isPlainObject } from "./_shared/parsing.js";

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  body?: unknown;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

type Json = Record<string, unknown>;

export type LogLevel = "info" | "warn" | "error";

export type ClientLogEvent = {
  ts: number;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

const MAX_EVENTS_PER_REQUEST = 20;

function json(res: ResLike, status: number, body: Json) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

function isLogLevel(v: unknown): v is LogLevel {
  return v === "info" || v === "warn" || v === "error";
}

function normalizeEvent(raw: unknown): ClientLogEvent | null {
  if (!isPlainObject(raw)) return null;

  const ts = typeof raw.ts === "number" && Number.isFinite(raw.ts) ? Math.trunc(raw.ts) : null;
  const level = isLogLevel(raw.level) ? raw.level : null;
  const message = typeof raw.message === "string" ? raw.message.slice(0, 2000) : null;

  if (ts === null || level === null || message === null) return null;

  const context =
    isPlainObject(raw.context) ? (raw.context as Record<string, unknown>) : undefined;

  return { ts, level, message, ...(context !== undefined ? { context } : {}) };
}

function parseBody(req: ReqLike): unknown {
  if (isPlainObject(req.body)) return req.body;

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as unknown;
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

export default function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "POST" });

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const body = parseBody(req);
  if (!isPlainObject(body)) {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
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
