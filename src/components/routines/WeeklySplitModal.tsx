"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { ISO_DAY_LABELS, getTodayLocalDate } from "@/lib/dates/localDate";
import { putLocalWeeklySplitAndSchedule } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { buildWeeklySplitSchedule } from "@/lib/schedule/weeklySplit";
import type {
  Routine,
  ScheduledWorkout,
  WeeklySplitRule,
} from "@/lib/types/domain";
import { saveWeeklySplitPayloadSchema } from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface WeeklySplitModalProps {
  open: boolean;
  routines: Routine[];
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
  onClose: () => void;
}

const WEEK_HORIZONS = [4, 8, 12] as const;

export function WeeklySplitModal({
  open,
  routines,
  weeklySplitRules,
  scheduledWorkouts,
  onClose,
}: WeeklySplitModalProps) {
  // day_of_week (1..7) -> ordered array of routine IDs
  const [dayAssignments, setDayAssignments] = useState<
    Record<number, string[]>
  >({});
  const [applyToCalendar, setApplyToCalendar] = useState(true);
  const [horizonWeeks, setHorizonWeeks] = useState<number>(4);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const initial: Record<number, string[]> = {};
    for (const { day } of ISO_DAY_LABELS) {
      initial[day] = [];
    }

    const sorted = [...weeklySplitRules]
      .filter((r) => r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const rule of sorted) {
      const list = initial[rule.day_of_week] ?? [];
      list.push(rule.routine_id);
      initial[rule.day_of_week] = list;
    }

    setDayAssignments(initial);
    setApplyToCalendar(true);
    setHorizonWeeks(4);
    setErrorMessage(null);
  }, [open, weeklySplitRules]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const routineById = new Map(routines.map((r) => [r.id, r]));

  function handlePrimaryChange(day: number, routineId: string) {
    setDayAssignments((prev) => {
      const current = prev[day] ?? [];
      if (routineId === "") {
        return { ...prev, [day]: [] };
      }
      const rest = current.slice(1);
      return { ...prev, [day]: [routineId, ...rest] };
    });
  }

  function handleSlotChange(day: number, slotIdx: number, routineId: string) {
    setDayAssignments((prev) => {
      const current = [...(prev[day] ?? [])];
      if (routineId === "") {
        current.splice(slotIdx, 1);
      } else {
        current[slotIdx] = routineId;
      }
      return { ...prev, [day]: current };
    });
  }

  function handleAddSlot(day: number) {
    const fallbackRoutine = routines[0]?.id;
    if (!fallbackRoutine) return;
    setDayAssignments((prev) => {
      const current = prev[day] ?? [];
      return { ...prev, [day]: [...current, fallbackRoutine] };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const now = new Date().toISOString();
    const nextRules: WeeklySplitRule[] = [];

    for (const { day } of ISO_DAY_LABELS) {
      const assignedIds = dayAssignments[day] ?? [];
      assignedIds.forEach((routineId, idx) => {
        if (routineById.has(routineId)) {
          nextRules.push({
            id: crypto.randomUUID(),
            day_of_week: day,
            routine_id: routineId,
            sort_order: idx,
            is_active: true,
            created_at: now,
            updated_at: now,
          });
        }
      });
    }

    const scheduleDelta = applyToCalendar
      ? buildWeeklySplitSchedule({
          rules: nextRules,
          startDate: getTodayLocalDate(),
          weeks: horizonWeeks,
          existingScheduled: scheduledWorkouts,
          nowIso: now,
        })
      : { removePlannedIds: [], generatedWorkouts: [] };

    const parsed = saveWeeklySplitPayloadSchema.safeParse({
      rules: nextRules.map((r) => ({
        id: r.id,
        day_of_week: r.day_of_week,
        routine_id: r.routine_id,
        sort_order: r.sort_order,
        is_active: r.is_active,
      })),
      removePlannedIds: scheduleDelta.removePlannedIds,
      generatedWorkouts: scheduleDelta.generatedWorkouts.map((sw) => ({
        id: sw.id,
        routine_id: sw.routine_id,
        scheduled_date: sw.scheduled_date,
        status: sw.status,
        workout_id: sw.workout_id,
        source_split_rule_id: sw.source_split_rule_id,
        notes: sw.notes,
      })),
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(firstIssue?.message ?? "Invalid weekly split configuration.");
      return;
    }

    setSubmitting(true);
    try {
      useAppDataStore.getState().saveWeeklySplitOptimistic({
        rules: nextRules,
        removePlannedIds: scheduleDelta.removePlannedIds,
        generatedWorkouts: scheduleDelta.generatedWorkouts,
      });

      await putLocalWeeklySplitAndSchedule({
        rules: nextRules,
        removePlannedIds: scheduleDelta.removePlannedIds,
        generatedWorkouts: scheduleDelta.generatedWorkouts,
      });

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: "SAVE_WEEKLY_SPLIT",
          clientUpdatedAt: now,
          payload: parsed.data,
        },
        "schedule:weekly_split"
      );

      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Weekly Split Schedule"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close weekly split"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              Weekly Split
            </h2>
          </div>

          <button
            type="submit"
            form="weekly-split-form"
            disabled={submitting || routines.length === 0}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            Save
          </button>
        </div>
      </header>

      <form
        id="weekly-split-form"
        onSubmit={handleSubmit}
        className="pb-safe flex-1 overflow-y-auto bg-white"
      >
        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}

        {routines.length === 0 ? (
          <div className="border-b border-zinc-200 px-4 py-10 text-center sm:px-6">
            <p className="text-sm font-semibold text-zinc-950">
              Create at least one routine first
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Once you have routines saved, assign them to days of the week
              here.
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-200 border-b border-zinc-200">
              {ISO_DAY_LABELS.map(({ day, full }) => {
                const slots = dayAssignments[day] ?? [];
                const primaryId = slots[0] ?? "";
                const primaryRoutine = routineById.get(primaryId);

                return (
                  <div key={day} className="space-y-2.5 px-4 py-3.5 sm:px-6">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              primaryRoutine?.color ?? "#E4E4E7",
                          }}
                        />
                        <label
                          htmlFor={`split-day-${day}-0`}
                          className="text-sm font-semibold text-zinc-950"
                        >
                          {full}
                        </label>
                      </div>

                      {primaryId !== "" && routines.length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleAddSlot(day)}
                          className="inline-flex min-h-[34px] items-center gap-1 rounded-full border border-zinc-200 px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                          <span>Add session</span>
                        </button>
                      )}
                    </div>

                    <select
                      id={`split-day-${day}-0`}
                      value={primaryId}
                      onChange={(e) => handlePrimaryChange(day, e.target.value)}
                      className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    >
                      <option value="">Rest Day</option>
                      {routines.map((routine) => (
                        <option key={routine.id} value={routine.id}>
                          {routine.name}
                        </option>
                      ))}
                    </select>

                    {slots.slice(1).map((slotRoutineId, extraIdx) => {
                      const slotIndex = extraIdx + 1;
                      return (
                        <div
                          key={`${day}-slot-${slotIndex}`}
                          className="flex items-center gap-2"
                        >
                          <select
                            aria-label={`${full} additional session ${slotIndex + 1}`}
                            value={slotRoutineId}
                            onChange={(e) =>
                              handleSlotChange(day, slotIndex, e.target.value)
                            }
                            className="min-h-[44px] flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                          >
                            {routines.map((routine) => (
                              <option key={routine.id} value={routine.id}>
                                {routine.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSlotChange(day, slotIndex, "")}
                            aria-label={`Remove extra session on ${full}`}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="space-y-4 px-4 py-5 sm:px-6">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <span className="block text-sm font-semibold text-zinc-950">
                    Apply split to calendar starting today
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">
                    Replaces future split-generated planned workouts. Completed
                    sessions and manual calendar overrides are preserved.
                  </span>
                </div>
                <input
                  id="split-apply-calendar"
                  type="checkbox"
                  checked={applyToCalendar}
                  onChange={(e) => setApplyToCalendar(e.target.checked)}
                  className="h-5 w-5 shrink-0 accent-emerald-600"
                />
              </label>

              {applyToCalendar && (
                <div className="grid grid-cols-3 gap-2">
                  {WEEK_HORIZONS.map((weeks) => {
                    const active = horizonWeeks === weeks;
                    return (
                      <button
                        key={weeks}
                        type="button"
                        onClick={() => setHorizonWeeks(weeks)}
                        className={`tabular-nums min-h-[44px] rounded-lg border text-sm font-medium transition-colors ${
                          active
                            ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                        }`}
                      >
                        {weeks} Weeks
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
