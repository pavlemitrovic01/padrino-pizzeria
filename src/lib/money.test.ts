import { describe, it, expect } from "vitest";
import { toSafeInt, formatEUR, formatRSD } from "./money";

describe("toSafeInt", () => {
  it("returns number as-is when finite", () => {
    expect(toSafeInt(42)).toBe(42);
    expect(toSafeInt(0)).toBe(0);
    expect(toSafeInt(-10)).toBe(-10);
  });

  it("truncates floats", () => {
    expect(toSafeInt(3.7)).toBe(3);
    expect(toSafeInt(-2.9)).toBe(-2);
  });

  it("returns fallback for NaN", () => {
    expect(toSafeInt(NaN)).toBe(0);
    expect(toSafeInt(NaN, 99)).toBe(99);
  });

  it("returns fallback for Infinity", () => {
    expect(toSafeInt(Infinity)).toBe(0);
    expect(toSafeInt(-Infinity, 5)).toBe(5);
  });

  it("parses string numbers", () => {
    expect(toSafeInt("123")).toBe(123);
    expect(toSafeInt("3.14")).toBe(3);
  });

  it("returns fallback for invalid input", () => {
    expect(toSafeInt("abc")).toBe(0);
    expect(toSafeInt(null)).toBe(0);
    expect(toSafeInt(undefined)).toBe(0);
    expect(toSafeInt({})).toBe(0);
  });
});

describe("formatEUR", () => {
  it("formats cents as EUR", () => {
    expect(formatEUR(100)).toMatch(/1[,.]00/);
    expect(formatEUR(1234)).toMatch(/12[,.]34/);
    expect(formatEUR(0)).toMatch(/0[,.]00/);
  });

  it("handles invalid input with fallback to 0", () => {
    expect(formatEUR(NaN)).toMatch(/0[,.]00/);
    expect(formatEUR("invalid")).toMatch(/0[,.]00/);
  });
});

describe("formatRSD", () => {
  it("formats amount as RSD", () => {
    expect(formatRSD(1000)).toMatch(/1[.\s]?000/);
    expect(formatRSD(0)).toMatch(/0/);
  });

  it("handles invalid input", () => {
    expect(formatRSD(NaN)).toMatch(/0/);
  });
});
