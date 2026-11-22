"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Dumbbell, Plus, Search, X } from "lucide-react";
import { CustomExerciseDrawer } from "@/components/exercises/CustomExerciseDrawer";
import { ExerciseDetailDrawer } from "@/components/exercises/ExerciseDetailDrawer";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
} from "@/lib/exercises/labels";
import type { EquipmentType, Exercise, MuscleGroup } from "@/lib/types/domain";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface ExerciseLibraryClientProps {
  initialExercises: Exercise[];
}

export function ExerciseLibraryClient({
  initialExercises,
}: ExerciseLibraryClientProps) {
  const { hydrated, exercises: storeExercises } = useAppDataStore();
  const exercises = hydrated ? storeExercises : initialExercises;

  const [query, setQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | "all">("all");
  const [selectedEquipment, setSelectedEquipment] = useState<
    EquipmentType | "all"
  >("all");
  const [customOnly, setCustomOnly] = useState(false);

  const [detailExercise, setDetailExercise] = useState<Exercise | null>(null);
  const [customDrawerOpen, setCustomDrawerOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const filteredExercises = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (selectedMuscle !== "all" && ex.muscle_group !== selectedMuscle) {
        return false;
      }
      if (selectedEquipment !== "all" && ex.equipment !== selectedEquipment) {
        return false;
      }
      if (customOnly && !ex.is_custom) {
        return false;
      }
      if (q.length > 0 && !ex.name.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [exercises, query, selectedMuscle, selectedEquipment, customOnly]);

  function openCreateDrawer() {
    setEditingExercise(null);
    setCustomDrawerOpen(true);
  }

  function openEditDrawer(ex: Exercise) {
    setDetailExercise(null);
    setEditingExercise(ex);
    setCustomDrawerOpen(true);
  }

  const hasActiveFilters =
    query.trim().length > 0 ||
    selectedMuscle !== "all" ||
    selectedEquipment !== "all" ||
    customOnly;

  function resetFilters() {
    setQuery("");
    setSelectedMuscle("all");
    setSelectedEquipment("all");
    setCustomOnly(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-100">
            Exercise Library
          </h1>
          <p className="tabular-nums text-xs text-zinc-400">
            Showing {filteredExercises.length} of {exercises.length} exercises
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDrawer}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Custom</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-500"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          aria-label="Search exercises"
          className="min-h-[44px] w-full rounded-xl border border-zinc-800 bg-[#111114] pr-11 pl-10 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-200"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Muscle group chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setSelectedMuscle("all")}
          className={`min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
            selectedMuscle === "all"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700"
          }`}
        >
          All Muscles
        </button>
        {MUSCLE_GROUPS.map((muscle) => (
          <button
            key={muscle}
            type="button"
            onClick={() =>
              setSelectedMuscle((prev) => (prev === muscle ? "all" : muscle))
            }
            className={`min-h-[38px] shrink-0 rounded-full border px-3.5 text-xs font-medium transition-colors ${
              selectedMuscle === muscle
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700"
            }`}
          >
            {MUSCLE_LABELS[muscle]}
          </button>
        ))}
      </div>

      {/* Equipment + Custom chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setCustomOnly((prev) => !prev)}
          className={`min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
            customOnly
              ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
              : "border-zinc-800 bg-[#111114] text-zinc-400 hover:border-zinc-700"
          }`}
        >
          Custom Only
        </button>
        <button
          type="button"
          onClick={() => setSelectedEquipment("all")}
          className={`min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
            selectedEquipment === "all"
              ? "border-zinc-600 bg-zinc-800 text-zinc-100"
              : "border-zinc-800 bg-[#111114] text-zinc-400 hover:border-zinc-700"
          }`}
        >
          All Equipment
        </button>
        {EQUIPMENT_TYPES.map((eq) => (
          <button
            key={eq}
            type="button"
            onClick={() =>
              setSelectedEquipment((prev) => (prev === eq ? "all" : eq))
            }
            className={`min-h-[36px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
              selectedEquipment === eq
                ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                : "border-zinc-800 bg-[#111114] text-zinc-400 hover:border-zinc-700"
            }`}
          >
            {EQUIPMENT_LABELS[eq]}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      {filteredExercises.length > 0 ? (
        <ul className="divide-y divide-zinc-800/80 overflow-hidden rounded-2xl border border-zinc-800 bg-[#111114]">
          {filteredExercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => setDetailExercise(exercise)}
                className="flex min-h-[72px] w-full items-center gap-3.5 px-3.5 py-2.5 text-left transition-colors hover:bg-zinc-900/70 active:bg-zinc-900"
              >
                <ExerciseVisual
                  exercise={exercise}
                  size="thumb"
                  animateFallback={false}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-zinc-100">
                      {exercise.name}
                    </span>
                    {exercise.is_custom && (
                      <span className="shrink-0 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                        Custom
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {MUSCLE_LABELS[exercise.muscle_group]} •{" "}
                    {EQUIPMENT_LABELS[exercise.equipment]}
                  </p>
                </div>
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-zinc-500"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-zinc-800 bg-[#111114] p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-zinc-100">
            {exercises.length === 0
              ? "No exercises in database yet"
              : "No matching exercises"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            {exercises.length === 0
              ? "Verify your Supabase connection in Settings or create a custom exercise."
              : "Try adjusting your search or filter chips."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      <ExerciseDetailDrawer
        exercise={detailExercise}
        onClose={() => setDetailExercise(null)}
        onEdit={openEditDrawer}
      />

      <CustomExerciseDrawer
        open={customDrawerOpen}
        editingExercise={editingExercise}
        onClose={() => setCustomDrawerOpen(false)}
      />
    </div>
  );
}
