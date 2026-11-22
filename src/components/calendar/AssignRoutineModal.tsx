"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ClipboardList, X } from "lucide-react";
import { addDays, getTodayLocalDate } from "@/lib/dates/localDate";
import { putLocalScheduledWorkout } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import type {
  Routine,
  RoutineExercise,
  ScheduledWorkout,
} from "@/lib/types/domain";
import { upsertScheduledWorkoutPayloadSchema } from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface AssignRoutineModalProps {
  open: boolean;
  defaultDate: string;
  editingSchedule: ScheduledWorkout | null;
  routines: Routine[];
  routineExercises: RoutineExercise[];
  onClose: () => void;
}

export function AssignRoutineModal({
  open,
  defaultDate,
  editingSchedule,
  routines,
  routineExercises,
  onClose,
}: AssignRoutineModalProps) {
  const [scheduledDate, setScheduledDate] = useState(defaultDate);
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingSchedule) {
      setScheduledDate(editingSchedule.scheduled_date);
      setSelectedRoutineId(editingSchedule.routine_id);
      setNotes(editingSchedule.notes ?? "");
    } else {
      setScheduledDate(defaultDate);
      setSelectedRoutineId(routines[0]?.id ?? "");
      setNotes("");
    }
    setErrorMessage(null);
  }, [open, editingSchedule, defaultDate, routines]);

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

  const today = getTodayLocalDate();
  const tomorrow = addDays(today, 1);

  const countByRoutine = new Map<string, number>();
  for (const row of routineExercises) {
    countByRoutine.set(
      row.routine_id,
      (countByRoutine.get(row.routine_id) ?? 0) + 1
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const scheduleId = editingSchedule
      ? editingSchedule.id
      : crypto.randomUUID();

    const parsed = upsertScheduledWorkoutPayloadSchema.safeParse({
      id: scheduleId,
      routine_id: selectedRoutineId,
      scheduled_date: scheduledDate,
      status: editingSchedule?.status ?? "planned",
      workout_id: editingSchedule?.workout_id ?? null,
      // Clearing source_split_rule_id marks manual scheduling/moves so weekly
      // split regeneration preserves the user's manual placement.
      source_split_rule_id: null,
      notes,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(
        firstIssue?.message ?? "Please select a valid date and routine."
      );
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const optimisticItem: ScheduledWorkout = {
        id: parsed.data.id,
        routine_id: parsed.data.routine_id,
        scheduled_date: parsed.data.scheduled_date,
        status: parsed.data.status,
        workout_id: parsed.data.workout_id,
        source_split_rule_id: parsed.data.source_split_rule_id,
        notes: parsed.data.notes,
        created_at: editingSchedule?.created_at ?? now,
        updated_at: now,
      };

      useAppDataStore
        .getState()
        .upsertScheduledWorkoutOptimistic(optimisticItem);
      await putLocalScheduledWorkout(optimisticItem);

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: "UPSERT_SCHEDULED_WORKOUT",
          clientUpdatedAt: now,
          payload: parsed.data,
        },
        `scheduled:${scheduleId}`
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
      aria-label={editingSchedule ? "Move Workout" : "Schedule Workout"}
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close schedule modal"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              {editingSchedule ? "Move Workout" : "Schedule Workout"}
            </h2>
          </div>

          <button
            type="submit"
            form="assign-routine-form"
            disabled={submitting || routines.length === 0 || !selectedRoutineId}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            Save
          </button>
        </div>
      </header>

      <form
        id="assign-routine-form"
        onSubmit={handleSubmit}
        className="pb-safe flex-1 overflow-y-auto bg-white"
      >
        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}

        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          {/* Date selector */}
          <div className="space-y-2.5 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="schedule-date-input"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Workout Date
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setScheduledDate(today)}
                  className={`min-h-[34px] rounded-full border px-3 text-xs font-medium transition-colors ${
                    scheduledDate === today
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setScheduledDate(tomorrow)}
                  className={`min-h-[34px] rounded-full border px-3 text-xs font-medium transition-colors ${
                    scheduledDate === tomorrow
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
                  }`}
                >
                  Tomorrow
                </button>
              </div>
            </div>

            <input
              id="schedule-date-input"
              type="date"
              required
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="tabular-nums min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Routine selection */}
          <div className="py-3">
            <div className="px-4 pb-2 sm:px-6">
              <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Select Routine
              </span>
            </div>

            {routines.length > 0 ? (
              <ul className="divide-y divide-zinc-200 border-t border-zinc-200">
                {routines.map((routine) => {
                  const selected = routine.id === selectedRoutineId;
                  const exerciseCount = countByRoutine.get(routine.id) ?? 0;

                  return (
                    <li key={routine.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedRoutineId(routine.id)}
                        className={`flex min-h-[56px] w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors sm:px-6 ${
                          selected ? "bg-emerald-50/50" : "hover:bg-zinc-50"
                        }`}
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full"
                            style={{ backgroundColor: routine.color }}
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-950">
                              {routine.name}
                            </p>
                            <p className="tabular-nums text-xs text-zinc-500">
                              {exerciseCount}{" "}
                              {exerciseCount === 1 ? "exercise" : "exercises"}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                            selected
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-zinc-300 bg-white"
                          }`}
                        >
                          {selected && (
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="border-t border-zinc-200 px-4 py-8 text-center sm:px-6">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
                  <ClipboardList className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-3 text-sm font-semibold text-zinc-950">
                  No routines saved yet
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Create a routine before assigning it to the calendar.
                </p>
                <Link
                  href="/routines"
                  onClick={onClose}
                  className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Go to Routines
                </Link>
              </div>
            )}
          </div>

          {/* Optional note */}
          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="schedule-notes-input"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Session Note (optional)
            </label>
            <input
              id="schedule-notes-input"
              type="text"
              maxLength={400}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Morning session before travel"
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
