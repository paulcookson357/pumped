"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Dumbbell,
} from "lucide-react";
import { ExerciseProgressChart } from "@/components/exercises/ExerciseProgressChart";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import { formatDayHeader } from "@/lib/dates/localDate";
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  TRACKING_LABELS,
} from "@/lib/exercises/labels";
import type {
  AppSettings,
  Exercise,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import {
  computeExercisePersonalBests,
  deriveExerciseProgressFromLocal,
  type ExerciseProgressPoint,
} from "@/lib/workouts/progress";
import { formatNumberCompact } from "@/lib/workouts/stats";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface ExerciseProgressClientProps {
  exerciseId: string;
  initialExercise: Exercise | null;
  initialProgress: ExerciseProgressPoint[];
  initialWorkouts: Workout[];
  initialWorkoutSets: WorkoutSet[];
  initialSettings: AppSettings | null;
}

export function ExerciseProgressClient({
  exerciseId,
  initialExercise,
  initialProgress,
  initialWorkouts,
  initialWorkoutSets,
  initialSettings,
}: ExerciseProgressClientProps) {
  const {
    hydrated,
    touchedDomains,
    exercises: storeExercises,
    workouts: storeWorkouts,
    workoutSets: storeWorkoutSets,
    settings: storeSettings,
  } = useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);

  const [fetchedProgress, setFetchedProgress] = useState<
    ExerciseProgressPoint[] | null
  >(null);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  const shouldReconcileWorkouts =
    hydrated &&
    !touchedDomains.workouts &&
    storeWorkouts.length === 0 &&
    initialWorkouts.length > 0 &&
    pendingCount === 0;

  useEffect(() => {
    if (shouldReconcileWorkouts) {
      useAppDataStore
        .getState()
        .setWorkoutsBundle(initialWorkouts, initialWorkoutSets);
    }
  }, [shouldReconcileWorkouts, initialWorkouts, initialWorkoutSets]);

  const exercise =
    storeExercises.find((e) => e.id === exerciseId) ?? initialExercise;
  const effectiveSettings = storeSettings ?? initialSettings;
  const weightUnit = effectiveSettings?.weight_unit ?? "kg";

  const workouts =
    !hydrated || shouldReconcileWorkouts ? initialWorkouts : storeWorkouts;
  const workoutSets =
    !hydrated || shouldReconcileWorkouts ? initialWorkoutSets : storeWorkoutSets;

  useEffect(() => {
    if (!hydrated || (typeof navigator !== "undefined" && !navigator.onLine)) {
      return;
    }

    let cancelled = false;
    fetch(`/api/exercises/${exerciseId}/progress`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { progress?: ExerciseProgressPoint[] } | null) => {
        if (!cancelled && data?.progress) {
          setFetchedProgress(data.progress);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [exerciseId, hydrated, storeWorkouts.length]);

  const progressPoints = useMemo(() => {
    const serverPoints = fetchedProgress ?? initialProgress;
    const localPoints = deriveExerciseProgressFromLocal(
      exerciseId,
      workouts,
      workoutSets
    );

    if (touchedDomains.workouts) {
      // Respect optimistic completes & deletes in client state
      const activeWorkoutIds = new Set(workouts.map((w) => w.id));
      const merged = new Map<string, ExerciseProgressPoint>();
      for (const sp of serverPoints) {
        if (activeWorkoutIds.has(sp.workout_id)) {
          merged.set(sp.workout_id, sp);
        }
      }
      for (const lp of localPoints) {
        merged.set(lp.workout_id, lp);
      }
      return Array.from(merged.values()).sort((a, b) => {
        if (a.workout_date !== b.workout_date) {
          return a.workout_date.localeCompare(b.workout_date);
        }
        return a.completed_at.localeCompare(b.completed_at);
      });
    }

    return serverPoints.length >= localPoints.length
      ? serverPoints
      : localPoints;
  }, [
    fetchedProgress,
    initialProgress,
    exerciseId,
    workouts,
    workoutSets,
    touchedDomains.workouts,
  ]);

  const matchingExerciseSets = useMemo(
    () => workoutSets.filter((ws) => ws.exercise_id === exerciseId),
    [workoutSets, exerciseId]
  );

  const personalBests = useMemo(
    () => computeExercisePersonalBests(progressPoints, matchingExerciseSets),
    [progressPoints, matchingExerciseSets]
  );

  const setsByWorkoutId = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const ws of matchingExerciseSets) {
      if (!ws.is_completed) continue;
      const list = map.get(ws.workout_id) ?? [];
      list.push(ws);
      map.set(ws.workout_id, list);
    }
    return map;
  }, [matchingExerciseSets]);

  if (!exercise) {
    return (
      <div>
        <div className="pb-3">
          <Link
            href="/exercises"
            className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Exercises</span>
          </Link>
        </div>
        <section className="-mx-4 border-y border-zinc-200 px-4 py-10 text-center sm:-mx-6 sm:px-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-3 text-base font-bold text-zinc-950">
            Exercise not found
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            This exercise may have been archived or removed.
          </p>
        </section>
      </div>
    );
  }

  const descendingSessions = [...progressPoints].reverse();

  return (
    <div>
      {/* Back + Title */}
      <div className="flex items-center justify-between gap-2 pb-2">
        <Link
          href="/exercises"
          className="-ml-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Exercises</span>
        </Link>
        {exercise.is_custom && (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            Custom
          </span>
        )}
      </div>

      <h1 className="pb-3 text-xl font-bold tracking-tight text-zinc-950">
        {exercise.name}
      </h1>

      {/* Hero visual & metadata strip */}
      <div className="-mx-4 border-t border-zinc-200 sm:-mx-6">
        <ExerciseVisual exercise={exercise} size="detail" animateFallback />
        <div className="grid grid-cols-3 divide-x divide-zinc-200 border-b border-zinc-200 bg-white">
          <div className="px-4 py-2.5 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Muscle
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
              {MUSCLE_LABELS[exercise.muscle_group]}
            </p>
          </div>
          <div className="px-4 py-2.5 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Equipment
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
              {EQUIPMENT_LABELS[exercise.equipment]}
            </p>
          </div>
          <div className="px-4 py-2.5 sm:px-6">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
              Tracking
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
              {TRACKING_LABELS[exercise.tracking_type]}
            </p>
          </div>
        </div>
      </div>

      {/* Personal Bests Strip */}
      <section className="-mx-4 grid grid-cols-2 divide-x divide-y divide-zinc-200 border-b border-zinc-200 bg-white sm:-mx-6 sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Best Est. 1RM
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-emerald-600">
            {personalBests.allTimeBest1RM > 0
              ? `${formatNumberCompact(personalBests.allTimeBest1RM)} ${weightUnit}`
              : "—"}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Max Weight
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {personalBests.allTimeMaxWeight > 0
              ? `${formatNumberCompact(personalBests.allTimeMaxWeight)} ${weightUnit}`
              : "—"}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Best Set Volume
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {personalBests.allTimeBestSetVolume > 0
              ? `${formatNumberCompact(personalBests.allTimeBestSetVolume)} ${weightUnit}`
              : "—"}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Sessions
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {personalBests.totalSessions}
          </p>
        </div>
      </section>

      {/* Progress Chart */}
      <ExerciseProgressChart points={progressPoints} weightUnit={weightUnit} />

      {/* Session History */}
      <section className="-mx-4 border-b border-zinc-200 sm:-mx-6">
        <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Session History ({descendingSessions.length})
          </h2>
        </div>

        {descendingSessions.length > 0 ? (
          <ul className="divide-y divide-zinc-200 bg-white">
            {descendingSessions.map((point) => {
              const sessionSets = (setsByWorkoutId.get(point.workout_id) ?? [])
                .slice()
                .sort((a, b) => a.set_number - b.set_number);

              return (
                <li key={point.workout_id}>
                  <Link
                    href={`/history/${point.workout_id}`}
                    className="block px-4 py-3.5 transition-colors hover:bg-zinc-50 sm:px-6"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-zinc-950">
                          {point.workout_name}
                        </h3>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {formatDayHeader(point.workout_date)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 text-right">
                        <div className="tabular-nums text-xs">
                          <p className="font-bold text-emerald-700">
                            1RM {formatNumberCompact(point.best_est_1rm)}{" "}
                            {weightUnit}
                          </p>
                          <p className="text-zinc-500">
                            Vol {formatNumberCompact(point.total_volume)}{" "}
                            {weightUnit}
                          </p>
                        </div>
                        <ChevronRight
                          className="h-4 w-4 text-zinc-400"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    {sessionSets.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {sessionSets.map((ws) => (
                          <span
                            key={ws.id}
                            className={`tabular-nums rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                              ws.set_type === "warmup"
                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700"
                            }`}
                          >
                            {ws.set_type === "warmup" ? "W: " : ""}
                            {ws.weight !== null
                              ? `${formatNumberCompact(ws.weight)} × ${ws.reps ?? 0}`
                              : `${ws.reps ?? 0} reps`}
                          </span>
                        ))}
                      </div>
                    ) : (
                      point.best_set_weight !== null &&
                      point.best_set_reps !== null && (
                        <p className="tabular-nums mt-1.5 text-xs text-zinc-600">
                          Best set: {formatNumberCompact(point.best_set_weight)}{" "}
                          {weightUnit} × {point.best_set_reps}
                        </p>
                      )
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-zinc-500 sm:px-6">
            No completed sessions logged for this exercise yet.
          </div>
        )}
      </section>

      {/* Collapsible Form Instructions */}
      {exercise.instructions.length > 0 && (
        <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
          <button
            type="button"
            onClick={() => setInstructionsOpen((prev) => !prev)}
            aria-expanded={instructionsOpen}
            className="flex min-h-[48px] w-full items-center justify-between px-4 py-3 text-left sm:px-6"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Form Instructions ({exercise.instructions.length})
            </span>
            {instructionsOpen ? (
              <ChevronUp className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            ) : (
              <ChevronDown
                className="h-4 w-4 text-zinc-500"
                aria-hidden="true"
              />
            )}
          </button>

          {instructionsOpen && (
            <ol className="space-y-3 border-t border-zinc-100 px-4 py-4 text-sm leading-relaxed text-zinc-700 sm:px-6">
              {exercise.instructions.map((step, idx) => (
                <li
                  key={`${idx}-${step.slice(0, 12)}`}
                  className="flex gap-3"
                >
                  <span className="tabular-nums mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
