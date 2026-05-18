/**
 * Shared parsing utilities — canonical source of truth for src/.
 * NO safeInt here — ≥3 divergent semantics exist; canonical = src/lib/money.ts toSafeInt.
 *
 * isRecord:      typeof object && !== null (arrays pass — Variant A)
 * isPlainObject: typeof object && !== null && !Array.isArray (Variant B)
 * safeString:    trims, falls back to "" for null/undefined
 * normalizeText: lowercases + strips diacritics + collapses whitespace
 */

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

export function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}
