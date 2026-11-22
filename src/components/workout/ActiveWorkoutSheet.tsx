"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Dumbbell,
  Plus,
  StickyNote,
  Timer,
  Trash2,
} from "lucide-react";
import { ExerciseDetailDrawer } from "@/components/exercises/ExerciseDetailDrawer";
import { ExercisePickerModal } from "@/components/routines/ExercisePickerModal";
import { ActiveExerciseBlock } from "@/components/workout/ActiveExerciseBlock";
import { RestTimerBanner } from "@/components/workout/RestTimerBanner";
import { putLocalRoutineBundle } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { useWakeLock } from "@/lib/pwa/useWakeLock";
import { replaceExerciseInRoutineTemplate } from "@/lib/routines/swap";
import { getSupersetPositions } from "@/lib/routines/supersets";
import type { Exercise, RoutineExercise } from "@/lib/types/domain";
import {
  formatCardioDecimal,
  formatCardioDurationCompact,
  getDistanceUnit,
  parseCardioTimeInput,
} from "@/lib/workouts/cardio";
import {
  computeWorkoutTotals,
  formatElapsedDuration,
  formatNumberCompact,
} from "@/lib/workouts/stats";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

const QUICK_REST_SECONDS = [30, 60, 90, 120, 180] as const;

export function ActiveWorkoutSheet() {
  const {
    activeWorkout,
    sheetOpen,
    previousByExercise,
    minimizeSheet,
    updateWorkoutMeta,
    toggleShowRpe,
    addExercises,
    swapExercise,
    finishWorkout,
    discardWorkout,
  } = useActiveWorkoutStore();

  const exercises = useAppDataStore((state) => state.exercises);
  const routines = useAppDataStore((state) => state.routines);
  const routineExercises = useAppDataStore((state) => state.routineExercises);
  const settings = useAppDataStore((state) => state.settings);
  const startRestTimer = useRestTimerStore((state) => state.start);

  useWakeLock(Boolean(activeWorkout && sheetOpen));

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [quickRestOpen, setQuickRestOpen] = useState(false);
  const [notesVisible, setNotesVisible] = useState(false);
  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [swapTargetDraftId, setSwapTargetDraftId] = useState<string | null>(
    null
  );
  const [pendingSwap, setPendingSwap] = useState<{
    draftId: string;
    oldExerciseId: string;
    newExerciseId: string;
    draftIndex: number;
  } | null>(null);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);
  const [finishPrompt, setFinishPrompt] = useState<
    "none" | "empty" | "unfinished"
  >("none");
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const startedAtIso = activeWorkout?.startedAt ?? null;

  useEffect(() => {
    if (!sheetOpen || !startedAtIso) return;

    const updateClock = () => {
      const startedMs = new Date(startedAtIso).getTime();
      if (Number.isFinite(startedMs)) {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
      }
    };

    updateClock();
    const interval = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(interval);
  }, [sheetOpen, startedAtIso]);

  useEffect(() => {
    if (!sheetOpen) {
      setFinishPrompt("none");
      setConfirmDiscard(false);
      setQuickRestOpen(false);
      setPendingSwap(null);
      setSwapNotice(null);
    }
  }, [sheetOpen]);

  useEffect(() => {
    if (!sheetOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.key === "Escape" &&
        !addPickerOpen &&
        !swapTargetDraftId &&
        !previewExercise
      ) {
        minimizeSheet();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    sheetOpen,
    addPickerOpen,
    swapTargetDraftId,
    previewExercise,
    minimizeSheet,
  ]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  const supersetLabels = useMemo(() => {
    if (!activeWorkout) return [];
    return getSupersetPositions(
      activeWorkout.exercises.map((e) => ({ superset_group: e.supersetGroup }))
    );
  }, [activeWorkout]);

  const liveTotals = useMemo(() => {
    if (!activeWorkout) {
      return {
        totalVolume: 0,
        totalSets: 0,
        unfinishedSets: 0,
        totalCardioSeconds: 0,
        totalDistance: 0,
      };
    }
    const allSets = activeWorkout.exercises.flatMap((ex) =>
      ex.sets.map((s) => ({
        is_completed: s.isCompleted,
        set_type: s.setType,
        weight: s.weight ? Number(s.weight) || 0 : 0,
        reps: s.reps ? Number(s.reps) || 0 : 0,
      }))
    );
    const totals = computeWorkoutTotals(allSets);
    const unfinishedSets = allSets.filter((s) => !s.is_completed).length;

    let totalCardioSeconds = 0;
    let totalDistance = 0;
    for (const ex of activeWorkout.exercises) {
      const isCardioEx = exerciseMap.get(ex.exerciseId)?.tracking_type === "cardio";
      if (!isCardioEx) continue;
      for (const s of ex.sets) {
        if (!s.isCompleted) continue;
        const secs = parseCardioTimeInput(s.durationSeconds);
        if (secs !== null && secs > 0) totalCardioSeconds += secs;
        const dist = Number(s.distance);
        if (Number.isFinite(dist) && dist > 0) totalDistance += dist;
      }
    }

    return {
      totalVolume: totals.totalVolume,
      totalSets: totals.totalSets,
      unfinishedSets,
      totalCardioSeconds,
      totalDistance: Math.round(totalDistance * 100) / 100,
    };
  }, [activeWorkout, exerciseMap]);

  if (!activeWorkout || !sheetOpen) {
    return null;
  }

  const autoStartRestTimer = settings?.auto_start_rest_timer ?? true;
  const defaultRestSeconds = settings?.default_rest_seconds ?? 90;

  const swapTargetDraft = swapTargetDraftId
    ? activeWorkout.exercises.find((e) => e.draftId === swapTargetDraftId)
    : undefined;
  const swapTargetExercise = swapTargetDraft
    ? exerciseMap.get(swapTargetDraft.exerciseId)
    : undefined;

  const activeRoutine = activeWorkout.routineId
    ? routines.find((r) => r.id === activeWorkout.routineId)
    : undefined;

  function handleAttemptFinish() {
    if (liveTotals.totalSets === 0) {
      setFinishPrompt("empty");
      return;
    }
    if (liveTotals.unfinishedSets > 0) {
      setFinishPrompt("unfinished");
      return;
    }
    void finishWorkout(settings);
  }

  function handlePickSwapReplacement(replacementId: string) {
    if (!activeWorkout || !swapTargetDraftId) {
      setSwapTargetDraftId(null);
      return;
    }

    const draftIndex = activeWorkout.exercises.findIndex(
      (e) => e.draftId === swapTargetDraftId
    );
    const targetDraft =
      draftIndex >= 0 ? activeWorkout.exercises[draftIndex] : undefined;

    if (!targetDraft) {
      setSwapTargetDraftId(null);
      return;
    }

    const routineContainsExercise =
      Boolean(activeRoutine) &&
      routineExercises.some(
        (re) =>
          re.routine_id === activeRoutine?.id &&
          re.exercise_id === targetDraft.exerciseId
      );

    if (routineContainsExercise) {
      setPendingSwap({
        draftId: swapTargetDraftId,
        oldExerciseId: targetDraft.exerciseId,
        newExerciseId: replacementId,
        draftIndex,
      });
      setSwapTargetDraftId(null);
      return;
    }

    swapExercise(swapTargetDraftId, replacementId);
    setSwapTargetDraftId(null);
  }

  function handleConfirmSwapTodayOnly() {
    if (!pendingSwap) return;
    swapExercise(pendingSwap.draftId, pendingSwap.newExerciseId);
    setPendingSwap(null);
  }

  async function handleConfirmSwapAndUpdateRoutine() {
    if (!pendingSwap || !activeRoutine) return;

    const currentRoutineId = activeRoutine.id;
    const routineRows = routineExercises.filter(
      (re) => re.routine_id === currentRoutineId
    );
    const { updated, changed } = replaceExerciseInRoutineTemplate(
      routineRows,
      pendingSwap.oldExerciseId,
      pendingSwap.newExerciseId,
      pendingSwap.draftIndex
    );

    swapExercise(pendingSwap.draftId, pendingSwap.newExerciseId);
    setPendingSwap(null);

    if (!changed) {
      return;
    }

    const now = new Date().toISOString();
    const updatedRoutine = { ...activeRoutine, updated_at: now };

    useAppDataStore
      .getState()
      .upsertRoutineOptimistic(updatedRoutine, updated);
    await putLocalRoutineBundle(updatedRoutine, updated);

    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "UPSERT_ROUTINE",
        clientUpdatedAt: now,
        payload: {
          id: updatedRoutine.id,
          name: updatedRoutine.name,
          color: updatedRoutine.color,
          notes: updatedRoutine.notes,
          sort_order: updatedRoutine.sort_order,
          exercises: updated.map((row: RoutineExercise, idx: number) => ({
            id: row.id,
            exercise_id: row.exercise_id,
            sort_order: idx,
            superset_group: row.superset_group,
            target_sets: row.target_sets,
            target_reps_min: row.target_reps_min,
            target_reps_max: row.target_reps_max,
            target_rpe: row.target_rpe,
            rest_seconds: row.rest_seconds,
            notes: row.notes,
          })),
        },
      },
      `routine:${updatedRoutine.id}`
    );

    setSwapNotice(`Updated "${updatedRoutine.name}" routine template.`);
    window.setTimeout(() => setSwapNotice(null), 3500);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={activeWorkout.name || "Active Workout"}
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      {/* Sticky header */}
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <button
              type="button"
              onClick={minimizeSheet}
              aria-label="Minimize workout"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <ChevronDown className="h-5 w-5" aria-hidden="true" />
            </button>
            <input
              id="active-workout-name"
              type="text"
              value={activeWorkout.name}
              onChange={(e) => updateWorkoutMeta({ name: e.target.value })}
              aria-label="Workout name"
              maxLength={80}
              className="min-h-[40px] min-w-0 flex-1 rounded-lg bg-transparent px-1.5 text-base font-bold tracking-tight text-zinc-950 focus:bg-zinc-50 focus:outline-none"
            />
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setQuickRestOpen((prev) => !prev)}
              aria-label="Quick rest timer"
              aria-expanded={quickRestOpen}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
            >
              <Timer className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={toggleShowRpe}
              aria-label="Toggle RPE column"
              aria-pressed={activeWorkout.showRpe}
              className={`min-h-[40px] rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
                activeWorkout.showRpe
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              RPE
            </button>

            <button
              type="button"
              onClick={handleAttemptFinish}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Finish</span>
            </button>
          </div>
        </div>

        {/* Live telemetry hairline bar */}
        <div className="flex items-center justify-between gap-2 border-t border-zinc-100 bg-zinc-50/60 px-4 py-2 text-xs sm:px-6">
          <div className="tabular-nums flex items-center gap-3 text-zinc-600">
            <span>
              Time{" "}
              <strong className="font-semibold text-zinc-950">
                {formatElapsedDuration(elapsedSeconds)}
              </strong>
            </span>
            <span>
              Sets{" "}
              <strong className="font-semibold text-zinc-950">
                {liveTotals.totalSets}
              </strong>
            </span>
            {liveTotals.totalVolume > 0 ||
            (liveTotals.totalCardioSeconds === 0 &&
              liveTotals.totalDistance === 0) ? (
              <span>
                Vol{" "}
                <strong className="font-semibold text-zinc-950">
                  {formatNumberCompact(liveTotals.totalVolume)}{" "}
                  {activeWorkout.weightUnit}
                </strong>
              </span>
            ) : (
              <span>
                Cardio{" "}
                <strong className="font-semibold text-zinc-950">
                  {liveTotals.totalCardioSeconds > 0
                    ? formatCardioDurationCompact(liveTotals.totalCardioSeconds)
                    : ""}
                  {liveTotals.totalCardioSeconds > 0 &&
                  liveTotals.totalDistance > 0
                    ? " • "
                    : ""}
                  {liveTotals.totalDistance > 0
                    ? `${formatCardioDecimal(liveTotals.totalDistance)} ${getDistanceUnit(activeWorkout.weightUnit)}`
                    : ""}
                </strong>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => setNotesVisible((prev) => !prev)}
            className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-950"
          >
            <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Note</span>
          </button>
        </div>

        {/* Quick manual rest timer popover */}
        {quickRestOpen && (
          <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 bg-zinc-50 px-4 py-2 sm:px-6">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Start Timer:
            </span>
            {QUICK_REST_SECONDS.map((secs) => (
              <button
                key={secs}
                type="button"
                onClick={() => {
                  startRestTimer(secs, null);
                  setQuickRestOpen(false);
                }}
                className="tabular-nums min-h-[34px] rounded-full border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
              >
                {secs}s
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Active Wall-Clock Rest Timer Banner */}
      <RestTimerBanner />

      {/* Mid-workout routine swap confirmation strip */}
      {pendingSwap && (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold text-emerald-950">
            Swap &ldquo;
            {exerciseMap.get(pendingSwap.oldExerciseId)?.name ?? "Exercise"}
            &rdquo; &rarr; &ldquo;
            {exerciseMap.get(pendingSwap.newExerciseId)?.name ?? "Exercise"}
            &rdquo;?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPendingSwap(null)}
              className="min-h-[38px] rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmSwapTodayOnly}
              className="min-h-[38px] flex-1 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              Today Only
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmSwapAndUpdateRoutine()}
              className="min-h-[38px] flex-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Swap &amp; Update Routine
            </button>
          </div>
        </div>
      )}

      {swapNotice && (
        <div
          role="status"
          className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-medium text-emerald-800 sm:px-6"
        >
          {swapNotice}
        </div>
      )}

      {/* Finish confirmation strip */}
      {finishPrompt === "empty" && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold text-amber-900">
            No completed sets yet. Check at least one set or discard this
            workout.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFinishPrompt("none")}
              className="min-h-[38px] flex-1 rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900"
            >
              Keep Lifting
            </button>
            <button
              type="button"
              onClick={() => {
                setFinishPrompt("none");
                discardWorkout();
              }}
              className="min-h-[38px] flex-1 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white"
            >
              Discard Workout
            </button>
          </div>
        </div>
      )}

      {finishPrompt === "unfinished" && (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50/70 px-4 py-3 sm:px-6">
          <p className="text-xs font-semibold text-emerald-950">
            Finish workout now? Unchecked sets ({liveTotals.unfinishedSets})
            won&apos;t be saved.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setFinishPrompt("none")}
              className="min-h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setFinishPrompt("none");
                void finishWorkout(settings);
              }}
              className="min-h-[38px] flex-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Complete &amp; Save
            </button>
          </div>
        </div>
      )}

      {/* Scrollable workout exercise list */}
      <div className="pb-safe flex-1 overflow-y-auto bg-white">
        {(notesVisible || activeWorkout.notes.trim().length > 0) && (
          <div className="border-b border-zinc-200 px-4 py-3 sm:px-6">
            <textarea
              id="active-workout-notes"
              rows={2}
              value={activeWorkout.notes}
              onChange={(e) => updateWorkoutMeta({ notes: e.target.value })}
              placeholder="Session notes (how energy feels, cues, adjustments)..."
              aria-label="Workout notes"
              maxLength={500}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {activeWorkout.exercises.length > 0 ? (
          <div className="divide-y divide-zinc-200 border-b border-zinc-200">
            {activeWorkout.exercises.map((draft, idx) => (
              <ActiveExerciseBlock
                key={draft.draftId}
                draft={draft}
                index={idx}
                totalExercises={activeWorkout.exercises.length}
                supersetLabel={supersetLabels[idx] ?? null}
                exercise={exerciseMap.get(draft.exerciseId)}
                previousRecord={previousByExercise[draft.exerciseId]}
                weightUnit={activeWorkout.weightUnit}
                showRpe={activeWorkout.showRpe}
                autoStartRestTimer={autoStartRestTimer}
                onPreviewExercise={setPreviewExercise}
                onRequestSwap={setSwapTargetDraftId}
              />
            ))}
          </div>
        ) : (
          <div className="border-b border-zinc-200 px-4 py-12 text-center sm:px-6">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-950">
              Ready to lift
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Add exercises below to start logging your sets.
            </p>
          </div>
        )}

        {/* Footer actions: Add Exercise & Discard Workout */}
        <div className="space-y-3 px-4 py-5 sm:px-6">
          <button
            type="button"
            onClick={() => setAddPickerOpen(true)}
            className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add Exercise</span>
          </button>

          {!confirmDiscard ? (
            <button
              type="button"
              onClick={() => setConfirmDiscard(true)}
              className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              <span>Discard Workout</span>
            </button>
          ) : (
            <div className="space-y-2 border-l-2 border-rose-500 pl-3.5">
              <p className="text-xs font-medium text-zinc-700">
                Discard this workout and all logged sets?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDiscard(false)}
                  className="min-h-[40px] flex-1 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={discardWorkout}
                  className="min-h-[40px] flex-1 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
                >
                  Confirm Discard
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Exercises Picker */}
      <ExercisePickerModal
        open={addPickerOpen}
        exercises={exercises}
        mode="multi"
        title="Add Exercises"
        onClose={() => setAddPickerOpen(false)}
        onConfirm={(selectedIds) => {
          addExercises(selectedIds, defaultRestSeconds);
          setAddPickerOpen(false);
        }}
      />

      {/* Mid-Workout Single-Exercise Swap Picker */}
      <ExercisePickerModal
        open={swapTargetDraftId !== null}
        exercises={exercises}
        mode="single"
        excludeExerciseIds={
          swapTargetDraft
            ? [swapTargetDraft.exerciseId].filter(Boolean)
            : []
        }
        initialMuscleGroup={swapTargetExercise?.muscle_group ?? "all"}
        title="Swap Exercise"
        onClose={() => setSwapTargetDraftId(null)}
        onConfirm={(selectedIds) => {
          const replacementId = selectedIds[0];
          if (replacementId) {
            handlePickSwapReplacement(replacementId);
          } else {
            setSwapTargetDraftId(null);
          }
        }}
      />

      {/* Inline Exercise Form Demo Viewer */}
      <ExerciseDetailDrawer
        exercise={previewExercise}
        readOnly
        zIndexClass="z-[70]"
        onClose={() => setPreviewExercise(null)}
        onEdit={() => {}}
      />
    </div>
  );
}
