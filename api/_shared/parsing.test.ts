import { describe, expect, it } from "vitest";
import { isPlainObject, normalizeText, safeInt, safeNumber } from "./parsing";

describe("isPlainObject", () => {
  it("accepts plain objects", () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
  });
  it("rejects null / undefined / primitives / arrays", () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject(0)).toBe(false);
    expect(isPlainObject("")).toBe(false);
    expect(isPlainObject(false)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject([1, 2])).toBe(false);
  });
});

describe("normalizeText", () => {
  it("lowercases + strips Serbian diacritics", () => {
    expect(normalizeText("Čokolada Šećer Žaba Ćuprija Đak")).toBe(
      "cokolada secer zaba cuprija djak",
    );
  });
  it("collapses whitespace and trims", () => {
    expect(normalizeText("  hello   world  ")).toBe("hello world");
    expect(normalizeText("a\t\nb")).toBe("a b");
  });
  it("coerces null/undefined/non-string to empty-prefixed string", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
    expect(normalizeText(42)).toBe("42");
  });
});

describe("safeInt", () => {
  it("returns truncated integer for finite numbers and numeric strings", () => {
    expect(safeInt(5)).toBe(5);
    expect(safeInt(5.9)).toBe(5);
    expect(safeInt(-3.2)).toBe(-3);
    expect(safeInt("7")).toBe(7);
    expect(safeInt("7.4")).toBe(7);
  });
  it("returns fallback (default 0) for non-finite inputs", () => {
    expect(safeInt(undefined)).toBe(0);
    expect(safeInt(null)).toBe(0);
    expect(safeInt("not a number")).toBe(0);
    expect(safeInt(Number.NaN)).toBe(0);
    expect(safeInt(Number.POSITIVE_INFINITY)).toBe(0);
    expect(safeInt({})).toBe(0);
  });
  it("honors explicit fallback", () => {
    expect(safeInt(undefined, 99)).toBe(99);
    expect(safeInt("bad", -1)).toBe(-1);
  });
});

describe("safeNumber", () => {
  it("returns finite numbers and parses numeric strings", () => {
    expect(safeNumber(5)).toBe(5);
    expect(safeNumber(5.5)).toBe(5.5);
    expect(safeNumber("7.25")).toBe(7.25);
    expect(safeNumber("-3")).toBe(-3);
  });
  it("returns fallback NaN by default for non-finite inputs", () => {
    expect(Number.isNaN(safeNumber(undefined))).toBe(true);
    expect(Number.isNaN(safeNumber(null))).toBe(true);
    expect(Number.isNaN(safeNumber("xyz"))).toBe(true);
    expect(Number.isNaN(safeNumber(Number.NaN))).toBe(true);
    expect(Number.isNaN(safeNumber(Number.POSITIVE_INFINITY))).toBe(true);
  });
  it("honors explicit fallback (incl. 0 opt-in)", () => {
    expect(safeNumber(undefined, 0)).toBe(0);
    expect(safeNumber("bad", 300)).toBe(300);
    expect(safeNumber(null, -1)).toBe(-1);
  });
});
