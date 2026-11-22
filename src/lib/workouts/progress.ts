import {
  addDays,
  formatMonthTitle,
  getTodayLocalDate,
  parseLocalDate,
} from "@/lib/dates/localDate";
import { calculateEpley1RM } from "@/lib/metrics/oneRepMax";
import type { Workout, WorkoutSet } from "@/lib/types/domain";

export type ProgressTimeRange = "1M" | "3M" | "6M" | "1Y" | "ALL";

export type ProgressMetric =
  | "est_1rm"
  | "max_weight"
  | "total_volume"
  | "duration_minutes"
  | "total_distance"
  | "max_speed";

export interface ExerciseProgressPoint {
  workout_id: string;
  workout_name: string;
  workout_date: string;
  completed_at: string;
  max_weight: number;
  best_est_1rm: number;
  total_volume: number;
  best_set_weight: number | null;
  best_set_reps: number | null;
  total_duration_seconds: number;
  total_distance: number;
  max_speed: number;
  max_resistance: number;
  max_incline: number;
}

export interface ExercisePersonalBests {
  allTimeMaxWeight: number;
  allTimeBest1RM: number;
  allTimeBestSetVolume: number;
  allTimeBestDurationSeconds: number;
  allTimeBestDistance: number;
  allTimeMaxSpeed: number;
  allTimeMaxResistance: number;
  allTimeMaxIncline: number;
  totalSessions: number;
  totalWorkingSets: number;
}

export interface WorkoutMonthGroup {
  monthKey: string;
  monthLabel: string;
  workouts: Workout[];
}

export interface HistoryOverviewStats {
  totalWorkouts: number;
  totalVolume: number;
  totalSets: number;
  totalPRs: number;
}

export interface WorkoutExerciseGroup {
  exerciseOrder: number;
  exerciseId: string;
  supersetGroup: number | null;
  notes: string | null;
  sets: WorkoutSet[];
}

function roundTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const RANGE_DAYS: Record<Exclude<ProgressTimeRange, "ALL">, number> = {
  "1M": 30,
  "3M": 90,
  "6M": 180,
  "1Y": 365,
};

/**
 * Mirrors PostgreSQL `get_exercise_progress`:
 * Aggregates completed workouts into chronological Max Weight, Epley Est. 1RM,
 * Total Working Volume, and Best Set per workout (excluding warmup sets).
 */
export function deriveExerciseProgressFromLocal(
  exerciseId: string,
  workouts: Workout[],
  workoutSets: WorkoutSet[]
): ExerciseProgressPoint[] {
  const workoutById = new Map<string, Workout>();
  for (const w of workouts) {
    if (w.status === "completed") {
      workoutById.set(w.id, w);
    }
  }

  const setsByWorkout = new Map<string, WorkoutSet[]>();
  for (const ws of workoutSets) {
    if (
      ws.exercise_id !== exerciseId ||
      !ws.is_completed ||
      ws.set_type === "warmup"
    ) {
      continue;
    }
    if (!workoutById.has(ws.workout_id)) {
      continue;
    }
    const list = setsByWorkout.get(ws.workout_id) ?? [];
    list.push(ws);
    setsByWorkout.set(ws.workout_id, list);
  }

  const points: ExerciseProgressPoint[] = [];

  for (const [workoutId, exSets] of setsByWorkout.entries()) {
    const workout = workoutById.get(workoutId);
    if (!workout || exSets.length === 0) continue;

    let maxWeight = 0;
    let bestEst1RM = 0;
    let totalVolume = 0;
    let bestSet: WorkoutSet | null = null;
    let bestRankScore = -1;
    let totalDurationSeconds = 0;
    let totalDistance = 0;
    let maxSpeed = 0;
    let maxResistance = 0;
    let maxIncline = 0;

    const ordered = [...exSets].sort((a, b) => a.set_number - b.set_number);

    for (const ws of ordered) {
      const w = ws.weight ?? 0;
      const r = ws.reps ?? 0;
      const est1RM = calculateEpley1RM(w, r);
      const setVol = w > 0 && r > 0 ? w * r : 0;

      if (w > maxWeight) maxWeight = w;
      if (est1RM > bestEst1RM) bestEst1RM = est1RM;
      totalVolume += setVol;

      const dur = ws.duration_seconds ?? 0;
      const dist = ws.distance ?? 0;
      const spd = ws.speed ?? 0;
      const res = ws.resistance ?? 0;
      const inc = ws.incline ?? 0;
      if (dur > 0) totalDurationSeconds += dur;
      if (dist > 0) totalDistance += dist;
      if (spd > maxSpeed) maxSpeed = spd;
      if (res > maxResistance) maxResistance = res;
      if (inc > maxIncline) maxIncline = inc;

      const isBetterBest =
        est1RM > bestRankScore ||
        (est1RM === bestRankScore &&
          bestSet !== null &&
          (w > (bestSet.weight ?? 0) ||
            (w === (bestSet.weight ?? 0) && r > (bestSet.reps ?? 0))));

      if (bestSet === null || isBetterBest) {
        bestRankScore = est1RM;
        bestSet = ws;
      }
    }

    points.push({
      workout_id: workout.id,
      workout_name: workout.name,
      workout_date: workout.workout_date,
      completed_at: workout.completed_at ?? workout.updated_at,
      max_weight: roundTwoDecimals(maxWeight),
      best_est_1rm: roundTwoDecimals(bestEst1RM),
      total_volume: roundTwoDecimals(totalVolume),
      best_set_weight: bestSet?.weight ?? null,
      best_set_reps: bestSet?.reps ?? null,
      total_duration_seconds: Math.round(totalDurationSeconds),
      total_distance: roundTwoDecimals(totalDistance),
      max_speed: roundTwoDecimals(maxSpeed),
      max_resistance: roundTwoDecimals(maxResistance),
      max_incline: roundTwoDecimals(maxIncline),
    });
  }

  return points.sort((a, b) => {
    if (a.workout_date !== b.workout_date) {
      return a.workout_date.localeCompare(b.workout_date);
    }
    return a.completed_at.localeCompare(b.completed_at);
  });
}

export function filterProgressByTimeRange(
  points: ExerciseProgressPoint[],
  range: ProgressTimeRange,
  todayDateStr = getTodayLocalDate()
): ExerciseProgressPoint[] {
  if (range === "ALL") {
    return points;
  }

  const cutoff = addDays(todayDateStr, -RANGE_DAYS[range]);
  return points.filter((p) => p.workout_date >= cutoff);
}

export function computeExercisePersonalBests(
  points: ExerciseProgressPoint[],
  exerciseSets: WorkoutSet[]
): ExercisePersonalBests {
  let allTimeMaxWeight = 0;
  let allTimeBest1RM = 0;
  let allTimeBestSetVolume = 0;
  let allTimeBestDurationSeconds = 0;
  let allTimeBestDistance = 0;
  let allTimeMaxSpeed = 0;
  let allTimeMaxResistance = 0;
  let allTimeMaxIncline = 0;
  let totalWorkingSets = 0;

  for (const p of points) {
    if (p.max_weight > allTimeMaxWeight) {
      allTimeMaxWeight = p.max_weight;
    }
    if (p.best_est_1rm > allTimeBest1RM) {
      allTimeBest1RM = p.best_est_1rm;
    }
    if (p.total_duration_seconds > allTimeBestDurationSeconds) {
      allTimeBestDurationSeconds = p.total_duration_seconds;
    }
    if (p.total_distance > allTimeBestDistance) {
      allTimeBestDistance = p.total_distance;
    }
    if (p.max_speed > allTimeMaxSpeed) {
      allTimeMaxSpeed = p.max_speed;
    }
    if (p.max_resistance > allTimeMaxResistance) {
      allTimeMaxResistance = p.max_resistance;
    }
    if (p.max_incline > allTimeMaxIncline) {
      allTimeMaxIncline = p.max_incline;
    }
  }

  for (const ws of exerciseSets) {
    if (!ws.is_completed || ws.set_type === "warmup") continue;
    totalWorkingSets += 1;
    const w = ws.weight ?? 0;
    const r = ws.reps ?? 0;
    const vol = w > 0 && r > 0 ? roundTwoDecimals(w * r) : 0;
    if (w > allTimeMaxWeight) allTimeMaxWeight = roundTwoDecimals(w);
    const est = calculateEpley1RM(w, r);
    if (est > allTimeBest1RM) allTimeBest1RM = est;
    if (vol > allTimeBestSetVolume) allTimeBestSetVolume = vol;
    if ((ws.duration_seconds ?? 0) > allTimeBestDurationSeconds) {
      allTimeBestDurationSeconds = ws.duration_seconds ?? 0;
    }
    if ((ws.distance ?? 0) > allTimeBestDistance) {
      allTimeBestDistance = roundTwoDecimals(ws.distance ?? 0);
    }
    if ((ws.speed ?? 0) > allTimeMaxSpeed) {
      allTimeMaxSpeed = roundTwoDecimals(ws.speed ?? 0);
    }
    if ((ws.resistance ?? 0) > allTimeMaxResistance) {
      allTimeMaxResistance = roundTwoDecimals(ws.resistance ?? 0);
    }
    if ((ws.incline ?? 0) > allTimeMaxIncline) {
      allTimeMaxIncline = roundTwoDecimals(ws.incline ?? 0);
    }
  }

  // If set-level rows aren't hydrated locally for historical workouts, approximate set-vol floor from best_set if available
  if (allTimeBestSetVolume === 0 && points.length > 0) {
    for (const p of points) {
      if (p.best_set_weight !== null && p.best_set_reps !== null) {
        const vol = roundTwoDecimals(p.best_set_weight * p.best_set_reps);
        if (vol > allTimeBestSetVolume) {
          allTimeBestSetVolume = vol;
        }
      }
    }
  }

  return {
    allTimeMaxWeight: roundTwoDecimals(allTimeMaxWeight),
    allTimeBest1RM: roundTwoDecimals(allTimeBest1RM),
    allTimeBestSetVolume: roundTwoDecimals(allTimeBestSetVolume),
    allTimeBestDurationSeconds: Math.round(allTimeBestDurationSeconds),
    allTimeBestDistance: roundTwoDecimals(allTimeBestDistance),
    allTimeMaxSpeed: roundTwoDecimals(allTimeMaxSpeed),
    allTimeMaxResistance: roundTwoDecimals(allTimeMaxResistance),
    allTimeMaxIncline: roundTwoDecimals(allTimeMaxIncline),
    totalSessions: points.length,
    totalWorkingSets,
  };
}

export function groupWorkoutsByMonth(
  workouts: Workout[]
): WorkoutMonthGroup[] {
  const completed = workouts
    .filter((w) => w.status === "completed")
    .sort((a, b) => {
      if (a.workout_date !== b.workout_date) {
        return b.workout_date.localeCompare(a.workout_date);
      }
      const tA = a.completed_at ?? a.created_at;
      const tB = b.completed_at ?? b.created_at;
      return tB.localeCompare(tA);
    });

  const groups: WorkoutMonthGroup[] = [];
  const byKey = new Map<string, WorkoutMonthGroup>();

  for (const workout of completed) {
    const monthKey = workout.workout_date.slice(0, 7);
    let group = byKey.get(monthKey);
    if (!group) {
      const parsed = parseLocalDate(workout.workout_date);
      group = {
        monthKey,
        monthLabel: formatMonthTitle(parsed.getFullYear(), parsed.getMonth()),
        workouts: [],
      };
      byKey.set(monthKey, group);
      groups.push(group);
    }
    group.workouts.push(workout);
  }

  return groups;
}

export function computeHistoryOverviewStats(
  workouts: Workout[]
): HistoryOverviewStats {
  let totalWorkouts = 0;
  let totalVolume = 0;
  let totalSets = 0;
  let totalPRs = 0;

  for (const w of workouts) {
    if (w.status !== "completed") continue;
    totalWorkouts += 1;
    totalVolume += Number(w.total_volume) || 0;
    totalSets += Number(w.total_sets) || 0;
    totalPRs += Number(w.pr_count) || 0;
  }

  return {
    totalWorkouts,
    totalVolume: roundTwoDecimals(totalVolume),
    totalSets,
    totalPRs,
  };
}

export function groupWorkoutSetsByExercise(
  sets: WorkoutSet[]
): WorkoutExerciseGroup[] {
  const sorted = [...sets].sort((a, b) => {
    if (a.exercise_order !== b.exercise_order) {
      return a.exercise_order - b.exercise_order;
    }
    return a.set_number - b.set_number;
  });

  const groups: WorkoutExerciseGroup[] = [];
  const byOrder = new Map<number, WorkoutExerciseGroup>();

  for (const ws of sorted) {
    let group = byOrder.get(ws.exercise_order);
    if (!group) {
      group = {
        exerciseOrder: ws.exercise_order,
        exerciseId: ws.exercise_id,
        supersetGroup: ws.superset_group,
        notes: ws.notes,
        sets: [],
      };
      byOrder.set(ws.exercise_order, group);
      groups.push(group);
    }
    if (!group.notes && ws.notes) {
      group.notes = ws.notes;
    }
    group.sets.push(ws);
  }

  return groups;
}
