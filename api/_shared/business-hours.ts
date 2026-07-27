/**
 * Shared business-hours gate logic for Vercel serverless handlers (api/**).
 * Mirror of src/lib/businessHours.ts (separate build context, same rules —
 * both sides MUST agree on "is it open right now" or client UI and server
 * gate would disagree).
 *
 * Policy: NULL/malformed open or close time => fail-open (always accepts).
 * A misconfigured or unset gate must never block real orders.
 */

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function parseTimeToMinutes(v: unknown): number | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(TIME_RE);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function nowMinutesInPodgorica(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Podgorica",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "");

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return 0;

  // Defensive: some engines format midnight as "24:00" even with hourCycle h23.
  return (hour % 24) * 60 + minute;
}

/**
 * open > close means the window rolls past midnight (e.g. 12:00-00:00,
 * 12:00-02:00). open === close is treated as "always open" (24h) — same
 * fail-open bias as an unconfigured gate, not a "closed all day" reading.
 */
export function isWithinBusinessHours(
  openTime: unknown,
  closeTime: unknown,
  nowMinutes: number,
): boolean {
  const open = parseTimeToMinutes(openTime);
  const close = parseTimeToMinutes(closeTime);

  if (open === null || close === null) return true;
  if (open === close) return true;
  if (open < close) return nowMinutes >= open && nowMinutes < close;

  return nowMinutes >= open || nowMinutes < close;
}

function formatClock(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hh = String(h).padStart(2, "0");
  return m === 0 ? hh : `${hh}:${String(m).padStart(2, "0")}`;
}

/** Derives the public display label (e.g. "12–00") from open/close times. */
export function formatHoursLabel(openTime: unknown, closeTime: unknown): string {
  const open = parseTimeToMinutes(openTime);
  const close = parseTimeToMinutes(closeTime);
  if (open === null || close === null) return "";
  return `${formatClock(open)}–${formatClock(close)}`;
}
