import { describe, expect, it } from "vitest";
import {
  buildExerciseIdRemap,
  parseBackupJsonText,
  remapBackupData,
} from "@/lib/export/workoutImport";

const OLD_BENCH_ID = "11111111-1111-4111-8111-111111111111";
const DB_BENCH_ID = "dc355ecf-4705-4e55-b707-91399df9f290";
const CUSTOM_ID = "22222222-2222-4222-8222-222222222222";
const ROUTINE_ID = "33333333-3333-4333-8333-333333333333";
const WORKOUT_ID = "44444444-4444-4444-8444-444444444444";

function makeValidBackupObject() {
  return {
    schemaVersion: 1,
    exportedAt: "2026-11-22T20:00:00.000Z",
    data: {
      exercises: [
        {
          id: OLD_BENCH_ID,
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
        },
        {
          id: CUSTOM_ID,
          slug: null,
          name: "Cable Y-Raise",
          muscle_group: "shoulders",
          secondary_muscles: [],
          equipment: "cable",
          tracking_type: "weight_reps",
          media_gif_url: null,
          media_image_start_url: null,
          media_image_end_url: null,
          custom_video_url: null,
          instructions: [],
          is_custom: true,
          archived_at: null,
        },
      ],
      routines: [
        {
          id: ROUTINE_ID,
          name: "Push Day",
          color: "#059669",
          notes: null,
          sort_order: 0,
          last_performed_at: null,
          archived_at: null,
        },
      ],
      routineExercises: [
        {
          id: "55555555-5555-4555-8555-555555555551",
          routine_id: ROUTINE_ID,
          exercise_id: OLD_BENCH_ID,
          sort_order: 0,
          superset_group: null,
          target_sets: 3,
          target_reps_min: 8,
          target_reps_max: 10,
          target_rpe: 8,
          rest_seconds: 90,
          notes: null,
        },
      ],
      weeklySplitRules: [
        {
          id: "66666666-6666-4666-8666-666666666661",
          day_of_week: 1,
          routine_id: ROUTINE_ID,
          sort_order: 0,
          is_active: true,
        },
      ],
      scheduledWorkouts: [],
      workouts: [
        {
          id: WORKOUT_ID,
          routine_id: ROUTINE_ID,
          name: "Push Day",
          notes: null,
          status: "completed",
          workout_date: "2026-11-22",
          started_at: "2026-11-22T10:00:00.000Z",
          completed_at: "2026-11-22T10:45:00.000Z",
          duration_seconds: 2700,
          weight_unit: "kg",
          total_volume: 600,
          total_sets: 1,
          pr_count: 1,
        },
      ],
      workoutSets: [
        {
          id: "77777777-7777-4777-8777-777777777771",
          workout_id: WORKOUT_ID,
          exercise_id: OLD_BENCH_ID,
          exercise_order: 0,
          superset_group: null,
          set_number: 1,
          set_type: "normal",
          weight: 60,
          reps: 10,
          rpe: 8,
          duration_seconds: null,
          rest_seconds: 90,
          is_completed: true,
          completed_at: "2026-11-22T10:15:00.000Z",
          is_pr_weight: true,
          is_pr_1rm: true,
          is_pr_volume: true,
          notes: null,
        },
      ],
      settings: {
        weight_unit: "kg",
        default_rest_seconds: 90,
        auto_start_rest_timer: true,
        show_rpe_column: true,
        timer_sound_enabled: true,
        timer_haptics_enabled: true,
      },
    },
  };
}

describe("workoutImport", () => {
  it("parses and summarizes valid v1 backup JSON", () => {
    const parsed = parseBackupJsonText(JSON.stringify(makeValidBackupObject()));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.summary).toEqual({
        exportedAt: "2026-11-22T20:00:00.000Z",
        exercises: 2,
        routines: 1,
        routineExercises: 1,
        weeklySplitRules: 1,
        scheduledWorkouts: 0,
        workouts: 1,
        workoutSets: 1,
        hasSettings: true,
      });
    }
  });

  it("rejects malformed JSON and unsupported schemaVersion", () => {
    expect(parseBackupJsonText("{bad json").ok).toBe(false);

    const wrongVersion = { ...makeValidBackupObject(), schemaVersion: 2 };
    const result = parseBackupJsonText(JSON.stringify(wrongVersion));
    expect(result.ok).toBe(false);
  });

  it("rejects broken foreign-key references inside backup data", () => {
    const broken = makeValidBackupObject();
    broken.data.workoutSets[0]!.workout_id =
      "99999999-9999-4999-8999-999999999999";

    const result = parseBackupJsonText(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("missing workout");
    }
  });

  it("remaps matched built-in exercises by slug/name while preserving new custom exercises", () => {
    const parsed = parseBackupJsonText(JSON.stringify(makeValidBackupObject()));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const { idMap, exercisesToUpsert } = buildExerciseIdRemap(
      parsed.backup.data.exercises,
      [
        {
          id: DB_BENCH_ID,
          slug: "barbell-bench-press",
          name: "Barbell Bench Press",
          is_custom: false,
          archived_at: null,
        },
      ]
    );

    expect(idMap.get(OLD_BENCH_ID)).toBe(DB_BENCH_ID);
    expect(idMap.get(CUSTOM_ID)).toBe(CUSTOM_ID);
    expect(exercisesToUpsert.map((e) => e.id)).toEqual([CUSTOM_ID]);

    const remapped = remapBackupData(parsed.backup.data, idMap);
    expect(remapped.routineExercises[0]?.exercise_id).toBe(DB_BENCH_ID);
    expect(remapped.workoutSets[0]?.exercise_id).toBe(DB_BENCH_ID);
  });
});
