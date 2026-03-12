// src/lib/logger.ts
// Padrino — minimal monitoring/logging bez novih biblioteka.
// Fokus: stabilno, TS strict-safe, bez network zavisnosti.
//
// Šta radi:
// - Normalizuje error objekte
// - Loguje u console (dev/prod)
// - Čuva poslednjih N logova u localStorage (ring buffer) za debug na produkciji
// - Omogućava init global handlera (window.onerror + unhandledrejection)

export type LogLevel = "info" | "warn" | "error";

export type ClientLogEvent = {
  ts: number; // epoch ms
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

const STORAGE_KEY = "padrino_client_logs_v1";
const MAX_EVENTS = 80;

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function readBuffer(): ClientLogEvent[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    // Minimalna validacija
    return parsed.filter(
      (e): e is ClientLogEvent =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as ClientLogEvent).ts === "number" &&
        typeof (e as ClientLogEvent).level === "string" &&
        typeof (e as ClientLogEvent).message === "string"
    );
  } catch {
    return [];
  }
}

function writeBuffer(events: ClientLogEvent[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, safeJsonStringify(events));
  } catch {
    // ignore (storage može biti pun / blokiran)
  }
}

function pushEvent(evt: ClientLogEvent) {
  const buf = readBuffer();
  buf.push(evt);
  const trimmed = buf.length > MAX_EVENTS ? buf.slice(buf.length - MAX_EVENTS) : buf;
  writeBuffer(trimmed);
}

export function getClientLogs(): ClientLogEvent[] {
  return readBuffer();
}

export function clearClientLogs() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function normalizeError(err: unknown): { message: string; stack?: string; name?: string } {
  if (err instanceof Error) {
    return { message: err.message || "Error", stack: err.stack, name: err.name };
  }
  if (typeof err === "string") {
    return { message: err };
  }
  // pokušaj da izvučemo nešto smisleno
  try {
    const asAny = err as { message?: unknown; stack?: unknown; name?: unknown };
    const msg =
      typeof asAny?.message === "string"
        ? asAny.message
        : typeof err === "object"
          ? safeJsonStringify(err)
          : String(err);
    return {
      message: msg || "Nepoznata greška",
      stack: typeof asAny?.stack === "string" ? asAny.stack : undefined,
      name: typeof asAny?.name === "string" ? asAny.name : undefined,
    };
  } catch {
    return { message: "Nepoznata greška" };
  }
}

export function log(level: LogLevel, message: string, context?: Record<string, unknown>) {
  const evt: ClientLogEvent = {
    ts: Date.now(),
    level,
    message,
    context,
  };

  // 1) console (svjesno, bez eksternog servisa)
  if (level === "error") console.error(message, context);
  else if (level === "warn") console.warn(message, context);
  else console.log(message, context);

  // 2) localStorage buffer
  pushEvent(evt);
}

export function logError(message: string, err: unknown, context?: Record<string, unknown>) {
  const n = normalizeError(err);
  log("error", message, {
    ...context,
    errorMessage: n.message,
    errorName: n.name,
    errorStack: n.stack,
  });
}

export type MonitoringInitOptions = {
  appTag?: string; // npr "padrino-web"
  version?: string; // npr git sha / build tag
};

let monitoringInitialized = false;

export function initClientMonitoring(opts?: MonitoringInitOptions) {
  if (monitoringInitialized) return;
  monitoringInitialized = true;

  const baseCtx: Record<string, unknown> = {
    appTag: opts?.appTag ?? "padrino-web",
    version: opts?.version ?? "unknown",
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
  };

  // Global JS runtime errors
  window.addEventListener("error", (event) => {
    // event.error je često Error, ali nije garantovano
    logError("window.error", (event as ErrorEvent).error ?? event, {
      ...baseCtx,
      filename: (event as ErrorEvent).filename,
      lineno: (event as ErrorEvent).lineno,
      colno: (event as ErrorEvent).colno,
      message: (event as ErrorEvent).message,
    });
  });

  // Unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    logError("window.unhandledrejection", event.reason, {
      ...baseCtx,
    });
  });

  // Marker da znamo da je monitoring aktivan
  log("info", "Client monitoring initialized", { ...baseCtx });
}
