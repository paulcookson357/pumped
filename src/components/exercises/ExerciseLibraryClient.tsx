"use client";

import { useEffect, useMemo, useState } from "react";
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
import { writeDomainSnapshot } from "@/lib/offline/db";
import type { EquipmentType, Exercise, MuscleGroup } from "@/lib/types/domain";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface ExerciseLibraryClientProps {
  initialExercises: Exercise[];
}

export function ExerciseLibraryClient({
  initialExercises,
}: ExerciseLibraryClientProps) {
  const { hydrated, touchedDomains, exercises: storeExercises } =
    useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);

  const shouldReconcileServerExercises =
    hydrated &&
    !touchedDomains.exercises &&
    storeExercises.length === 0 &&
    initialExercises.length > 0 &&
    pendingCount === 0;

  useEffect(() => {
    if (shouldReconcileServerExercises) {
      useAppDataStore.getState().setExercises(initialExercises);
      void writeDomainSnapshot({ exercises: initialExercises });
    }
  }, [shouldReconcileServerExercises, initialExercises]);

  const exercises =
    !hydrated || shouldReconcileServerExercises
      ? initialExercises
      : storeExercises;

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
    <div>
      <div className="flex items-center justify-between gap-3 pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            Exercise Library
          </h1>
          <p className="tabular-nums text-xs text-zinc-500">
            Showing {filteredExercises.length} of {exercises.length} exercises
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateDrawer}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Custom</span>
        </button>
      </div>

      {/* Search bar */}
      <div className="relative pb-3">
        <Search
          className="pointer-events-none absolute top-[22px] left-3.5 h-4 w-4 -translate-y-1/2 text-zinc-400"
          aria-hidden="true"
        />
        <input
          id="library-exercise-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          aria-label="Search exercises"
          className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50/70 pr-11 pl-10 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
        />
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute top-[22px] right-1 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Filter strips */}
      <div className="-mx-4 space-y-2 border-b border-zinc-200 px-4 pb-3.5 sm:-mx-6 sm:px-6">
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
                setSelectedMuscle((prev) => (prev === muscle ? "all" : muscle))
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

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6">
          <button
            type="button"
            onClick={() => setCustomOnly((prev) => !prev)}
            className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
              customOnly
                ? "border-blue-600 bg-blue-50 text-blue-700"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            Custom Only
          </button>
          <button
            type="button"
            onClick={() => setSelectedEquipment("all")}
            className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
              selectedEquipment === "all"
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
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
              className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-medium transition-colors ${
                selectedEquipment === eq
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {EQUIPMENT_LABELS[eq]}
            </button>
          ))}
        </div>
      </div>

      {/* Borderless full-bleed exercise rows */}
      {filteredExercises.length > 0 ? (
        <ul className="-mx-4 divide-y divide-zinc-200 sm:-mx-6">
          {filteredExercises.map((exercise) => (
            <li
              key={exercise.id}
              className="[content-visibility:auto] [contain-intrinsic-size:72px]"
            >
              <button
                type="button"
                onClick={() => setDetailExercise(exercise)}
                className="flex min-h-[72px] w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors hover:bg-zinc-50 active:bg-zinc-100/80 sm:px-6"
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
                <ChevronRight
                  className="h-4 w-4 shrink-0 text-zinc-400"
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="-mx-4 border-b border-zinc-200 px-4 py-10 text-center sm:-mx-6 sm:px-6">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <Dumbbell className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="mt-3 text-sm font-semibold text-zinc-950">
            {exercises.length === 0
              ? "No exercises in database yet"
              : "No matching exercises"}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">
            {exercises.length === 0
              ? "Verify your Supabase connection in Settings or create a custom exercise."
              : "Try adjusting your search or filter chips."}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
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
