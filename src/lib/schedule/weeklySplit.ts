import { addDays, getIsoDayOfWeek } from "@/lib/dates/localDate";
import type { ScheduledWorkout, WeeklySplitRule } from "@/lib/types/domain";

export interface BuildWeeklySplitParams {
  rules: Array<
    Pick<
      WeeklySplitRule,
      "id" | "day_of_week" | "routine_id" | "sort_order" | "is_active"
    >
  >;
  startDate: string;
  weeks: number;
  existingScheduled: ScheduledWorkout[];
  createId?: () => string;
  nowIso?: string;
}

export interface WeeklySplitGenerationResult {
  removePlannedIds: string[];
  generatedWorkouts: ScheduledWorkout[];
}

export function buildWeeklySplitSchedule({
  rules,
  startDate,
  weeks,
  existingScheduled,
  createId = () => crypto.randomUUID(),
  nowIso = new Date().toISOString(),
}: BuildWeeklySplitParams): WeeklySplitGenerationResult {
  const removePlannedIds: string[] = [];
  const removeIdSet = new Set<string>();

  for (const row of existingScheduled) {
    if (
      row.status === "planned" &&
      row.source_split_rule_id !== null &&
      row.scheduled_date >= startDate
    ) {
      removePlannedIds.push(row.id);
      removeIdSet.add(row.id);
    }
  }

  // Keep existing completed workouts, past entries, and manual overrides untouched
  const occupiedKeys = new Set<string>();
  for (const row of existingScheduled) {
    if (!removeIdSet.has(row.id)) {
      occupiedKeys.add(`${row.scheduled_date}::${row.routine_id}`);
    }
  }

  const activeRules = [...rules]
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const generatedWorkouts: ScheduledWorkout[] = [];
  const totalDays = Math.max(0, weeks * 7);

  for (let offset = 0; offset < totalDays; offset += 1) {
    const dateStr = addDays(startDate, offset);
    const isoDay = getIsoDayOfWeek(dateStr);

    for (const rule of activeRules) {
      if (rule.day_of_week !== isoDay) {
        continue;
      }

      const key = `${dateStr}::${rule.routine_id}`;
      if (occupiedKeys.has(key)) {
        continue;
      }

      occupiedKeys.add(key);
      generatedWorkouts.push({
        id: createId(),
        routine_id: rule.routine_id,
        scheduled_date: dateStr,
        status: "planned",
        workout_id: null,
        source_split_rule_id: rule.id,
        notes: null,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }
  }

  return {
    removePlannedIds,
    generatedWorkouts,
  };
}
