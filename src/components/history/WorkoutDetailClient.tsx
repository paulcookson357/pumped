"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  ChevronRight,
  History,
  Pencil,
  RotateCcw,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import { EditWorkoutModal } from "@/components/history/EditWorkoutModal";
import { RoutineEditorModal } from "@/components/routines/RoutineEditorModal";
import { formatDayHeader } from "@/lib/dates/localDate";
import { calculateEpley1RM } from "@/lib/metrics/oneRepMax";
import { deleteLocalWorkout } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { getSupersetColor } from "@/lib/routines/colors";
import { getSupersetPositions } from "@/lib/routines/supersets";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  SetType,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import { groupWorkoutSetsByExercise } from "@/lib/workouts/progress";
import {
  formatElapsedDuration,
  formatNumberCompact,
} from "@/lib/workouts/stats";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface WorkoutDetailClientProps {
  workoutId: string;
  initialWorkout: Workout | null;
  initialSets: WorkoutSet[];
  initialExercises: Exercise[];
  initialRoutines: Routine[];
  initialSettings: AppSettings | null;
}

const SET_TYPE_BADGES: Record<
  SetType,
  { short: string; badgeClass: string }
> = {
  normal: {
    short: "",
    badgeClass: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  warmup: {
    short: "W",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  dropset: {
    short: "D",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
  },
  failure: {
    short: "F",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

export function WorkoutDetailClient({
  workoutId,
  initialWorkout,
  initialSets,
  initialExercises,
  initialRoutines,
  initialSettings,
}: WorkoutDetailClientProps) {
  const router = useRouter();
  const {
    hydrated,
    touchedDomains,
    workouts: storeWorkouts,
    workoutSets: storeWorkoutSets,
    exercises: storeExercises,
    routines: storeRoutines,
    settings: storeSettings,
  } = useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const requestStartWorkout = useActiveWorkoutStore(
    (state) => state.requestStartWorkout
  );

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saveRoutineOpen, setSaveRoutineOpen] = useState(false);
  const [saveRoutineSeed, setSaveRoutineSeed] = useState<{
    name: string;
    notes: string | null;
    exercises: RoutineExercise[];
  } | null>(null);
  const [savedRoutineName, setSavedRoutineName] = useState<string | null>(null);

  const shouldReconcileExercises =
    hydrated &&
    !touchedDomains.exercises &&
    storeExercises.length === 0 &&
    initialExercises.length > 0 &&
    pendingCount === 0;

  const shouldReconcileRoutines =
    hydrated &&
    !touchedDomains.routines &&
    storeRoutines.length === 0 &&
    initialRoutines.length > 0 &&
    pendingCount === 0;

  useEffect(() => {
    if (shouldReconcileExercises) {
      useAppDataStore.getState().setExercises(initialExercises);
    }
  }, [shouldReconcileExercises, initialExercises]);

  useEffect(() => {
    if (shouldReconcileRoutines) {
      useAppDataStore.getState().setRoutinesBundle(initialRoutines, []);
    }
  }, [shouldReconcileRoutines, initialRoutines]);

  const exercises =
    !hydrated || shouldReconcileExercises ? initialExercises : storeExercises;
  const routines =
    !hydrated || shouldReconcileRoutines ? initialRoutines : storeRoutines;
  const effectiveSettings = storeSettings ?? initialSettings;

  const storeMatchedWorkout = storeWorkouts.find((w) => w.id === workoutId);

  const workout =
    hydrated && touchedDomains.workouts
      ? (storeMatchedWorkout ?? null)
      : (storeMatchedWorkout ?? initialWorkout);

  const sets = useMemo(() => {
    const matched = storeWorkoutSets.filter((ws) => ws.workout_id === workoutId);
    if (matched.length > 0) {
      return matched;
    }
    return hydrated && touchedDomains.workouts ? [] : initialSets;
  }, [storeWorkoutSets, workoutId, hydrated, touchedDomains.workouts, initialSets]);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  const routine = useMemo(
    () =>
      workout?.routine_id
        ? routines.find((r) => r.id === workout.routine_id)
        : undefined,
    [workout?.routine_id, routines]
  );

  const exerciseGroups = useMemo(
    () => groupWorkoutSetsByExercise(sets.filter((s) => s.is_completed)),
    [sets]
  );

  const supersetLabels = useMemo(
    () =>
      getSupersetPositions(
        exerciseGroups.map((g) => ({ superset_group: g.supersetGroup }))
      ),
    [exerciseGroups]
  );

  if (!workout) {
    return (
      <div>
        <div className="pb-3">
          <Link
            href="/history"
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to History</span>
          </Link>
        </div>
        <section className="-mx-4 border-y border-zinc-200 px-4 py-10 text-center sm:-mx-6 sm:px-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-base font-bold text-zinc-950">
            Workout not found
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            This workout may have been deleted or has not synced yet.
          </p>
          <div className="mt-5">
            <Link
              href="/history"
              className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              Return to History
            </Link>
          </div>
        </section>
      </div>
    );
  }

  function handleRepeatWorkout() {
    if (!workout) return;
    const now = new Date().toISOString();
    const defaultRest = effectiveSettings?.default_rest_seconds ?? 90;

    const templateRows: RoutineExercise[] = exerciseGroups.map((group, idx) => ({
      id: crypto.randomUUID(),
      routine_id: workout.routine_id ?? workout.id,
      exercise_id: group.exerciseId,
      sort_order: idx,
      superset_group: group.supersetGroup,
      target_sets: Math.max(1, group.sets.length),
      target_reps_min: group.sets[0]?.reps ?? null,
      target_reps_max: null,
      target_rpe: null,
      rest_seconds: group.sets[0]?.rest_seconds ?? defaultRest,
      notes: group.notes,
      created_at: now,
      updated_at: now,
    }));

    requestStartWorkout({
      routine: routine ?? null,
      routineExercises: templateRows,
      name: workout.name,
      appSettings: effectiveSettings,
    });
  }

  function handleOpenSaveAsRoutine() {
    if (!workout || exerciseGroups.length === 0) return;
    const now = new Date().toISOString();
    const defaultRest = effectiveSettings?.default_rest_seconds ?? 90;

    const seedExercises: RoutineExercise[] = exerciseGroups.map((group, idx) => {
      const workingSets = group.sets.filter((s) => s.set_type !== "warmup");
      const firstSet = workingSets[0] ?? group.sets[0];
      return {
        id: crypto.randomUUID(),
        routine_id: workout.id,
        exercise_id: group.exerciseId,
        sort_order: idx,
        superset_group: group.supersetGroup,
        target_sets: Math.max(1, group.sets.length),
        target_reps_min: firstSet?.reps ?? null,
        target_reps_max: firstSet?.reps ?? null,
        target_rpe: firstSet?.rpe ?? null,
        rest_seconds: firstSet?.rest_seconds ?? defaultRest,
        notes: group.notes,
        created_at: now,
        updated_at: now,
      };
    });

    setSaveRoutineSeed({
      name: workout.name,
      notes: workout.notes,
      exercises: seedExercises,
    });
    setSaveRoutineOpen(true);
  }

  async function handleConfirmDelete() {
    if (!workout) return;
    const now = new Date().toISOString();
    useAppDataStore.getState().deleteWorkoutOptimistic(workout.id);
    await deleteLocalWorkout(workout.id);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "DELETE_WORKOUT",
        clientUpdatedAt: now,
        payload: { id: workout.id },
      },
      `workout:${workout.id}`
    );
    router.push("/history");
  }

  return (
    <div>
      {/* Back bar & actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <Link
          href="/history"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>History</span>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleRepeatWorkout}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Repeat Workout</span>
          </button>
          <button
            type="button"
            disabled={exerciseGroups.length === 0}
            onClick={handleOpenSaveAsRoutine}
            className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
          >
            <BookmarkPlus className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Save as Routine</span>
          </button>
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            aria-label="Edit workout"
            className="inline-flex h-10 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => setConfirmDelete((prev) => !prev)}
            aria-label="Delete workout"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {savedRoutineName && (
        <div
          role="status"
          className="-mx-4 mb-3 flex flex-wrap items-center justify-between gap-2 border-y border-emerald-200 bg-emerald-50/80 px-4 py-2.5 text-xs font-medium text-emerald-900 sm:-mx-6 sm:px-6"
        >
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span>Saved &ldquo;{savedRoutineName}&rdquo; to Routines.</span>
          </span>
          <Link
            href="/routines"
            className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
          >
            View Routines
          </Link>
        </div>
      )}

      {/* Inline delete confirmation */}
      {confirmDelete && (
        <div className="-mx-4 mb-3 border-y border-rose-200 bg-rose-50/80 px-4 py-3 sm:-mx-6 sm:px-6">
          <p className="text-xs font-semibold text-rose-900">
            Delete &ldquo;{workout.name}&rdquo; permanently? Scheduled routines
            linked to this session will return to Planned.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="min-h-[38px] flex-1 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              className="min-h-[38px] flex-1 rounded-lg bg-rose-600 text-xs font-semibold text-white hover:bg-rose-500"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}

      {/* Session Headline */}
      <div className="pb-3.5">
        <div className="flex flex-wrap items-center gap-2">
          {routine && (
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: routine.color }}
            />
          )}
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            {workout.name}
          </h1>
        </div>
        <p className="mt-0.5 text-xs font-medium text-zinc-500">
          {formatDayHeader(workout.workout_date)}
          {routine ? ` • ${routine.name}` : ""}
        </p>
      </div>

      {/* 4-cell metric grid */}
      <section className="-mx-4 grid grid-cols-2 divide-x divide-y divide-zinc-200 border-y border-zinc-200 bg-white sm:-mx-6 sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Duration
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {formatElapsedDuration(workout.duration_seconds ?? 0)}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Volume
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {formatNumberCompact(workout.total_volume)} {workout.weight_unit}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Completed Sets
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {workout.total_sets}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            PRs
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-emerald-600">
            {workout.pr_count}
          </p>
        </div>
      </section>

      {workout.notes && (
        <section className="-mx-4 border-b border-zinc-200 bg-zinc-50/50 px-4 py-3 sm:-mx-6 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Session Notes
          </p>
          <p className="mt-1 text-sm text-zinc-700">{workout.notes}</p>
        </section>
      )}

      {/* Exercise Set Breakdown */}
      {exerciseGroups.length > 0 ? (
        <div className="-mx-4 divide-y divide-zinc-200 border-b border-zinc-200 sm:-mx-6">
          {exerciseGroups.map((group, idx) => {
            const exercise = exerciseMap.get(group.exerciseId);
            const supersetLabel = supersetLabels[idx] ?? null;
            const supersetColor = getSupersetColor(group.supersetGroup);
            const trackingType = exercise?.tracking_type ?? "weight_reps";

            return (
              <section
                key={`${group.exerciseOrder}:${group.exerciseId}`}
                className="flex bg-white"
              >
                {supersetColor && (
                  <span
                    aria-hidden="true"
                    className="w-1.5 shrink-0"
                    style={{ backgroundColor: supersetColor }}
                  />
                )}

                <div className="min-w-0 flex-1">
                  <Link
                    href={`/exercises/${group.exerciseId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-zinc-50 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {exercise && (
                        <ExerciseVisual
                          exercise={exercise}
                          size="thumb"
                          animateFallback={false}
                        />
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {supersetLabel && (
                            <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                              {supersetLabel}
                            </span>
                          )}
                          <h2 className="truncate text-base font-bold text-zinc-950">
                            {exercise?.name ?? "Exercise"}
                          </h2>
                        </div>
                        {group.notes && (
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {group.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700">
                      <TrendingUp className="h-4 w-4" aria-hidden="true" />
                      <span>Progress</span>
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </Link>

                  <div className="divide-y divide-zinc-100 border-t border-zinc-100">
                    {group.sets.map((ws) => {
                      const badge = SET_TYPE_BADGES[ws.set_type];
                      const badgeLabel =
                        ws.set_type === "normal"
                          ? String(ws.set_number)
                          : badge.short;
                      const est1rm =
                        ws.set_type !== "warmup" &&
                        ws.weight !== null &&
                        ws.reps !== null
                          ? calculateEpley1RM(ws.weight, ws.reps)
                          : 0;

                      const perfLabel =
                        trackingType === "duration"
                          ? `${ws.duration_seconds ?? 0}s`
                          : trackingType === "bodyweight_reps"
                            ? `${ws.reps ?? 0} reps`
                            : ws.weight !== null && ws.weight > 0
                              ? `${formatNumberCompact(ws.weight)} ${workout.weight_unit} × ${ws.reps ?? 0}`
                              : `${ws.reps ?? 0} reps`;

                      return (
                        <div
                          key={ws.id}
                          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 sm:px-6"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`tabular-nums flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-bold ${badge.badgeClass}`}
                            >
                              {badgeLabel}
                            </span>
                            <span className="tabular-nums text-sm font-semibold text-zinc-950">
                              {perfLabel}
                            </span>
                            {ws.rpe !== null && (
                              <span className="tabular-nums rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
                                RPE {ws.rpe}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {est1rm > 0 && (
                              <span className="tabular-nums text-xs text-zinc-500">
                                1RM {formatNumberCompact(est1rm)}{" "}
                                {workout.weight_unit}
                              </span>
                            )}
                            {ws.is_pr_weight && (
                              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                Weight PR
                              </span>
                            )}
                            {ws.is_pr_1rm && (
                              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                1RM PR
                              </span>
                            )}
                            {ws.is_pr_volume && (
                              <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                Vol PR
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="-mx-4 border-b border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500 sm:-mx-6 sm:px-6">
          No completed sets recorded for this workout.
        </div>
      )}

      <EditWorkoutModal
        open={editModalOpen}
        workout={workout}
        sets={sets}
        exercises={exercises}
        onClose={() => setEditModalOpen(false)}
      />

      <RoutineEditorModal
        open={saveRoutineOpen}
        editingRoutine={null}
        initialRoutineExercises={[]}
        templateSeed={saveRoutineSeed}
        exercises={exercises}
        nextSortOrder={routines.length}
        defaultRestSeconds={effectiveSettings?.default_rest_seconds ?? 90}
        onClose={() => {
          setSaveRoutineOpen(false);
          setSaveRoutineSeed(null);
        }}
        onSaved={(savedRoutine) => {
          setSavedRoutineName(savedRoutine.name);
        }}
      />
    </div>
  );
}
