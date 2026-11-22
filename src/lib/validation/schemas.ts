import { z } from "zod";

export const syncDomainSchema = z.enum([
  "exercises",
  "routines",
  "schedule",
  "workouts",
  "settings",
]);

export const muscleGroupSchema = z.enum([
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
]);

export const equipmentTypeSchema = z.enum([
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "smith_machine",
  "other",
]);

export const trackingTypeSchema = z.enum([
  "weight_reps",
  "bodyweight_reps",
  "weighted_bodyweight",
  "duration",
]);

function isSafeMediaPathOrHttpsUrl(value: string): boolean {
  if (value.startsWith("/exercises/")) {
    return !value.includes("..");
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const optionalSafeUrlSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((val) => {
    if (typeof val !== "string") return null;
    const trimmed = val.trim();
    return trimmed.length === 0 ? null : trimmed;
  })
  .refine((val) => val === null || isSafeMediaPathOrHttpsUrl(val), {
    message: "URL must start with https://, http://, or /exercises/",
  });

export const createExerciseInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Exercise name is required").max(80),
  muscle_group: muscleGroupSchema,
  secondary_muscles: z.array(muscleGroupSchema).max(6).default([]),
  equipment: equipmentTypeSchema,
  tracking_type: trackingTypeSchema.default("weight_reps"),
  media_image_start_url: optionalSafeUrlSchema.optional().default(null),
  custom_video_url: optionalSafeUrlSchema.optional().default(null),
  instructions: z
    .array(z.string().trim().min(1).max(400))
    .max(12)
    .default([]),
});

export const updateExerciseInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Exercise name is required").max(80),
  muscle_group: muscleGroupSchema,
  secondary_muscles: z.array(muscleGroupSchema).max(6).default([]),
  equipment: equipmentTypeSchema,
  tracking_type: trackingTypeSchema.default("weight_reps"),
  media_image_start_url: optionalSafeUrlSchema.optional().default(null),
  custom_video_url: optionalSafeUrlSchema.optional().default(null),
  instructions: z
    .array(z.string().trim().min(1).max(400))
    .max(12)
    .default([]),
});

export const archiveExerciseInputSchema = z.object({
  id: z.string().uuid(),
});

export const syncMutationSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string().min(1),
    type: z.literal("CREATE_EXERCISE"),
    clientUpdatedAt: z.string().datetime(),
    payload: createExerciseInputSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("UPDATE_EXERCISE"),
    clientUpdatedAt: z.string().datetime(),
    payload: updateExerciseInputSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("ARCHIVE_EXERCISE"),
    clientUpdatedAt: z.string().datetime(),
    payload: archiveExerciseInputSchema,
  }),
]);

export const syncMutateRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(100),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseInputSchema>;
export type ArchiveExerciseInput = z.infer<typeof archiveExerciseInputSchema>;
