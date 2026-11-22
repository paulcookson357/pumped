import { describe, expect, it } from "vitest";
import type { Workout, WorkoutSet } from "@/lib/types/domain";
import {
  computeExercisePersonalBests,
  computeHistoryOverviewStats,
  deriveExerciseProgressFromLocal,
  filterProgressByTimeRange,
  groupWorkoutsByMonth,
  groupWorkoutSetsByExercise,
} from "@/lib/workouts/progress";

const BENCH_ID = "11111111-1111-4111-8111-111111111111";
const SQUAT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-11-22T12:00:00.000Z";

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: overrides.id ?? "w-1",
    routine_id: overrides.routine_id ?? null,
    name: overrides.name ?? "Push",
    notes: null,
    status: overrides.status ?? "completed",
    workout_date: overrides.workout_date ?? "2026-11-22",
    started_at: overrides.started_at ?? "2026-11-22T10:00:00.000Z",
    completed_at: overrides.completed_at ?? "2026-11-22T10:45:00.000Z",
    duration_seconds: overrides.duration_seconds ?? 2700,
    weight_unit: "kg",
    total_volume: overrides.total_volume ?? 1000,
    total_sets: overrides.total_sets ?? 3,
    pr_count: overrides.pr_count ?? 0,
    client_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: overrides.id ?? "s-1",
    workout_id: overrides.workout_id ?? "w-1",
    exercise_id: overrides.exercise_id ?? BENCH_ID,
    exercise_order: overrides.exercise_order ?? 0,
    superset_group: overrides.superset_group ?? null,
    set_number: overrides.set_number ?? 1,
    set_type: overrides.set_type ?? "normal",
    weight: overrides.weight !== undefined ? overrides.weight : 60,
    reps: overrides.reps !== undefined ? overrides.reps : 10,
    rpe: overrides.rpe ?? null,
    duration_seconds: overrides.duration_seconds ?? null,
    rest_seconds: overrides.rest_seconds ?? 90,
    is_completed: overrides.is_completed ?? true,
    completed_at: overrides.completed_at ?? NOW,
    is_pr_weight: false,
    is_pr_1rm: false,
    is_pr_volume: false,
    notes: overrides.notes ?? null,
    client_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe("exercise progress and workout history helpers", () => {
  it("derives chronological exercise progress excluding warmups and incomplete sets", () => {
    const workouts = [
      makeWorkout({
        id: "w-nov",
        workout_date: "2026-11-20",
        completed_at: "2026-11-20T10:45:00.000Z",
      }),
      makeWorkout({
        id: "w-oct",
        workout_date: "2026-10-05",
        completed_at: "2026-10-05T10:45:00.000Z",
      }),
      makeWorkout({
        id: "w-draft",
        status: "in_progress",
        workout_date: "2026-11-22",
      }),
    ];

    const sets = [
      makeSet({
        id: "s-oct-wu",
        workout_id: "w-oct",
        set_number: 1,
        set_type: "warmup",
        weight: 80,
        reps: 10,
      }),
      makeSet({
        id: "s-oct-1",
        workout_id: "w-oct",
        set_number: 2,
        weight: 60,
        reps: 8,
      }),
      makeSet({
        id: "s-nov-1",
        workout_id: "w-nov",
        set_number: 1,
        weight: 65,
        reps: 10,
      }),
      makeSet({
        id: "s-nov-2",
        workout_id: "w-nov",
        set_number: 2,
        weight: 70,
        reps: 5,
      }),
      makeSet({
        id: "s-draft",
        workout_id: "w-draft",
        set_number: 1,
        weight: 100,
        reps: 10,
      }),
    ];

    const progress = deriveExerciseProgressFromLocal(BENCH_ID, workouts, sets);
    expect(progress).toHaveLength(2);
    expect(progress[0]?.workout_id).toBe("w-oct");
    expect(progress[0]?.max_weight).toBe(60);
    expect(progress[0]?.best_est_1rm).toBe(76);
    expect(progress[0]?.total_volume).toBe(480);

    expect(progress[1]?.workout_id).toBe("w-nov");
    expect(progress[1]?.max_weight).toBe(70);
    expect(progress[1]?.best_est_1rm).toBe(86.67); // 65*(1+10/30) beats 70*(1+5/30)=81.67
    expect(progress[1]?.best_set_weight).toBe(65);
    expect(progress[1]?.best_set_reps).toBe(10);
    expect(progress[1]?.total_volume).toBe(1000); // 65*10 + 70*5
  });

  it("filters progress points accurately across time ranges", () => {
    const points = [
      {
        workout_id: "w-2y",
        workout_name: "Old",
        workout_date: "2024-11-01",
        completed_at: "2024-11-01T10:00:00.000Z",
        max_weight: 50,
        best_est_1rm: 60,
        total_volume: 500,
        best_set_weight: 50,
        best_set_reps: 6,
      },
      {
        workout_id: "w-45d",
        workout_name: "Mid",
        workout_date: "2026-10-08",
        completed_at: "2026-10-08T10:00:00.000Z",
        max_weight: 60,
        best_est_1rm: 76,
        total_volume: 600,
        best_set_weight: 60,
        best_set_reps: 8,
      },
      {
        workout_id: "w-5d",
        workout_name: "Recent",
        workout_date: "2026-11-17",
        completed_at: "2026-11-17T10:00:00.000Z",
        max_weight: 65,
        best_est_1rm: 86.67,
        total_volume: 650,
        best_set_weight: 65,
        best_set_reps: 10,
      },
    ];

    expect(
      filterProgressByTimeRange(points, "1M", "2026-11-22").map(
        (p) => p.workout_id
      )
    ).toEqual(["w-5d"]);
    expect(
      filterProgressByTimeRange(points, "3M", "2026-11-22").map(
        (p) => p.workout_id
      )
    ).toEqual(["w-45d", "w-5d"]);
    expect(
      filterProgressByTimeRange(points, "1Y", "2026-11-22").map(
        (p) => p.workout_id
      )
    ).toEqual(["w-45d", "w-5d"]);
    expect(
      filterProgressByTimeRange(points, "ALL", "2026-11-22")
    ).toHaveLength(3);
  });

  it("computes personal bests across points and sets", () => {
    const sets = [
      makeSet({ id: "s1", set_type: "warmup", weight: 90, reps: 10 }),
      makeSet({ id: "s2", set_type: "normal", weight: 65, reps: 10 }),
      makeSet({ id: "s3", set_type: "normal", weight: 70, reps: 5 }),
    ];

    const points = deriveExerciseProgressFromLocal(
      BENCH_ID,
      [makeWorkout()],
      sets
    );
    const bests = computeExercisePersonalBests(points, sets);

    expect(bests.allTimeMaxWeight).toBe(70);
    expect(bests.allTimeBest1RM).toBe(86.67);
    expect(bests.allTimeBestSetVolume).toBe(650);
    expect(bests.totalSessions).toBe(1);
    expect(bests.totalWorkingSets).toBe(2);
  });

  it("groups completed workouts descending by month and aggregates overview stats", () => {
    const workouts = [
      makeWorkout({
        id: "w-1",
        workout_date: "2026-10-12",
        total_volume: 1200,
        total_sets: 6,
        pr_count: 1,
      }),
      makeWorkout({
        id: "w-2",
        workout_date: "2026-11-02",
        total_volume: 1500,
        total_sets: 8,
        pr_count: 2,
      }),
      makeWorkout({
        id: "w-3",
        workout_date: "2026-11-20",
        total_volume: 800,
        total_sets: 4,
        pr_count: 0,
      }),
      makeWorkout({
        id: "w-4",
        status: "discarded",
        workout_date: "2026-11-22",
        total_volume: 9999,
      }),
    ];

    const groups = groupWorkoutsByMonth(workouts);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.monthKey).toBe("2026-11");
    expect(groups[0]?.workouts.map((w) => w.id)).toEqual(["w-3", "w-2"]);
    expect(groups[1]?.monthKey).toBe("2026-10");

    const overview = computeHistoryOverviewStats(workouts);
    expect(overview).toEqual({
      totalWorkouts: 3,
      totalVolume: 3500,
      totalSets: 18,
      totalPRs: 3,
    });
  });

  it("groups workout sets sequentially by exercise_order", () => {
    const sets = [
      makeSet({
        id: "s-b2",
        exercise_id: SQUAT_ID,
        exercise_order: 1,
        superset_group: 1,
        set_number: 2,
      }),
      makeSet({
        id: "s-a1",
        exercise_id: BENCH_ID,
        exercise_order: 0,
        superset_group: 1,
        set_number: 1,
        notes: "Pause 1s on chest",
      }),
      makeSet({
        id: "s-b1",
        exercise_id: SQUAT_ID,
        exercise_order: 1,
        superset_group: 1,
        set_number: 1,
      }),
    ];

    const grouped = groupWorkoutSetsByExercise(sets);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.exerciseId).toBe(BENCH_ID);
    expect(grouped[0]?.notes).toBe("Pause 1s on chest");
    expect(grouped[1]?.exerciseId).toBe(SQUAT_ID);
    expect(grouped[1]?.sets.map((s) => s.set_number)).toEqual([1, 2]);
  });
});
