import { describe, expect, it } from "vitest";
import { replaceExerciseInRoutineTemplate } from "@/lib/routines/swap";
import type { RoutineExercise } from "@/lib/types/domain";

function makeRow(
  id: string,
  exerciseId: string,
  sortOrder: number,
  supersetGroup: number | null = null
): RoutineExercise {
  return {
    id,
    routine_id: "11111111-1111-4111-8111-111111111111",
    exercise_id: exerciseId,
    sort_order: sortOrder,
    superset_group: supersetGroup,
    target_sets: 3,
    target_reps_min: 8,
    target_reps_max: 12,
    target_rpe: 8,
    rest_seconds: 90,
    notes: `Note for ${exerciseId}`,
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: "2026-11-01T10:00:00.000Z",
  };
}

describe("replaceExerciseInRoutineTemplate", () => {
  it("replaces the preferredIndex match while preserving superset and prescription fields", () => {
    const rows = [
      makeRow("r2", "ex-2", 1, 1),
      makeRow("r1", "ex-1", 0, null),
      makeRow("r3", "ex-2", 2, 1),
    ];

    const result = replaceExerciseInRoutineTemplate(rows, "ex-2", "ex-new", 2);

    expect(result.changed).toBe(true);
    expect(result.updated.map((r) => r.exercise_id)).toEqual([
      "ex-1",
      "ex-2",
      "ex-new",
    ]);
    expect(result.updated[2]?.id).toBe("r3");
    expect(result.updated[2]?.superset_group).toBe(1);
    expect(result.updated[2]?.target_sets).toBe(3);
    expect(result.updated[2]?.rest_seconds).toBe(90);
  });

  it("falls back to first matching exercise_id when preferredIndex is not provided or misses", () => {
    const rows = [makeRow("r1", "ex-1", 0), makeRow("r2", "ex-2", 1)];

    const result = replaceExerciseInRoutineTemplate(rows, "ex-2", "ex-swap", 0);

    expect(result.changed).toBe(true);
    expect(result.updated[1]?.exercise_id).toBe("ex-swap");
  });

  it("returns changed: false when oldExerciseId is absent or identical to replacement", () => {
    const rows = [makeRow("r1", "ex-1", 0)];

    expect(replaceExerciseInRoutineTemplate(rows, "missing", "ex-2").changed).toBe(
      false
    );
    expect(replaceExerciseInRoutineTemplate(rows, "ex-1", "ex-1").changed).toBe(
      false
    );
  });
});
