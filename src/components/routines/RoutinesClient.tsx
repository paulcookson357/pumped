"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Play,
  Plus,
} from "lucide-react";
import { RoutineEditorModal } from "@/components/routines/RoutineEditorModal";
import { WeeklySplitModal } from "@/components/routines/WeeklySplitModal";
import { ISO_DAY_LABELS } from "@/lib/dates/localDate";
import { reorderLocalRoutines, writeDomainSnapshot } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { getSupersetPositions } from "@/lib/routines/supersets";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  WeeklySplitRule,
} from "@/lib/types/domain";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface RoutinesClientProps {
  initialRoutines: Routine[];
  initialRoutineExercises: RoutineExercise[];
  initialExercises: Exercise[];
  initialWeeklySplitRules: WeeklySplitRule[];
  initialScheduledWorkouts: ScheduledWorkout[];
  initialSettings: AppSettings | null;
}

export function RoutinesClient({
  initialRoutines,
  initialRoutineExercises,
  initialExercises,
  initialWeeklySplitRules,
  initialScheduledWorkouts,
  initialSettings,
}: RoutinesClientProps) {
  const {
    hydrated,
    touchedDomains,
    routines: storeRoutines,
    routineExercises: storeRoutineExercises,
    exercises: storeExercises,
    weeklySplitRules: storeSplitRules,
    scheduledWorkouts: storeScheduled,
    settings: storeSettings,
  } = useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const {
    activeWorkout,
    requestStartWorkout,
    openSheet,
  } = useActiveWorkoutStore();

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

  const shouldReconcileSchedule =
    hydrated &&
    !touchedDomains.schedule &&
    storeSplitRules.length === 0 &&
    storeScheduled.length === 0 &&
    (initialWeeklySplitRules.length > 0 ||
      initialScheduledWorkouts.length > 0) &&
    pendingCount === 0;

  useEffect(() => {
    if (shouldReconcileExercises) {
      useAppDataStore.getState().setExercises(initialExercises);
      void writeDomainSnapshot({ exercises: initialExercises });
    }
  }, [shouldReconcileExercises, initialExercises]);

  useEffect(() => {
    if (shouldReconcileRoutines) {
      useAppDataStore
        .getState()
        .setRoutinesBundle(initialRoutines, initialRoutineExercises);
      void writeDomainSnapshot({
        routines: {
          routines: initialRoutines,
          routineExercises: initialRoutineExercises,
        },
      });
    }
  }, [shouldReconcileRoutines, initialRoutines, initialRoutineExercises]);

  useEffect(() => {
    if (shouldReconcileSchedule) {
      useAppDataStore
        .getState()
        .setScheduleBundle(initialWeeklySplitRules, initialScheduledWorkouts);
      void writeDomainSnapshot({
        schedule: {
          weeklySplitRules: initialWeeklySplitRules,
          scheduledWorkouts: initialScheduledWorkouts,
        },
      });
    }
  }, [shouldReconcileSchedule, initialWeeklySplitRules, initialScheduledWorkouts]);

  const routines =
    !hydrated || shouldReconcileRoutines ? initialRoutines : storeRoutines;
  const routineExercises =
    !hydrated || shouldReconcileRoutines
      ? initialRoutineExercises
      : storeRoutineExercises;
  const exercises =
    !hydrated || shouldReconcileExercises ? initialExercises : storeExercises;
  const weeklySplitRules =
    !hydrated || shouldReconcileSchedule
      ? initialWeeklySplitRules
      : storeSplitRules;
  const scheduledWorkouts =
    !hydrated || shouldReconcileSchedule
      ? initialScheduledWorkouts
      : storeScheduled;
  const defaultRestSeconds =
    storeSettings?.default_rest_seconds ??
    initialSettings?.default_rest_seconds ??
    90;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  const routineMap = useMemo(
    () => new Map(routines.map((r) => [r.id, r])),
    [routines]
  );

  const exercisesByRoutine = useMemo(() => {
    const grouped = new Map<string, RoutineExercise[]>();
    for (const row of routineExercises) {
      const list = grouped.get(row.routine_id) ?? [];
      list.push(row);
      grouped.set(row.routine_id, list);
    }
    for (const [key, list] of grouped.entries()) {
      list.sort((a, b) => a.sort_order - b.sort_order);
      grouped.set(key, list);
    }
    return grouped;
  }, [routineExercises]);

  const splitByDay = useMemo(() => {
    const grouped = new Map<number, Routine[]>();
    const active = [...weeklySplitRules]
      .filter((r) => r.is_active)
      .sort((a, b) => a.sort_order - b.sort_order);

    for (const rule of active) {
      const routine = routineMap.get(rule.routine_id);
      if (!routine) continue;
      const list = grouped.get(rule.day_of_week) ?? [];
      list.push(routine);
      grouped.set(rule.day_of_week, list);
    }
    return grouped;
  }, [weeklySplitRules, routineMap]);

  const activeSplitDaysCount = splitByDay.size;

  function openNewRoutine() {
    setEditingRoutine(null);
    setEditorOpen(true);
  }

  function openEditRoutine(routine: Routine) {
    setEditingRoutine(routine);
    setEditorOpen(true);
  }

  async function handleReorderRoutine(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= routines.length) return;

    const reordered = [...routines];
    const [moved] = reordered.splice(index, 1);
    if (!moved) return;
    reordered.splice(targetIndex, 0, moved);

    const orderedIds = reordered.map((r) => r.id);
    const now = new Date().toISOString();

    useAppDataStore.getState().reorderRoutinesOptimistic(orderedIds);
    await reorderLocalRoutines(orderedIds);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "REORDER_ROUTINES",
        clientUpdatedAt: now,
        payload: { orderedIds },
      },
      "routines:reorder"
    );
  }

  const nextSortOrder =
    routines.reduce((max, r) => Math.max(max, r.sort_order), -1) + 1;

  return (
    <div>
      {/* Top header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            Routines
          </h1>
          <p className="tabular-nums text-xs text-zinc-500">
            {routines.length} {routines.length === 1 ? "routine" : "routines"} •{" "}
            {activeSplitDaysCount}/7 split days active
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSplitModalOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            <CalendarRange className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <span>Weekly Split</span>
          </button>
          <button
            type="button"
            onClick={openNewRoutine}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>New</span>
          </button>
        </div>
      </div>

      {/* Compact Mon-Sun Weekly Split hairline strip */}
      <button
        type="button"
        onClick={() => setSplitModalOpen(true)}
        aria-label="Configure weekly training split"
        className="-mx-4 block w-[calc(100%+2rem)] border-y border-zinc-200 bg-zinc-50/50 text-left transition-colors hover:bg-zinc-50 sm:-mx-6 sm:w-[calc(100%+3rem)]"
      >
        <div className="grid grid-cols-7 divide-x divide-zinc-200">
          {ISO_DAY_LABELS.map(({ day, short }) => {
            const assigned = splitByDay.get(day) ?? [];
            const firstRoutine = assigned[0];
            return (
              <div
                key={day}
                className="flex min-h-[54px] flex-col items-center justify-center gap-1 px-1 py-2 text-center"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  {short}
                </span>
                {assigned.length > 0 ? (
                  <div className="flex items-center justify-center gap-1">
                    {assigned.slice(0, 2).map((r) => (
                      <span
                        key={r.id}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: r.color }}
                      />
                    ))}
                    {assigned.length > 2 && (
                      <span className="text-[10px] font-medium text-zinc-500">
                        +
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-[10px] text-zinc-300">Rest</span>
                )}
                <span className="w-full truncate px-0.5 text-[10px] font-medium text-zinc-700">
                  {firstRoutine ? firstRoutine.name : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </button>

      {/* Borderless full-bleed quick-start strip */}
      <div className="-mx-4 border-b border-zinc-200 bg-white px-4 py-2.5 sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={() =>
            activeWorkout
              ? openSheet()
              : requestStartWorkout({
                  name: "Quick Workout",
                  appSettings: storeSettings ?? initialSettings,
                })
          }
          className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100/70"
        >
          <Play className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>
            {activeWorkout
              ? `Resume "${activeWorkout.name}"`
              : "Start Empty Workout"}
          </span>
        </button>
      </div>

      {/* Borderless full-bleed routine list */}
      {routines.length > 0 ? (
        <ul className="-mx-4 divide-y divide-zinc-200 border-b border-zinc-200 sm:-mx-6">
          {routines.map((routine, idx) => {
            const items = exercisesByRoutine.get(routine.id) ?? [];
            const supersetLabels = getSupersetPositions(items);
            const totalSets = items.reduce((sum, i) => sum + i.target_sets, 0);

            return (
              <li
                key={routine.id}
                className="flex items-stretch bg-white transition-colors hover:bg-zinc-50/70"
              >
                <span
                  className="w-1.5 shrink-0"
                  style={{ backgroundColor: routine.color }}
                  aria-hidden="true"
                />

                <button
                  type="button"
                  onClick={() => openEditRoutine(routine)}
                  className="min-w-0 flex-1 px-4 py-3.5 text-left sm:px-5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="truncate text-base font-bold text-zinc-950">
                      {routine.name}
                    </h2>
                    <span className="tabular-nums shrink-0 text-xs font-medium text-zinc-500">
                      {items.length}{" "}
                      {items.length === 1 ? "exercise" : "exercises"} •{" "}
                      {totalSets} sets
                    </span>
                  </div>

                  {items.length > 0 ? (
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      {items
                        .slice(0, 4)
                        .map((item, exIdx) => {
                          const name =
                            exerciseMap.get(item.exercise_id)?.name ??
                            "Exercise";
                          const label = supersetLabels[exIdx];
                          return label ? `[${label}] ${name}` : name;
                        })
                        .join(" • ")}
                      {items.length > 4 ? ` • +${items.length - 4} more` : ""}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-400">
                      No exercises added yet
                    </p>
                  )}
                </button>

                <div className="flex shrink-0 items-center gap-1 pr-2 sm:pr-4">
                  <button
                    type="button"
                    onClick={() =>
                      activeWorkout?.routineId === routine.id &&
                      activeWorkout.scheduledWorkoutId === null
                        ? openSheet()
                        : requestStartWorkout({
                            routine,
                            routineExercises: items,
                            appSettings: storeSettings ?? initialSettings,
                          })
                    }
                    aria-label={`Start ${routine.name}`}
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    <Play className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      {activeWorkout?.routineId === routine.id &&
                      activeWorkout.scheduledWorkoutId === null
                        ? "Resume"
                        : "Start"}
                    </span>
                  </button>
                  {routines.length > 1 && (
                    <div className="flex items-center">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => void handleReorderRoutine(idx, -1)}
                        aria-label={`Move ${routine.name} up`}
                        className="flex h-10 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25"
                      >
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === routines.length - 1}
                        onClick={() => void handleReorderRoutine(idx, 1)}
                        aria-label={`Move ${routine.name} down`}
                        className="flex h-10 w-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25"
                      >
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => openEditRoutine(routine)}
                    aria-label={`Edit ${routine.name}`}
                    className="flex h-10 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="-mx-4 border-b border-zinc-200 px-4 py-10 text-center sm:-mx-6 sm:px-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-base font-semibold text-zinc-950">
            No routines created yet
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Build reusable templates with target sets, rep ranges, RPE, rest
            timers, and supersets.
          </p>
          <button
            type="button"
            onClick={openNewRoutine}
            className="mt-5 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Create First Routine</span>
          </button>
        </div>
      )}

      <RoutineEditorModal
        open={editorOpen}
        editingRoutine={editingRoutine}
        initialRoutineExercises={
          editingRoutine
            ? (exercisesByRoutine.get(editingRoutine.id) ?? [])
            : []
        }
        exercises={exercises}
        nextSortOrder={nextSortOrder}
        defaultRestSeconds={defaultRestSeconds}
        onClose={() => setEditorOpen(false)}
      />

      <WeeklySplitModal
        open={splitModalOpen}
        routines={routines}
        weeklySplitRules={weeklySplitRules}
        scheduledWorkouts={scheduledWorkouts}
        onClose={() => setSplitModalOpen(false)}
      />
    </div>
  );
}
