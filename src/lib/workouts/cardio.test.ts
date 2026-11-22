import { describe, expect, it } from "vitest";
import {
  computeCardioTotals,
  formatCardioDecimal,
  formatCardioDurationCompact,
  formatCardioDurationDisplay,
  formatCardioDurationInput,
  formatCardioSetSummary,
  getDistanceUnit,
  getSpeedUnit,
  parseCardioTimeInput,
} from "@/lib/workouts/cardio";

describe("cardio telemetry helpers", () => {
  it("derives distance and speed units from weightUnit setting", () => {
    expect(getDistanceUnit("kg")).toBe("km");
    expect(getSpeedUnit("kg")).toBe("km/h");
    expect(getDistanceUnit("lbs")).toBe("mi");
    expect(getSpeedUnit("lbs")).toBe("mph");
  });

  it("parses mm:ss, hh:mm:ss, and decimal minutes into integer seconds", () => {
    expect(parseCardioTimeInput("")).toBeNull();
    expect(parseCardioTimeInput("   ")).toBeNull();
    expect(parseCardioTimeInput("20")).toBe(1200);
    expect(parseCardioTimeInput("12.5")).toBe(750);
    expect(parseCardioTimeInput("20:30")).toBe(1230);
    expect(parseCardioTimeInput("0:45")).toBe(45);
    expect(parseCardioTimeInput("1:05:10")).toBe(3910);

    // Invalid inputs
    expect(parseCardioTimeInput("-5")).toBeNull();
    expect(parseCardioTimeInput("10:75")).toBeNull();
    expect(parseCardioTimeInput("1:65:00")).toBeNull();
    expect(parseCardioTimeInput("abc")).toBeNull();
    expect(parseCardioTimeInput("1:2:3:4")).toBeNull();
  });

  it("formats editable and display durations cleanly", () => {
    expect(formatCardioDurationInput(null)).toBe("");
    expect(formatCardioDurationInput(0)).toBe("");
    expect(formatCardioDurationInput(1230)).toBe("20:30");
    expect(formatCardioDurationInput(3905)).toBe("1:05:05");

    expect(formatCardioDurationDisplay(null)).toBe("0:00");
    expect(formatCardioDurationDisplay(45)).toBe("0:45");
    expect(formatCardioDurationDisplay(1200)).toBe("20:00");

    expect(formatCardioDurationCompact(45)).toBe("45s");
    expect(formatCardioDurationCompact(1200)).toBe("20m");
    expect(formatCardioDurationCompact(1230)).toBe("20m 30s");
    expect(formatCardioDurationCompact(3900)).toBe("1h 05m");
  });

  it("formats concise unit-aware cardio set summaries", () => {
    expect(
      formatCardioSetSummary(
        {
          duration_seconds: 1200,
          distance: 3.25,
          speed: 9.8,
          resistance: 6,
          incline: 2.5,
        },
        "kg"
      )
    ).toBe("20:00 • 3.25 km • 9.8 km/h • Lvl 6 • 2.5% inc");

    expect(
      formatCardioSetSummary(
        {
          duration_seconds: 900,
          distance: 2.5,
          speed: 10,
          resistance: null,
          incline: 0,
        },
        "lbs"
      )
    ).toBe("15:00 • 2.5 mi • 10 mph • 0% inc");

    expect(formatCardioSetSummary({}, "kg")).toBe("—");
    expect(formatCardioDecimal(4.5)).toBe("4.5");
  });

  it("computes total cardio time and distance only across completed sets with cardio data", () => {
    const totals = computeCardioTotals([
      {
        duration_seconds: 1200,
        distance: 3.2,
        speed: 9.6,
        is_completed: true,
      },
      {
        duration_seconds: 600,
        distance: 1.55,
        resistance: 8,
        is_completed: true,
      },
      {
        duration_seconds: 999,
        distance: 10,
        is_completed: false,
      },
      {
        duration_seconds: null,
        distance: null,
        is_completed: true,
      },
    ]);

    expect(totals).toEqual({
      totalCardioSeconds: 1800,
      totalDistance: 4.75,
      cardioSets: 2,
    });
  });
});
