"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import type { SetType, TrackingType, WeightUnit } from "@/lib/types/domain";
import {
  formatCardioDecimal,
  formatCardioDurationInput,
  getDistanceUnit,
  getSpeedUnit,
} from "@/lib/workouts/cardio";
import {
  formatNumberCompact,
  formatPreviousSetLabel,
} from "@/lib/workouts/stats";
import type { ActiveSetDraft } from "@/stores/useActiveWorkoutStore";

interface PreviousSetSnapshot {
  set_number: number;
  set_type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance?: number | null;
  speed?: number | null;
  resistance?: number | null;
  incline?: number | null;
}

interface SetRowProps {
  set: ActiveSetDraft;
  setNumber: number;
  canDelete: boolean;
  trackingType: TrackingType;
  weightUnit: WeightUnit;
  showRpe: boolean;
  targetRepsMin: number | null;
  prevSet?: PreviousSetSnapshot;
  onUpdate: (
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
  onApplyPrevious: () => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

const SET_TYPE_META: Record<
  SetType,
  { short: string; label: string; badgeClass: string }
> = {
  normal: {
    short: "N",
    label: "Normal",
    badgeClass: "border-zinc-200 bg-zinc-50 text-zinc-700",
  },
  warmup: {
    short: "W",
    label: "Warmup",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  },
  dropset: {
    short: "D",
    label: "Dropset",
    badgeClass: "border-violet-200 bg-violet-50 text-violet-700",
  },
  failure: {
    short: "F",
    label: "Failure",
    badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const RPE_OPTIONS = [5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10] as const;

export function SetRow({
  set,
  setNumber,
  canDelete,
  trackingType,
  weightUnit,
  showRpe,
  targetRepsMin,
  prevSet,
  onUpdate,
  onApplyPrevious,
  onToggleComplete,
  onDelete,
}: SetRowProps) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [rpeMenuOpen, setRpeMenuOpen] = useState(false);

  const prevLabel = formatPreviousSetLabel(prevSet, trackingType, weightUnit);
  const isCardio = trackingType === "cardio";
  const hasWeightCol =
    trackingType === "weight_reps" || trackingType === "weighted_bodyweight";
  const isDuration = trackingType === "duration";
  const distanceUnit = getDistanceUnit(weightUnit);
  const speedUnit = getSpeedUnit(weightUnit);

  const weightPlaceholder =
    prevSet && prevSet.weight !== null
      ? formatNumberCompact(prevSet.weight)
      : trackingType === "weighted_bodyweight"
        ? "+0"
        : "0";

  const repsPlaceholder =
    prevSet && prevSet.reps !== null
      ? String(prevSet.reps)
      : targetRepsMin !== null
        ? String(targetRepsMin)
        : "0";

  const durationPlaceholder =
    prevSet && prevSet.duration_seconds !== null
      ? String(prevSet.duration_seconds)
      : "30";

  const cardioTimePlaceholder =
    prevSet && prevSet.duration_seconds !== null && prevSet.duration_seconds > 0
      ? formatCardioDurationInput(prevSet.duration_seconds)
      : "20:00";

  const typeMeta = SET_TYPE_META[set.setType];
  const badgeText = set.setType === "normal" ? String(setNumber) : typeMeta.short;

  return (
    <div
      className={`transition-colors ${
        set.isCompleted ? "bg-emerald-50/60" : "bg-white"
      }`}
    >
      <div className="flex items-center gap-1.5 px-4 py-2 sm:gap-2 sm:px-6">
        {/* Set type badge / menu trigger */}
        <button
          type="button"
          onClick={() => {
            setRpeMenuOpen(false);
            setTypeMenuOpen((prev) => !prev);
          }}
          aria-label={`Set ${setNumber} type (${typeMeta.label})`}
          aria-expanded={typeMenuOpen}
          className={`tabular-nums flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold transition-colors ${typeMeta.badgeClass}`}
        >
          {badgeText}
        </button>

        {/* Tappable Previous column */}
        <button
          type="button"
          disabled={!prevSet}
          onClick={onApplyPrevious}
          title={prevSet ? `Copy previous: ${prevLabel}` : undefined}
          className="tabular-nums min-h-[38px] min-w-0 flex-1 truncate rounded-md px-1.5 text-left text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none"
        >
          {prevLabel}
        </button>

        {/* Weight input (weight_reps & weighted_bodyweight) */}
        {hasWeightCol && (
          <input
            id={`set-${set.id}-weight`}
            type="text"
            inputMode="decimal"
            value={set.weight}
            onChange={(e) => onUpdate({ weight: e.target.value })}
            placeholder={weightPlaceholder}
            aria-label={`Set ${setNumber} weight in ${weightUnit}`}
            className="tabular-nums min-h-[40px] w-[66px] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none sm:w-20"
          />
        )}

        {/* Time / Reps / Duration input */}
        {isCardio ? (
          <input
            id={`set-${set.id}-duration`}
            type="text"
            value={set.durationSeconds}
            onChange={(e) => onUpdate({ durationSeconds: e.target.value })}
            placeholder={cardioTimePlaceholder}
            aria-label={`Interval ${setNumber} time (mm:ss or minutes)`}
            className="tabular-nums min-h-[40px] w-[78px] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none sm:w-24"
          />
        ) : isDuration ? (
          <input
            id={`set-${set.id}-duration`}
            type="text"
            inputMode="numeric"
            value={set.durationSeconds}
            onChange={(e) => onUpdate({ durationSeconds: e.target.value })}
            placeholder={durationPlaceholder}
            aria-label={`Set ${setNumber} duration in seconds`}
            className="tabular-nums min-h-[40px] w-[72px] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none sm:w-20"
          />
        ) : (
          <input
            id={`set-${set.id}-reps`}
            type="text"
            inputMode="numeric"
            value={set.reps}
            onChange={(e) => onUpdate({ reps: e.target.value })}
            placeholder={repsPlaceholder}
            aria-label={`Set ${setNumber} reps`}
            className="tabular-nums min-h-[40px] w-[58px] shrink-0 rounded-lg border border-zinc-200 bg-white px-2 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none sm:w-16"
          />
        )}

        {/* Optional RPE button */}
        {showRpe && (
          <button
            type="button"
            onClick={() => {
              setTypeMenuOpen(false);
              setRpeMenuOpen((prev) => !prev);
            }}
            aria-label={`Set ${setNumber} RPE`}
            aria-expanded={rpeMenuOpen}
            className={`tabular-nums flex h-10 w-11 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold transition-colors ${
              set.rpe !== null
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-white text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {set.rpe !== null ? set.rpe : "—"}
          </button>
        )}

        {/* Set Completion Checkmark */}
        <button
          type="button"
          onClick={onToggleComplete}
          aria-label={
            set.isCompleted
              ? `Mark ${isCardio ? "interval" : "set"} ${setNumber} incomplete`
              : `Complete ${isCardio ? "interval" : "set"} ${setNumber}`
          }
          aria-pressed={set.isCompleted}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${
            set.isCompleted
              ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500"
              : "border-zinc-200 bg-zinc-50 text-zinc-400 hover:border-emerald-300 hover:text-emerald-600"
          }`}
        >
          <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
        </button>
      </div>

      {/* Cardio metrics grid (distance, speed, resistance, incline) */}
      {isCardio && (
        <div className="grid grid-cols-2 gap-2 px-4 pt-0.5 pb-2.5 sm:grid-cols-4 sm:px-6">
          <div>
            <label
              htmlFor={`set-${set.id}-distance`}
              className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Dist ({distanceUnit})
            </label>
            <input
              id={`set-${set.id}-distance`}
              type="text"
              inputMode="decimal"
              value={set.distance}
              onChange={(e) => onUpdate({ distance: e.target.value })}
              placeholder={
                prevSet?.distance !== null && prevSet?.distance !== undefined
                  ? formatCardioDecimal(prevSet.distance)
                  : "0.0"
              }
              aria-label={`Interval ${setNumber} distance in ${distanceUnit}`}
              className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`set-${set.id}-speed`}
              className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Speed ({speedUnit})
            </label>
            <input
              id={`set-${set.id}-speed`}
              type="text"
              inputMode="decimal"
              value={set.speed}
              onChange={(e) => onUpdate({ speed: e.target.value })}
              placeholder={
                prevSet?.speed !== null && prevSet?.speed !== undefined
                  ? formatCardioDecimal(prevSet.speed)
                  : "0.0"
              }
              aria-label={`Interval ${setNumber} speed in ${speedUnit}`}
              className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`set-${set.id}-resistance`}
              className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Resist (Lvl)
            </label>
            <input
              id={`set-${set.id}-resistance`}
              type="text"
              inputMode="decimal"
              value={set.resistance}
              onChange={(e) => onUpdate({ resistance: e.target.value })}
              placeholder={
                prevSet?.resistance !== null &&
                prevSet?.resistance !== undefined
                  ? formatCardioDecimal(prevSet.resistance)
                  : "—"
              }
              aria-label={`Interval ${setNumber} resistance level`}
              className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor={`set-${set.id}-incline`}
              className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Incline (%)
            </label>
            <input
              id={`set-${set.id}-incline`}
              type="text"
              inputMode="decimal"
              value={set.incline}
              onChange={(e) => onUpdate({ incline: e.target.value })}
              placeholder={
                prevSet?.incline !== null && prevSet?.incline !== undefined
                  ? formatCardioDecimal(prevSet.incline)
                  : "—"
              }
              aria-label={`Interval ${setNumber} incline percentage`}
              className="tabular-nums mt-0.5 min-h-[40px] w-full rounded-lg border border-zinc-200 bg-white px-2.5 text-center text-base font-semibold text-zinc-950 placeholder:text-zinc-300 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Inline Set Type + Delete Selector */}
      {typeMenuOpen && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2 sm:px-6">
          {(["normal", "warmup", "dropset", "failure"] as const).map((t) => {
            const meta = SET_TYPE_META[t];
            const active = set.setType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  onUpdate({ setType: t });
                  setTypeMenuOpen(false);
                }}
                className={`min-h-[34px] rounded-full border px-2.5 text-xs font-medium transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {meta.short} • {meta.label}
              </button>
            );
          })}

          {canDelete && (
            <button
              type="button"
              onClick={() => {
                setTypeMenuOpen(false);
                onDelete();
              }}
              className="ml-auto inline-flex min-h-[34px] items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}

      {/* Inline RPE Picker Row */}
      {rpeMenuOpen && showRpe && (
        <div className="flex flex-wrap items-center gap-1 border-t border-zinc-100 bg-zinc-50/70 px-4 py-2 sm:px-6">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            RPE:
          </span>
          {RPE_OPTIONS.map((val) => {
            const active = set.rpe === val;
            return (
              <button
                key={val}
                type="button"
                onClick={() => {
                  onUpdate({ rpe: val });
                  setRpeMenuOpen(false);
                }}
                className={`tabular-nums min-h-[32px] rounded-md border px-2 text-xs font-semibold transition-colors ${
                  active
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {val}
              </button>
            );
          })}
          {set.rpe !== null && (
            <button
              type="button"
              onClick={() => {
                onUpdate({ rpe: null });
                setRpeMenuOpen(false);
              }}
              className="ml-auto min-h-[32px] rounded-md border border-zinc-200 bg-white px-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
