import { describe, expect, it } from "vitest";
import {
  addDays,
  getIsoDayOfWeek,
  getMonthGridDates,
  getWeekDates,
  shiftMonth,
  toLocalDateString,
} from "@/lib/dates/localDate";

describe("localDate utilities", () => {
  it("formats local dates without UTC shifts", () => {
    const date = new Date(2026, 10, 22, 0, 15, 0); // Nov 22, 2026 00:15 local
    expect(toLocalDateString(date)).toBe("2026-11-22");
  });

  it("computes ISO weekdays (1=Mon .. 7=Sun)", () => {
    expect(getIsoDayOfWeek("2026-11-23")).toBe(1); // Monday
    expect(getIsoDayOfWeek("2026-11-25")).toBe(3); // Wednesday
    expect(getIsoDayOfWeek("2026-11-22")).toBe(7); // Sunday
  });

  it("handles month rollover and leap years in addDays", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2025-02-28", 1)).toBe("2025-03-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("builds Monday-first month grid covering all days", () => {
    // November 2026: Nov 1 is Sunday (lead=6), 30 days -> 36 cells -> 6 weeks (42)
    const nov2026 = getMonthGridDates(2026, 10);
    expect(nov2026).toHaveLength(42);
    expect(nov2026[0]).toBe("2026-10-26"); // Monday
    expect(getIsoDayOfWeek(nov2026[0] ?? "")).toBe(1);
    expect(nov2026).toContain("2026-11-01");
    expect(nov2026).toContain("2026-11-30");

    // February 2026: Feb 1 is Sunday (lead=6), 28 days -> 34 cells -> 5 weeks (35)
    const feb2026 = getMonthGridDates(2026, 1);
    expect(feb2026).toHaveLength(35);
    expect(feb2026[0]).toBe("2026-01-26");
    expect(feb2026[34]).toBe("2026-03-01");
  });

  it("returns Monday..Sunday 7-day slice in getWeekDates", () => {
    const week = getWeekDates("2026-11-22"); // Sunday
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-11-16");
    expect(week[6]).toBe("2026-11-22");
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex0: 11 });
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex0: 0 });
  });
});
