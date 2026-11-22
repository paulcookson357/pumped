import { describe, expect, it } from "vitest";
import type { Workout, WorkoutSet } from "@/lib/types/domain";
import {
  computeOptimisticPRs,
  computeWorkoutTotals,
  derivePreviousPerformanceFromLocal,
  formatElapsedDuration,
  formatPreviousSetLabel,
  formatRestRemaining,
} from "@/lib/workouts/stats";

const BENCH_ID = "11111111-1111-4111-8111-111111111111";
const SQUAT_ID = "22222222-2222-4222-8222-222222222222";
const NOW = "2026-11-22T12:00:00.000Z";

function makeSet(overrides: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: overrides.id ?? "set-1",
    workout_id: overrides.workout_id ?? "w-current",
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
    notes: null,
    client_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

function makeWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: overrides.id ?? "w-prior",
    routine_id: overrides.routine_id ?? null,
    name: overrides.name ?? "Push",
    notes: null,
    status: overrides.status ?? "completed",
    workout_date: overrides.workout_date ?? "2026-11-20",
    started_at: overrides.started_at ?? "2026-11-20T10:00:00.000Z",
    completed_at: overrides.completed_at ?? "2026-11-20T10:45:00.000Z",
    duration_seconds: overrides.duration_seconds ?? 2700,
    weight_unit: "kg",
    total_volume: overrides.total_volume ?? 1000,
    total_sets: overrides.total_sets ?? 3,
    pr_count: 0,
    client_updated_at: NOW,
    created_at: NOW,
    updated_at: NOW,
  };
}

describe("workout stats and optimistic PR computation", () => {
  it("computes totalSets including warmups while excluding warmups from working volume", () => {
    const sets = [
      makeSet({ id: "s1", set_type: "warmup", weight: 40, reps: 10, is_completed: true }),
      makeSet({ id: "s2", set_type: "normal", weight: 80, reps: 5, is_completed: true }),
      makeSet({ id: "s3", set_type: "dropset", weight: 60, reps: 8, is_completed: true }),
      makeSet({ id: "s4", set_type: "normal", weight: 100, reps: 5, is_completed: false }),
    ];

    const totals = computeWorkoutTotals(sets);
    expect(totals.totalSets).toBe(3);
    expect(totals.workingSets).toBe(2);
    expect(totals.totalVolume).toBe(880); // 80*5 + 60*8
  });

  it("marks first-ever working sets as PRs while ignoring warmups", () => {
    const sets = [
      makeSet({ id: "s1", set_type: "warmup", weight: 100, reps: 10 }),
      makeSet({ id: "s2", set_number: 2, set_type: "normal", weight: 60, reps: 10 }),
    ];

    const res = computeOptimisticPRs(sets, [], []);
    expect(res.prCount).toBe(1);
    expect(res.setsWithPRs[0]?.is_pr_weight).toBe(false);
    expect(res.setsWithPRs[1]?.is_pr_weight).toBe(true);
    expect(res.setsWithPRs[1]?.is_pr_1rm).toBe(true);
    expect(res.setsWithPRs[1]?.is_pr_volume).toBe(true);
  });

  it("triggers PR only when beating prior completed max and never on ties", () => {
    const priorWorkouts = [makeWorkout({ id: "w1", status: "completed" })];
    const priorSets = [
      makeSet({ id: "p1", workout_id: "w1", weight: 80, reps: 5 }), // 1RM 93.33, vol 400
    ];

    // Tie set (80x5) plus heavier single (90x1 -> 1RM 90, vol 90 -> Weight PR only)
    // plus volume/1RM set (70x12 -> 1RM 98, vol 840 -> 1RM + Volume PR)
    const currentSets = [
      makeSet({ id: "c1", set_number: 1, weight: 80, reps: 5 }),
      makeSet({ id: "c2", set_number: 2, weight: 90, reps: 1 }),
      makeSet({ id: "c3", set_number: 3, weight: 70, reps: 12 }),
    ];

    const res = computeOptimisticPRs(
      currentSets,
      priorWorkouts,
      priorSets,
      "w-current"
    );

    expect(res.prCount).toBe(2);
    expect(res.setsWithPRs[0]?.is_pr_weight).toBe(false);
    expect(res.setsWithPRs[1]?.is_pr_weight).toBe(true);
    expect(res.setsWithPRs[1]?.is_pr_1rm).toBe(false);
    expect(res.setsWithPRs[1]?.is_pr_volume).toBe(false);
    expect(res.setsWithPRs[2]?.is_pr_weight).toBe(false);
    expect(res.setsWithPRs[2]?.is_pr_1rm).toBe(true);
    expect(res.setsWithPRs[2]?.is_pr_volume).toBe(true);
  });

  it("derives previous performance from the most recent completed workout per exercise", () => {
    const olderWorkout = makeWorkout({
      id: "w-old",
      completed_at: "2026-11-10T10:00:00.000Z",
    });
    const newerWorkout = makeWorkout({
      id: "w-new",
      completed_at: "2026-11-21T10:00:00.000Z",
    });
    const sets = [
      makeSet({ id: "o1", workout_id: "w-old", exercise_id: BENCH_ID, weight: 50, reps: 10 }),
      makeSet({ id: "n1", workout_id: "w-new", exercise_id: BENCH_ID, weight: 62.5, reps: 8 }),
      makeSet({ id: "o2", workout_id: "w-old", exercise_id: SQUAT_ID, weight: 100, reps: 5 }),
    ];

    const prev = derivePreviousPerformanceFromLocal(
      [olderWorkout, newerWorkout],
      sets,
      [BENCH_ID, SQUAT_ID]
    );

    expect(prev[BENCH_ID]?.workout_id).toBe("w-new");
    expect(prev[BENCH_ID]?.sets[0]?.weight).toBe(62.5);
    expect(prev[SQUAT_ID]?.workout_id).toBe("w-old");
  });

  it("formats elapsed duration, rest remaining, and previous set labels", () => {
    expect(formatElapsedDuration(65)).toBe("1:05");
    expect(formatElapsedDuration(3665)).toBe("1:01:05");
    expect(formatRestRemaining(90)).toBe("1:30");

    expect(
      formatPreviousSetLabel(
        { weight: 60, reps: 10, duration_seconds: null },
        "weight_reps",
        "kg"
      )
    ).toBe("60 kg × 10");
    expect(
      formatPreviousSetLabel(
        { weight: 0, reps: 12, duration_seconds: null },
        "weighted_bodyweight",
        "kg"
      )
    ).toBe("BW × 12");
    expect(
      formatPreviousSetLabel(
        { weight: null, reps: null, duration_seconds: 75 },
        "duration",
        "kg"
      )
    ).toBe("1m 15s");
  });
});
