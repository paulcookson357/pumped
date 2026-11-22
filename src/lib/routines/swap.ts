import type { RoutineExercise } from "@/lib/types/domain";

/**
 * Replaces a single exercise inside a sorted routine template list while preserving
 * order, superset grouping, set/rep/RPE targets, rest duration, and notes.
 */
export function replaceExerciseInRoutineTemplate(
  routineExercises: RoutineExercise[],
  oldExerciseId: string,
  newExerciseId: string,
  preferredIndex?: number
): { updated: RoutineExercise[]; changed: boolean } {
  const sorted = [...routineExercises].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  if (oldExerciseId === newExerciseId) {
    return { updated: sorted, changed: false };
  }

  let targetIdx = -1;
  if (
    preferredIndex !== undefined &&
    preferredIndex >= 0 &&
    preferredIndex < sorted.length &&
    sorted[preferredIndex]?.exercise_id === oldExerciseId
  ) {
    targetIdx = preferredIndex;
  } else {
    targetIdx = sorted.findIndex((item) => item.exercise_id === oldExerciseId);
  }

  if (targetIdx === -1) {
    return { updated: sorted, changed: false };
  }

  const now = new Date().toISOString();
  const updated = sorted.map((item, idx) =>
    idx === targetIdx
      ? {
          ...item,
          exercise_id: newExerciseId,
          updated_at: now,
        }
      : item
  );

  return { updated, changed: true };
}
