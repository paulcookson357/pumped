"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import { getSupersetColor } from "@/lib/routines/colors";
import type { Exercise, SetType, WeightUnit } from "@/lib/types/domain";
import { getDistanceUnit, getSpeedUnit } from "@/lib/workouts/cardio";

export interface EditableSetDraft {
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
  restSeconds: number | null;
  notes: string | null;
  completedAt: string | null;
}

export interface EditableExerciseDraft {
  draftId: string;
  exerciseId: string;
  supersetGroup: number | null;
  notes: string | null;
  sets: EditableSetDraft[];
}

interface EditWorkoutExerciseSectionProps {
  draft: EditableExerciseDraft;
  supersetLabel: string | null;
  exercise: Exercise | undefined;
  weightUnit: WeightUnit;
  onAddSet: () => void;
  onUpdateSet: (setId: string, patch: Partial<EditableSetDraft>) => void;
  onRemoveSet: (setId: string) => void;
  onRemoveExercise: () => void;
}

const SET_TYPE_CYCLE: SetType[] = ["normal", "warmup", "dropset", "failure"];
const SET_TYPE_STYLE: Record<SetType, { short: string; cls: string }> = {
  normal: { short: "", cls: "border-zinc-200 bg-zinc-50 text-zinc-700" },
  warmup: { short: "W", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  dropset: { short: "D", cls: "border-violet-200 bg-violet-50 text-violet-700" },
  failure: { short: "F", cls: "border-rose-200 bg-rose-50 text-rose-700" },
};
const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export function EditWorkoutExerciseSection({
  draft,
  supersetLabel,
  exercise,
  weightUnit,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
  onRemoveExercise,
}: EditWorkoutExerciseSectionProps) {
  const [rpeOpenSetId, setRpeOpenSetId] = useState<string | null>(null);

  const trackingType = exercise?.tracking_type ?? "weight_reps";
  const isCardio = trackingType === "cardio";
  const hasWeightCol =
    trackingType === "weight_reps" || trackingType === "weighted_bodyweight";
  const isDuration = trackingType === "duration";
  const distanceUnit = getDistanceUnit(weightUnit);
  const speedUnit = getSpeedUnit(weightUnit);
  const accentColor = getSupersetColor(draft.supersetGroup);

  function cycleSetType(current: SetType): SetType {
    const idx = SET_TYPE_CYCLE.indexOf(current);
    return SET_TYPE_CYCLE[(idx + 1) % SET_TYPE_CYCLE.length] ?? "normal";
  }

  return (
    <section className="flex bg-white">
      {accentColor && (
        <span
          aria-hidden="true"
          className="w-1.5 shrink-0"
          style={{ backgroundColor: accentColor }}
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {exercise && (
              <ExerciseVisual
                exercise={exercise}
                size="thumb"
                animateFallback={false}
              />
            )}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                {supersetLabel && (
                  <span className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-violet-700">
                    {supersetLabel}
                  </span>
                )}
                <h3 className="truncate text-base font-bold text-zinc-950">
                  {exercise?.name ?? "Exercise"}
                </h3>
              </div>
              <p className="text-xs text-zinc-500">
                Tap badge to cycle type (N / W / D / F)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onRemoveExercise}
            aria-label={`Remove ${exercise?.name ?? "exercise"}`}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Column labels */}
        <div className="flex items-center gap-1.5 border-t border-zinc-100 bg-zinc-50/70 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 sm:gap-2 sm:px-6">
          <span className="w-9 text-center">{isCardio ? "Int" : "Set"}</span>
          {hasWeightCol && (
            <span className="flex-1 text-center">{weightUnit}</span>
          )}
          <span className="flex-1 text-center">
            {isCardio ? "Time (mm:ss)" : isDuration ? "Secs" : "Reps"}
          </span>
          <span className="w-12 text-center">RPE</span>
          <span className="w-10" aria-hidden="true" />
        </div>

        <div className="divide-y divide-zinc-100">
          {draft.sets.map((ws, idx) => {
            const setNum = idx + 1;
            const badge = SET_TYPE_STYLE[ws.setType];
            const badgeLabel =
              ws.setType === "normal" ? String(setNum) : badge.short;
            const rpeOpen = rpeOpenSetId === ws.id;

            return (
              <div key={ws.id}>
                <div className="flex items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-6">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSet(ws.id, { setType: cycleSetType(ws.setType) })
                    }
                    aria-label={`Set ${setNum} type (${ws.setType})`}
                    className={`tabular-nums flex h-10 w-9 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${badge.cls}`}
                  >
                    {badgeLabel}
                  </button>

                  {hasWeightCol && (
                    <input
                      id={`edit-set-${ws.id}-weight`}
                      type="text"
                      inputMode="decimal"
                      value={ws.weight}
                      onChange={(e) =>
                        onUpdateSet(ws.id, { weight: e.target.value })
                      }
                      aria-label={`Set ${setNum} weight in ${weightUnit}`}
                      placeholder="0"
                      className="tabular-nums min-h-[44px] min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  )}

                  {isCardio ? (
                    <input
                      id={`edit-set-${ws.id}-duration`}
                      type="text"
                      value={ws.durationSeconds}
                      onChange={(e) =>
                        onUpdateSet(ws.id, { durationSeconds: e.target.value })
                      }
                      aria-label={`Interval ${setNum} time (mm:ss or minutes)`}
                      placeholder="20:00"
                      className="tabular-nums min-h-[44px] min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  ) : isDuration ? (
                    <input
                      id={`edit-set-${ws.id}-duration`}
                      type="text"
                      inputMode="numeric"
                      value={ws.durationSeconds}
                      onChange={(e) =>
                        onUpdateSet(ws.id, { durationSeconds: e.target.value })
                      }
                      aria-label={`Set ${setNum} duration in seconds`}
                      placeholder="30"
                      className="tabular-nums min-h-[44px] min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  ) : (
                    <input
                      id={`edit-set-${ws.id}-reps`}
                      type="text"
                      inputMode="numeric"
                      value={ws.reps}
                      onChange={(e) =>
                        onUpdateSet(ws.id, { reps: e.target.value })
                      }
                      aria-label={`Set ${setNum} reps`}
                      placeholder="0"
                      className="tabular-nums min-h-[44px] min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setRpeOpenSetId((prev) => (prev === ws.id ? null : ws.id))
                    }
                    aria-label={`Set ${setNum} RPE`}
                    aria-expanded={rpeOpen}
                    className={`tabular-nums flex h-11 w-12 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold ${
                      ws.rpe !== null
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                        : "border-zinc-200 bg-white text-zinc-400"
                    }`}
                  >
                    {ws.rpe !== null ? ws.rpe : "—"}
                  </button>

                  <button
                    type="button"
                    disabled={draft.sets.length <= 1}
                    onClick={() => onRemoveSet(ws.id)}
                    aria-label={`Delete set ${setNum}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {isCardio && (
                  <div className="grid grid-cols-2 gap-2 px-4 pt-0.5 pb-3 sm:grid-cols-4 sm:px-6">
                    <div>
                      <label
                        htmlFor={`edit-set-${ws.id}-distance`}
                        className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                      >
                        Dist ({distanceUnit})
                      </label>
                      <input
                        id={`edit-set-${ws.id}-distance`}
                        type="text"
                        inputMode="decimal"
                        value={ws.distance}
                        onChange={(e) =>
                          onUpdateSet(ws.id, { distance: e.target.value })
                        }
                        aria-label={`Interval ${setNum} distance in ${distanceUnit}`}
                        placeholder="0.0"
                        className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-set-${ws.id}-speed`}
                        className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                      >
                        Speed ({speedUnit})
                      </label>
                      <input
                        id={`edit-set-${ws.id}-speed`}
                        type="text"
                        inputMode="decimal"
                        value={ws.speed}
                        onChange={(e) =>
                          onUpdateSet(ws.id, { speed: e.target.value })
                        }
                        aria-label={`Interval ${setNum} speed in ${speedUnit}`}
                        placeholder="0.0"
                        className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-set-${ws.id}-resistance`}
                        className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                      >
                        Resist (Lvl)
                      </label>
                      <input
                        id={`edit-set-${ws.id}-resistance`}
                        type="text"
                        inputMode="decimal"
                        value={ws.resistance}
                        onChange={(e) =>
                          onUpdateSet(ws.id, { resistance: e.target.value })
                        }
                        aria-label={`Interval ${setNum} resistance level`}
                        placeholder="—"
                        className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`edit-set-${ws.id}-incline`}
                        className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
                      >
                        Incline (%)
                      </label>
                      <input
                        id={`edit-set-${ws.id}-incline`}
                        type="text"
                        inputMode="decimal"
                        value={ws.incline}
                        onChange={(e) =>
                          onUpdateSet(ws.id, { incline: e.target.value })
                        }
                        aria-label={`Interval ${setNum} incline percentage`}
                        placeholder="—"
                        className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-2 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                {rpeOpen && (
                  <div className="flex flex-wrap items-center gap-1 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2 sm:px-6">
                    {RPE_OPTIONS.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          onUpdateSet(ws.id, { rpe: val });
                          setRpeOpenSetId(null);
                        }}
                        className={`tabular-nums min-h-[34px] rounded-md border px-2 text-xs font-semibold ${
                          ws.rpe === val
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-200 bg-white text-zinc-700"
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                    {ws.rpe !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateSet(ws.id, { rpe: null });
                          setRpeOpenSetId(null);
                        }}
                        className="ml-auto min-h-[34px] rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="border-t border-zinc-100 px-4 py-2.5 sm:px-6">
          <button
            type="button"
            onClick={onAddSet}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{isCardio ? "Add Interval" : "Add Set"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
