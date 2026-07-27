import { describe, expect, it } from "vitest";
import {
  formatHoursLabel,
  isWithinBusinessHours,
  nowMinutesInPodgorica,
  parseTimeToMinutes,
} from "./business-hours";

describe("parseTimeToMinutes", () => {
  it("parses HH:MM and HH:MM:SS", () => {
    expect(parseTimeToMinutes("12:00")).toBe(720);
    expect(parseTimeToMinutes("00:00")).toBe(0);
    expect(parseTimeToMinutes("23:59")).toBe(1439);
    expect(parseTimeToMinutes("12:00:00")).toBe(720);
    expect(parseTimeToMinutes("23:59:59")).toBe(1439);
  });

  it("rejects out-of-range, malformed, or non-string input", () => {
    expect(parseTimeToMinutes("24:00")).toBeNull();
    expect(parseTimeToMinutes("25:61")).toBeNull();
    expect(parseTimeToMinutes("9:00")).toBeNull(); // no leading zero — DB/UI always zero-pad
    expect(parseTimeToMinutes("")).toBeNull();
    expect(parseTimeToMinutes(null)).toBeNull();
    expect(parseTimeToMinutes(undefined)).toBeNull();
    expect(parseTimeToMinutes(720)).toBeNull();
    expect(parseTimeToMinutes("not a time")).toBeNull();
  });
});

describe("nowMinutesInPodgorica — DST correctness", () => {
  it("converts UTC to Europe/Podgorica winter time (CET, UTC+1)", () => {
    const winter = new Date("2026-01-15T10:30:00Z");
    expect(nowMinutesInPodgorica(winter)).toBe(11 * 60 + 30);
  });

  it("converts UTC to Europe/Podgorica summer time (CEST, UTC+2)", () => {
    const summer = new Date("2026-07-15T10:30:00Z");
    expect(nowMinutesInPodgorica(summer)).toBe(12 * 60 + 30);
  });

  it("rolls over correctly across local midnight in CEST", () => {
    const justAfterLocalMidnight = new Date("2026-07-15T22:30:00Z"); // 00:30 local
    expect(nowMinutesInPodgorica(justAfterLocalMidnight)).toBe(30);
  });
});

describe("isWithinBusinessHours — fail-open policy", () => {
  it("is open when either bound is null/undefined/malformed", () => {
    expect(isWithinBusinessHours(null, null, 0)).toBe(true);
    expect(isWithinBusinessHours("12:00", null, 300)).toBe(true);
    expect(isWithinBusinessHours(null, "12:00", 300)).toBe(true);
    expect(isWithinBusinessHours("bad", "12:00", 300)).toBe(true);
    expect(isWithinBusinessHours(undefined, undefined, 300)).toBe(true);
  });

  it("is open all day when open === close (degenerate config)", () => {
    expect(isWithinBusinessHours("09:00", "09:00", 0)).toBe(true);
    expect(isWithinBusinessHours("09:00", "09:00", 1439)).toBe(true);
  });

  it("handles a same-day window (no rollover), e.g. 09:00-17:00", () => {
    expect(isWithinBusinessHours("09:00", "17:00", 539)).toBe(false); // 08:59
    expect(isWithinBusinessHours("09:00", "17:00", 540)).toBe(true); // 09:00 exactly
    expect(isWithinBusinessHours("09:00", "17:00", 1019)).toBe(true); // 16:59
    expect(isWithinBusinessHours("09:00", "17:00", 1020)).toBe(false); // 17:00 exactly
  });

  it("handles midnight rollover, e.g. 12:00-00:00", () => {
    expect(isWithinBusinessHours("12:00", "00:00", 719)).toBe(false); // 11:59
    expect(isWithinBusinessHours("12:00", "00:00", 720)).toBe(true); // 12:00 exactly
    expect(isWithinBusinessHours("12:00", "00:00", 1439)).toBe(true); // 23:59
    expect(isWithinBusinessHours("12:00", "00:00", 0)).toBe(false); // 00:00 exactly — closed
    expect(isWithinBusinessHours("12:00", "00:00", 1)).toBe(false); // 00:01
  });

  it("handles midnight rollover past close, e.g. 12:00-02:00", () => {
    expect(isWithinBusinessHours("12:00", "02:00", 1)).toBe(true); // 00:01
    expect(isWithinBusinessHours("12:00", "02:00", 119)).toBe(true); // 01:59
    expect(isWithinBusinessHours("12:00", "02:00", 120)).toBe(false); // 02:00 exactly
    expect(isWithinBusinessHours("12:00", "02:00", 719)).toBe(false); // 11:59
    expect(isWithinBusinessHours("12:00", "02:00", 720)).toBe(true); // 12:00 exactly
  });
});

describe("formatHoursLabel", () => {
  it("formats round-hour bounds without minutes", () => {
    expect(formatHoursLabel("12:00", "00:00")).toBe("12–00");
    expect(formatHoursLabel("09:00", "17:00")).toBe("09–17");
  });

  it("includes minutes when non-zero", () => {
    expect(formatHoursLabel("12:00", "23:45")).toBe("12–23:45");
    expect(formatHoursLabel("08:30", "16:00")).toBe("08:30–16");
  });

  it("returns empty string when unconfigured or malformed", () => {
    expect(formatHoursLabel(null, "12:00")).toBe("");
    expect(formatHoursLabel("12:00", null)).toBe("");
    expect(formatHoursLabel("bad", "12:00")).toBe("");
  });
});
