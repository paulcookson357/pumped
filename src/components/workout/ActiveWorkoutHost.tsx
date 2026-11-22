"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { ActiveWorkoutMiniBar } from "@/components/workout/ActiveWorkoutMiniBar";
import { ActiveWorkoutSheet } from "@/components/workout/ActiveWorkoutSheet";
import { WorkoutFinishModal } from "@/components/workout/WorkoutFinishModal";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

export function ActiveWorkoutHost() {
  const {
    activeWorkout,
    pendingStartRequest,
    finishSummary,
    hydrate: hydrateWorkout,
    clearPendingStart,
    confirmReplaceAndStart,
    openSheet,
    dismissSummary,
  } = useActiveWorkoutStore();

  const hydrateTimer = useRestTimerStore((state) => state.hydrate);

  useEffect(() => {
    hydrateWorkout();
    hydrateTimer();
  }, [hydrateWorkout, hydrateTimer]);

  return (
    <>
      <ActiveWorkoutMiniBar />
      <ActiveWorkoutSheet />
      <WorkoutFinishModal summary={finishSummary} onDismiss={dismissSummary} />

      {pendingStartRequest && activeWorkout && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Workout already in progress"
          className="fixed inset-0 z-[65] flex items-end justify-center bg-zinc-950/40 p-4 sm:items-center"
        >
          <div className="w-full max-w-md rounded-xl border border-zinc-200 bg-white p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-zinc-950">
                  Workout already in progress
                </h2>
                <p className="mt-1 text-sm text-zinc-600">
                  &ldquo;{activeWorkout.name}&rdquo; is currently active. Resume
                  it or discard it to start &ldquo;
                  {pendingStartRequest.name ??
                    pendingStartRequest.routine?.name ??
                    "Quick Workout"}
                  &rdquo;.
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  clearPendingStart();
                  openSheet();
                }}
                className="min-h-[44px] flex-1 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Resume Current
              </button>
              <button
                type="button"
                onClick={confirmReplaceAndStart}
                className="min-h-[44px] flex-1 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-100"
              >
                Discard &amp; Start New
              </button>
            </div>
            <button
              type="button"
              onClick={clearPendingStart}
              className="mt-2 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-white text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
