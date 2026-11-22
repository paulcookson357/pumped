"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  Link2,
  MoreHorizontal,
  Plus,
  StickyNote,
  Timer,
  Trash2,
  Unlink,
} from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import { SetRow } from "@/components/workout/SetRow";
import type { PreviousPerformanceRecord } from "@/lib/offline/db";
import { getSupersetColor } from "@/lib/routines/colors";
import type { Exercise, WeightUnit } from "@/lib/types/domain";
import { useActiveWorkoutStore, type ActiveExerciseDraft } from "@/stores/useActiveWorkoutStore";
import { useRestTimerStore } from "@/stores/useRestTimerStore";

const REST_PRESETS = [0, 30, 60, 90, 120, 180] as const;

interface ActiveExerciseBlockProps {
  draft: ActiveExerciseDraft;
  index: number;
  totalExercises: number;
  supersetLabel: string | null;
  exercise: Exercise | undefined;
  previousRecord: PreviousPerformanceRecord | undefined;
  weightUnit: WeightUnit;
  showRpe: boolean;
  autoStartRestTimer: boolean;
  onPreviewExercise: (exercise: Exercise) => void;
  onRequestSwap: (draftId: string) => void;
}

export function ActiveExerciseBlock({
  draft,
  index,
  totalExercises,
  supersetLabel,
  exercise,
  previousRecord,
  weightUnit,
  showRpe,
  autoStartRestTimer,
  onPreviewExercise,
  onRequestSwap,
}: ActiveExerciseBlockProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(draft.notes.trim().length > 0);

  const {
    addSet,
    removeSet,
    updateSet,
    applyPreviousToSet,
    toggleSetComplete,
    updateExerciseRest,
    updateExerciseNotes,
    removeExercise,
    moveExercise,
    linkSuperset,
    unlinkSuperset,
  } = useActiveWorkoutStore();

  const startRestTimer = useRestTimerStore((state) => state.start);

  const trackingType = exercise?.tracking_type ?? "weight_reps";
  const accentColor = getSupersetColor(draft.supersetGroup);
  const isInSuperset = draft.supersetGroup !== null;
  const canLinkNext = index < totalExercises - 1;
  const hasWeightCol =
    trackingType === "weight_reps" || trackingType === "weighted_bodyweight";

  return (
    <section className="relative flex bg-white">
      {accentColor && (
        <span
          aria-hidden="true"
          className="w-1.5 shrink-0"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <div className="min-w-0 flex-1">
        {/* Exercise header */}
        <div className="flex items-start justify-between gap-2 px-4 pt-3.5 pb-2 sm:px-6">
          <button
            type="button"
            disabled={!exercise}
            onClick={() => {
              if (exercise) onPreviewExercise(exercise);
            }}
            className="flex min-w-0 flex-1 items-center gap-3 text-left transition-opacity hover:opacity-85 disabled:opacity-100"
          >
            {exercise && (
              <ExerciseVisual
                exercise={exercise}
                size="thumb"
                animateFallback={false}
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {supersetLabel && (
                  <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                    {supersetLabel}
                  </span>
                )}
                <h3 className="truncate text-base font-bold text-zinc-950">
                  {exercise?.name ?? "Unknown Exercise"}
                </h3>
              </div>

              {(draft.targetRepsMin !== null || draft.targetRpe !== null) && (
                <p className="tabular-nums mt-0.5 text-xs text-zinc-500">
                  Target:{" "}
                  {draft.targetRepsMin !== null
                    ? draft.targetRepsMax !== null &&
                      draft.targetRepsMax !== draft.targetRepsMin
                      ? `${draft.targetRepsMin}-${draft.targetRepsMax} reps`
                      : `${draft.targetRepsMin} reps`
                    : ""}
                  {draft.targetRepsMin !== null && draft.targetRpe !== null
                    ? " • "
                    : ""}
                  {draft.targetRpe !== null ? `RPE ${draft.targetRpe}` : ""}
                </p>
              )}
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setRestOpen((prev) => !prev);
              }}
              aria-label="Configure rest timer duration"
              aria-expanded={restOpen}
              className="tabular-nums inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Timer className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>{draft.restSeconds > 0 ? `${draft.restSeconds}s` : "Off"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setRestOpen(false);
                setMenuOpen((prev) => !prev);
              }}
              aria-label="Exercise options"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Rest preset bar */}
        {restOpen && (
          <div className="flex flex-wrap items-center gap-1.5 border-y border-zinc-100 bg-zinc-50/70 px-4 py-2 sm:px-6">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Rest:
            </span>
            {REST_PRESETS.map((secs) => {
              const active = draft.restSeconds === secs;
              return (
                <button
                  key={secs}
                  type="button"
                  onClick={() => {
                    updateExerciseRest(draft.draftId, secs);
                    setRestOpen(false);
                  }}
                  className={`tabular-nums min-h-[32px] rounded-full border px-2.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                  }`}
                >
                  {secs === 0 ? "Off" : `${secs}s`}
                </button>
              );
            })}
            {draft.restSeconds > 0 && (
              <button
                type="button"
                onClick={() => {
                  startRestTimer(draft.restSeconds, exercise?.name ?? null);
                  setRestOpen(false);
                }}
                className="ml-auto min-h-[32px] rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Start Now
              </button>
            )}
          </div>
        )}

        {/* Exercise action drawer */}
        {menuOpen && (
          <div className="flex flex-wrap items-center gap-1.5 border-y border-zinc-100 bg-zinc-50/70 px-4 py-2 sm:px-6">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestSwap(draft.draftId);
              }}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Swap</span>
            </button>

            {isInSuperset ? (
              <button
                type="button"
                onClick={() => {
                  unlinkSuperset(index);
                  setMenuOpen(false);
                }}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
              >
                <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unlink Superset</span>
              </button>
            ) : canLinkNext ? (
              <button
                type="button"
                onClick={() => {
                  linkSuperset(index);
                  setMenuOpen(false);
                }}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Superset ↓</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setNotesOpen((prev) => !prev);
                setMenuOpen(false);
              }}
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <StickyNote className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Note</span>
            </button>

            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                moveExercise(index, -1);
                setMenuOpen(false);
              }}
              aria-label="Move exercise up"
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Up</span>
            </button>

            <button
              type="button"
              disabled={index === totalExercises - 1}
              onClick={() => {
                moveExercise(index, 1);
                setMenuOpen(false);
              }}
              aria-label="Move exercise down"
              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
            >
              <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Down</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                removeExercise(draft.draftId);
              }}
              className="ml-auto inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remove</span>
            </button>
          </div>
        )}

        {/* Exercise note input */}
        {notesOpen && (
          <div className="px-4 pb-2 sm:px-6">
            <input
              id={`workout-ex-note-${draft.draftId}`}
              type="text"
              value={draft.notes}
              onChange={(e) =>
                updateExerciseNotes(draft.draftId, e.target.value)
              }
              placeholder="Cue or setup note..."
              aria-label="Exercise note"
              maxLength={400}
              className="min-h-[38px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        )}

        {/* Column headers */}
        <div className="flex items-center gap-1.5 border-b border-zinc-100 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 sm:gap-2 sm:px-6">
          <span className="w-8 shrink-0 text-center">Set</span>
          <span className="min-w-0 flex-1 pl-1.5">Previous</span>
          {hasWeightCol && (
            <span className="w-[66px] shrink-0 text-center sm:w-20">
              {trackingType === "weighted_bodyweight"
                ? `+${weightUnit}`
                : weightUnit}
            </span>
          )}
          <span
            className={`shrink-0 text-center ${
              trackingType === "duration"
                ? "w-[72px] sm:w-20"
                : "w-[58px] sm:w-16"
            }`}
          >
            {trackingType === "duration" ? "Secs" : "Reps"}
          </span>
          {showRpe && <span className="w-11 shrink-0 text-center">RPE</span>}
          <span className="w-10 shrink-0 text-center">✓</span>
        </div>

        {/* Set rows */}
        <div className="divide-y divide-zinc-100">
          {draft.sets.map((s, setIdx) => {
            const prevSet = previousRecord?.sets[setIdx];
            const fallback = {
              weight: prevSet?.weight ?? null,
              reps: prevSet?.reps ?? null,
              durationSeconds: prevSet?.duration_seconds ?? null,
            };

            return (
              <SetRow
                key={s.id}
                set={s}
                setNumber={setIdx + 1}
                canDelete={draft.sets.length > 1}
                trackingType={trackingType}
                weightUnit={weightUnit}
                showRpe={showRpe}
                targetRepsMin={draft.targetRepsMin}
                prevSet={prevSet}
                onUpdate={(patch) => updateSet(draft.draftId, s.id, patch)}
                onApplyPrevious={() =>
                  applyPreviousToSet(draft.draftId, s.id, fallback)
                }
                onToggleComplete={() =>
                  toggleSetComplete(draft.draftId, s.id, {
                    fallback,
                    autoStartRestTimer,
                    exerciseName: exercise?.name,
                  })
                }
                onDelete={() => removeSet(draft.draftId, s.id)}
              />
            );
          })}
        </div>

        {/* Add set hairline button */}
        <div className="border-t border-zinc-100 px-4 py-2 sm:px-6">
          <button
            type="button"
            onClick={() => addSet(draft.draftId)}
            className="flex min-h-[38px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-200 text-xs font-semibold text-zinc-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50/40 hover:text-emerald-700"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add Set</span>
          </button>
        </div>
      </div>
    </section>
  );
}
