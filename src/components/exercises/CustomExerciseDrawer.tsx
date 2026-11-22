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
      aria-label={editingExercise ? "Edit Custom Exercise" : "New Custom Exercise"}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-xs sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-800 bg-[#111114] p-5 pb-8 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight text-zinc-100">
            {editingExercise ? "Edit Custom Exercise" : "New Custom Exercise"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close form"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="custom-ex-name"
              className="block text-xs font-medium text-zinc-300"
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
              className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label
                htmlFor="custom-ex-muscle"
                className="block text-xs font-medium text-zinc-300"
              >
                Muscle Group
              </label>
              <select
                id="custom-ex-muscle"
                value={muscleGroup}
                onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none"
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
                className="block text-xs font-medium text-zinc-300"
              >
                Equipment
              </label>
              <select
                id="custom-ex-equipment"
                value={equipment}
                onChange={(e) => setEquipment(e.target.value as EquipmentType)}
                className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none"
              >
                {EQUIPMENT_TYPES.map((eq) => (
                  <option key={eq} value={eq}>
                    {EQUIPMENT_LABELS[eq]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-ex-tracking"
              className="block text-xs font-medium text-zinc-300"
            >
              Tracking Type
            </label>
            <select
              id="custom-ex-tracking"
              value={trackingType}
              onChange={(e) => setTrackingType(e.target.value as TrackingType)}
              className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {TRACKING_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {TRACKING_LABELS[tt]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-ex-image"
              className="block text-xs font-medium text-zinc-300"
            >
              Demo Image / GIF URL (optional)
            </label>
            <input
              id="custom-ex-image"
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
              className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-ex-video"
              className="block text-xs font-medium text-zinc-300"
            >
              Form Video Link (optional)
            </label>
            <input
              id="custom-ex-video"
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/..."
              className="min-h-[44px] w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3.5 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="custom-ex-instructions"
              className="block text-xs font-medium text-zinc-300"
            >
              Form Cues / Instructions (one step per line)
            </label>
            <textarea
              id="custom-ex-instructions"
              rows={3}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              placeholder={"Set cables at lowest notch\nRaise arms into a 30° Y angle"}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-base text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {errorMessage && (
            <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200">
              {errorMessage}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-[44px] flex-1 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
            >
              {editingExercise ? "Save Changes" : "Create Exercise"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
