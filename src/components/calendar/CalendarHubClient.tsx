"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Ban,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Database,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { AssignRoutineModal } from "@/components/calendar/AssignRoutineModal";
import { CalendarGrid, type CalendarDot } from "@/components/calendar/CalendarGrid";
import { ExerciseDetailDrawer } from "@/components/exercises/ExerciseDetailDrawer";
import { WeeklySplitModal } from "@/components/routines/WeeklySplitModal";
import {
  addDays,
  formatDayHeader,
  getTodayLocalDate,
  parseLocalDate,
  shiftMonth,
} from "@/lib/dates/localDate";
import {
  deleteLocalScheduledWorkout,
  putLocalScheduledWorkout,
  writeDomainSnapshot,
} from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { getSupersetPositions } from "@/lib/routines/supersets";
import type {
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  WeeklySplitRule,
  Workout,
} from "@/lib/types/domain";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface CalendarHubClientProps {
  serverTodayDate: string;
  isConfigured: boolean;
  initialRoutines: Routine[];
  initialRoutineExercises: RoutineExercise[];
  initialExercises: Exercise[];
  initialWeeklySplitRules: WeeklySplitRule[];
  initialScheduledWorkouts: ScheduledWorkout[];
  initialWorkouts: Workout[];
}

function formatRepPrescription(row: RoutineExercise): string {
  if (row.target_reps_min !== null && row.target_reps_max !== null) {
    if (row.target_reps_min === row.target_reps_max) {
      return `${row.target_sets}×${row.target_reps_min}`;
    }
    return `${row.target_sets}×${row.target_reps_min}-${row.target_reps_max}`;
  }
  if (row.target_reps_min !== null) {
    return `${row.target_sets}×${row.target_reps_min}+`;
  }
  return `${row.target_sets} sets`;
}

export function CalendarHubClient({
  serverTodayDate,
  isConfigured,
  initialRoutines,
  initialRoutineExercises,
  initialExercises,
  initialWeeklySplitRules,
  initialScheduledWorkouts,
  initialWorkouts,
}: CalendarHubClientProps) {
  const {
    hydrated,
    touchedDomains,
    routines: storeRoutines,
    routineExercises: storeRoutineExercises,
    exercises: storeExercises,
    weeklySplitRules: storeSplitRules,
    scheduledWorkouts: storeScheduled,
    workouts: storeWorkouts,
  } = useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);

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
  const workouts =
    !hydrated || (storeWorkouts.length === 0 && initialWorkouts.length > 0)
      ? initialWorkouts
      : storeWorkouts;

  const initialParsed = parseLocalDate(serverTodayDate);
  const [todayDate, setTodayDate] = useState(serverTodayDate);
  const [selectedDate, setSelectedDate] = useState(serverTodayDate);
  const [viewMode, setViewMode] = useState<"month" | "week">("month");
  const [viewYear, setViewYear] = useState(initialParsed.getFullYear());
  const [viewMonthIndex0, setViewMonthIndex0] = useState(
    initialParsed.getMonth()
  );

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<ScheduledWorkout | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [previewExercise, setPreviewExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    const localToday = getTodayLocalDate();
    setTodayDate(localToday);
    setSelectedDate((prev) => (prev === serverTodayDate ? localToday : prev));
    if (localToday !== serverTodayDate) {
      const parsed = parseLocalDate(localToday);
      setViewYear(parsed.getFullYear());
      setViewMonthIndex0(parsed.getMonth());
    }
  }, [serverTodayDate]);

  const routineMap = useMemo(
    () => new Map(routines.map((r) => [r.id, r])),
    [routines]
  );

  const exerciseMap = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
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

  const dotsByDate = useMemo(() => {
    const map = new Map<string, CalendarDot[]>();
    const linkedWorkoutIds = new Set<string>();

    for (const sw of scheduledWorkouts) {
      if (sw.workout_id) {
        linkedWorkoutIds.add(sw.workout_id);
      }
      const routine = routineMap.get(sw.routine_id);
      if (!routine) continue;
      const list = map.get(sw.scheduled_date) ?? [];
      list.push({ color: routine.color, status: sw.status });
      map.set(sw.scheduled_date, list);
    }

    for (const w of workouts) {
      if (w.status !== "completed" || linkedWorkoutIds.has(w.id)) {
        continue;
      }
      const list = map.get(w.workout_date) ?? [];
      list.push({ color: "#059669", status: "completed" });
      map.set(w.workout_date, list);
    }

    return map;
  }, [scheduledWorkouts, workouts, routineMap]);

  const selectedDaySchedules = useMemo(() => {
    return scheduledWorkouts.filter((sw) => sw.scheduled_date === selectedDate);
  }, [scheduledWorkouts, selectedDate]);

  const selectedDayAdHocWorkouts = useMemo(() => {
    const linkedIds = new Set(
      selectedDaySchedules
        .map((sw) => sw.workout_id)
        .filter((id): id is string => id !== null)
    );
    return workouts.filter(
      (w) =>
        w.status === "completed" &&
        w.workout_date === selectedDate &&
        !linkedIds.has(w.id)
    );
  }, [workouts, selectedDate, selectedDaySchedules]);

  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    const parsed = parseLocalDate(dateStr);
    setViewYear(parsed.getFullYear());
    setViewMonthIndex0(parsed.getMonth());
  }

  function handleStepPeriod(delta: -1 | 1) {
    if (viewMode === "week") {
      const next = addDays(selectedDate, delta * 7);
      handleSelectDate(next);
      return;
    }

    const shifted = shiftMonth(viewYear, viewMonthIndex0, delta);
    setViewYear(shifted.year);
    setViewMonthIndex0(shifted.monthIndex0);
  }

  function handleJumpToday() {
    handleSelectDate(todayDate);
  }

  function openNewScheduleModal() {
    setEditingSchedule(null);
    setAssignModalOpen(true);
  }

  function openMoveScheduleModal(item: ScheduledWorkout) {
    setEditingSchedule(item);
    setAssignModalOpen(true);
  }

  async function handleToggleSkip(item: ScheduledWorkout) {
    const now = new Date().toISOString();
    const nextStatus = item.status === "skipped" ? "planned" : "skipped";
    const updated: ScheduledWorkout = {
      ...item,
      status: nextStatus,
      updated_at: now,
    };

    useAppDataStore.getState().upsertScheduledWorkoutOptimistic(updated);
    await putLocalScheduledWorkout(updated);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "UPSERT_SCHEDULED_WORKOUT",
        clientUpdatedAt: now,
        payload: {
          id: updated.id,
          routine_id: updated.routine_id,
          scheduled_date: updated.scheduled_date,
          status: updated.status,
          workout_id: updated.workout_id,
          source_split_rule_id: updated.source_split_rule_id,
          notes: updated.notes,
        },
      },
      `scheduled:${updated.id}`
    );
  }

  async function handleRemoveScheduled(item: ScheduledWorkout) {
    const now = new Date().toISOString();
    useAppDataStore.getState().deleteScheduledWorkoutOptimistic(item.id);
    await deleteLocalScheduledWorkout(item.id);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "DELETE_SCHEDULED_WORKOUT",
        clientUpdatedAt: now,
        payload: { id: item.id },
      },
      `scheduled:${item.id}`
    );
  }

  async function handleQuickScheduleRoutine(routineId: string) {
    const now = new Date().toISOString();
    const newItem: ScheduledWorkout = {
      id: crypto.randomUUID(),
      routine_id: routineId,
      scheduled_date: selectedDate,
      status: "planned",
      workout_id: null,
      source_split_rule_id: null,
      notes: null,
      created_at: now,
      updated_at: now,
    };

    useAppDataStore.getState().upsertScheduledWorkoutOptimistic(newItem);
    await putLocalScheduledWorkout(newItem);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "UPSERT_SCHEDULED_WORKOUT",
        clientUpdatedAt: now,
        payload: {
          id: newItem.id,
          routine_id: newItem.routine_id,
          scheduled_date: newItem.scheduled_date,
          status: newItem.status,
          workout_id: newItem.workout_id,
          source_split_rule_id: newItem.source_split_rule_id,
          notes: newItem.notes,
        },
      },
      `scheduled:${newItem.id}`
    );
  }

  return (
    <div>
      {/* Top header */}
      <div className="flex items-center justify-between gap-2 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            Calendar
          </h1>
          <p className="text-xs text-zinc-500">
            Weekly split & scheduled strength sessions
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSplitModalOpen(true)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            <CalendarRange className="h-4 w-4 text-zinc-500" aria-hidden="true" />
            <span>Split</span>
          </button>
          <button
            type="button"
            onClick={openNewScheduleModal}
            className="inline-flex min-h-[44px] items-center gap-1 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Schedule</span>
          </button>
        </div>
      </div>

      {/* Month / Week interactive grid */}
      <CalendarGrid
        mode={viewMode}
        onModeChange={setViewMode}
        viewYear={viewYear}
        viewMonthIndex0={viewMonthIndex0}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onSelectDate={handleSelectDate}
        onStepPeriod={handleStepPeriod}
        onJumpToday={handleJumpToday}
        dotsByDate={dotsByDate}
      />

      {/* Selected Day Agenda */}
      <section className="-mx-4 border-b border-zinc-200 sm:-mx-6">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/50 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-zinc-950">
              {formatDayHeader(selectedDate)}
            </h2>
            {selectedDate === todayDate && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Today
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={openNewScheduleModal}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Assign</span>
          </button>
        </div>

        {selectedDaySchedules.length > 0 ||
        selectedDayAdHocWorkouts.length > 0 ? (
          <div className="divide-y divide-zinc-200">
            {selectedDaySchedules.map((scheduleItem) => {
              const routine = routineMap.get(scheduleItem.routine_id);
              const rows = exercisesByRoutine.get(scheduleItem.routine_id) ?? [];
              const supersetLabels = getSupersetPositions(rows);
              const totalSets = rows.reduce((s, r) => s + r.target_sets, 0);
              const accentColor = routine?.color ?? "#475569";

              return (
                <div key={scheduleItem.id} className="flex bg-white">
                  <span
                    className="w-1.5 shrink-0"
                    style={{
                      backgroundColor:
                        scheduleItem.status === "completed"
                          ? "#059669"
                          : accentColor,
                    }}
                    aria-hidden="true"
                  />

                  <div className="min-w-0 flex-1">
                    {/* Agenda Header */}
                    <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2.5 sm:px-5">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3
                            className={`truncate text-base font-bold ${
                              scheduleItem.status === "skipped"
                                ? "text-zinc-400 line-through"
                                : "text-zinc-950"
                            }`}
                          >
                            {routine?.name ?? "Scheduled Routine"}
                          </h3>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              scheduleItem.status === "completed"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : scheduleItem.status === "skipped"
                                  ? "border-zinc-200 bg-zinc-100 text-zinc-500"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                            }`}
                          >
                            {scheduleItem.status === "completed"
                              ? "Completed"
                              : scheduleItem.status === "skipped"
                                ? "Skipped"
                                : "Planned"}
                          </span>
                        </div>
                        <p className="tabular-nums mt-0.5 text-xs text-zinc-500">
                          {rows.length}{" "}
                          {rows.length === 1 ? "exercise" : "exercises"} •{" "}
                          {totalSets} target sets
                        </p>
                        {scheduleItem.notes && (
                          <p className="mt-1 text-xs text-zinc-600">
                            {scheduleItem.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Interactive exercise demo preview list */}
                    {rows.length > 0 && (
                      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
                        {rows.map((row, idx) => {
                          const ex = exerciseMap.get(row.exercise_id);
                          const label = supersetLabels[idx];

                          return (
                            <li key={row.id}>
                              <button
                                type="button"
                                disabled={!ex}
                                onClick={() => {
                                  if (ex) setPreviewExercise(ex);
                                }}
                                className="flex min-h-[44px] w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-zinc-50 disabled:opacity-60 sm:px-5"
                              >
                                <div className="flex min-w-0 items-center gap-2">
                                  {label && (
                                    <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                                      {label}
                                    </span>
                                  )}
                                  <span className="truncate text-sm font-medium text-zinc-900">
                                    {ex?.name ?? "Unknown Exercise"}
                                  </span>
                                </div>
                                <span className="tabular-nums shrink-0 text-xs text-zinc-500">
                                  {formatRepPrescription(row)}
                                  {row.target_rpe !== null
                                    ? ` • RPE ${row.target_rpe}`
                                    : ""}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    {/* Management actions */}
                    {scheduleItem.status !== "completed" && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-4 py-2.5 sm:px-5">
                        <button
                          type="button"
                          onClick={() => openMoveScheduleModal(scheduleItem)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          <ArrowRightLeft
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>Move Date</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleToggleSkip(scheduleItem)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          {scheduleItem.status === "skipped" ? (
                            <>
                              <RotateCcw
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <Ban
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                              <span>Skip</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleRemoveScheduled(scheduleItem)
                          }
                          aria-label="Remove scheduled workout"
                          className="ml-auto inline-flex min-h-[38px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-medium text-rose-700 hover:bg-rose-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Remove</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {selectedDayAdHocWorkouts.map((workout) => (
              <div
                key={workout.id}
                className="flex items-center justify-between gap-3 bg-white px-4 py-3.5 sm:px-6"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-950">
                      {workout.name}
                    </p>
                    <p className="tabular-nums text-xs text-zinc-500">
                      {workout.total_sets} sets • {Math.round(workout.total_volume)}{" "}
                      {workout.weight_unit}
                    </p>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
                  Logged
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center sm:px-6">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <CalendarDays className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-zinc-950">
              Rest day — nothing scheduled
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {routines.length > 0
                ? "Assign a routine to this date or configure your repeating weekly split."
                : "Create your first strength routine to schedule workouts here."}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              {routines.length > 0 ? (
                <button
                  type="button"
                  onClick={openNewScheduleModal}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Schedule a Routine</span>
                </button>
              ) : (
                <Link
                  href="/routines"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
                >
                  Create First Routine
                </Link>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Quick schedule strip when user already has saved routines */}
      {routines.length > 0 && (
        <section className="-mx-4 border-b border-zinc-200 sm:-mx-6">
          <div className="flex items-center justify-between border-b border-zinc-100 bg-zinc-50/40 px-4 py-2.5 sm:px-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Quick Assign to {formatDayHeader(selectedDate)}
            </span>
            <Link
              href="/routines"
              className="text-xs font-medium text-emerald-700 hover:underline"
            >
              Manage Routines
            </Link>
          </div>
          <ul className="divide-y divide-zinc-200">
            {routines.map((routine) => {
              const count = (exercisesByRoutine.get(routine.id) ?? []).length;
              return (
                <li
                  key={routine.id}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: routine.color }}
                    />
                    <span className="truncate text-sm font-medium text-zinc-900">
                      {routine.name}
                    </span>
                    <span className="tabular-nums shrink-0 text-xs text-zinc-400">
                      ({count} ex)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleQuickScheduleRoutine(routine.id)}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Assign</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!isConfigured && (
        <section className="-mx-4 flex items-center justify-between border-b border-amber-200 bg-amber-50/60 px-4 py-3 sm:-mx-6 sm:px-6">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
            <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Supabase environment keys not configured</span>
          </div>
          <Link
            href="/settings"
            className="text-xs font-semibold text-amber-900 underline"
          >
            Settings
          </Link>
        </section>
      )}

      <AssignRoutineModal
        open={assignModalOpen}
        defaultDate={selectedDate}
        editingSchedule={editingSchedule}
        routines={routines}
        routineExercises={routineExercises}
        onClose={() => setAssignModalOpen(false)}
      />

      <WeeklySplitModal
        open={splitModalOpen}
        routines={routines}
        weeklySplitRules={weeklySplitRules}
        scheduledWorkouts={scheduledWorkouts}
        onClose={() => setSplitModalOpen(false)}
      />

      <ExerciseDetailDrawer
        exercise={previewExercise}
        readOnly
        onClose={() => setPreviewExercise(null)}
        onEdit={() => {}}
      />
    </div>
  );
}
