import { describe, expect, it } from "vitest";
import { buildWeeklySplitSchedule } from "@/lib/schedule/weeklySplit";
import type { ScheduledWorkout } from "@/lib/types/domain";

const PUSH_ID = "11111111-1111-4111-8111-111111111111";
const PULL_ID = "22222222-2222-4222-8222-222222222222";
const RULE_MON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const RULE_WED = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function makeScheduled(
  overrides: Partial<ScheduledWorkout>
): ScheduledWorkout {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    routine_id: PUSH_ID,
    scheduled_date: "2026-11-23",
    status: "planned",
    workout_id: null,
    source_split_rule_id: null,
    notes: null,
    created_at: "2026-11-22T00:00:00.000Z",
    updated_at: "2026-11-22T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildWeeklySplitSchedule", () => {
  it("generates workouts over the requested week horizon for active rules", () => {
    let seq = 0;
    const result = buildWeeklySplitSchedule({
      rules: [
        {
          id: RULE_MON,
          day_of_week: 1, // Monday
          routine_id: PUSH_ID,
          sort_order: 0,
          is_active: true,
        },
        {
          id: RULE_WED,
          day_of_week: 3, // Wednesday
          routine_id: PULL_ID,
          sort_order: 0,
          is_active: true,
        },
      ],
      startDate: "2026-11-23", // Monday
      weeks: 4,
      existingScheduled: [],
      createId: () => `gen-${++seq}`,
      nowIso: "2026-11-22T12:00:00.000Z",
    });

    expect(result.removePlannedIds).toEqual([]);
    expect(result.generatedWorkouts).toHaveLength(8);
    expect(result.generatedWorkouts[0]).toMatchObject({
      id: "gen-1",
      routine_id: PUSH_ID,
      scheduled_date: "2026-11-23",
      source_split_rule_id: RULE_MON,
    });
    expect(result.generatedWorkouts[1]).toMatchObject({
      id: "gen-2",
      routine_id: PULL_ID,
      scheduled_date: "2026-11-25",
      source_split_rule_id: RULE_WED,
    });
  });

  it("replaces future auto-generated planned workouts while preserving completed, past, and manual entries", () => {
    let seq = 0;
    const existing: ScheduledWorkout[] = [
      // Past planned auto-generated -> preserve
      makeScheduled({
        id: "past-auto",
        scheduled_date: "2026-11-16",
        source_split_rule_id: RULE_MON,
      }),
      // Future completed auto-generated on Nov 23 -> preserve and skip duplicate
      makeScheduled({
        id: "done-today",
        scheduled_date: "2026-11-23",
        status: "completed",
        source_split_rule_id: RULE_MON,
      }),
      // Future manual assignment on Nov 25 -> preserve and skip duplicate
      makeScheduled({
        id: "manual-wed",
        routine_id: PULL_ID,
        scheduled_date: "2026-11-25",
        source_split_rule_id: null,
      }),
      // Future auto-generated planned on Nov 30 -> should be queued for removal
      makeScheduled({
        id: "old-future-auto",
        scheduled_date: "2026-11-30",
        source_split_rule_id: RULE_MON,
      }),
    ];

    const result = buildWeeklySplitSchedule({
      rules: [
        {
          id: RULE_MON,
          day_of_week: 1,
          routine_id: PUSH_ID,
          sort_order: 0,
          is_active: true,
        },
        {
          id: RULE_WED,
          day_of_week: 3,
          routine_id: PULL_ID,
          sort_order: 0,
          is_active: true,
        },
      ],
      startDate: "2026-11-23",
      weeks: 2,
      existingScheduled: existing,
      createId: () => `gen-${++seq}`,
    });

    expect(result.removePlannedIds).toEqual(["old-future-auto"]);
    // Week 1 Mon (Nov 23) skipped because done-today; Week 1 Wed (Nov 25) skipped because manual-wed
    // Week 2 Mon (Nov 30) & Week 2 Wed (Dec 2) generated
    expect(result.generatedWorkouts.map((w) => w.scheduled_date)).toEqual([
      "2026-11-30",
      "2026-12-02",
    ]);
  });
});
