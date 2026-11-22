import { describe, expect, it } from "vitest";
import {
  WORKOUTS_CSV_HEADERS,
  buildJsonBackup,
  buildWorkoutsCsv,
  escapeCsvCell,
  type ExportDataset,
} from "@/lib/export/workoutExport";
import type { Exercise, Routine, Workout, WorkoutSet } from "@/lib/types/domain";

const BENCH_ID = "dc355ecf-4705-4e55-b707-91399df9f290";
const ROUTINE_ID = "22222222-2222-4222-8222-222222222222";
const WORKOUT_ID = "33333333-3333-4333-8333-333333333333";

function makeExercise(): Exercise {
  return {
    id: BENCH_ID,
    slug: "barbell-bench-press",
    name: "Barbell Bench Press",
    muscle_group: "chest",
    secondary_muscles: ["triceps"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    media_gif_url: null,
    media_image_start_url: null,
    media_image_end_url: null,
    custom_video_url: null,
    instructions: [],
    is_custom: false,
    archived_at: null,
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: "2026-11-01T10:00:00.000Z",
  };
}

function makeRoutine(): Routine {
  return {
    id: ROUTINE_ID,
    name: "Upper Push A",
    color: "#059669",
    notes: null,
    sort_order: 0,
    last_performed_at: "2026-11-22T10:40:00.000Z",
    archived_at: null,
    created_at: "2026-11-01T10:00:00.000Z",
    updated_at: "2026-11-22T10:40:00.000Z",
  };
}

function makeDataset(): ExportDataset {
  const workout: Workout = {
    id: WORKOUT_ID,
    routine_id: ROUTINE_ID,
    name: "Push Day",
    notes: 'Barbell felt fast, "paused" reps',
    status: "completed",
    workout_date: "2026-11-22",
    started_at: "2026-11-22T10:00:00.000Z",
    completed_at: "2026-11-22T10:40:00.000Z",
    duration_seconds: 2400,
    weight_unit: "kg",
    total_volume: 480,
    total_sets: 2,
    pr_count: 1,
    client_updated_at: "2026-11-22T10:40:00.000Z",
    created_at: "2026-11-22T10:00:00.000Z",
    updated_at: "2026-11-22T10:40:00.000Z",
  };

  const sets: WorkoutSet[] = [
    {
      id: "44444444-4444-4444-8444-444444444441",
      workout_id: WORKOUT_ID,
      exercise_id: BENCH_ID,
      exercise_order: 0,
      superset_group: null,
      set_number: 1,
      set_type: "warmup",
      weight: 40,
      reps: 8,
      rpe: null,
      duration_seconds: null,
      distance: null,
      speed: null,
      resistance: null,
      incline: null,
      rest_seconds: 60,
      is_completed: true,
      completed_at: "2026-11-22T10:10:00.000Z",
      is_pr_weight: false,
      is_pr_1rm: false,
      is_pr_volume: false,
      notes: "Line 1\nLine 2",
      client_updated_at: "2026-11-22T10:10:00.000Z",
      created_at: "2026-11-22T10:10:00.000Z",
      updated_at: "2026-11-22T10:10:00.000Z",
    },
    {
      id: "44444444-4444-4444-8444-444444444442",
      workout_id: WORKOUT_ID,
      exercise_id: BENCH_ID,
      exercise_order: 0,
      superset_group: null,
      set_number: 2,
      set_type: "normal",
      weight: 60,
      reps: 8,
      rpe: 8.5,
      duration_seconds: null,
      distance: null,
      speed: null,
      resistance: null,
      incline: null,
      rest_seconds: 90,
      is_completed: true,
      completed_at: "2026-11-22T10:15:00.000Z",
      is_pr_weight: true,
      is_pr_1rm: true,
      is_pr_volume: false,
      notes: null,
      client_updated_at: "2026-11-22T10:15:00.000Z",
      created_at: "2026-11-22T10:15:00.000Z",
      updated_at: "2026-11-22T10:15:00.000Z",
    },
  ];

  return {
    exercises: [makeExercise()],
    routines: [makeRoutine()],
    routineExercises: [],
    weeklySplitRules: [],
    scheduledWorkouts: [],
    workouts: [workout],
    workoutSets: sets,
    settings: null,
  };
}

describe("workoutExport", () => {
  it("escapes CSV cells with commas, quotes, newlines, and nullish values", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell(82.5)).toBe("82.5");
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell("a, b")).toBe('"a, b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("outputs header row alone when there are no completed workouts", () => {
    const csv = buildWorkoutsCsv({
      exercises: [],
      routines: [],
      workouts: [],
      workoutSets: [],
    });

    expect(csv).toBe(WORKOUTS_CSV_HEADERS.join(","));
  });

  it("builds CSV rows with warmup blank est_1rm, zero warmup volume, working Epley 1RM, PRs, and escaped notes", () => {
    const csv = buildWorkoutsCsv(makeDataset());
    const lines = csv.split("\n");

    expect(lines[0]).toBe(WORKOUTS_CSV_HEADERS.join(","));
    expect(csv).toContain(
      `2026-11-22,${WORKOUT_ID},Push Day,Upper Push A,2400,kg,0,Barbell Bench Press,chest,barbell,,1,warmup,40,8,,,,,,,`
    );
    expect(csv).toContain(',0,false,false,false,"Line 1\nLine 2","Barbell felt fast, ""paused"" reps"');
    expect(csv).toContain(
      `2026-11-22,${WORKOUT_ID},Push Day,Upper Push A,2400,kg,0,Barbell Bench Press,chest,barbell,,2,normal,60,8,8.5,,,,,,76,480,true,true,false,,"Barbell felt fast, ""paused"" reps"`
    );
  });

  it("builds structured JSON backup v1 with matching record counts", () => {
    const dataset = makeDataset();
    const backup = buildJsonBackup(dataset, "2026-11-22T19:00:00.000Z");

    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe("2026-11-22T19:00:00.000Z");
    expect(backup.counts).toEqual({
      exercises: 1,
      routines: 1,
      routineExercises: 0,
      weeklySplitRules: 0,
      scheduledWorkouts: 0,
      workouts: 1,
      workoutSets: 2,
    });
    expect(backup.data.workouts[0]?.id).toBe(WORKOUT_ID);
  });
});
