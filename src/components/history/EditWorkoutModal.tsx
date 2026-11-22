"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import {
  EditWorkoutExerciseSection,
  type EditableExerciseDraft,
  type EditableSetDraft,
} from "@/components/history/EditWorkoutExerciseSection";
import { ExercisePickerModal } from "@/components/routines/ExercisePickerModal";
import { putLocalCompletedWorkout } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { getSupersetPositions } from "@/lib/routines/supersets";
import type { Exercise, Workout, WorkoutSet } from "@/lib/types/domain";
import { updateWorkoutPayloadSchema } from "@/lib/validation/schemas";
import { groupWorkoutSetsByExercise } from "@/lib/workouts/progress";
import { computeOptimisticPRs, computeWorkoutTotals } from "@/lib/workouts/stats";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface EditWorkoutModalProps {
  open: boolean;
  workout: Workout;
  sets: WorkoutSet[];
  exercises: Exercise[];
  onClose: () => void;
}

function buildInitialDrafts(sets: WorkoutSet[]): EditableExerciseDraft[] {
  const groups = groupWorkoutSetsByExercise(sets.filter((s) => s.is_completed));
  return groups.map((group) => ({
    draftId: crypto.randomUUID(),
    exerciseId: group.exerciseId,
    supersetGroup: group.supersetGroup,
    notes: group.notes,
    sets: group.sets.map((ws) => ({
      id: ws.id,
      setType: ws.set_type,
      weight: ws.weight !== null ? String(ws.weight) : "",
      reps: ws.reps !== null ? String(ws.reps) : "",
      rpe: ws.rpe,
      durationSeconds:
        ws.duration_seconds !== null ? String(ws.duration_seconds) : "",
      restSeconds: ws.rest_seconds,
      notes: ws.notes,
      completedAt: ws.completed_at,
    })),
  }));
}

function parseOptionalNumber(raw: string, integer = false): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return NaN;
  return integer ? Math.trunc(num) : num;
}

export function EditWorkoutModal({
  open,
  workout,
  sets,
  exercises,
  onClose,
}: EditWorkoutModalProps) {
  const router = useRouter();
  const [name, setName] = useState(workout.name);
  const [workoutDate, setWorkoutDate] = useState(workout.workout_date);
  const [durationMinutes, setDurationMinutes] = useState(
    String(Math.max(1, Math.round((workout.duration_seconds ?? 0) / 60)))
  );
  const [notes, setNotes] = useState(workout.notes ?? "");
  const [draftExercises, setDraftExercises] = useState<EditableExerciseDraft[]>(
    []
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(workout.name);
    setWorkoutDate(workout.workout_date);
    setDurationMinutes(
      String(Math.max(0, Math.round((workout.duration_seconds ?? 0) / 60)))
    );
    setNotes(workout.notes ?? "");
    setDraftExercises(buildInitialDrafts(sets));
    setPickerOpen(false);
    setErrorMessage(null);
  }, [open, workout, sets]);

  useEffect(() => {
    if (!open || pickerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, pickerOpen, onClose]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  const supersetLabels = useMemo(
    () =>
      getSupersetPositions(
        draftExercises.map((d) => ({ superset_group: d.supersetGroup }))
      ),
    [draftExercises]
  );

  if (!open) {
    return null;
  }

  function updateExerciseSet(
    draftId: string,
    setId: string,
    patch: Partial<EditableSetDraft>
  ) {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.draftId === draftId
          ? {
              ...ex,
              sets: ex.sets.map((s) =>
                s.id === setId ? { ...s, ...patch } : s
              ),
            }
          : ex
      )
    );
  }

  function addSetToExercise(draftId: string) {
    setDraftExercises((prev) =>
      prev.map((ex) => {
        if (ex.draftId !== draftId) return ex;
        const last = ex.sets[ex.sets.length - 1];
        const nextSet: EditableSetDraft = {
          id: crypto.randomUUID(),
          setType: "normal",
          weight: last?.weight ?? "",
          reps: last?.reps ?? "",
          rpe: last?.rpe ?? null,
          durationSeconds: last?.durationSeconds ?? "",
          restSeconds: last?.restSeconds ?? null,
          notes: null,
          completedAt: null,
        };
        return { ...ex, sets: [...ex.sets, nextSet] };
      })
    );
  }

  function removeSetFromExercise(draftId: string, setId: string) {
    setDraftExercises((prev) =>
      prev.map((ex) =>
        ex.draftId === draftId && ex.sets.length > 1
          ? { ...ex, sets: ex.sets.filter((s) => s.id !== setId) }
          : ex
      )
    );
  }

  function removeExerciseBlock(draftId: string) {
    setDraftExercises((prev) => prev.filter((ex) => ex.draftId !== draftId));
  }

  function handleAddExercises(selectedIds: string[]) {
    const newBlocks: EditableExerciseDraft[] = selectedIds.map((exerciseId) => ({
      draftId: crypto.randomUUID(),
      exerciseId,
      supersetGroup: null,
      notes: null,
      sets: [
        {
          id: crypto.randomUUID(),
          setType: "normal",
          weight: "",
          reps: "",
          rpe: null,
          durationSeconds: "",
          restSeconds: null,
          notes: null,
          completedAt: null,
        },
      ],
    }));
    setDraftExercises((prev) => [...prev, ...newBlocks]);
    setPickerOpen(false);
    setErrorMessage(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const minsNum = Number(durationMinutes.trim() || "0");
    if (!Number.isFinite(minsNum) || minsNum < 0 || minsNum > 1440) {
      setErrorMessage("Duration must be between 0 and 1440 minutes.");
      return;
    }

    const durationSeconds = Math.round(minsNum) * 60;
    const nowIso = new Date().toISOString();
    const effectiveCompletedAt =
      workoutDate === workout.workout_date && workout.completed_at
        ? workout.completed_at
        : `${workoutDate}T12:00:00.000Z`;
    const completedMs = Date.parse(effectiveCompletedAt);
    const effectiveStartedAt = Number.isFinite(completedMs)
      ? new Date(completedMs - durationSeconds * 1000).toISOString()
      : workout.started_at;

    const payloadSets = [];
    for (let exOrder = 0; exOrder < draftExercises.length; exOrder += 1) {
      const exDraft = draftExercises[exOrder];
      if (!exDraft) continue;

      for (let sIdx = 0; sIdx < exDraft.sets.length; sIdx += 1) {
        const s = exDraft.sets[sIdx];
        if (!s) continue;

        const w = parseOptionalNumber(s.weight, false);
        const r = parseOptionalNumber(s.reps, true);
        const d = parseOptionalNumber(s.durationSeconds, true);
        if (Number.isNaN(w) || Number.isNaN(r) || Number.isNaN(d)) {
          setErrorMessage("Weights and reps must be valid non-negative numbers.");
          return;
        }

        payloadSets.push({
          id: s.id,
          exercise_id: exDraft.exerciseId,
          exercise_order: exOrder,
          superset_group: exDraft.supersetGroup,
          set_number: sIdx + 1,
          set_type: s.setType,
          weight: w,
          reps: r,
          rpe: s.rpe,
          duration_seconds: d,
          rest_seconds: s.restSeconds,
          is_completed: true,
          completed_at: s.completedAt ?? effectiveCompletedAt,
          notes: sIdx === 0 ? exDraft.notes : s.notes,
        });
      }
    }

    const parsed = updateWorkoutPayloadSchema.safeParse({
      id: workout.id,
      routine_id: workout.routine_id,
      name,
      notes,
      workout_date: workoutDate,
      started_at: effectiveStartedAt,
      completed_at: effectiveCompletedAt,
      duration_seconds: durationSeconds,
      weight_unit: workout.weight_unit,
      sets: payloadSets,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(firstIssue?.message ?? "Please check your workout edits.");
      return;
    }

    setSaving(true);
    try {
      const appState = useAppDataStore.getState();
      const rawSets: WorkoutSet[] = parsed.data.sets.map((s) => ({
        ...s,
        workout_id: workout.id,
        is_pr_weight: false,
        is_pr_1rm: false,
        is_pr_volume: false,
        client_updated_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      }));

      const strictlyEarlierWorkouts = appState.workouts.filter((w) => {
        if (w.status !== "completed" || w.id === workout.id) return false;
        const wStamp = w.completed_at ?? w.created_at;
        return (
          wStamp < effectiveCompletedAt ||
          (wStamp === effectiveCompletedAt && w.created_at < workout.created_at)
        );
      });

      const prResult = computeOptimisticPRs(
        rawSets,
        strictlyEarlierWorkouts,
        appState.workoutSets,
        workout.id
      );
      const totals = computeWorkoutTotals(prResult.setsWithPRs);

      const updatedWorkout: Workout = {
        ...workout,
        name: parsed.data.name,
        notes: parsed.data.notes,
        workout_date: parsed.data.workout_date,
        started_at: parsed.data.started_at,
        completed_at: parsed.data.completed_at,
        duration_seconds: parsed.data.duration_seconds,
        total_volume: totals.totalVolume,
        total_sets: totals.totalSets,
        pr_count: prResult.prCount,
        client_updated_at: nowIso,
        updated_at: nowIso,
      };

      appState.completeWorkoutOptimistic({
        workout: updatedWorkout,
        sets: prResult.setsWithPRs,
        scheduledWorkoutId: null,
      });

      await putLocalCompletedWorkout({
        workout: updatedWorkout,
        sets: prResult.setsWithPRs,
        scheduledWorkoutId: null,
      });

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: "UPDATE_WORKOUT",
          clientUpdatedAt: nowIso,
          payload: parsed.data,
        },
        `workout:${workout.id}`
      ).then(() => {
        if (useSyncStore.getState().pendingCount === 0) {
          router.refresh();
        }
      });

      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edit Completed Workout"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cancel editing workout"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              Edit Workout
            </h2>
          </div>

          <button
            type="submit"
            form="edit-workout-form"
            disabled={saving}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </header>

      <form
        id="edit-workout-form"
        onSubmit={handleSave}
        className="pb-safe flex-1 overflow-y-auto bg-white"
      >
        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}

        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          <div className="space-y-1.5 px-4 py-3.5 sm:px-6">
            <label
              htmlFor="edit-workout-name"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Workout Name *
            </label>
            <input
              id="edit-workout-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 divide-x divide-zinc-200">
            <div className="space-y-1.5 px-4 py-3.5 sm:px-6">
              <label
                htmlFor="edit-workout-date"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Date
              </label>
              <input
                id="edit-workout-date"
                type="date"
                required
                value={workoutDate}
                onChange={(e) => setWorkoutDate(e.target.value)}
                className="tabular-nums min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="space-y-1.5 px-4 py-3.5 sm:px-6">
              <label
                htmlFor="edit-workout-duration"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Duration (min)
              </label>
              <input
                id="edit-workout-duration"
                type="text"
                inputMode="numeric"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
                className="tabular-nums min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5 px-4 py-3.5 sm:px-6">
            <label
              htmlFor="edit-workout-notes"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Session Notes
            </label>
            <textarea
              id="edit-workout-notes"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How energy felt, cues, adjustments..."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          {draftExercises.map((draft, idx) => (
            <EditWorkoutExerciseSection
              key={draft.draftId}
              draft={draft}
              supersetLabel={supersetLabels[idx] ?? null}
              exercise={exerciseMap.get(draft.exerciseId)}
              weightUnit={workout.weight_unit}
              onAddSet={() => addSetToExercise(draft.draftId)}
              onUpdateSet={(setId, patch) =>
                updateExerciseSet(draft.draftId, setId, patch)
              }
              onRemoveSet={(setId) =>
                removeSetFromExercise(draft.draftId, setId)
              }
              onRemoveExercise={() => removeExerciseBlock(draft.draftId)}
            />
          ))}
        </div>

        <div className="px-4 py-5 sm:px-6">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Exercise</span>
          </button>
        </div>
      </form>

      <ExercisePickerModal
        open={pickerOpen}
        exercises={exercises}
        mode="multi"
        title="Add Exercises"
        onClose={() => setPickerOpen(false)}
        onConfirm={handleAddExercises}
      />
    </div>
  );
}
