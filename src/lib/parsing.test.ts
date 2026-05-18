import { describe, expect, it } from "vitest";
import { isRecord, isPlainObject, safeString, normalizeText } from "./parsing";

describe("isRecord", () => {
  it("returns true for plain objects", () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord({ a: 1 })).toBe(true);
  });

  it("returns true for arrays (Variant A — arrays pass)", () => {
    expect(isRecord([])).toBe(true);
    expect(isRecord([1, 2, 3])).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isRecord(42)).toBe(false);
    expect(isRecord("string")).toBe(false);
    expect(isRecord(true)).toBe(false);
    expect(isRecord(undefined)).toBe(false);
  });
});

describe("isPlainObject", () => {
  it("returns true for plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });

  it("returns false for arrays (Variant B — arrays rejected)", () => {
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2, 3])).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPlainObject(null)).toBe(false);
  });

  it("returns false for primitives", () => {
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject("string")).toBe(false);
    expect(isPlainObject(true)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
  });
});

describe("safeString", () => {
  it("trims string values", () => {
    expect(safeString("  hello  ")).toBe("hello");
    expect(safeString("abc")).toBe("abc");
  });

  it("returns empty string for null/undefined", () => {
    expect(safeString(null)).toBe("");
    expect(safeString(undefined)).toBe("");
  });

  it("converts numbers to string", () => {
    expect(safeString(42)).toBe("42");
    expect(safeString(0)).toBe("0");
  });

  it("returns empty string for empty input", () => {
    expect(safeString("")).toBe("");
    expect(safeString("   ")).toBe("");
  });
});

describe("normalizeText", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeText("Čevapi")).toBe("cevapi");
    expect(normalizeText("Ćufte")).toBe("cufte");
    expect(normalizeText("Šargarepa")).toBe("sargarepa");
    expect(normalizeText("Žito")).toBe("zito");
    expect(normalizeText("Đuveč")).toBe("djuvec");
  });

  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
  });

  it("handles null/undefined gracefully", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });

  it("handles non-string input", () => {
    expect(normalizeText(42)).toBe("42");
    expect(normalizeText(true)).toBe("true");
  });

  it("preserves mixed latin content after normalization", () => {
    expect(normalizeText("Pizza QUATTRO")).toBe("pizza quattro");
    expect(normalizeText("Coca-Cola")).toBe("coca-cola");
  });
});
