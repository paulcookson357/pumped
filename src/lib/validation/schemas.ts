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

function optionalTrimmedTextSchema(maxLength: number) {
  return z
    .union([z.string(), z.null(), z.undefined()])
    .transform((val) => {
      if (typeof val !== "string") return null;
      const trimmed = val.trim();
      return trimmed.length === 0 ? null : trimmed.slice(0, maxLength);
    });
}

export const localDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color");

export const scheduleStatusSchema = z.enum(["planned", "completed", "skipped"]);

export const setTypeSchema = z.enum(["warmup", "normal", "dropset", "failure"]);

export const weightUnitSchema = z.enum(["kg", "lbs"]);

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

export const routineExerciseInputSchema = z
  .object({
    id: z.string().uuid(),
    exercise_id: z.string().uuid(),
    sort_order: z.number().int().min(0).max(500),
    superset_group: z.number().int().min(1).max(50).nullable().default(null),
    target_sets: z.number().int().min(1).max(30),
    target_reps_min: z.number().int().min(1).max(500).nullable().default(null),
    target_reps_max: z.number().int().min(1).max(500).nullable().default(null),
    target_rpe: z
      .number()
      .min(5)
      .max(10)
      .refine((v) => Math.round(v * 2) === v * 2, {
        message: "RPE must be in 0.5 increments",
      })
      .nullable()
      .default(null),
    rest_seconds: z.number().int().min(0).max(900),
    notes: optionalTrimmedTextSchema(400).optional().default(null),
  })
  .refine(
    (row) =>
      row.target_reps_min === null ||
      row.target_reps_max === null ||
      row.target_reps_max >= row.target_reps_min,
    { message: "Max reps must be greater than or equal to min reps" }
  );

export const upsertRoutinePayloadSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Routine name is required").max(80),
  color: hexColorSchema,
  notes: optionalTrimmedTextSchema(500).optional().default(null),
  sort_order: z.number().int().min(0).max(1000),
  exercises: z.array(routineExerciseInputSchema).max(60),
});

export const reorderRoutinesPayloadSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(200),
});

export const archiveRoutinePayloadSchema = z.object({
  id: z.string().uuid(),
});

export const weeklySplitRuleInputSchema = z.object({
  id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  routine_id: z.string().uuid(),
  sort_order: z.number().int().min(0).max(50),
  is_active: z.boolean().default(true),
});

export const scheduledWorkoutInputSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  scheduled_date: localDateSchema,
  status: scheduleStatusSchema.default("planned"),
  workout_id: z.string().uuid().nullable().default(null),
  source_split_rule_id: z.string().uuid().nullable().default(null),
  notes: optionalTrimmedTextSchema(400).optional().default(null),
});

export const saveWeeklySplitPayloadSchema = z.object({
  rules: z.array(weeklySplitRuleInputSchema).max(70),
  removePlannedIds: z.array(z.string().uuid()).max(500).default([]),
  generatedWorkouts: z.array(scheduledWorkoutInputSchema).max(500).default([]),
});

export const upsertScheduledWorkoutPayloadSchema = scheduledWorkoutInputSchema;

export const deleteScheduledWorkoutPayloadSchema = z.object({
  id: z.string().uuid(),
});

export const workoutSetInputSchema = z.object({
  id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  exercise_order: z.number().int().min(0).max(500),
  superset_group: z.number().int().min(1).max(50).nullable().default(null),
  set_number: z.number().int().min(1).max(100),
  set_type: setTypeSchema.default("normal"),
  weight: z.number().min(0).max(5000).nullable().default(null),
  reps: z.number().int().min(0).max(5000).nullable().default(null),
  rpe: z
    .number()
    .min(5)
    .max(10)
    .refine((v) => Math.round(v * 2) === v * 2, {
      message: "RPE must be in 0.5 increments",
    })
    .nullable()
    .default(null),
  duration_seconds: z.number().int().min(0).max(86400).nullable().default(null),
  rest_seconds: z.number().int().min(0).max(900).nullable().default(null),
  is_completed: z.boolean().default(true),
  completed_at: z.string().datetime().nullable().default(null),
  notes: optionalTrimmedTextSchema(400).optional().default(null),
});

export const finishWorkoutPayloadSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid().nullable().default(null),
  scheduled_workout_id: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1, "Workout name is required").max(80),
  notes: optionalTrimmedTextSchema(500).optional().default(null),
  workout_date: localDateSchema,
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  duration_seconds: z.number().int().min(0).max(86400),
  weight_unit: weightUnitSchema.default("kg"),
  sets: z.array(workoutSetInputSchema).max(500),
});

export const previousExerciseSetsRequestSchema = z.object({
  exerciseIds: z.array(z.string().uuid()).min(1).max(100),
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
  z.object({
    id: z.string().min(1),
    type: z.literal("UPSERT_ROUTINE"),
    clientUpdatedAt: z.string().datetime(),
    payload: upsertRoutinePayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("REORDER_ROUTINES"),
    clientUpdatedAt: z.string().datetime(),
    payload: reorderRoutinesPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("ARCHIVE_ROUTINE"),
    clientUpdatedAt: z.string().datetime(),
    payload: archiveRoutinePayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("SAVE_WEEKLY_SPLIT"),
    clientUpdatedAt: z.string().datetime(),
    payload: saveWeeklySplitPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("UPSERT_SCHEDULED_WORKOUT"),
    clientUpdatedAt: z.string().datetime(),
    payload: upsertScheduledWorkoutPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("DELETE_SCHEDULED_WORKOUT"),
    clientUpdatedAt: z.string().datetime(),
    payload: deleteScheduledWorkoutPayloadSchema,
  }),
  z.object({
    id: z.string().min(1),
    type: z.literal("FINISH_WORKOUT"),
    clientUpdatedAt: z.string().datetime(),
    payload: finishWorkoutPayloadSchema,
  }),
]);

export const syncMutateRequestSchema = z.object({
  mutations: z.array(syncMutationSchema).min(1).max(100),
});

export type SyncMutation = z.infer<typeof syncMutationSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseInputSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseInputSchema>;
export type ArchiveExerciseInput = z.infer<typeof archiveExerciseInputSchema>;
export type RoutineExerciseInput = z.infer<typeof routineExerciseInputSchema>;
export type UpsertRoutinePayload = z.infer<typeof upsertRoutinePayloadSchema>;
export type ReorderRoutinesPayload = z.infer<typeof reorderRoutinesPayloadSchema>;
export type ArchiveRoutinePayload = z.infer<typeof archiveRoutinePayloadSchema>;
export type WeeklySplitRuleInput = z.infer<typeof weeklySplitRuleInputSchema>;
export type ScheduledWorkoutInput = z.infer<typeof scheduledWorkoutInputSchema>;
export type SaveWeeklySplitPayload = z.infer<typeof saveWeeklySplitPayloadSchema>;
export type UpsertScheduledWorkoutPayload = z.infer<
  typeof upsertScheduledWorkoutPayloadSchema
>;
export type DeleteScheduledWorkoutPayload = z.infer<
  typeof deleteScheduledWorkoutPayloadSchema
>;
export type WorkoutSetInput = z.infer<typeof workoutSetInputSchema>;
export type FinishWorkoutPayload = z.infer<typeof finishWorkoutPayloadSchema>;
