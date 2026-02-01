// src/lib/money.ts
// Money helpers (EUR cents as integer). Never compute with floats.

export function toSafeInt(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export function formatEUR(cents: unknown): string {
  const v = toSafeInt(cents, 0);
  const amount = v / 100;

  try {
    return new Intl.NumberFormat("sr-Latn-ME", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `€${amount.toFixed(2)}`;
  }
}

export function formatRSD(amount: unknown): string {
  const v = typeof amount === "number" ? amount : Number(amount);
  const safe = Number.isFinite(v) ? v : 0;

  try {
    return new Intl.NumberFormat("sr-Latn-ME", {
      style: "currency",
      currency: "RSD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(safe);
  } catch {
    return `${Math.round(safe)} RSD`;
  }
}
