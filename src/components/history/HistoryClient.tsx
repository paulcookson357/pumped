"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronRight,
  Clock,
  Dumbbell,
  History,
  Play,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { formatDayHeader } from "@/lib/dates/localDate";
import { writeDomainSnapshot } from "@/lib/offline/db";
import type {
  AppSettings,
  Exercise,
  Routine,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import {
  computeHistoryOverviewStats,
  groupWorkoutsByMonth,
  groupWorkoutSetsByExercise,
} from "@/lib/workouts/progress";
import {
  computeCardioTotals,
  formatCardioDecimal,
  formatCardioDurationCompact,
  getDistanceUnit,
  hasAnyCardioMetrics,
} from "@/lib/workouts/cardio";
import {
  formatElapsedDuration,
  formatNumberCompact,
} from "@/lib/workouts/stats";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface HistoryClientProps {
  initialWorkouts: Workout[];
  initialWorkoutSets: WorkoutSet[];
  initialExercises: Exercise[];
  initialRoutines: Routine[];
  initialSettings: AppSettings | null;
}

export function HistoryClient({
  initialWorkouts,
  initialWorkoutSets,
  initialExercises,
  initialRoutines,
  initialSettings,
}: HistoryClientProps) {
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
  const { activeWorkout, requestStartWorkout, openSheet } =
    useActiveWorkoutStore();

  const shouldReconcileWorkouts =
    hydrated &&
    !touchedDomains.workouts &&
    storeWorkouts.length === 0 &&
    initialWorkouts.length > 0 &&
    pendingCount === 0;

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

  const shouldReconcileSettings =
    hydrated &&
    !touchedDomains.settings &&
    storeSettings === null &&
    initialSettings !== null;

  useEffect(() => {
    if (shouldReconcileWorkouts) {
      useAppDataStore
        .getState()
        .setWorkoutsBundle(initialWorkouts, initialWorkoutSets);
      void writeDomainSnapshot({
        workouts: {
          workouts: initialWorkouts,
          workoutSets: initialWorkoutSets,
        },
      });
    }
  }, [shouldReconcileWorkouts, initialWorkouts, initialWorkoutSets]);

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

  useEffect(() => {
    if (shouldReconcileSettings && initialSettings) {
      useAppDataStore.getState().setSettings(initialSettings);
    }
  }, [shouldReconcileSettings, initialSettings]);

  const workouts =
    !hydrated || shouldReconcileWorkouts ? initialWorkouts : storeWorkouts;
  const workoutSets =
    !hydrated || shouldReconcileWorkouts ? initialWorkoutSets : storeWorkoutSets;
  const exercises =
    !hydrated || shouldReconcileExercises ? initialExercises : storeExercises;
  const routines =
    !hydrated || shouldReconcileRoutines ? initialRoutines : storeRoutines;
  const effectiveSettings = storeSettings ?? initialSettings;
  const weightUnit = effectiveSettings?.weight_unit ?? "kg";

  const [query, setQuery] = useState("");
  const [prsOnly, setPrsOnly] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | "all">(
    "all"
  );

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  const routineMap = useMemo(
    () => new Map(routines.map((r) => [r.id, r])),
    [routines]
  );

  const setsByWorkoutId = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const ws of workoutSets) {
      if (!ws.is_completed) continue;
      const list = map.get(ws.workout_id) ?? [];
      list.push(ws);
      map.set(ws.workout_id, list);
    }
    return map;
  }, [workoutSets]);

  const completedWorkouts = useMemo(
    () => workouts.filter((w) => w.status === "completed"),
    [workouts]
  );

  const filterableRoutines = useMemo(() => {
    const usedIds = new Set(
      completedWorkouts
        .map((w) => w.routine_id)
        .filter((id): id is string => id !== null)
    );
    return routines.filter((r) => usedIds.has(r.id));
  }, [completedWorkouts, routines]);

  const filteredWorkouts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return completedWorkouts.filter((w) => {
      if (prsOnly && Number(w.pr_count) <= 0) {
        return false;
      }
      if (
        selectedRoutineId !== "all" &&
        w.routine_id !== selectedRoutineId
      ) {
        return false;
      }
      if (q.length > 0) {
        const nameMatches = w.name.toLowerCase().includes(q);
        if (nameMatches) return true;
        const wSets = setsByWorkoutId.get(w.id) ?? [];
        const exMatches = wSets.some((ws) =>
          (exerciseMap.get(ws.exercise_id)?.name ?? "")
            .toLowerCase()
            .includes(q)
        );
        return exMatches;
      }
      return true;
    });
  }, [
    completedWorkouts,
    prsOnly,
    selectedRoutineId,
    query,
    setsByWorkoutId,
    exerciseMap,
  ]);

  const overviewStats = useMemo(
    () => computeHistoryOverviewStats(filteredWorkouts),
    [filteredWorkouts]
  );

  const monthGroups = useMemo(
    () => groupWorkoutsByMonth(filteredWorkouts),
    [filteredWorkouts]
  );

  const hasActiveFilters =
    query.trim().length > 0 || prsOnly || selectedRoutineId !== "all";

  function resetFilters() {
    setQuery("");
    setPrsOnly(false);
    setSelectedRoutineId("all");
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            Workout History
          </h1>
          <p className="tabular-nums text-xs text-zinc-500">
            {completedWorkouts.length}{" "}
            {completedWorkouts.length === 1 ? "session" : "sessions"} logged
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            activeWorkout
              ? openSheet()
              : requestStartWorkout({
                  name: "Quick Workout",
                  appSettings: effectiveSettings,
                })
          }
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          <Play className="h-4 w-4" aria-hidden="true" />
          <span>{activeWorkout ? "Resume" : "Start Empty"}</span>
        </button>
      </div>

      {/* Overview telemetry strip */}
      <section className="-mx-4 grid grid-cols-2 divide-x divide-y divide-zinc-200 border-y border-zinc-200 bg-white sm:-mx-6 sm:grid-cols-4 sm:divide-y-0">
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Workouts
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {overviewStats.totalWorkouts}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Total Volume
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {formatNumberCompact(overviewStats.totalVolume)} {weightUnit}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            Completed Sets
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
            {overviewStats.totalSets}
          </p>
        </div>
        <div className="px-4 py-3 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
            PR Sets
          </p>
          <p className="tabular-nums mt-0.5 text-lg font-bold text-emerald-600">
            {overviewStats.totalPRs}
          </p>
        </div>
      </section>

      {/* Search + filter bar when workouts exist */}
      {completedWorkouts.length > 0 && (
        <div className="-mx-4 space-y-2.5 border-b border-zinc-200 px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              id="history-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workouts or exercises..."
              aria-label="Search workout history"
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 pr-10 pl-10 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear history search"
                className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setSelectedRoutineId("all");
                setPrsOnly(false);
              }}
              className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
                selectedRoutineId === "all" && !prsOnly
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              All Workouts
            </button>
            <button
              type="button"
              onClick={() => setPrsOnly((prev) => !prev)}
              className={`inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors ${
                prsOnly
                  ? "border-amber-500 bg-amber-50 text-amber-800"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>PRs Only</span>
            </button>
            {filterableRoutines.map((routine) => {
              const active = selectedRoutineId === routine.id;
              return (
                <button
                  key={routine.id}
                  type="button"
                  onClick={() =>
                    setSelectedRoutineId((prev) =>
                      prev === routine.id ? "all" : routine.id
                    )
                  }
                  className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: routine.color }}
                  />
                  <span>{routine.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feed */}
      {monthGroups.length > 0 ? (
        <div className="-mx-4 sm:-mx-6">
          {monthGroups.map((group) => (
            <section key={group.monthKey} className="border-b border-zinc-200">
              <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2 sm:px-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                  {group.monthLabel} ({group.workouts.length})
                </h2>
              </div>

              <ul className="divide-y divide-zinc-200 bg-white">
                {group.workouts.map((workout) => {
                  const routine = workout.routine_id
                    ? routineMap.get(workout.routine_id)
                    : undefined;
                  const sets = setsByWorkoutId.get(workout.id) ?? [];
                  const exerciseGroups = groupWorkoutSetsByExercise(sets);
                  const cardioTotals = computeCardioTotals(
                    sets.filter(
                      (s) =>
                        exerciseMap.get(s.exercise_id)
                          ?.tracking_type === "cardio" || hasAnyCardioMetrics(s)
                    )
                  );
                  const hasCardioHeadline =
                    workout.total_volume === 0 &&
                    (cardioTotals.totalDistance > 0 ||
                      cardioTotals.totalCardioSeconds > 0);

                  return (
                    <li key={workout.id}>
                      <Link
                        href={`/history/${workout.id}`}
                        className="flex items-stretch transition-colors hover:bg-zinc-50/80 active:bg-zinc-100/70"
                      >
                        <span
                          aria-hidden="true"
                          className="w-1.5 shrink-0"
                          style={{
                            backgroundColor: routine?.color ?? "#059669",
                          }}
                        />

                        <div className="min-w-0 flex-1 px-4 py-3.5 sm:px-5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-base font-bold text-zinc-950">
                                  {workout.name}
                                </h3>
                                {Number(workout.pr_count) > 0 && (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                    <Trophy
                                      className="h-3 w-3 text-amber-600"
                                      aria-hidden="true"
                                    />
                                    <span>
                                      {workout.pr_count}{" "}
                                      {Number(workout.pr_count) === 1
                                        ? "PR"
                                        : "PRs"}
                                    </span>
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs font-medium text-zinc-500">
                                {formatDayHeader(workout.workout_date)}
                              </p>
                            </div>

                            <ChevronRight
                              className="mt-1 h-4 w-4 shrink-0 text-zinc-400"
                              aria-hidden="true"
                            />
                          </div>

                          <div className="tabular-nums mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                            <span className="inline-flex items-center gap-1">
                              <Clock
                                className="h-3.5 w-3.5 text-zinc-400"
                                aria-hidden="true"
                              />
                              <span>
                                {formatElapsedDuration(
                                  workout.duration_seconds ?? 0
                                )}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Dumbbell
                                className="h-3.5 w-3.5 text-zinc-400"
                                aria-hidden="true"
                              />
                              <span>
                                {hasCardioHeadline
                                  ? cardioTotals.totalDistance > 0
                                    ? `${formatCardioDecimal(cardioTotals.totalDistance)} ${getDistanceUnit(workout.weight_unit)}`
                                    : formatCardioDurationCompact(
                                        cardioTotals.totalCardioSeconds
                                      )
                                  : `${formatNumberCompact(workout.total_volume)} ${workout.weight_unit}`}
                              </span>
                            </span>
                            <span>
                              {workout.total_sets}{" "}
                              {workout.total_sets === 1 ? "set" : "sets"}
                            </span>
                          </div>

                          {exerciseGroups.length > 0 && (
                            <p className="mt-2 truncate text-xs text-zinc-500">
                              {exerciseGroups
                                .slice(0, 4)
                                .map((eg) => {
                                  const exName =
                                    exerciseMap.get(eg.exerciseId)?.name ??
                                    "Exercise";
                                  return `${exName} (${eg.sets.length})`;
                                })
                                .join(" • ")}
                              {exerciseGroups.length > 4
                                ? ` • +${exerciseGroups.length - 4} more`
                                : ""}
                            </p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <section className="-mx-4 border-b border-zinc-200 px-4 py-10 text-center sm:-mx-6 sm:px-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-950">
            {completedWorkouts.length === 0
              ? "No completed workouts yet"
              : "No workouts match your filters"}
          </h2>
          <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-zinc-500">
            {completedWorkouts.length === 0
              ? "Log a strength session from Calendar, Routines, or Empty Workout to track volume and PR milestones."
              : "Try clearing your search query or switching workout filters."}
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2.5">
            {completedWorkouts.length === 0 ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    activeWorkout
                      ? openSheet()
                      : requestStartWorkout({
                          name: "Quick Workout",
                          appSettings: effectiveSettings,
                        })
                  }
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  <span>Start Empty Workout</span>
                </button>
                <Link
                  href="/"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Go to Calendar
                </Link>
              </>
            ) : (
              hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  Reset Filters
                </button>
              )
            )}
          </div>
        </section>
      )}
    </div>
  );
}
