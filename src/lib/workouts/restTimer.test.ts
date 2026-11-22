import { describe, expect, it } from "vitest";
import {
  adjustTimerEndAt,
  computeRemainingSeconds,
  isTimerFinished,
} from "@/lib/workouts/restTimer";

describe("wall-clock rest timer calculations", () => {
  it("computes remaining seconds accurately across background gaps", () => {
    const now = 1_000_000;
    const endAt = now + 89_200; // 89.2s remaining -> ceils to 90s
    expect(computeRemainingSeconds(endAt, now)).toBe(90);
    expect(computeRemainingSeconds(endAt, now + 90_000)).toBe(0);
    expect(computeRemainingSeconds(null, now)).toBe(0);
  });

  it("adjusts timer by +15s and -15s and clears timer if adjusted to <= 0", () => {
    const now = 1_000_000;
    const initialEnd = now + 60_000;

    const added = adjustTimerEndAt(initialEnd, 15, 60, now);
    expect(computeRemainingSeconds(added.endAt, now)).toBe(75);
    expect(added.durationSeconds).toBe(75);

    const subtracted = adjustTimerEndAt(now + 10_000, -15, 60, now);
    expect(subtracted.endAt).toBeNull();
    expect(subtracted.durationSeconds).toBe(0);
  });

  it("detects completion based on wall clock timestamp", () => {
    const now = 1_000_000;
    expect(isTimerFinished(now + 500, now)).toBe(false);
    expect(isTimerFinished(now, now)).toBe(true);
    expect(isTimerFinished(now - 50, now)).toBe(true);
    expect(isTimerFinished(null, now)).toBe(false);
  });
});
