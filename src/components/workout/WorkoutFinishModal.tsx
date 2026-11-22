"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Award, CheckCircle2, Trophy, X } from "lucide-react";
import { formatDayHeader } from "@/lib/dates/localDate";
import {
  computeCardioTotals,
  formatCardioDecimal,
  formatCardioDurationCompact,
  formatCardioSetSummary,
  getDistanceUnit,
  hasAnyCardioMetrics,
} from "@/lib/workouts/cardio";
import {
  formatElapsedDuration,
  formatNumberCompact,
} from "@/lib/workouts/stats";
import { useAppDataStore } from "@/stores/useAppDataStore";
import type { WorkoutFinishSummary } from "@/stores/useActiveWorkoutStore";

interface WorkoutFinishModalProps {
  summary: WorkoutFinishSummary | null;
  onDismiss: () => void;
}

export function WorkoutFinishModal({
  summary,
  onDismiss,
}: WorkoutFinishModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!summary) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [summary, onDismiss]);

  const exercises = useAppDataStore((state) => state.exercises);

  if (!summary) {
    return null;
  }

  const { workout, sets, prHighlights, exerciseNames } = summary;
  const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]));
  const cardioTotals = computeCardioTotals(
    sets.filter(
      (s) =>
        exerciseById.get(s.exercise_id)?.tracking_type === "cardio" ||
        hasAnyCardioMetrics(s)
    )
  );
  const showCardioHeadlineStat =
    workout.total_volume === 0 &&
    (cardioTotals.totalDistance > 0 || cardioTotals.totalCardioSeconds > 0);

  // Group completed sets sequentially by exercise_order for summary recap
  const groupedExercises: Array<{
    key: string;
    exerciseId: string;
    exerciseName: string;
    sets: typeof sets;
  }> = [];

  for (const ws of sets) {
    const key = `${ws.exercise_order}:${ws.exercise_id}`;
    const last = groupedExercises[groupedExercises.length - 1];
    if (last && last.key === key) {
      last.sets.push(ws);
    } else {
      groupedExercises.push({
        key,
        exerciseId: ws.exercise_id,
        exerciseName: exerciseNames[ws.exercise_id] ?? "Exercise",
        sets: [ws],
      });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Workout Complete"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
            <span className="text-sm font-bold uppercase tracking-wider">
              Workout Complete
            </span>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close summary"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="pb-safe flex-1 overflow-y-auto bg-white">
        {/* Headline Banner */}
        <div className="border-b border-zinc-200 px-4 py-6 text-center sm:px-6">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            {workout.pr_count > 0 ? (
              <Trophy className="h-6 w-6" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            )}
          </div>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-zinc-950">
            {workout.name}
          </h2>
          <p className="mt-1 text-xs font-medium text-zinc-500">
            {formatDayHeader(workout.workout_date)}
          </p>
        </div>

        {/* 4-cell Stat Hairline Grid */}
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 border-b border-zinc-200 sm:grid-cols-4 sm:divide-y-0">
          <div className="px-4 py-3.5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Duration
            </p>
            <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
              {formatElapsedDuration(workout.duration_seconds ?? 0)}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              {showCardioHeadlineStat
                ? cardioTotals.totalDistance > 0
                  ? "Distance"
                  : "Cardio Time"
                : "Volume"}
            </p>
            <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
              {showCardioHeadlineStat
                ? cardioTotals.totalDistance > 0
                  ? `${formatCardioDecimal(cardioTotals.totalDistance)} ${getDistanceUnit(workout.weight_unit)}`
                  : formatCardioDurationCompact(cardioTotals.totalCardioSeconds)
                : `${formatNumberCompact(workout.total_volume)} ${workout.weight_unit}`}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Completed Sets
            </p>
            <p className="tabular-nums mt-0.5 text-lg font-bold text-zinc-950">
              {workout.total_sets}
            </p>
          </div>
          <div className="px-4 py-3.5 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Personal Records
            </p>
            <p className="tabular-nums mt-0.5 text-lg font-bold text-emerald-600">
              {workout.pr_count}
            </p>
          </div>
        </div>

        {/* Personal Records Highlights */}
        {prHighlights.length > 0 && (
          <section className="border-b border-zinc-200">
            <div className="border-b border-zinc-100 bg-emerald-50/40 px-4 py-2.5 sm:px-6">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-800">
                <Award className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                <span>Personal Records</span>
              </div>
            </div>
            <ul className="divide-y divide-zinc-100">
              {prHighlights.map((pr) => (
                <li
                  key={pr.setId}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-zinc-950">
                      {exerciseNames[pr.exerciseId] ?? "Exercise"}
                    </p>
                    <p className="tabular-nums text-xs text-zinc-500">
                      {pr.weight !== null ? `${formatNumberCompact(pr.weight)} ${workout.weight_unit}` : "BW"}
                      {pr.reps !== null ? ` × ${pr.reps}` : ""}
                      {pr.est1rm > 0
                        ? ` • Est. 1RM ${formatNumberCompact(pr.est1rm)} ${workout.weight_unit}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1">
                    {pr.isWeightPR && (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        Weight PR
                      </span>
                    )}
                    {pr.is1RMPR && (
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                        1RM PR
                      </span>
                    )}
                    {pr.isVolumePR && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        Volume PR
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Exercise Breakdown */}
        {groupedExercises.length > 0 && (
          <section className="divide-y divide-zinc-200 border-b border-zinc-200">
            {groupedExercises.map((group) => {
              const isCardioGroup =
                exerciseById.get(group.exerciseId)?.tracking_type === "cardio";
              return (
                <div key={group.key} className="px-4 py-3.5 sm:px-6">
                  <h3 className="text-sm font-bold text-zinc-950">
                    {group.exerciseName}
                  </h3>
                  <ul className="mt-1.5 space-y-1">
                    {group.sets.map((s) => {
                      const setIsCardio =
                        isCardioGroup ||
                        s.distance !== null ||
                        s.speed !== null ||
                        s.resistance !== null ||
                        s.incline !== null;
                      return (
                        <li
                          key={s.id}
                          className="tabular-nums flex items-center justify-between gap-2 text-xs text-zinc-600"
                        >
                          <span className="shrink-0">
                            {setIsCardio ? "Interval" : "Set"} {s.set_number}
                            {s.set_type !== "normal" ? ` (${s.set_type})` : ""}
                          </span>
                          <span className="truncate font-medium text-zinc-900">
                            {setIsCardio
                              ? formatCardioSetSummary(s, workout.weight_unit)
                              : s.duration_seconds !== null &&
                                  s.duration_seconds > 0
                                ? `${s.duration_seconds}s`
                                : s.weight !== null && s.weight > 0
                                  ? `${formatNumberCompact(s.weight)} ${workout.weight_unit} × ${s.reps ?? 0}`
                                  : `${s.reps ?? 0} reps`}
                            {s.rpe !== null ? ` • RPE ${s.rpe}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </section>
        )}
      </div>

      <footer className="pb-safe shrink-0 space-y-2 border-t border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => {
            router.push(`/history/${workout.id}`);
            onDismiss();
          }}
          className="flex min-h-[44px] w-full items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
        >
          View Session Details
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex min-h-[48px] w-full items-center justify-center rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Done
        </button>
      </footer>
    </div>
  );
}
