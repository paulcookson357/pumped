"use client";

import { create } from "zustand";
import { getTodayLocalDate } from "@/lib/dates/localDate";
import {
  getLocalPreviousPerformance,
  putLocalCompletedWorkout,
  putLocalPreviousPerformance,
  type PreviousPerformanceRecord,
} from "@/lib/offline/db";
import { enqueueAndSync, syncIfStale } from "@/lib/offline/syncEngine";
import {
  linkAdjacentSuperset,
  normalizeSupersetGroups,
  unlinkSupersetItem,
} from "@/lib/routines/supersets";
import type {
  AppSettings,
  Routine,
  RoutineExercise,
  SetType,
  WeightUnit,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import {
  formatCardioDecimal,
  formatCardioDurationInput,
  parseCardioTimeInput,
} from "@/lib/workouts/cardio";
import {
  computeOptimisticPRs,
  computeWorkoutTotals,
  derivePreviousPerformanceFromLocal,
  type ExercisePRHighlight,
} from "@/lib/workouts/stats";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

const ACTIVE_WORKOUT_STORAGE_KEY = "pumped-active-workout-v1";

export interface ActiveSetDraft {
  id: string;
  setType: SetType;
  weight: string;
  reps: string;
  rpe: number | null;
  durationSeconds: string;
  distance: string;
  speed: string;
  resistance: string;
  incline: string;
  isCompleted: boolean;
  completedAt: string | null;
}

export interface ActiveExerciseDraft {
  draftId: string;
  exerciseId: string;
  supersetGroup: number | null;
  restSeconds: number;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetRpe: number | null;
  notes: string;
  sets: ActiveSetDraft[];
}

export interface ActiveWorkoutDraft {
  id: string;
  routineId: string | null;
  scheduledWorkoutId: string | null;
  name: string;
  notes: string;
  workoutDate: string;
  startedAt: string;
  weightUnit: WeightUnit;
  showRpe: boolean;
  exercises: ActiveExerciseDraft[];
}

export interface StartWorkoutRequest {
  routine?: Routine | null;
  routineExercises?: RoutineExercise[];
  scheduledWorkoutId?: string | null;
  workoutDate?: string;
  name?: string;
  appSettings?: AppSettings | null;
}

export interface WorkoutFinishSummary {
  workout: Workout;
  sets: WorkoutSet[];
  prHighlights: ExercisePRHighlight[];
  exerciseNames: Record<string, string>;
}

interface PreviousFallbackValues {
  weight: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distance?: number | null;
  speed?: number | null;
  resistance?: number | null;
  incline?: number | null;
}

interface ActiveWorkoutState {
  hydrated: boolean;
  activeWorkout: ActiveWorkoutDraft | null;
  sheetOpen: boolean;
  pendingStartRequest: StartWorkoutRequest | null;
  previousByExercise: Record<string, PreviousPerformanceRecord>;
  finishSummary: WorkoutFinishSummary | null;
  hydrate: () => void;
  openSheet: () => void;
  minimizeSheet: () => void;
  dismissSummary: () => void;
  clearPendingStart: () => void;
  requestStartWorkout: (request: StartWorkoutRequest) => void;
  confirmReplaceAndStart: () => void;
  updateWorkoutMeta: (patch: { name?: string; notes?: string }) => void;
  toggleShowRpe: () => void;
  addExercises: (exerciseIds: string[], defaultRestSeconds?: number) => void;
  removeExercise: (draftId: string) => void;
  moveExercise: (index: number, direction: -1 | 1) => void;
  swapExercise: (draftId: string, newExerciseId: string) => void;
  linkSuperset: (index: number) => void;
  unlinkSuperset: (index: number) => void;
  updateExerciseRest: (draftId: string, restSeconds: number) => void;
  updateExerciseNotes: (draftId: string, notes: string) => void;
  addSet: (draftId: string) => void;
  removeSet: (draftId: string, setId: string) => void;
  updateSet: (
    draftId: string,
    setId: string,
    patch: Partial<
      Pick<
        ActiveSetDraft,
        | "setType"
        | "weight"
        | "reps"
        | "rpe"
        | "durationSeconds"
        | "distance"
        | "speed"
        | "resistance"
        | "incline"
      >
    >
  ) => void;
  applyPreviousToSet: (
    draftId: string,
    setId: string,
    fallback: PreviousFallbackValues
  ) => void;
  toggleSetComplete: (
    draftId: string,
    setId: string,
    options?: {
      fallback?: PreviousFallbackValues;
      autoStartRestTimer?: boolean;
      exerciseName?: string;
    }
  ) => void;
  finishWorkout: (appSettings?: AppSettings | null) => Promise<void>;
  discardWorkout: () => void;
  loadPreviousPerformance: (exerciseIds: string[]) => Promise<void>;
}

function createEmptySet(setType: SetType = "normal"): ActiveSetDraft {
  return {
    id: crypto.randomUUID(),
    setType,
    weight: "",
    reps: "",
    rpe: null,
    durationSeconds: "",
    distance: "",
    speed: "",
    resistance: "",
    incline: "",
    isCompleted: false,
    completedAt: null,
  };
}

function buildDraftFromRequest(
  request: StartWorkoutRequest
): ActiveWorkoutDraft {
  const settings = request.appSettings ?? useAppDataStore.getState().settings;
  const weightUnit: WeightUnit = settings?.weight_unit ?? "kg";
  const showRpe = settings?.show_rpe_column ?? true;
  const defaultRest = settings?.default_rest_seconds ?? 90;
  const sortedRows = [...(request.routineExercises ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const exercises: ActiveExerciseDraft[] = sortedRows.map((row) => ({
    draftId: crypto.randomUUID(),
    exerciseId: row.exercise_id,
    supersetGroup: row.superset_group,
    restSeconds: row.rest_seconds ?? defaultRest,
    targetRepsMin: row.target_reps_min,
    targetRepsMax: row.target_reps_max,
    targetRpe: row.target_rpe,
    notes: row.notes ?? "",
    sets: Array.from({ length: Math.max(1, row.target_sets) }, () =>
      createEmptySet("normal")
    ),
  }));

  return {
    id: crypto.randomUUID(),
    routineId: request.routine?.id ?? null,
    scheduledWorkoutId: request.scheduledWorkoutId ?? null,
    name:
      request.name?.trim() ||
      request.routine?.name ||
      "Quick Workout",
    notes: request.routine?.notes ?? "",
    workoutDate: request.workoutDate ?? getTodayLocalDate(),
    startedAt: new Date().toISOString(),
    weightUnit,
    showRpe,
    exercises,
  };
}

function persistWorkoutDraft(draft: ActiveWorkoutDraft | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!draft) {
      window.localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
    } else {
      window.localStorage.setItem(
        ACTIVE_WORKOUT_STORAGE_KEY,
        JSON.stringify(draft)
      );
    }
  } catch {
    // ignore storage errors
  }
}

function parseOptionalFloat(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function parseOptionalIncline(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num) || num < -15 || num > 50) return null;
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Math.floor(Number(trimmed));
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

export const useActiveWorkoutStore = create<ActiveWorkoutState>((set, get) => {
  const commitDraft = (nextDraft: ActiveWorkoutDraft | null) => {
    persistWorkoutDraft(nextDraft);
    set({ activeWorkout: nextDraft });
  };

  const startImmediate = (request: StartWorkoutRequest) => {
    const draft = buildDraftFromRequest(request);
    useRestTimerStore.getState().skip();
    persistWorkoutDraft(draft);
    set({
      activeWorkout: draft,
      sheetOpen: true,
      pendingStartRequest: null,
      finishSummary: null,
    });

    const exIds = draft.exercises.map((e) => e.exerciseId);
    if (exIds.length > 0) {
      void get().loadPreviousPerformance(exIds);
    }
  };

  return {
    hydrated: false,
    activeWorkout: null,
    sheetOpen: false,
    pendingStartRequest: null,
    previousByExercise: {},
    finishSummary: null,

    hydrate: () => {
      if (get().hydrated || typeof window === "undefined") return;

      try {
        const raw = window.localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as ActiveWorkoutDraft;
          if (parsed && typeof parsed.id === "string" && Array.isArray(parsed.exercises)) {
            const normalizedDraft: ActiveWorkoutDraft = {
              ...parsed,
              exercises: parsed.exercises.map((ex) => ({
                ...ex,
                sets: (ex.sets ?? []).map((s) => ({
                  ...s,
                  distance: s.distance ?? "",
                  speed: s.speed ?? "",
                  resistance: s.resistance ?? "",
                  incline: s.incline ?? "",
                })),
              })),
            };
            set({
              hydrated: true,
              activeWorkout: normalizedDraft,
              sheetOpen: false,
            });
            const exIds = normalizedDraft.exercises.map((e) => e.exerciseId);
            if (exIds.length > 0) {
              void get().loadPreviousPerformance(exIds);
            }
            return;
          }
        }
      } catch {
        try {
          window.localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY);
        } catch {
          // ignore
        }
      }

      set({ hydrated: true });
    },

    openSheet: () => {
      if (!get().activeWorkout) return;
      set({ sheetOpen: true });
    },

    minimizeSheet: () => set({ sheetOpen: false }),

    dismissSummary: () => set({ finishSummary: null }),

    clearPendingStart: () => set({ pendingStartRequest: null }),

    requestStartWorkout: (request) => {
      if (get().activeWorkout) {
        set({ pendingStartRequest: request });
        return;
      }
      startImmediate(request);
    },

    confirmReplaceAndStart: () => {
      const pending = get().pendingStartRequest;
      if (!pending) return;
      startImmediate(pending);
    },

    loadPreviousPerformance: async (exerciseIds) => {
      const uniqueIds = Array.from(new Set(exerciseIds));
      if (uniqueIds.length === 0) return;

      const appData = useAppDataStore.getState();
      const fromMemory = derivePreviousPerformanceFromLocal(
        appData.workouts,
        appData.workoutSets,
        uniqueIds
      );
      const fromIdb = await getLocalPreviousPerformance(uniqueIds);

      set((state) => ({
        previousByExercise: {
          ...state.previousByExercise,
          ...fromIdb,
          ...fromMemory,
        },
      }));

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return;
      }

      try {
        const res = await fetch("/api/exercises/previous", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ exerciseIds: uniqueIds }),
        });

        if (!res.ok) return;

        const data = (await res.json()) as {
          previous?: Record<string, PreviousPerformanceRecord>;
        };
        if (data.previous) {
          const records = Object.values(data.previous);
          if (records.length > 0) {
            void putLocalPreviousPerformance(records);
          }
          set((state) => ({
            previousByExercise: {
              ...state.previousByExercise,
              ...data.previous,
            },
          }));
        }
      } catch {
        // Offline / transient network errors fall back safely to local IDB
      }
    },

    updateWorkoutMeta: (patch) => {
      const current = get().activeWorkout;
      if (!current) return;
      commitDraft({
        ...current,
        name: patch.name !== undefined ? patch.name : current.name,
        notes: patch.notes !== undefined ? patch.notes : current.notes,
      });
    },

    toggleShowRpe: () => {
      const current = get().activeWorkout;
      if (!current) return;
      commitDraft({
        ...current,
        showRpe: !current.showRpe,
      });
    },

    addExercises: (exerciseIds, defaultRestSeconds) => {
      const current = get().activeWorkout;
      if (!current || exerciseIds.length === 0) return;

      const rest =
        defaultRestSeconds ??
        useAppDataStore.getState().settings?.default_rest_seconds ??
        90;

      const allExercises = useAppDataStore.getState().exercises;
      const exerciseMap = new Map(allExercises.map((ex) => [ex.id, ex]));

      const added: ActiveExerciseDraft[] = exerciseIds.map((exerciseId) => {
        const trackingType = exerciseMap.get(exerciseId)?.tracking_type;
        const isCardio = trackingType === "cardio";
        return {
          draftId: crypto.randomUUID(),
          exerciseId,
          supersetGroup: null,
          restSeconds: isCardio ? 60 : rest,
          targetRepsMin: null,
          targetRepsMax: null,
          targetRpe: null,
          notes: "",
          sets: isCardio
            ? [createEmptySet("normal")]
            : [
                createEmptySet("normal"),
                createEmptySet("normal"),
                createEmptySet("normal"),
              ],
        };
      });

      commitDraft({
        ...current,
        exercises: [...current.exercises, ...added],
      });

      void get().loadPreviousPerformance(exerciseIds);
    },

    removeExercise: (draftId) => {
      const current = get().activeWorkout;
      if (!current) return;

      const filtered = normalizeSupersetGroups(
        current.exercises
          .filter((ex) => ex.draftId !== draftId)
          .map((ex) => ({ ...ex, superset_group: ex.supersetGroup }))
      ).map(({ superset_group, ...rest }) => ({
        ...rest,
        supersetGroup: superset_group,
      }));

      commitDraft({
        ...current,
        exercises: filtered,
      });
    },

    moveExercise: (index, direction) => {
      const current = get().activeWorkout;
      if (!current) return;

      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.exercises.length) return;

      const reordered = [...current.exercises];
      const [moved] = reordered.splice(index, 1);
      if (!moved) return;
      reordered.splice(targetIndex, 0, moved);

      commitDraft({
        ...current,
        exercises: reordered,
      });
    },

    swapExercise: (draftId, newExerciseId) => {
      const current = get().activeWorkout;
      if (!current) return;

      const nextExercises = current.exercises.map((ex) => {
        if (ex.draftId !== draftId) return ex;
        return {
          ...ex,
          exerciseId: newExerciseId,
          sets: ex.sets.map((s) =>
            s.isCompleted
              ? s
              : {
                  ...s,
                  weight: "",
                  reps: "",
                  rpe: null,
                  durationSeconds: "",
                  distance: "",
                  speed: "",
                  resistance: "",
                  incline: "",
                }
          ),
        };
      });

      commitDraft({
        ...current,
        exercises: nextExercises,
      });

      void get().loadPreviousPerformance([newExerciseId]);
    },

    linkSuperset: (index) => {
      const current = get().activeWorkout;
      if (!current) return;

      const linked = linkAdjacentSuperset(
        current.exercises.map((ex) => ({
          ...ex,
          superset_group: ex.supersetGroup,
        })),
        index
      ).map(({ superset_group, ...rest }) => ({
        ...rest,
        supersetGroup: superset_group,
      }));

      commitDraft({
        ...current,
        exercises: linked,
      });
    },

    unlinkSuperset: (index) => {
      const current = get().activeWorkout;
      if (!current) return;

      const unlinked = unlinkSupersetItem(
        current.exercises.map((ex) => ({
          ...ex,
          superset_group: ex.supersetGroup,
        })),
        index
      ).map(({ superset_group, ...rest }) => ({
        ...rest,
        supersetGroup: superset_group,
      }));

      commitDraft({
        ...current,
        exercises: unlinked,
      });
    },

    updateExerciseRest: (draftId, restSeconds) => {
      const current = get().activeWorkout;
      if (!current) return;
      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) =>
          ex.draftId === draftId
            ? { ...ex, restSeconds: Math.max(0, Math.min(900, restSeconds)) }
            : ex
        ),
      });
    },

    updateExerciseNotes: (draftId, notes) => {
      const current = get().activeWorkout;
      if (!current) return;
      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) =>
          ex.draftId === draftId ? { ...ex, notes } : ex
        ),
      });
    },

    addSet: (draftId) => {
      const current = get().activeWorkout;
      if (!current) return;

      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) => {
          if (ex.draftId !== draftId) return ex;
          const prevSet = ex.sets[ex.sets.length - 1];
          const nextSet: ActiveSetDraft = {
            id: crypto.randomUUID(),
            setType:
              prevSet && prevSet.setType !== "warmup" ? prevSet.setType : "normal",
            weight: prevSet ? prevSet.weight : "",
            reps: prevSet ? prevSet.reps : "",
            rpe: null,
            durationSeconds: prevSet ? prevSet.durationSeconds : "",
            distance: prevSet ? prevSet.distance : "",
            speed: prevSet ? prevSet.speed : "",
            resistance: prevSet ? prevSet.resistance : "",
            incline: prevSet ? prevSet.incline : "",
            isCompleted: false,
            completedAt: null,
          };
          return {
            ...ex,
            sets: [...ex.sets, nextSet],
          };
        }),
      });
    },

    removeSet: (draftId, setId) => {
      const current = get().activeWorkout;
      if (!current) return;

      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) => {
          if (ex.draftId !== draftId || ex.sets.length <= 1) return ex;
          return {
            ...ex,
            sets: ex.sets.filter((s) => s.id !== setId),
          };
        }),
      });
    },

    updateSet: (draftId, setId, patch) => {
      const current = get().activeWorkout;
      if (!current) return;

      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) => {
          if (ex.draftId !== draftId) return ex;
          return {
            ...ex,
            sets: ex.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
          };
        }),
      });
    },

    applyPreviousToSet: (draftId, setId, fallback) => {
      const current = get().activeWorkout;
      if (!current) return;
      const exerciseMap = new Map(
        useAppDataStore.getState().exercises.map((ex) => [ex.id, ex])
      );

      commitDraft({
        ...current,
        exercises: current.exercises.map((ex) => {
          if (ex.draftId !== draftId) return ex;
          const isCardio =
            exerciseMap.get(ex.exerciseId)?.tracking_type === "cardio";

          return {
            ...ex,
            sets: ex.sets.map((s) => {
              if (s.id !== setId) return s;
              const prevDuration =
                fallback.durationSeconds !== null
                  ? isCardio
                    ? formatCardioDurationInput(fallback.durationSeconds)
                    : String(fallback.durationSeconds)
                  : s.durationSeconds;

              return {
                ...s,
                weight:
                  fallback.weight !== null ? String(fallback.weight) : s.weight,
                reps: fallback.reps !== null ? String(fallback.reps) : s.reps,
                durationSeconds: prevDuration || s.durationSeconds,
                distance:
                  fallback.distance !== null && fallback.distance !== undefined
                    ? formatCardioDecimal(fallback.distance)
                    : s.distance,
                speed:
                  fallback.speed !== null && fallback.speed !== undefined
                    ? formatCardioDecimal(fallback.speed)
                    : s.speed,
                resistance:
                  fallback.resistance !== null &&
                  fallback.resistance !== undefined
                    ? formatCardioDecimal(fallback.resistance)
                    : s.resistance,
                incline:
                  fallback.incline !== null && fallback.incline !== undefined
                    ? formatCardioDecimal(fallback.incline)
                    : s.incline,
              };
            }),
          };
        }),
      });
    },

    toggleSetComplete: (draftId, setId, options) => {
      const current = get().activeWorkout;
      if (!current) return;

      const exIndex = current.exercises.findIndex(
        (ex) => ex.draftId === draftId
      );
      if (exIndex === -1) return;
      const exercise = current.exercises[exIndex];
      if (!exercise) return;

      const targetSet = exercise.sets.find((s) => s.id === setId);
      if (!targetSet) return;

      const completing = !targetSet.isCompleted;
      const nowIso = new Date().toISOString();
      const fallback = options?.fallback;
      const exMeta = useAppDataStore
        .getState()
        .exercises.find((e) => e.id === exercise.exerciseId);
      const isCardio = exMeta?.tracking_type === "cardio";

      const nextExercises = current.exercises.map((ex) => {
        if (ex.draftId !== draftId) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s) => {
            if (s.id !== setId) return s;
            if (!completing) {
              return { ...s, isCompleted: false, completedAt: null };
            }

            const adoptedWeight =
              s.weight.trim().length > 0
                ? s.weight
                : fallback?.weight !== null && fallback?.weight !== undefined
                  ? String(fallback.weight)
                  : "";
            const adoptedReps =
              s.reps.trim().length > 0
                ? s.reps
                : fallback?.reps !== null && fallback?.reps !== undefined
                  ? String(fallback.reps)
                  : ex.targetRepsMin !== null
                    ? String(ex.targetRepsMin)
                    : "";
            const adoptedDuration =
              s.durationSeconds.trim().length > 0
                ? s.durationSeconds
                : fallback?.durationSeconds !== null &&
                    fallback?.durationSeconds !== undefined
                  ? isCardio
                    ? formatCardioDurationInput(fallback.durationSeconds)
                    : String(fallback.durationSeconds)
                  : "";
            const adoptedDistance =
              s.distance.trim().length > 0
                ? s.distance
                : fallback?.distance !== null &&
                    fallback?.distance !== undefined
                  ? formatCardioDecimal(fallback.distance)
                  : "";
            const adoptedSpeed =
              s.speed.trim().length > 0
                ? s.speed
                : fallback?.speed !== null && fallback?.speed !== undefined
                  ? formatCardioDecimal(fallback.speed)
                  : "";
            const adoptedResistance =
              s.resistance.trim().length > 0
                ? s.resistance
                : fallback?.resistance !== null &&
                    fallback?.resistance !== undefined
                  ? formatCardioDecimal(fallback.resistance)
                  : "";
            const adoptedIncline =
              s.incline.trim().length > 0
                ? s.incline
                : fallback?.incline !== null && fallback?.incline !== undefined
                  ? formatCardioDecimal(fallback.incline)
                  : "";

            return {
              ...s,
              weight: adoptedWeight,
              reps: adoptedReps,
              durationSeconds: adoptedDuration,
              distance: adoptedDistance,
              speed: adoptedSpeed,
              resistance: adoptedResistance,
              incline: adoptedIncline,
              isCompleted: true,
              completedAt: nowIso,
            };
          }),
        };
      });

      commitDraft({
        ...current,
        exercises: nextExercises,
      });

      // Trigger auto-rest timer if enabled and not mid-superset transition
      const shouldAutoStart = options?.autoStartRestTimer ?? true;
      if (completing && shouldAutoStart && exercise.restSeconds > 0) {
        const isSupersetNotLast =
          exercise.supersetGroup !== null &&
          current.exercises.some(
            (other, i) =>
              i > exIndex && other.supersetGroup === exercise.supersetGroup
          );

        if (!isSupersetNotLast) {
          useRestTimerStore
            .getState()
            .start(exercise.restSeconds, options?.exerciseName ?? null);
        }
      }
    },

    finishWorkout: async (appSettings) => {
      const current = get().activeWorkout;
      if (!current) return;

      const now = new Date();
      const completedAt = now.toISOString();
      const startedMs = new Date(current.startedAt).getTime();
      const durationSeconds = Number.isFinite(startedMs)
        ? Math.max(0, Math.floor((now.getTime() - startedMs) / 1000))
        : 0;

      const appData = useAppDataStore.getState();
      const exerciseMap = new Map(appData.exercises.map((ex) => [ex.id, ex]));
      const rawCompletedSets: WorkoutSet[] = [];
      let sequentialExOrder = 0;

      for (const ex of current.exercises) {
        const completedForEx = ex.sets.filter((s) => s.isCompleted);
        if (completedForEx.length === 0) continue;
        const isCardio = exerciseMap.get(ex.exerciseId)?.tracking_type === "cardio";

        completedForEx.forEach((s, setIdx) => {
          const parsedDuration = isCardio
            ? parseCardioTimeInput(s.durationSeconds)
            : parseOptionalInt(s.durationSeconds);

          rawCompletedSets.push({
            id: s.id,
            workout_id: current.id,
            exercise_id: ex.exerciseId,
            exercise_order: sequentialExOrder,
            superset_group: ex.supersetGroup,
            set_number: setIdx + 1,
            set_type: s.setType,
            weight: isCardio ? null : parseOptionalFloat(s.weight),
            reps: isCardio ? null : parseOptionalInt(s.reps),
            rpe: s.rpe,
            duration_seconds: parsedDuration,
            distance: isCardio ? parseOptionalFloat(s.distance) : null,
            speed: isCardio ? parseOptionalFloat(s.speed) : null,
            resistance: isCardio ? parseOptionalFloat(s.resistance) : null,
            incline: isCardio ? parseOptionalIncline(s.incline) : null,
            rest_seconds: ex.restSeconds,
            is_completed: true,
            completed_at: s.completedAt ?? completedAt,
            is_pr_weight: false,
            is_pr_1rm: false,
            is_pr_volume: false,
            notes: ex.notes.trim() || null,
            client_updated_at: completedAt,
            created_at: current.startedAt,
            updated_at: completedAt,
          });
        });

        sequentialExOrder += 1;
      }

      const totals = computeWorkoutTotals(rawCompletedSets);
      const prEval = computeOptimisticPRs(
        rawCompletedSets,
        appData.workouts,
        appData.workoutSets,
        current.id
      );

      const workoutName = current.name.trim() || "Workout";
      const completedWorkout: Workout = {
        id: current.id,
        routine_id: current.routineId,
        name: workoutName,
        notes: current.notes.trim() || null,
        status: "completed",
        workout_date: current.workoutDate,
        started_at: current.startedAt,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        weight_unit: appSettings?.weight_unit ?? current.weightUnit,
        total_volume: totals.totalVolume,
        total_sets: totals.totalSets,
        pr_count: prEval.prCount,
        client_updated_at: completedAt,
        created_at: current.startedAt,
        updated_at: completedAt,
      };

      const exerciseNames: Record<string, string> = {};
      for (const ex of appData.exercises) {
        exerciseNames[ex.id] = ex.name;
      }

      appData.completeWorkoutOptimistic({
        workout: completedWorkout,
        sets: prEval.setsWithPRs,
        scheduledWorkoutId: current.scheduledWorkoutId,
      });

      await putLocalCompletedWorkout({
        workout: completedWorkout,
        sets: prEval.setsWithPRs,
        scheduledWorkoutId: current.scheduledWorkoutId,
      });

      persistWorkoutDraft(null);
      useRestTimerStore.getState().skip();

      set({
        activeWorkout: null,
        sheetOpen: false,
        pendingStartRequest: null,
        finishSummary: {
          workout: completedWorkout,
          sets: prEval.setsWithPRs,
          prHighlights: prEval.prHighlights,
          exerciseNames,
        },
      });

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: "FINISH_WORKOUT",
          clientUpdatedAt: completedAt,
          payload: {
            id: completedWorkout.id,
            routine_id: completedWorkout.routine_id,
            scheduled_workout_id: current.scheduledWorkoutId,
            name: completedWorkout.name,
            notes: completedWorkout.notes,
            workout_date: completedWorkout.workout_date,
            started_at: completedWorkout.started_at,
            completed_at: completedAt,
            duration_seconds: durationSeconds,
            weight_unit: completedWorkout.weight_unit,
            sets: prEval.setsWithPRs.map((ws) => ({
              id: ws.id,
              exercise_id: ws.exercise_id,
              exercise_order: ws.exercise_order,
              superset_group: ws.superset_group,
              set_number: ws.set_number,
              set_type: ws.set_type,
              weight: ws.weight,
              reps: ws.reps,
              rpe: ws.rpe,
              duration_seconds: ws.duration_seconds,
              distance: ws.distance,
              speed: ws.speed,
              resistance: ws.resistance,
              incline: ws.incline,
              rest_seconds: ws.rest_seconds,
              is_completed: true,
              completed_at: ws.completed_at,
              notes: ws.notes,
            })),
          },
        },
        `workout:${completedWorkout.id}`
      ).then(() => syncIfStale());
    },

    discardWorkout: () => {
      persistWorkoutDraft(null);
      useRestTimerStore.getState().skip();
      set({
        activeWorkout: null,
        sheetOpen: false,
        pendingStartRequest: null,
      });
    },
  };
});
