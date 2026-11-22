"use client";

import { useEffect, useState } from "react";
import { ChevronUp, Timer } from "lucide-react";
import { computeRemainingSeconds } from "@/lib/workouts/restTimer";
import {
  formatElapsedDuration,
  formatRestRemaining,
} from "@/lib/workouts/stats";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

export function ActiveWorkoutMiniBar() {
  const { activeWorkout, sheetOpen, openSheet } = useActiveWorkoutStore();
  const restEndAt = useRestTimerStore((state) => state.endAt);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const activeStartedAt = activeWorkout?.startedAt ?? null;
  const visible = Boolean(activeWorkout && !sheetOpen);

  useEffect(() => {
    if (!visible || !activeStartedAt) return;
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [visible, activeStartedAt]);

  if (!activeWorkout || sheetOpen) {
    return null;
  }

  const startedMs = new Date(activeWorkout.startedAt).getTime();
  const elapsedSeconds = Number.isFinite(startedMs)
    ? Math.max(0, Math.floor((nowMs - startedMs) / 1000))
    : 0;
  const completedSetsCount = activeWorkout.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
  const restRemaining = computeRemainingSeconds(restEndAt, nowMs);

  return (
    <div className="fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom))] z-30 border-t border-emerald-200 bg-emerald-50/95 backdrop-blur-md">
      <button
        type="button"
        onClick={openSheet}
        aria-label={`Resume ${activeWorkout.name}`}
        className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:bg-emerald-100/70 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-emerald-600"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-emerald-950">
              {activeWorkout.name}
            </p>
            <p className="tabular-nums text-[11px] font-medium text-emerald-800">
              {formatElapsedDuration(elapsedSeconds)} • {completedSetsCount}{" "}
              {completedSetsCount === 1 ? "set" : "sets"} logged
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {restRemaining > 0 && (
            <span className="tabular-nums inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs font-bold text-emerald-700">
              <Timer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{formatRestRemaining(restRemaining)}</span>
            </span>
          )}
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </button>
    </div>
  );
}
