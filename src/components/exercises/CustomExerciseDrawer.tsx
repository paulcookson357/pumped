"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_TYPES,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  TRACKING_LABELS,
  TRACKING_TYPES,
} from "@/lib/exercises/labels";
import { putLocalExercise } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import type {
  EquipmentType,
  Exercise,
  MuscleGroup,
  TrackingType,
} from "@/lib/types/domain";
import {
  createExerciseInputSchema,
  updateExerciseInputSchema,
} from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";

interface CustomExerciseDrawerProps {
  open: boolean;
  editingExercise: Exercise | null;
  onClose: () => void;
}

export function CustomExerciseDrawer({
  open,
  editingExercise,
  onClose,
}: CustomExerciseDrawerProps) {
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>("chest");
  const [equipment, setEquipment] = useState<EquipmentType>("dumbbell");
  const [trackingType, setTrackingType] = useState<TrackingType>("weight_reps");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [instructionsText, setInstructionsText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editingExercise) {
      setName(editingExercise.name);
      setMuscleGroup(editingExercise.muscle_group);
      setEquipment(editingExercise.equipment);
      setTrackingType(editingExercise.tracking_type);
      setImageUrl(editingExercise.media_image_start_url ?? "");
      setVideoUrl(editingExercise.custom_video_url ?? "");
      setInstructionsText(editingExercise.instructions.join("\n"));
    } else {
      setName("");
      setMuscleGroup("chest");
      setEquipment("dumbbell");
      setTrackingType("weight_reps");
      setImageUrl("");
      setVideoUrl("");
      setInstructionsText("");
    }
    setErrorMessage(null);
  }, [open, editingExercise]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const instructions = instructionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const id = editingExercise ? editingExercise.id : crypto.randomUUID();
    const rawPayload = {
      id,
      name,
      muscle_group: muscleGroup,
      secondary_muscles: editingExercise?.secondary_muscles ?? [],
      equipment,
      tracking_type: trackingType,
      media_image_start_url: imageUrl,
      custom_video_url: videoUrl,
      instructions,
    };

    const schema = editingExercise
      ? updateExerciseInputSchema
      : createExerciseInputSchema;

    const parsed = schema.safeParse(rawPayload);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      setErrorMessage(firstIssue?.message ?? "Please check your inputs.");
      return;
    }

    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      const optimisticExercise: Exercise = {
        id: parsed.data.id,
        slug: null,
        name: parsed.data.name,
        muscle_group: parsed.data.muscle_group,
        secondary_muscles: parsed.data.secondary_muscles,
        equipment: parsed.data.equipment,
        tracking_type: parsed.data.tracking_type,
        media_gif_url: null,
        media_image_start_url: parsed.data.media_image_start_url,
        media_image_end_url: null,
        custom_video_url: parsed.data.custom_video_url,
        instructions: parsed.data.instructions,
        is_custom: true,
        archived_at: null,
        created_at: editingExercise?.created_at ?? now,
        updated_at: now,
      };

      useAppDataStore.getState().upsertExerciseOptimistic(optimisticExercise);
      await putLocalExercise(optimisticExercise);

      void enqueueAndSync(
        {
          id: crypto.randomUUID(),
          type: editingExercise ? "UPDATE_EXERCISE" : "CREATE_EXERCISE",
          clientUpdatedAt: now,
          payload: parsed.data,
        },
        `exercise:${id}`
      );

      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        editingExercise ? "Edit Custom Exercise" : "New Custom Exercise"
      }
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      {/* Full-page modal sticky header */}
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close form"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              {editingExercise ? "Edit Custom Exercise" : "New Custom Exercise"}
            </h2>
          </div>

          <button
            type="submit"
            form="custom-exercise-form"
            disabled={submitting}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
          >
            Save
          </button>
        </div>
      </header>

      {/* Full-width scrollable form */}
      <form
        id="custom-exercise-form"
        onSubmit={handleSubmit}
        className="pb-safe flex-1 overflow-y-auto bg-white"
      >
        <div className="divide-y divide-zinc-200 border-b border-zinc-200">
          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="custom-ex-name"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Exercise Name *
            </label>
            <input
              id="custom-ex-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cable Y-Raise"
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:px-6">
            <div className="space-y-1.5">
              <label
                htmlFor="custom-ex-muscle"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Muscle Group
              </label>
              <select
                id="custom-ex-muscle"
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
              >
                {MUSCLE_GROUPS.map((m) => (
                  <option key={m} value={m}>
                    {MUSCLE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="custom-ex-equipment"
                className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
              >
                Equipment
              </label>
              <select
                id="custom-ex-equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value as EquipmentType)}
                className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
              >
                {EQUIPMENT_TYPES.map((eq) => (
                  <option key={eq} value={eq}>
                    {EQUIPMENT_LABELS[eq]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="custom-ex-tracking"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Tracking Type
            </label>
            <select
              id="custom-ex-tracking"
              value={trackingType}
              onChange={(e) => setTrackingType(e.target.value as TrackingType)}
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-base text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
            >
              {TRACKING_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {TRACKING_LABELS[tt]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="custom-ex-image"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Demo Image / GIF URL (optional)
            </label>
            <input
              id="custom-ex-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="custom-ex-video"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Form Video Link (optional)
            </label>
            <input
              id="custom-ex-video"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="min-h-[44px] w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="space-y-1.5 px-4 py-4 sm:px-6">
            <label
              htmlFor="custom-ex-instructions"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
            >
              Form Cues / Instructions (one step per line)
            </label>
            <textarea
              id="custom-ex-instructions"
              rows={4}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder={"Set cables at lowest notch\nRaise arms into a 30° Y angle"}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-base text-zinc-950 placeholder:text-zinc-400 focus:border-emerald-600 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}
