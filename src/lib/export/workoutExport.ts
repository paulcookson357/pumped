import { calculateEpley1RM } from "@/lib/metrics/oneRepMax";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  WeeklySplitRule,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import { formatNumberCompact } from "@/lib/workouts/stats";

export interface ExportDataset {
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  settings: AppSettings | null;
}

export interface PumpedJsonBackup {
  schemaVersion: 1;
  exportedAt: string;
  counts: {
    exercises: number;
    routines: number;
    routineExercises: number;
    weeklySplitRules: number;
    scheduledWorkouts: number;
    workouts: number;
    workoutSets: number;
  };
  data: ExportDataset;
}

export const WORKOUTS_CSV_HEADERS = [
  "workout_date",
  "workout_id",
  "workout_name",
  "routine_name",
  "duration_seconds",
  "weight_unit",
  "exercise_order",
  "exercise_name",
  "muscle_group",
  "equipment",
  "superset_group",
  "set_number",
  "set_type",
  "weight",
  "reps",
  "rpe",
  "set_duration_seconds",
  "est_1rm",
  "set_volume",
  "is_pr_weight",
  "is_pr_1rm",
  "is_pr_volume",
  "set_notes",
  "workout_notes",
] as const;

function roundTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function escapeCsvCell(
  value: string | number | boolean | null | undefined
): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildJsonBackup(
  dataset: ExportDataset,
  exportedAt = new Date().toISOString()
): PumpedJsonBackup {
  return {
    schemaVersion: 1,
    exportedAt,
    counts: {
      exercises: dataset.exercises.length,
      routines: dataset.routines.length,
      routineExercises: dataset.routineExercises.length,
      weeklySplitRules: dataset.weeklySplitRules.length,
      scheduledWorkouts: dataset.scheduledWorkouts.length,
      workouts: dataset.workouts.length,
      workoutSets: dataset.workoutSets.length,
    },
    data: dataset,
  };
}

export function buildWorkoutsCsv(
  dataset: Pick<
    ExportDataset,
    "exercises" | "routines" | "workouts" | "workoutSets"
  >
): string {
  const exerciseMap = new Map(dataset.exercises.map((ex) => [ex.id, ex]));
  const routineMap = new Map(dataset.routines.map((r) => [r.id, r]));

  const sortedWorkouts = dataset.workouts
    .filter((w) => w.status === "completed")
    .slice()
    .sort((a, b) => {
      if (a.workout_date !== b.workout_date) {
        return b.workout_date.localeCompare(a.workout_date);
      }
      const stampA = a.completed_at ?? a.created_at;
      const stampB = b.completed_at ?? b.created_at;
      return stampB.localeCompare(stampA);
    });

  const setsByWorkoutId = new Map<string, WorkoutSet[]>();
  for (const ws of dataset.workoutSets) {
    if (!ws.is_completed) continue;
    const list = setsByWorkoutId.get(ws.workout_id) ?? [];
    list.push(ws);
    setsByWorkoutId.set(ws.workout_id, list);
  }

  const lines: string[] = [WORKOUTS_CSV_HEADERS.join(",")];

  for (const workout of sortedWorkouts) {
    const routineName = workout.routine_id
      ? (routineMap.get(workout.routine_id)?.name ?? "")
      : "";
    const sets = (setsByWorkoutId.get(workout.id) ?? []).slice().sort((a, b) => {
      if (a.exercise_order !== b.exercise_order) {
        return a.exercise_order - b.exercise_order;
      }
      return a.set_number - b.set_number;
    });

    for (const ws of sets) {
      const exercise = exerciseMap.get(ws.exercise_id);
      const isWarmup = ws.set_type === "warmup";
      const w = ws.weight ?? 0;
      const r = ws.reps ?? 0;
      const est1rmValue =
        !isWarmup && w > 0 && r > 0 ? calculateEpley1RM(w, r) : 0;
      const est1rmCell =
        est1rmValue > 0 ? formatNumberCompact(est1rmValue) : "";
      const setVolumeCell =
        !isWarmup && w > 0 && r > 0 ? roundTwoDecimals(w * r) : 0;

      const row = [
        workout.workout_date,
        workout.id,
        workout.name,
        routineName,
        workout.duration_seconds,
        workout.weight_unit,
        ws.exercise_order,
        exercise?.name ?? "Exercise",
        exercise?.muscle_group ?? "",
        exercise?.equipment ?? "",
        ws.superset_group,
        ws.set_number,
        ws.set_type,
        ws.weight,
        ws.reps,
        ws.rpe,
        ws.duration_seconds,
        est1rmCell,
        setVolumeCell,
        ws.is_pr_weight,
        ws.is_pr_1rm,
        ws.is_pr_volume,
        ws.notes,
        workout.notes,
      ];

      lines.push(row.map(escapeCsvCell).join(","));
    }
  }

  return lines.join("\n");
}
