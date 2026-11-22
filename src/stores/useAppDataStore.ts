"use client";

import { create } from "zustand";
import type { SnapshotDomainPayloads } from "@/lib/offline/db";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
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

interface AppDataState {
  hydrated: boolean;
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  settings: AppSettings | null;
  hydrateAll: (data: {
    exercises: Exercise[];
    routines: Routine[];
    routineExercises: RoutineExercise[];
    weeklySplitRules: WeeklySplitRule[];
    scheduledWorkouts: ScheduledWorkout[];
    workouts: Workout[];
    workoutSets: WorkoutSet[];
    settings: AppSettings | null;
  }) => void;
  applyDomainPayloads: (payload: SnapshotDomainPayloads) => void;
  setExercises: (exercises: Exercise[]) => void;
  upsertExerciseOptimistic: (exercise: Exercise) => void;
  archiveExerciseOptimistic: (id: string) => void;
}

export const useAppDataStore = create<AppDataState>((set) => ({
  hydrated: false,
  exercises: [],
  routines: [],
  routineExercises: [],
  weeklySplitRules: [],
  scheduledWorkouts: [],
  workouts: [],
  workoutSets: [],
  settings: null,

  hydrateAll: (data) =>
    set({
      hydrated: true,
      exercises: sortExercises(data.exercises),
      routines: data.routines,
      routineExercises: data.routineExercises,
      weeklySplitRules: data.weeklySplitRules,
      scheduledWorkouts: data.scheduledWorkouts,
      workouts: data.workouts,
      workoutSets: data.workoutSets,
      settings: data.settings,
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
          ? payload.routines.routines
          : state.routines,
      routineExercises:
        payload.routines !== undefined
          ? payload.routines.routineExercises
          : state.routineExercises,
      weeklySplitRules:
        payload.schedule !== undefined
          ? payload.schedule.weeklySplitRules
          : state.weeklySplitRules,
      scheduledWorkouts:
        payload.schedule !== undefined
          ? payload.schedule.scheduledWorkouts
          : state.scheduledWorkouts,
      workouts:
        payload.workouts !== undefined
          ? payload.workouts.workouts
          : state.workouts,
      workoutSets:
        payload.workouts !== undefined
          ? payload.workouts.workoutSets
          : state.workoutSets,
      settings:
        payload.settings !== undefined ? payload.settings : state.settings,
    })),

  setExercises: (exercises) => set({ exercises: sortExercises(exercises) }),

  upsertExerciseOptimistic: (exercise) =>
    set((state) => {
      const next = state.exercises.filter((item) => item.id !== exercise.id);
      next.push(exercise);
      return { exercises: sortExercises(next) };
    }),

  archiveExerciseOptimistic: (id) =>
    set((state) => ({
      exercises: state.exercises.filter((item) => item.id !== id),
    })),
}));
