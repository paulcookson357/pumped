"use client";

import { useEffect, useState } from "react";
import { BellRing, Minus, Plus, Timer, X } from "lucide-react";
import { playRestCompleteFeedback } from "@/lib/audio/restChime";
import { computeRemainingSeconds, isTimerFinished } from "@/lib/workouts/restTimer";
import { formatRestRemaining } from "@/lib/workouts/stats";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

export function RestTimerBanner() {
  const {
    endAt,
    durationSeconds,
    exerciseName,
    completedNotice,
    adjust,
    skip,
    markCompleted,
    dismissCompleted,
  } = useRestTimerStore();
  const settings = useAppDataStore((state) => state.settings);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (endAt === null) return;
    setNowMs(Date.now());

    const interval = window.setInterval(() => {
      const now = Date.now();
      setNowMs(now);

      if (isTimerFinished(endAt, now)) {
        markCompleted();
        playRestCompleteFeedback({
          soundEnabled: settings?.timer_sound_enabled ?? true,
          hapticsEnabled: settings?.timer_haptics_enabled ?? true,
        });
      }
    }, 200);

    return () => window.clearInterval(interval);
  }, [
    endAt,
    markCompleted,
    settings?.timer_haptics_enabled,
    settings?.timer_sound_enabled,
  ]);

  useEffect(() => {
    if (!completedNotice) return;
    const timeout = window.setTimeout(() => {
      dismissCompleted();
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, [completedNotice, dismissCompleted]);

  if (endAt !== null) {
    const remaining = computeRemainingSeconds(endAt, nowMs);
    const total = Math.max(durationSeconds, remaining, 1);
    const progressPct = Math.max(
      0,
      Math.min(100, (remaining / total) * 100)
    );

    return (
      <div
        role="region"
        aria-label="Rest timer"
        className="relative shrink-0 border-b border-emerald-200 bg-emerald-50/80 px-4 py-2.5 sm:px-6"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Timer className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="tabular-nums text-base font-bold leading-tight text-emerald-950">
                {formatRestRemaining(remaining)}
              </p>
              <p className="truncate text-[11px] font-medium text-emerald-700">
                {exerciseName ? `Resting • ${exerciseName}` : "Rest timer"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => adjust(-15)}
              aria-label="Subtract 15 seconds"
              className="inline-flex min-h-[36px] items-center gap-0.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Minus className="h-3 w-3" aria-hidden="true" />
              <span>15s</span>
            </button>
            <button
              type="button"
              onClick={() => adjust(15)}
              aria-label="Add 15 seconds"
              className="inline-flex min-h-[36px] items-center gap-0.5 rounded-lg border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              <span>15s</span>
            </button>
            <button
              type="button"
              onClick={skip}
              className="inline-flex min-h-[36px] items-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
            >
              Skip
            </button>
          </div>
        </div>

        {/* Hairline countdown progress bar */}
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-emerald-200/70">
          <div
            className="h-full bg-emerald-600 transition-[width] duration-200 ease-linear"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    );
  }

  if (completedNotice) {
    return (
      <div
        role="status"
        className="flex shrink-0 items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-600 px-4 py-2 text-white sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold">
          <BellRing className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">
            Rest complete
            {completedNotice.exerciseName
              ? ` — Ready for ${completedNotice.exerciseName}`
              : " — Next set ready"}
          </span>
        </div>
        <button
          type="button"
          onClick={dismissCompleted}
          aria-label="Dismiss rest notification"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/90 hover:bg-emerald-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return null;
}
