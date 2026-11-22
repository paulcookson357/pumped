"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Link2,
  Trash2,
  Unlink,
} from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/exercises/labels";
import type { Exercise } from "@/lib/types/domain";

export interface DraftRoutineExercise {
  id: string;
  exercise_id: string;
  superset_group: number | null;
  setsInput: string;
  repsMinInput: string;
  repsMaxInput: string;
  targetRpe: number | null;
  restInput: string;
  notes: string;
}

const RPE_OPTIONS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5];
const REST_PRESETS = [60, 90, 120, 180];

interface SortableRoutineExerciseRowProps {
  item: DraftRoutineExercise;
  exercise: Exercise | undefined;
  index: number;
  totalCount: number;
  supersetLabel: string | null;
  sameSupersetAsNext: boolean;
  onChange: (id: string, patch: Partial<DraftRoutineExercise>) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (id: string) => void;
  onLinkNext: (index: number) => void;
  onUnlink: (index: number) => void;
}

export function SortableRoutineExerciseRow({
  item,
  exercise,
  index,
  totalCount,
  supersetLabel,
  sameSupersetAsNext,
  onChange,
  onMoveUp,
  onMoveDown,
  onRemove,
  onLinkNext,
  onUnlink,
}: SortableRoutineExerciseRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const isFirst = index === 0;
  const isLast = index === totalCount - 1;
  const inSuperset = supersetLabel !== null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border-b border-zinc-200 px-4 py-4 sm:px-6 ${
        inSuperset ? "border-l-4 border-l-violet-500 bg-violet-50/20" : "bg-white"
      } ${isDragging ? "z-10 shadow-md ring-1 ring-zinc-300" : ""}`}
    >
      {/* Top header row: drag handle + thumb + title + move/delete */}
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Drag to reorder ${exercise?.name ?? "exercise"}`}
          className="touch-none -ml-2 flex h-11 w-10 shrink-0 cursor-grab items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 active:cursor-grabbing"
        >
          <GripVertical className="h-5 w-5" aria-hidden="true" />
        </button>

        {exercise && (
          <ExerciseVisual
            exercise={exercise}
            size="thumb"
            animateFallback={false}
          />
        )}

        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {supersetLabel && (
              <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                Superset {supersetLabel}
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-950">
              {exercise?.name ?? "Exercise removed"}
            </span>
          </div>
          {exercise && (
            <p className="mt-0.5 text-xs text-zinc-500">
              {MUSCLE_LABELS[exercise.muscle_group]} •{" "}
              {EQUIPMENT_LABELS[exercise.equipment]}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center">
          <button
            type="button"
            disabled={isFirst}
            onClick={() => onMoveUp(index)}
            aria-label="Move exercise up"
            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={isLast}
            onClick={() => onMoveDown(index)}
            aria-label="Move exercise down"
            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-30"
          >
            <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remove exercise"
            className="flex h-10 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-rose-50 hover:text-rose-600"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Superset actions */}
      {(inSuperset || !isLast) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {inSuperset && (
            <button
              type="button"
              onClick={() => onUnlink(index)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 text-xs font-medium text-violet-700 hover:bg-violet-50"
            >
              <Unlink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Unlink Superset</span>
            </button>
          )}
          {!isLast && !sameSupersetAsNext && (
            <button
              type="button"
              onClick={() => onLinkNext(index)}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Superset w/ Next</span>
            </button>
          )}
        </div>
      )}

      {/* Prescription controls */}
      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
        <div>
          <label
            htmlFor={`sets-${item.id}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Sets
          </label>
          <input
            id={`sets-${item.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={item.setsInput}
            onChange={(e) => onChange(item.id, { setsInput: e.target.value })}
            className="tabular-nums mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`rpe-${item.id}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Target RPE
          </label>
          <select
            id={`rpe-${item.id}`}
            value={item.targetRpe === null ? "" : String(item.targetRpe)}
            onChange={(e) =>
              onChange(item.id, {
                targetRpe: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            className="tabular-nums mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
          >
            <option value="">None</option>
            {RPE_OPTIONS.map((rpe) => (
              <option key={rpe} value={String(rpe)}>
                RPE {rpe.toFixed(1)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor={`min-reps-${item.id}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Min Reps
          </label>
          <input
            id={`min-reps-${item.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            placeholder="8"
            value={item.repsMinInput}
            onChange={(e) =>
              onChange(item.id, { repsMinInput: e.target.value })
            }
            className="tabular-nums mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label
            htmlFor={`max-reps-${item.id}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Max Reps
          </label>
          <input
            id={`max-reps-${item.id}`}
            type="number"
            inputMode="numeric"
            min={1}
            max={500}
            placeholder="12"
            value={item.repsMaxInput}
            onChange={(e) =>
              onChange(item.id, { repsMaxInput: e.target.value })
            }
            className="tabular-nums mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label
            htmlFor={`rest-${item.id}`}
            className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            Rest (sec)
          </label>
          <input
            id={`rest-${item.id}`}
            type="number"
            inputMode="numeric"
            min={0}
            max={900}
            step={15}
            value={item.restInput}
            onChange={(e) => onChange(item.id, { restInput: e.target.value })}
            className="tabular-nums mt-1 min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Quick rest pills + cue note */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-medium text-zinc-400">
          Rest presets:
        </span>
        {REST_PRESETS.map((sec) => {
          const active = item.restInput.trim() === String(sec);
          return (
            <button
              key={sec}
              type="button"
              onClick={() => onChange(item.id, { restInput: String(sec) })}
              className={`tabular-nums min-h-[32px] rounded-full border px-2.5 text-xs font-medium transition-colors ${
                active
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {sec}s
            </button>
          );
        })}
      </div>

      <div className="mt-2.5">
        <input
          id={`notes-${item.id}`}
          type="text"
          maxLength={400}
          value={item.notes}
          onChange={(e) => onChange(item.id, { notes: e.target.value })}
          placeholder="Form cue or setup note (optional)"
          aria-label="Exercise setup note"
          className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 px-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}
