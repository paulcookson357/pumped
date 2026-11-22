"use client";

import { useEffect, useState } from "react";
import { Archive, ExternalLink, Pencil, X } from "lucide-react";
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
  onClose: () => void;
  onEdit: (exercise: Exercise) => void;
}

export function ExerciseDetailDrawer({
  exercise,
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#111114] p-5 pb-8 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-zinc-100">
                {exercise.name}
              </h2>
              {exercise.is_custom && (
                <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-300">
                  Custom
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-zinc-400">
              {MUSCLE_LABELS[exercise.muscle_group]} •{" "}
              {EQUIPMENT_LABELS[exercise.equipment]} •{" "}
              {TRACKING_LABELS[exercise.tracking_type]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close exercise details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <ExerciseVisual exercise={exercise} size="detail" animateFallback />

        {exercise.secondary_muscles.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs font-medium text-zinc-400">
              Secondary:
            </span>
            {exercise.secondary_muscles.map((muscle) => (
              <span
                key={muscle}
                className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-xs text-zinc-300"
              >
                {MUSCLE_LABELS[muscle]}
              </span>
            ))}
          </div>
        )}

        {exercise.custom_video_url && (
          <div className="mt-4">
            <a
              href={exercise.custom_video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 text-sm font-medium text-blue-300 hover:bg-blue-500/20"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              <span>Open Video Demonstration</span>
            </a>
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Form Instructions
          </h3>
          {exercise.instructions.length > 0 ? (
            <ol className="space-y-2 text-sm leading-relaxed text-zinc-300">
              {exercise.instructions.map((step, index) => (
                <li key={`${index}-${step.slice(0, 16)}`} className="flex gap-2.5">
                  <span className="tabular-nums mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold text-zinc-300">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-zinc-500">
              No instructions added for this exercise.
            </p>
          )}
        </div>

        {exercise.is_custom && (
          <div className="mt-6 border-t border-zinc-800 pt-4">
            {!confirmArchive ? (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => onEdit(exercise)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-100 hover:border-zinc-600"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span>Edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(true)}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-medium text-rose-300 hover:bg-rose-500/20"
                >
                  <Archive className="h-4 w-4" aria-hidden="true" />
                  <span>Archive</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3">
                <p className="text-xs text-rose-200">
                  Archive &ldquo;{exercise.name}&rdquo;? Past logged sets remain
                  intact.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(false)}
                    className="min-h-[44px] flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleArchiveConfirm}
                    className="min-h-[44px] flex-1 rounded-xl bg-rose-500 px-3 text-sm font-semibold text-white hover:bg-rose-400"
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
