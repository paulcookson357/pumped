"use client";

import { create } from "zustand";
import type { SnapshotDomainPayloads } from "@/lib/offline/db";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  SyncDomain,
  WeeklySplitRule,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";

function sortExercises(exercises: Exercise[]): Exercise[] {
  return [...exercises].sort((a, b) => {
    if (a.is_custom !== b.is_custom) {
      return a.is_custom ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

function sortRoutines(routines: Routine[]): Routine[] {
  return [...routines].sort((a, b) => a.sort_order - b.sort_order);
}

function sortRoutineExercises(items: RoutineExercise[]): RoutineExercise[] {
  return [...items].sort((a, b) => a.sort_order - b.sort_order);
}

function sortWeeklySplitRules(rules: WeeklySplitRule[]): WeeklySplitRule[] {
  return [...rules].sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.sort_order - b.sort_order;
  });
}

function sortScheduledWorkouts(items: ScheduledWorkout[]): ScheduledWorkout[] {
  return [...items].sort((a, b) =>
    a.scheduled_date.localeCompare(b.scheduled_date)
  );
}

function sortWorkoutsDesc(items: Workout[]): Workout[] {
  return [...items].sort((a, b) => {
    const tA = a.completed_at ?? a.created_at;
    const tB = b.completed_at ?? b.created_at;
    return tB.localeCompare(tA);
  });
}

interface HydrateOptions {
  preserveNonEmptyExercises?: boolean;
  preserveNonEmptyRoutines?: boolean;
  preserveNonEmptySchedule?: boolean;
  preserveNonEmptyWorkouts?: boolean;
  preserveNonEmptySettings?: boolean;
}

interface AppDataState {
  hydrated: boolean;
  touchedDomains: Record<SyncDomain, boolean>;
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  settings: AppSettings | null;
  hydrateAll: (
    data: {
      exercises: Exercise[];
      routines: Routine[];
      routineExercises: RoutineExercise[];
      weeklySplitRules: WeeklySplitRule[];
      scheduledWorkouts: ScheduledWorkout[];
      workouts: Workout[];
      workoutSets: WorkoutSet[];
      settings: AppSettings | null;
    },
    options?: HydrateOptions
  ) => void;
  applyDomainPayloads: (payload: SnapshotDomainPayloads) => void;
  setExercises: (exercises: Exercise[]) => void;
  setRoutinesBundle: (
    routines: Routine[],
    routineExercises: RoutineExercise[]
  ) => void;
  setScheduleBundle: (
    weeklySplitRules: WeeklySplitRule[],
    scheduledWorkouts: ScheduledWorkout[]
  ) => void;
  setWorkoutsBundle: (workouts: Workout[], workoutSets: WorkoutSet[]) => void;
  setSettings: (settings: AppSettings | null) => void;
  upsertExerciseOptimistic: (exercise: Exercise) => void;
  archiveExerciseOptimistic: (id: string) => void;
  upsertRoutineOptimistic: (
    routine: Routine,
    exercises: RoutineExercise[]
  ) => void;
  reorderRoutinesOptimistic: (orderedIds: string[]) => void;
  archiveRoutineOptimistic: (routineId: string) => void;
  saveWeeklySplitOptimistic: (params: {
    rules: WeeklySplitRule[];
    removePlannedIds: string[];
    generatedWorkouts: ScheduledWorkout[];
  }) => void;
  upsertScheduledWorkoutOptimistic: (item: ScheduledWorkout) => void;
  deleteScheduledWorkoutOptimistic: (id: string) => void;
  completeWorkoutOptimistic: (params: {
    workout: Workout;
    sets: WorkoutSet[];
    scheduledWorkoutId?: string | null;
  }) => void;
  deleteWorkoutOptimistic: (workoutId: string) => void;
}

export const useAppDataStore = create<AppDataState>((set) => ({
  hydrated: false,
  touchedDomains: {
    exercises: false,
    routines: false,
    schedule: false,
    workouts: false,
    settings: false,
  },
  exercises: [],
  routines: [],
  routineExercises: [],
  weeklySplitRules: [],
  scheduledWorkouts: [],
  workouts: [],
  workoutSets: [],
  settings: null,

  hydrateAll: (data, options) =>
    set((state) => {
      const keepRoutines =
        Boolean(options?.preserveNonEmptyRoutines) &&
        data.routines.length === 0 &&
        state.routines.length > 0;
      const keepSchedule =
        Boolean(options?.preserveNonEmptySchedule) &&
        data.weeklySplitRules.length === 0 &&
        data.scheduledWorkouts.length === 0 &&
        (state.weeklySplitRules.length > 0 ||
          state.scheduledWorkouts.length > 0);
      const keepWorkouts =
        Boolean(options?.preserveNonEmptyWorkouts) &&
        data.workouts.length === 0 &&
        state.workouts.length > 0;
      const keepSettings =
        Boolean(options?.preserveNonEmptySettings) &&
        data.settings === null &&
        state.settings !== null;

      return {
        hydrated: true,
        exercises:
          options?.preserveNonEmptyExercises &&
          data.exercises.length === 0 &&
          state.exercises.length > 0
            ? state.exercises
            : sortExercises(data.exercises),
        routines: keepRoutines ? state.routines : sortRoutines(data.routines),
        routineExercises: keepRoutines
          ? state.routineExercises
          : sortRoutineExercises(data.routineExercises),
        weeklySplitRules: keepSchedule
          ? state.weeklySplitRules
          : sortWeeklySplitRules(data.weeklySplitRules),
        scheduledWorkouts: keepSchedule
          ? state.scheduledWorkouts
          : sortScheduledWorkouts(data.scheduledWorkouts),
        workouts: keepWorkouts
          ? state.workouts
          : sortWorkoutsDesc(data.workouts),
        workoutSets: keepWorkouts ? state.workoutSets : data.workoutSets,
        settings: keepSettings ? state.settings : data.settings,
      };
    }),

  applyDomainPayloads: (payload) =>
    set((state) => ({
      hydrated: true,
      exercises:
        payload.exercises !== undefined
          ? sortExercises(payload.exercises)
          : state.exercises,
      routines:
        payload.routines !== undefined
          ? sortRoutines(payload.routines.routines)
          : state.routines,
      routineExercises:
        payload.routines !== undefined
          ? sortRoutineExercises(payload.routines.routineExercises)
          : state.routineExercises,
      weeklySplitRules:
        payload.schedule !== undefined
          ? sortWeeklySplitRules(payload.schedule.weeklySplitRules)
          : state.weeklySplitRules,
      scheduledWorkouts:
        payload.schedule !== undefined
          ? sortScheduledWorkouts(payload.schedule.scheduledWorkouts)
          : state.scheduledWorkouts,
      workouts:
        payload.workouts !== undefined
          ? sortWorkoutsDesc(payload.workouts.workouts)
          : state.workouts,
      workoutSets:
        payload.workouts !== undefined
          ? payload.workouts.workoutSets
          : state.workoutSets,
      settings:
        payload.settings !== undefined ? payload.settings : state.settings,
    })),

  setExercises: (exercises) =>
    set((state) => ({
      exercises: sortExercises(exercises),
      touchedDomains: { ...state.touchedDomains, exercises: true },
    })),

  setRoutinesBundle: (routines, routineExercises) =>
    set((state) => ({
      routines: sortRoutines(routines),
      routineExercises: sortRoutineExercises(routineExercises),
      touchedDomains: { ...state.touchedDomains, routines: true },
    })),

  setScheduleBundle: (weeklySplitRules, scheduledWorkouts) =>
    set((state) => ({
      weeklySplitRules: sortWeeklySplitRules(weeklySplitRules),
      scheduledWorkouts: sortScheduledWorkouts(scheduledWorkouts),
      touchedDomains: { ...state.touchedDomains, schedule: true },
    })),

  setWorkoutsBundle: (workouts, workoutSets) =>
    set((state) => ({
      workouts: sortWorkoutsDesc(workouts),
      workoutSets,
      touchedDomains: { ...state.touchedDomains, workouts: true },
    })),

  setSettings: (settings) =>
    set((state) => ({
      settings,
      touchedDomains: { ...state.touchedDomains, settings: true },
    })),

  upsertExerciseOptimistic: (exercise) =>
    set((state) => {
      const next = state.exercises.filter((item) => item.id !== exercise.id);
      next.push(exercise);
      return {
        exercises: sortExercises(next),
        touchedDomains: { ...state.touchedDomains, exercises: true },
      };
    }),

  archiveExerciseOptimistic: (id) =>
    set((state) => ({
      exercises: state.exercises.filter((item) => item.id !== id),
      touchedDomains: { ...state.touchedDomains, exercises: true },
    })),

  upsertRoutineOptimistic: (routine, exercises) =>
    set((state) => {
      const nextRoutines = state.routines.filter((r) => r.id !== routine.id);
      nextRoutines.push(routine);
      const nextRoutineExercises = state.routineExercises.filter(
        (re) => re.routine_id !== routine.id
      );
      nextRoutineExercises.push(...exercises);

      return {
        routines: sortRoutines(nextRoutines),
        routineExercises: sortRoutineExercises(nextRoutineExercises),
        touchedDomains: { ...state.touchedDomains, routines: true },
      };
    }),

  reorderRoutinesOptimistic: (orderedIds) =>
    set((state) => {
      const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
      const now = new Date().toISOString();
      const next = state.routines.map((r) => {
        const nextOrder = orderMap.get(r.id);
        return nextOrder === undefined
          ? r
          : { ...r, sort_order: nextOrder, updated_at: now };
      });
      return {
        routines: sortRoutines(next),
        touchedDomains: { ...state.touchedDomains, routines: true },
      };
    }),

  archiveRoutineOptimistic: (routineId) =>
    set((state) => ({
      routines: state.routines.filter((r) => r.id !== routineId),
      routineExercises: state.routineExercises.filter(
        (re) => re.routine_id !== routineId
      ),
      weeklySplitRules: state.weeklySplitRules.filter(
        (rule) => rule.routine_id !== routineId
      ),
      scheduledWorkouts: state.scheduledWorkouts.filter(
        (sw) => !(sw.routine_id === routineId && sw.status === "planned")
      ),
      touchedDomains: {
        ...state.touchedDomains,
        routines: true,
        schedule: true,
      },
    })),

  saveWeeklySplitOptimistic: ({ rules, removePlannedIds, generatedWorkouts }) =>
    set((state) => {
      const removeSet = new Set(removePlannedIds);
      const remainingScheduled = state.scheduledWorkouts.filter(
        (sw) => !removeSet.has(sw.id)
      );
      return {
        weeklySplitRules: sortWeeklySplitRules(rules),
        scheduledWorkouts: sortScheduledWorkouts([
          ...remainingScheduled,
          ...generatedWorkouts,
        ]),
        touchedDomains: { ...state.touchedDomains, schedule: true },
      };
    }),

  upsertScheduledWorkoutOptimistic: (item) =>
    set((state) => {
      const next = state.scheduledWorkouts.filter((sw) => sw.id !== item.id);
      next.push(item);
      return {
        scheduledWorkouts: sortScheduledWorkouts(next),
        touchedDomains: { ...state.touchedDomains, schedule: true },
      };
    }),

  deleteScheduledWorkoutOptimistic: (id) =>
    set((state) => ({
      scheduledWorkouts: state.scheduledWorkouts.filter((sw) => sw.id !== id),
      touchedDomains: { ...state.touchedDomains, schedule: true },
    })),

  completeWorkoutOptimistic: ({ workout, sets, scheduledWorkoutId }) =>
    set((state) => {
      const completedStamp = workout.completed_at ?? workout.updated_at;
      const nextWorkouts = sortWorkoutsDesc([
        ...state.workouts.filter((w) => w.id !== workout.id),
        workout,
      ]);
      const nextWorkoutSets = [
        ...state.workoutSets.filter((ws) => ws.workout_id !== workout.id),
        ...sets,
      ];

      const nextRoutines = workout.routine_id
        ? state.routines.map((r) =>
            r.id === workout.routine_id
              ? {
                  ...r,
                  last_performed_at: completedStamp,
                  updated_at: completedStamp,
                }
              : r
          )
        : state.routines;

      const nextScheduled = scheduledWorkoutId
        ? state.scheduledWorkouts.map((sw) =>
            sw.id === scheduledWorkoutId
              ? {
                  ...sw,
                  status: "completed" as const,
                  workout_id: workout.id,
                  updated_at: completedStamp,
                }
              : sw
          )
        : state.scheduledWorkouts;

      return {
        workouts: nextWorkouts,
        workoutSets: nextWorkoutSets,
        routines: nextRoutines,
        scheduledWorkouts: nextScheduled,
        touchedDomains: {
          ...state.touchedDomains,
          workouts: true,
          ...(workout.routine_id ? { routines: true } : {}),
          ...(scheduledWorkoutId ? { schedule: true } : {}),
        },
      };
    }),

  deleteWorkoutOptimistic: (workoutId) =>
    set((state) => {
      const now = new Date().toISOString();
      const linkedSchedule = state.scheduledWorkouts.some(
        (sw) => sw.workout_id === workoutId
      );

      return {
        workouts: state.workouts.filter((w) => w.id !== workoutId),
        workoutSets: state.workoutSets.filter(
          (ws) => ws.workout_id !== workoutId
        ),
        scheduledWorkouts: linkedSchedule
          ? state.scheduledWorkouts.map((sw) =>
              sw.workout_id === workoutId
                ? {
                    ...sw,
                    status: "planned" as const,
                    workout_id: null,
                    updated_at: now,
                  }
                : sw
            )
          : state.scheduledWorkouts,
        touchedDomains: {
          ...state.touchedDomains,
          workouts: true,
          ...(linkedSchedule ? { schedule: true } : {}),
        },
      };
    }),
}));
