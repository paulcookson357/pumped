"use client";

import { create } from "zustand";
import { adjustTimerEndAt } from "@/lib/workouts/restTimer";

const STORAGE_KEY = "pumped-rest-timer-v1";

interface PersistedRestTimer {
  startedAt: number | null;
  endAt: number | null;
  durationSeconds: number;
  exerciseName: string | null;
}

export interface RestCompletedNotice {
  exerciseName: string | null;
  finishedAt: number;
}

interface RestTimerState {
  hydrated: boolean;
  startedAt: number | null;
  endAt: number | null;
  durationSeconds: number;
  exerciseName: string | null;
  completedNotice: RestCompletedNotice | null;
  hydrate: () => void;
  start: (seconds: number, exerciseName?: string | null) => void;
  adjust: (deltaSeconds: number) => void;
  skip: () => void;
  markCompleted: () => void;
  dismissCompleted: () => void;
}

function saveToStorage(state: PersistedRestTimer): void {
  if (typeof window === "undefined") return;
  try {
    if (state.endAt === null) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {
    // ignore storage quota errors
  }
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  hydrated: false,
  startedAt: null,
  endAt: null,
  durationSeconds: 0,
  exerciseName: null,
  completedNotice: null,

  hydrate: () => {
    if (get().hydrated || typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        set({ hydrated: true });
        return;
      }

      const parsed = JSON.parse(raw) as Partial<PersistedRestTimer>;
      if (typeof parsed.endAt === "number" && parsed.endAt > Date.now()) {
        set({
          hydrated: true,
          startedAt:
            typeof parsed.startedAt === "number"
              ? parsed.startedAt
              : Date.now(),
          endAt: parsed.endAt,
          durationSeconds:
            typeof parsed.durationSeconds === "number"
              ? parsed.durationSeconds
              : 90,
          exerciseName:
            typeof parsed.exerciseName === "string"
              ? parsed.exerciseName
              : null,
          completedNotice: null,
        });
        return;
      }

      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }

    set({ hydrated: true });
  },

  start: (seconds, exerciseName = null) => {
    const cleanSeconds = Math.max(0, Math.round(seconds));
    if (cleanSeconds <= 0) {
      get().skip();
      return;
    }

    const now = Date.now();
    const next: PersistedRestTimer = {
      startedAt: now,
      endAt: now + cleanSeconds * 1000,
      durationSeconds: cleanSeconds,
      exerciseName: exerciseName ?? null,
    };

    saveToStorage(next);
    set({
      ...next,
      hydrated: true,
      completedNotice: null,
    });
  },

  adjust: (deltaSeconds) => {
    const { endAt, durationSeconds, startedAt, exerciseName } = get();
    if (endAt === null) return;

    const now = Date.now();
    const adjusted = adjustTimerEndAt(endAt, deltaSeconds, durationSeconds, now);

    if (adjusted.endAt === null) {
      saveToStorage({
        startedAt: null,
        endAt: null,
        durationSeconds: 0,
        exerciseName: null,
      });
      set({
        startedAt: null,
        endAt: null,
        durationSeconds: 0,
        exerciseName: null,
        completedNotice: null,
      });
      return;
    }

    const next: PersistedRestTimer = {
      startedAt: startedAt ?? now,
      endAt: adjusted.endAt,
      durationSeconds: adjusted.durationSeconds,
      exerciseName,
    };
    saveToStorage(next);
    set(next);
  },

  skip: () => {
    saveToStorage({
      startedAt: null,
      endAt: null,
      durationSeconds: 0,
      exerciseName: null,
    });
    set({
      startedAt: null,
      endAt: null,
      durationSeconds: 0,
      exerciseName: null,
      completedNotice: null,
    });
  },

  markCompleted: () => {
    const { exerciseName, endAt } = get();
    if (endAt === null) return;

    saveToStorage({
      startedAt: null,
      endAt: null,
      durationSeconds: 0,
      exerciseName: null,
    });
    set({
      startedAt: null,
      endAt: null,
      durationSeconds: 0,
      exerciseName: null,
      completedNotice: {
        exerciseName,
        finishedAt: Date.now(),
      },
    });
  },

  dismissCompleted: () => set({ completedNotice: null }),
}));
