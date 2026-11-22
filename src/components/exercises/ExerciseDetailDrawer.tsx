"use client";

import { useEffect, useState } from "react";
import { Archive, ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import { ExerciseVisual } from "@/components/exercises/ExerciseVisual";
import {
  EQUIPMENT_LABELS,
  MUSCLE_LABELS,
  TRACKING_LABELS,
} from "@/lib/exercises/labels";
import { deleteLocalExercise } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import type { Exercise } from "@/lib/types/domain";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface ExerciseDetailDrawerProps {
  exercise: Exercise | null;
  readOnly?: boolean;
  zIndexClass?: string;
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
}

export function ExerciseDetailDrawer({
  exercise,
  readOnly = false,
  zIndexClass = "z-50",
  onClose,
  onEdit,
}: ExerciseDetailDrawerProps) {
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    setConfirmArchive(false);
  }, [exercise?.id]);

  useEffect(() => {
    if (!exercise) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise, onClose]);

  if (!exercise) {
    return null;
  }

  async function handleArchiveConfirm() {
    if (!exercise) return;
    const now = new Date().toISOString();
    useAppDataStore.getState().archiveExerciseOptimistic(exercise.id);
    await deleteLocalExercise(exercise.id);
    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "ARCHIVE_EXERCISE",
        clientUpdatedAt: now,
        payload: { id: exercise.id },
      },
      `exercise:${exercise.id}`
    );
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={exercise.name}
      className={`fixed inset-0 ${zIndexClass} flex h-dvh w-full flex-col bg-white`}
    >
      {/* Full-page modal sticky header */}
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close exercise details"
              className="-ml-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="truncate text-base font-bold tracking-tight text-zinc-950">
              {exercise.name}
            </h2>
            {exercise.is_custom && (
              <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                Custom
              </span>
            )}
          </div>

          {exercise.is_custom && !readOnly && (
            <button
              type="button"
              onClick={() => onEdit(exercise)}
              aria-label="Edit custom exercise"
              className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-medium text-zinc-800 hover:bg-zinc-50"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </header>

      {/* Full-page scrollable body */}
      <div className="pb-safe flex-1 overflow-y-auto bg-white">
        <ExerciseVisual exercise={exercise} size="detail" animateFallback />

        {/* Metadata strip separated by subtle hairline */}
        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          <div className="grid grid-cols-3 divide-x divide-zinc-200">
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Muscle
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                {MUSCLE_LABELS[exercise.muscle_group]}
              </p>
            </div>
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Equipment
              </p>
              <p className="mt-0.5 text-sm font-semibold text-zinc-950">
                {EQUIPMENT_LABELS[exercise.equipment]}
              </p>
            </div>
            <div className="px-4 py-3 sm:px-6">
              <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                Tracking
              </p>
              <p className="mt-0.5 truncate text-sm font-semibold text-zinc-950">
                {TRACKING_LABELS[exercise.tracking_type]}
              </p>
            </div>
          </div>

          {exercise.secondary_muscles.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 sm:px-6">
              <span className="mr-1 text-xs font-medium text-zinc-500">
                Secondary:
              </span>
              {exercise.secondary_muscles.map((muscle) => (
                <span
                  key={muscle}
                  className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-700"
                >
                  {MUSCLE_LABELS[muscle]}
                </span>
              ))}
            </div>
          )}

          {exercise.custom_video_url && (
            <div className="px-4 py-3 sm:px-6">
              <a
                href={exercise.custom_video_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
              >
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                <span>Open Video Demonstration</span>
              </a>
            </div>
          )}
        </div>

        {/* Form Instructions */}
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Form Instructions
          </h3>
          {exercise.instructions.length > 0 ? (
            <ol className="mt-3 space-y-3.5 text-sm leading-relaxed text-zinc-700">
              {exercise.instructions.map((step, index) => (
                <li
                  key={`${index}-${step.slice(0, 16)}`}
                  className="flex gap-3"
                >
                  <span className="tabular-nums mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-zinc-500">
              No instructions added for this exercise.
            </p>
          )}
        </div>

        {/* Custom exercise management footer */}
        {exercise.is_custom && !readOnly && (
          <div className="border-t border-zinc-200 px-4 py-5 sm:px-6">
            {!confirmArchive ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onEdit(exercise)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span>Edit Exercise</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-medium text-rose-700 hover:bg-rose-100"
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  <span>Archive</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 border-l-2 border-rose-500 pl-3.5">
                <p className="text-sm text-zinc-700">
                  Archive &ldquo;{exercise.name}&rdquo;? Past logged sets remain
                  intact.
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
      </div>
    </div>
  );
}
