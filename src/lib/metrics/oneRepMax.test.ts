import { describe, expect, it } from "vitest";
import { calculateEpley1RM } from "@/lib/metrics/oneRepMax";

describe("calculateEpley1RM", () => {
  it("returns 0 for zero, negative, or non-finite inputs", () => {
    expect(calculateEpley1RM(0, 10)).toBe(0);
    expect(calculateEpley1RM(100, 0)).toBe(0);
    expect(calculateEpley1RM(-60, 5)).toBe(0);
    expect(calculateEpley1RM(60, -2)).toBe(0);
    expect(calculateEpley1RM(Number.NaN, 5)).toBe(0);
    expect(calculateEpley1RM(100, Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("returns exact rounded weight for single-rep sets", () => {
    expect(calculateEpley1RM(140, 1)).toBe(140);
    expect(calculateEpley1RM(102.5, 1)).toBe(102.5);
  });

  it("computes Epley 1RM rounded to 2 decimals for multi-rep sets", () => {
    // 100 * (1 + 10/30) = 133.333... -> 133.33
    expect(calculateEpley1RM(100, 10)).toBe(133.33);
    // 80 * (1 + 6/30) = 96
    expect(calculateEpley1RM(80, 6)).toBe(96);
    // 62.5 * (1 + 8/30) = 79.1666... -> 79.17
    expect(calculateEpley1RM(62.5, 8)).toBe(79.17);
  });
});
