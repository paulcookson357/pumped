import { describe, expect, it } from "vitest";
import { computeStaleDomains } from "@/lib/offline/syncEngine";
import type { SyncDomain } from "@/lib/types/domain";

function makeVersions(
  overrides: Partial<Record<SyncDomain, number>> = {}
): Record<SyncDomain, number> {
  return {
    exercises: 2,
    routines: 1,
    schedule: 1,
    workouts: 1,
    settings: 1,
    ...overrides,
  };
}

describe("computeStaleDomains", () => {
  it("returns all domains when localVersions is null (first visit)", () => {
    expect(
      computeStaleDomains({
        remoteVersions: makeVersions(),
        localVersions: null,
        localExerciseCount: 0,
      })
    ).toEqual(["exercises", "routines", "schedule", "workouts", "settings"]);
  });

  it("returns only domains whose remote version differs from local version", () => {
    expect(
      computeStaleDomains({
        remoteVersions: makeVersions({ routines: 4, workouts: 3 }),
        localVersions: makeVersions(),
        localExerciseCount: 56,
      })
    ).toEqual(["routines", "workouts"]);
  });

  it("returns empty array when versions match and exercises are populated", () => {
    expect(
      computeStaleDomains({
        remoteVersions: makeVersions(),
        localVersions: makeVersions(),
        localExerciseCount: 56,
      })
    ).toEqual([]);
  });

  it("self-heals exercises when localExerciseCount is 0 and remote exercises > 1 even if versions match", () => {
    expect(
      computeStaleDomains({
        remoteVersions: makeVersions({ exercises: 2 }),
        localVersions: makeVersions({ exercises: 2 }),
        localExerciseCount: 0,
      })
    ).toEqual(["exercises"]);
  });
});
