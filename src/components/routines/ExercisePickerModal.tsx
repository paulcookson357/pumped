"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Dumbbell, Search, X } from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import {
  EQUIPMENT_LABELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
} from "@/lib/exercises/labels";
import type { Exercise, MuscleGroup } from "@/lib/types/domain";

interface ExercisePickerModalProps {
  open: boolean;
  exercises: Exercise[];
  mode?: "multi" | "single";
  excludeExerciseIds?: string[];
  title?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

export function ExercisePickerModal({
  open,
  exercises,
  mode = "multi",
  excludeExerciseIds,
  title = "Select Exercises",
  confirmLabel,
  onClose,
  onConfirm,
}: ExercisePickerModalProps) {
  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "all">(
    "all"
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedMuscle("all");
    setSelectedIds([]);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const excludeSet = useMemo(
    () => new Set(excludeExerciseIds ?? []),
    [excludeExerciseIds]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (excludeSet.has(ex.id)) return false;
      if (selectedMuscle !== "all" && ex.muscle_group !== selectedMuscle) {
        return false;
      }
      if (q.length > 0 && !ex.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [exercises, excludeSet, query, selectedMuscle]);

  if (!open) {
    return null;
  }

  function handleSelectRow(id: string) {
    if (mode === "single") {
      onConfirm([id]);
      return;
    }

    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleConfirmClick() {
    if (selectedIds.length === 0) return;
    onConfirm(selectedIds);
  }

  const buttonText =
    confirmLabel ??
    (selectedIds.length > 0 ? `Add (${selectedIds.length})` : "Add");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[60] flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close exercise picker"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="truncate text-base font-bold tracking-tight text-zinc-950">
              {title}
            </h2>
          </div>

          {mode === "multi" && (
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={handleConfirmClick}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {buttonText}
            </button>
          )}
        </div>

        {/* Search + muscle filter */}
        <div className="space-y-2.5 border-t border-zinc-100 px-4 py-3 sm:px-6">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            />
            <input
              id="picker-exercise-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises..."
              aria-label="Search exercises"
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 pr-10 pl-10 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
            <button
              type="button"
              onClick={() => setSelectedMuscle("all")}
              className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                selectedMuscle === "all"
                  ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              All Muscles
            </button>
            {MUSCLE_GROUPS.map((muscle) => (
              <button
                key={muscle}
                type="button"
                onClick={() =>
                  setSelectedMuscle((prev) =>
                    prev === muscle ? "all" : muscle
                  )
                }
                className={`min-h-[36px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
                  selectedMuscle === muscle
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {MUSCLE_LABELS[muscle]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="pb-safe flex-1 overflow-y-auto bg-white">
        {filtered.length > 0 ? (
          <ul className="divide-y divide-zinc-200 border-b border-zinc-200">
            {filtered.map((exercise) => {
              const isSelected = selectedSet.has(exercise.id);
              return (
                <li
                  key={exercise.id}
                  className="[content-visibility:auto] [contain-intrinsic-size:72px]"
                >
                  <button
                    type="button"
                    onClick={() => handleSelectRow(exercise.id)}
                    className={`flex min-h-[72px] w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors sm:px-6 ${
                      isSelected
                        ? "bg-emerald-50/50"
                        : "hover:bg-zinc-50 active:bg-zinc-100/70"
                    }`}
                  >
                    <ExerciseVisual
                      exercise={exercise}
                      size="thumb"
                      animateFallback={false}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-zinc-950">
                          {exercise.name}
                        </span>
                        {exercise.is_custom && (
                          <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Custom
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {MUSCLE_LABELS[exercise.muscle_group]} •{" "}
                        {EQUIPMENT_LABELS[exercise.equipment]}
                      </p>
                    </div>

                    {mode === "multi" ? (
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-600 text-white"
                            : "border-zinc-300 bg-white"
                        }`}
                      >
                        {isSelected && (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </span>
                    ) : (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-zinc-400"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-4 py-12 text-center sm:px-6">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-950">
              No exercises found
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Try a different search term or clear your muscle filter.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
