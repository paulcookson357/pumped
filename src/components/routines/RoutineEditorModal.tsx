"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Archive, Dumbbell, Plus, X } from "lucide-react";
import { ExercisePickerModal } from "@/components/routines/ExercisePickerModal";
import {
  SortableRoutineExerciseRow,
  type DraftRoutineExercise,
} from "@/components/routines/SortableRoutineExerciseRow";
import {
  archiveLocalRoutine,
  putLocalRoutineBundle,
} from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import { ROUTINE_COLORS } from "@/lib/routines/colors";
import {
  getSupersetPositions,
  linkAdjacentSuperset,
  normalizeSupersetGroups,
  unlinkSupersetItem,
} from "@/lib/routines/supersets";
import type {
  Exercise,
  Routine,
  RoutineExercise,
} from "@/lib/types/domain";
import { upsertRoutinePayloadSchema } from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface RoutineEditorModalProps {
  open: boolean;
  editingRoutine: Routine | null;
  initialRoutineExercises: RoutineExercise[];
  templateSeed?: {
    name: string;
    notes: string | null;
    exercises: RoutineExercise[];
  } | null;
  exercises: Exercise[];
  nextSortOrder: number;
  defaultRestSeconds: number;
  onClose: () => void;
  onSaved?: (routine: Routine) => void;
}

function toDraftItem(row: RoutineExercise): DraftRoutineExercise {
  return {
    id: row.id,
    exercise_id: row.exercise_id,
    superset_group: row.superset_group,
    setsInput: String(row.target_sets),
    repsMinInput:
      row.target_reps_min === null ? "" : String(row.target_reps_min),
    repsMaxInput:
      row.target_reps_max === null ? "" : String(row.target_reps_max),
    targetRpe: row.target_rpe,
    restInput: String(row.rest_seconds),
    notes: row.notes ?? "",
  };
}

function parseOptionalInt(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const num = Number(trimmed);
  if (!Number.isFinite(num)) return NaN;
  return Math.trunc(num);
}

export function RoutineEditorModal({
  open,
  editingRoutine,
  initialRoutineExercises,
  templateSeed = null,
  exercises,
  nextSortOrder,
  defaultRestSeconds,
  onClose,
  onSaved,
}: RoutineEditorModalProps) {
  const dndId = useId();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(ROUTINE_COLORS[0]?.hex ?? "#059669");
  const [notes, setNotes] = useState("");
  const [draftExercises, setDraftExercises] = useState<DraftRoutineExercise[]>(
    []
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const exerciseById = useMemo(
    () => new Map(exercises.map((ex) => [ex.id, ex])),
    [exercises]
  );

  useEffect(() => {
    if (!open) return;
    if (editingRoutine) {
      setName(editingRoutine.name);
      setColor(editingRoutine.color);
      setNotes(editingRoutine.notes ?? "");
      const sorted = [...initialRoutineExercises].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      setDraftExercises(sorted.map(toDraftItem));
    } else if (templateSeed) {
      setName(templateSeed.name);
      setColor(ROUTINE_COLORS[0]?.hex ?? "#059669");
      setNotes(templateSeed.notes ?? "");
      const sorted = [...templateSeed.exercises].sort(
        (a, b) => a.sort_order - b.sort_order
      );
      setDraftExercises(sorted.map(toDraftItem));
    } else {
      setName("");
      setColor(ROUTINE_COLORS[0]?.hex ?? "#059669");
      setNotes("");
      setDraftExercises([]);
    }
    setConfirmArchive(false);
    setPickerOpen(false);
    setErrorMessage(null);
  }, [open, editingRoutine, initialRoutineExercises, templateSeed]);

  useEffect(() => {
    if (!open || pickerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, pickerOpen, onClose]);

  const supersetLabels = useMemo(
    () => getSupersetPositions(draftExercises),
    [draftExercises]
  );

  if (!open) {
    return null;
  }

  function handleAddExercises(selectedIds: string[]) {
    const newItems: DraftRoutineExercise[] = selectedIds.map((exerciseId) => {
      const ex = exerciseById.get(exerciseId);
      const isCardio = ex?.tracking_type === "cardio";
      const isDuration = ex?.tracking_type === "duration";
      return {
        id: crypto.randomUUID(),
        exercise_id: exerciseId,
        superset_group: null,
        setsInput: isCardio ? "1" : "3",
        repsMinInput: isCardio || isDuration ? "" : "8",
        repsMaxInput: isCardio || isDuration ? "" : "12",
        targetRpe: isCardio ? null : 8,
        restInput: isCardio ? "60" : String(defaultRestSeconds),
        notes: "",
      };
    });
    setDraftExercises((prev) => [...prev, ...newItems]);
    setPickerOpen(false);
    setErrorMessage(null);
  }

  function handleUpdateItem(id: string, patch: Partial<DraftRoutineExercise>) {
    setDraftExercises((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  function handleRemoveItem(id: string) {
    setDraftExercises((prev) =>
      normalizeSupersetGroups(prev.filter((item) => item.id !== id))
    );
  }

  function handleMove(fromIndex: number, toIndex: number) {
    setDraftExercises((prev) => {
      if (
        toIndex < 0 ||
        toIndex >= prev.length ||
        fromIndex < 0 ||
        fromIndex >= prev.length
      ) {
        return prev;
      }
      return arrayMove(prev, fromIndex, toIndex);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setDraftExercises((prev) => {
      const oldIndex = prev.findIndex((item) => item.id === active.id);
      const newIndex = prev.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }

  function handleLinkNext(index: number) {
    setDraftExercises((prev) => linkAdjacentSuperset(prev, index));
  }

  function handleUnlink(index: number) {
    setDraftExercises((prev) => unlinkSupersetItem(prev, index));
  }

  async function handleArchiveConfirm() {
    if (!editingRoutine) return;
    const now = new Date().toISOString();
    useAppDataStore.getState().archiveRoutineOptimistic(editingRoutine.id);
    await archiveLocalRoutine(editingRoutine.id);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "ARCHIVE_ROUTINE",
        clientUpdatedAt: now,
        payload: { id: editingRoutine.id },
      },
      `routine:${editingRoutine.id}`
    );
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedDrafts = normalizeSupersetGroups(draftExercises);
    const parsedExercises = normalizedDrafts.map((item, idx) => {
      const setsNum = Number(item.setsInput.trim());
      const minReps = parseOptionalInt(item.repsMinInput);
      const maxReps = parseOptionalInt(item.repsMaxInput);
      const restNum = Number(item.restInput.trim() || "0");

      return {
        id: item.id,
        exercise_id: item.exercise_id,
        sort_order: idx,
        superset_group: item.superset_group,
        target_sets: Number.isFinite(setsNum) ? Math.trunc(setsNum) : -1,
        target_reps_min: minReps,
        target_reps_max: maxReps,
        target_rpe: item.targetRpe,
        rest_seconds: Number.isFinite(restNum) ? Math.trunc(restNum) : -1,
        notes: item.notes,
      };
    });

    const routineId = editingRoutine ? editingRoutine.id : crypto.randomUUID();
    const sortOrder = editingRoutine ? editingRoutine.sort_order : nextSortOrder;

    const parsed = upsertRoutinePayloadSchema.safeParse({
      id: routineId,
      name,
      color,
      notes,
      sort_order: sortOrder,
      exercises: parsedExercises,
    });

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(firstIssue?.message ?? "Please check your routine details.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const optimisticRoutine: Routine = {
        id: parsed.data.id,
        name: parsed.data.name,
        color: parsed.data.color,
        notes: parsed.data.notes,
        sort_order: parsed.data.sort_order,
        last_performed_at: editingRoutine?.last_performed_at ?? null,
        archived_at: null,
        created_at: editingRoutine?.created_at ?? now,
        updated_at: now,
      };

      const optimisticExercises: RoutineExercise[] = parsed.data.exercises.map(
        (ex, index) => ({
          id: ex.id,
          routine_id: parsed.data.id,
          exercise_id: ex.exercise_id,
          sort_order: index,
          superset_group: ex.superset_group,
          target_sets: ex.target_sets,
          target_reps_min: ex.target_reps_min,
          target_reps_max: ex.target_reps_max,
          target_rpe: ex.target_rpe,
          rest_seconds: ex.rest_seconds,
          notes: ex.notes,
          created_at: now,
          updated_at: now,
        })
      );

      useAppDataStore
        .getState()
        .upsertRoutineOptimistic(optimisticRoutine, optimisticExercises);
      await putLocalRoutineBundle(optimisticRoutine, optimisticExercises);

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: "UPSERT_ROUTINE",
          clientUpdatedAt: now,
          payload: parsed.data,
        },
        `routine:${routineId}`
      );

      onSaved?.(optimisticRoutine);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const modalTitle = editingRoutine
    ? "Edit Routine"
    : templateSeed
      ? "Save as Routine"
      : "New Routine";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={modalTitle}
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close routine editor"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              {modalTitle}
            </h2>
          </div>

          <button
            type="submit"
            form="routine-editor-form"
            disabled={submitting}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </header>

      <form
        id="routine-editor-form"
        onSubmit={handleSubmit}
        className="pb-safe flex-1 overflow-y-auto bg-white"
      >
        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}

        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="routine-name-input"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Routine Name *
            </label>
            <input
              id="routine-name-input"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Upper Push A"
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-2 px-4 py-4 sm:px-6">
            <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Calendar Accent Color
            </span>
            <div className="flex flex-wrap gap-3">
              {ROUTINE_COLORS.map((option) => {
                const selected =
                  color.toLowerCase() === option.hex.toLowerCase();
                return (
                  <button
                    key={option.hex}
                    type="button"
                    onClick={() => setColor(option.hex)}
                    aria-label={option.label}
                    aria-pressed={selected}
                    className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all ${
                      selected
                        ? "border-zinc-950 ring-2 ring-zinc-950 ring-offset-2"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <span
                      className="h-7 w-7 rounded-full"
                      style={{ backgroundColor: option.hex }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="routine-notes-input"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Routine Notes (optional)
            </label>
            <textarea
              id="routine-notes-input"
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Focus on controlled eccentric, 1-2 RIR on compounds"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {/* Exercises section */}
        <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50/60 px-4 py-3 sm:px-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
              Exercises ({draftExercises.length})
            </h3>
            <p className="text-[11px] text-zinc-500">
              Drag handle to reorder or link adjacent movements into supersets
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Add</span>
          </button>
        </div>

        {draftExercises.length > 0 ? (
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={draftExercises.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div>
                {draftExercises.map((item, idx) => {
                  const nextItem = draftExercises[idx + 1];
                  const sameSupersetAsNext =
                    item.superset_group !== null &&
                    nextItem?.superset_group === item.superset_group;

                  return (
                    <SortableRoutineExerciseRow
                      key={item.id}
                      item={item}
                      exercise={exerciseById.get(item.exercise_id)}
                      index={idx}
                      totalCount={draftExercises.length}
                      supersetLabel={supersetLabels[idx] ?? null}
                      sameSupersetAsNext={sameSupersetAsNext}
                      onChange={handleUpdateItem}
                      onMoveUp={(i) => handleMove(i, i - 1)}
                      onMoveDown={(i) => handleMove(i, i + 1)}
                      onRemove={handleRemoveItem}
                      onLinkNext={handleLinkNext}
                      onUnlink={handleUnlink}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="border-b border-zinc-200 px-4 py-10 text-center sm:px-6">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <Dumbbell className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-3 text-sm font-semibold text-zinc-950">
              No exercises in this routine yet
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Add exercises from the library to set target sets, reps, RPE, and
              rest timers.
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mt-4 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Exercises</span>
            </button>
          </div>
        )}

        {editingRoutine && (
          <div className="px-4 py-6 sm:px-6">
            {!confirmArchive ? (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                <span>Archive Routine</span>
              </button>
            ) : (
              <div className="space-y-3 border-l-2 border-rose-500 pl-3.5">
                <p className="text-sm text-zinc-700">
                  Archive &ldquo;{editingRoutine.name}&rdquo;? Past logged
                  workouts remain in History, while planned future schedule
                  slots for this routine will be cleared.
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="min-h-[44px] flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleArchiveConfirm}
                    className="min-h-[44px] flex-1 rounded-lg bg-rose-600 px-3 text-sm font-semibold text-white hover:bg-rose-500"
                  >
                    Confirm Archive
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      <ExercisePickerModal
        open={pickerOpen}
        exercises={exercises}
        mode="multi"
        title="Add Exercises"
        onClose={() => setPickerOpen(false)}
        onConfirm={handleAddExercises}
      />
    </div>
  );
}
