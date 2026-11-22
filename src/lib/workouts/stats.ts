import { calculateEpley1RM } from "@/lib/metrics/oneRepMax";
import type { PreviousPerformanceRecord } from "@/lib/offline/db";
import type {
  TrackingType,
  WeightUnit,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";

export interface WorkoutTotalsSummary {
  totalVolume: number;
  totalSets: number;
  workingSets: number;
}

export interface ExercisePRHighlight {
  exerciseId: string;
  setId: string;
  weight: number | null;
  reps: number | null;
  est1rm: number;
  volume: number;
  isWeightPR: boolean;
  is1RMPR: boolean;
  isVolumePR: boolean;
}

export interface OptimisticPRResult {
  setsWithPRs: WorkoutSet[];
  prCount: number;
  prHighlights: ExercisePRHighlight[];
}

function roundTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function formatNumberCompact(value: number): string {
  const rounded = roundTwoDecimals(value);
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

/**
 * Computes total working volume (excluding warmup sets) and total completed sets,
 * mirroring `finalize_workout_stats` in PostgreSQL.
 */
export function computeWorkoutTotals(
  sets: Array<
    Pick<WorkoutSet, "is_completed" | "set_type" | "weight" | "reps">
  >
): WorkoutTotalsSummary {
  let totalVolume = 0;
  let totalSets = 0;
  let workingSets = 0;

  for (const s of sets) {
    if (!s.is_completed) continue;
    totalSets += 1;
    if (s.set_type !== "warmup") {
      workingSets += 1;
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      if (w > 0 && r > 0) {
        totalVolume += w * r;
      }
    }
  }

  return {
    totalVolume: roundTwoDecimals(totalVolume),
    totalSets,
    workingSets,
  };
}

/**
 * Evaluates optimistic PR badges (Weight, Est. 1RM, Single-Set Volume) per exercise
 * against strictly prior completed workouts, excluding warmup sets.
 */
export function computeOptimisticPRs(
  completedSets: WorkoutSet[],
  priorWorkouts: Workout[],
  priorWorkoutSets: WorkoutSet[],
  currentWorkoutId?: string
): OptimisticPRResult {
  const completedWorkoutIds = new Set(
    priorWorkouts
      .filter((w) => w.status === "completed" && w.id !== currentWorkoutId)
      .map((w) => w.id)
  );

  // Build max baselines per exercise from prior completed workouts
  const priorBaselines = new Map<
    string,
    { maxWeight: number; max1RM: number; maxVolume: number }
  >();

  for (const ws of priorWorkoutSets) {
    if (
      !ws.is_completed ||
      ws.set_type === "warmup" ||
      !completedWorkoutIds.has(ws.workout_id)
    ) {
      continue;
    }

    const current = priorBaselines.get(ws.exercise_id) ?? {
      maxWeight: 0,
      max1RM: 0,
      maxVolume: 0,
    };

    const w = ws.weight ?? 0;
    const r = ws.reps ?? 0;
    const est1RM = calculateEpley1RM(w, r);
    const vol = w > 0 && r > 0 ? roundTwoDecimals(w * r) : 0;

    if (w > current.maxWeight) current.maxWeight = w;
    if (est1RM > current.max1RM) current.max1RM = est1RM;
    if (vol > current.maxVolume) current.maxVolume = vol;

    priorBaselines.set(ws.exercise_id, current);
  }

  const workingSetsByExercise = new Map<string, WorkoutSet[]>();
  for (const ws of completedSets) {
    if (!ws.is_completed || ws.set_type === "warmup") continue;
    const list = workingSetsByExercise.get(ws.exercise_id) ?? [];
    list.push(ws);
    workingSetsByExercise.set(ws.exercise_id, list);
  }

  const bestWtSetIds = new Set<string>();
  const best1RMSetIds = new Set<string>();
  const bestVolSetIds = new Set<string>();

  for (const [exerciseId, exSets] of workingSetsByExercise.entries()) {
    const baseline = priorBaselines.get(exerciseId) ?? {
      maxWeight: 0,
      max1RM: 0,
      maxVolume: 0,
    };

    let bestWtSet: WorkoutSet | null = null;
    let best1RMSet: WorkoutSet | null = null;
    let best1RMVal = baseline.max1RM;
    let bestVolSet: WorkoutSet | null = null;
    let bestVolVal = baseline.maxVolume;

    const ordered = [...exSets].sort((a, b) => a.set_number - b.set_number);

    for (const s of ordered) {
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      const est1rm = calculateEpley1RM(w, r);
      const vol = w > 0 && r > 0 ? roundTwoDecimals(w * r) : 0;

      if (w > baseline.maxWeight) {
        if (
          !bestWtSet ||
          w > (bestWtSet.weight ?? 0) ||
          (w === (bestWtSet.weight ?? 0) && r > (bestWtSet.reps ?? 0))
        ) {
          bestWtSet = s;
        }
      }

      if (est1rm > 0 && est1rm > best1RMVal) {
        best1RMVal = est1rm;
        best1RMSet = s;
      }

      if (vol > 0 && vol > bestVolVal) {
        bestVolVal = vol;
        bestVolSet = s;
      }
    }

    if (bestWtSet) bestWtSetIds.add(bestWtSet.id);
    if (best1RMSet) best1RMSetIds.add(best1RMSet.id);
    if (bestVolSet) bestVolSetIds.add(bestVolSet.id);
  }

  const prHighlights: ExercisePRHighlight[] = [];
  let prCount = 0;

  const setsWithPRs = completedSets.map((s) => {
    const is_pr_weight = bestWtSetIds.has(s.id);
    const is_pr_1rm = best1RMSetIds.has(s.id);
    const is_pr_volume = bestVolSetIds.has(s.id);

    if (is_pr_weight || is_pr_1rm || is_pr_volume) {
      prCount += 1;
      const w = s.weight ?? 0;
      const r = s.reps ?? 0;
      prHighlights.push({
        exerciseId: s.exercise_id,
        setId: s.id,
        weight: s.weight,
        reps: s.reps,
        est1rm: calculateEpley1RM(w, r),
        volume: w > 0 && r > 0 ? roundTwoDecimals(w * r) : 0,
        isWeightPR: is_pr_weight,
        is1RMPR: is_pr_1rm,
        isVolumePR: is_pr_volume,
      });
    }

    return {
      ...s,
      is_pr_weight,
      is_pr_1rm,
      is_pr_volume,
    };
  });

  return {
    setsWithPRs,
    prCount,
    prHighlights,
  };
}

/**
 * Derives most-recent completed session sets per exercise from local workouts & sets.
 */
export function derivePreviousPerformanceFromLocal(
  workouts: Workout[],
  workoutSets: WorkoutSet[],
  exerciseIds: string[]
): Record<string, PreviousPerformanceRecord> {
  if (exerciseIds.length === 0 || workouts.length === 0) {
    return {};
  }

  const targetIds = new Set(exerciseIds);
  const completedWorkouts = [...workouts]
    .filter((w) => w.status === "completed")
    .sort((a, b) => {
      const timeA = a.completed_at ?? a.created_at;
      const timeB = b.completed_at ?? b.created_at;
      if (timeA !== timeB) {
        return timeB.localeCompare(timeA);
      }
      return b.created_at.localeCompare(a.created_at);
    });

  const setsByWorkoutExercise = new Map<string, WorkoutSet[]>();
  for (const ws of workoutSets) {
    if (!ws.is_completed || !targetIds.has(ws.exercise_id)) continue;
    const key = `${ws.workout_id}:${ws.exercise_id}`;
    const list = setsByWorkoutExercise.get(key) ?? [];
    list.push(ws);
    setsByWorkoutExercise.set(key, list);
  }

  const result: Record<string, PreviousPerformanceRecord> = {};

  for (const exId of targetIds) {
    for (const workout of completedWorkouts) {
      const sets = setsByWorkoutExercise.get(`${workout.id}:${exId}`);
      if (!sets || sets.length === 0) continue;

      const sortedSets = [...sets].sort((a, b) => {
        if (a.exercise_order !== b.exercise_order) {
          return a.exercise_order - b.exercise_order;
        }
        return a.set_number - b.set_number;
      });

      result[exId] = {
        exercise_id: exId,
        workout_id: workout.id,
        updated_at: workout.completed_at ?? workout.updated_at,
        sets: sortedSets.map((s) => ({
          set_number: s.set_number,
          set_type: s.set_type,
          weight: s.weight,
          reps: s.reps,
          rpe: s.rpe,
          duration_seconds: s.duration_seconds,
        })),
      };
      break;
    }
  }

  return result;
}

export function formatElapsedDuration(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${pad(mins)}:${pad(secs)}`;
  }
  return `${mins}:${pad(secs)}`;
}

export function formatRestRemaining(totalSeconds: number): string {
  const clamped = Math.max(0, Math.ceil(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function formatPreviousSetLabel(
  prevSet:
    | {
        weight: number | null;
        reps: number | null;
        duration_seconds: number | null;
      }
    | undefined,
  trackingType: TrackingType,
  weightUnit: WeightUnit
): string {
  if (!prevSet) {
    return "—";
  }

  if (trackingType === "duration") {
    if (prevSet.duration_seconds === null || prevSet.duration_seconds <= 0) {
      return "—";
    }
    const mins = Math.floor(prevSet.duration_seconds / 60);
    const secs = prevSet.duration_seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  if (trackingType === "bodyweight_reps") {
    return prevSet.reps !== null ? `${prevSet.reps} reps` : "—";
  }

  if (trackingType === "weighted_bodyweight") {
    if (prevSet.reps === null) return "—";
    if (prevSet.weight === null || prevSet.weight === 0) {
      return `BW × ${prevSet.reps}`;
    }
    return `+${formatNumberCompact(prevSet.weight)} ${weightUnit} × ${prevSet.reps}`;
  }

  if (prevSet.weight !== null && prevSet.reps !== null) {
    return `${formatNumberCompact(prevSet.weight)} ${weightUnit} × ${prevSet.reps}`;
  }
  if (prevSet.reps !== null) {
    return `${prevSet.reps} reps`;
  }
  return "—";
}
