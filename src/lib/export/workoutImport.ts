import { z } from "zod";
import {
  equipmentTypeSchema,
  hexColorSchema,
  localDateSchema,
  muscleGroupSchema,
  scheduleStatusSchema,
  setTypeSchema,
  trackingTypeSchema,
  updateSettingsPayloadSchema,
  weightUnitSchema,
} from "@/lib/validation/schemas";

const backupExerciseSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().nullable().default(null),
  name: z.string().trim().min(1).max(80),
  muscle_group: muscleGroupSchema,
  secondary_muscles: z.array(muscleGroupSchema).default([]),
  equipment: equipmentTypeSchema,
  tracking_type: trackingTypeSchema.default("weight_reps"),
  media_gif_url: z.string().nullable().default(null),
  media_image_start_url: z.string().nullable().default(null),
  media_image_end_url: z.string().nullable().default(null),
  custom_video_url: z.string().nullable().default(null),
  instructions: z.array(z.string()).default([]),
  is_custom: z.boolean().default(false),
  archived_at: z.string().nullable().default(null),
});

const backupRoutineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80),
  color: hexColorSchema.default("#059669"),
  notes: z.string().nullable().default(null),
  sort_order: z.number().int().min(0).default(0),
  last_performed_at: z.string().nullable().default(null),
  archived_at: z.string().nullable().default(null),
});

const backupRoutineExerciseSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  sort_order: z.number().int().min(0),
  superset_group: z.number().int().min(1).nullable().default(null),
  target_sets: z.number().int().min(1).max(30),
  target_reps_min: z.number().int().min(1).nullable().default(null),
  target_reps_max: z.number().int().min(1).nullable().default(null),
  target_rpe: z.number().min(5).max(10).nullable().default(null),
  rest_seconds: z.number().int().min(0).max(900),
  notes: z.string().nullable().default(null),
});

const backupWeeklySplitRuleSchema = z.object({
  id: z.string().uuid(),
  day_of_week: z.number().int().min(1).max(7),
  routine_id: z.string().uuid(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
});

const backupScheduledWorkoutSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  scheduled_date: localDateSchema,
  status: scheduleStatusSchema.default("planned"),
  workout_id: z.string().uuid().nullable().default(null),
  source_split_rule_id: z.string().uuid().nullable().default(null),
  notes: z.string().nullable().default(null),
});

const backupWorkoutSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid().nullable().default(null),
  name: z.string().trim().min(1).max(80),
  notes: z.string().nullable().default(null),
  status: z.literal("completed"),
  workout_date: localDateSchema,
  started_at: z.string().min(1),
  completed_at: z.string().min(1),
  duration_seconds: z.number().int().min(0).nullable().default(null),
  weight_unit: weightUnitSchema.default("kg"),
  total_volume: z.number().min(0).default(0),
  total_sets: z.number().int().min(0).default(0),
  pr_count: z.number().int().min(0).default(0),
  client_updated_at: z.string().optional(),
});

const backupWorkoutSetSchema = z.object({
  id: z.string().uuid(),
  workout_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  exercise_order: z.number().int().min(0),
  superset_group: z.number().int().min(1).nullable().default(null),
  set_number: z.number().int().min(1),
  set_type: setTypeSchema.default("normal"),
  weight: z.number().min(0).nullable().default(null),
  reps: z.number().int().min(0).nullable().default(null),
  rpe: z.number().min(5).max(10).nullable().default(null),
  duration_seconds: z.number().int().min(0).nullable().default(null),
  distance: z.number().min(0).nullable().optional().default(null),
  speed: z.number().min(0).nullable().optional().default(null),
  resistance: z.number().min(0).nullable().optional().default(null),
  incline: z.number().min(-15).max(50).nullable().optional().default(null),
  rest_seconds: z.number().int().min(0).nullable().default(null),
  is_completed: z.boolean().default(true),
  completed_at: z.string().nullable().default(null),
  is_pr_weight: z.boolean().default(false),
  is_pr_1rm: z.boolean().default(false),
  is_pr_volume: z.boolean().default(false),
  notes: z.string().nullable().default(null),
  client_updated_at: z.string().optional(),
});

export const pumpedJsonBackupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().min(1),
  counts: z
    .object({
      exercises: z.number().int().min(0).optional(),
      routines: z.number().int().min(0).optional(),
      routineExercises: z.number().int().min(0).optional(),
      weeklySplitRules: z.number().int().min(0).optional(),
      scheduledWorkouts: z.number().int().min(0).optional(),
      workouts: z.number().int().min(0).optional(),
      workoutSets: z.number().int().min(0).optional(),
    })
    .optional(),
  data: z.object({
    exercises: z.array(backupExerciseSchema).max(5000),
    routines: z.array(backupRoutineSchema).max(2000),
    routineExercises: z.array(backupRoutineExerciseSchema).max(20000),
    weeklySplitRules: z.array(backupWeeklySplitRuleSchema).max(2000),
    scheduledWorkouts: z.array(backupScheduledWorkoutSchema).max(20000),
    workouts: z.array(backupWorkoutSchema).max(20000),
    workoutSets: z.array(backupWorkoutSetSchema).max(200000),
    settings: updateSettingsPayloadSchema.nullable().default(null),
  }),
});

export type BackupExercise = z.infer<typeof backupExerciseSchema>;
export type ValidatedJsonBackup = z.infer<typeof pumpedJsonBackupSchema>;

export interface BackupImportSummary {
  exportedAt: string;
  exercises: number;
  routines: number;
  routineExercises: number;
  weeklySplitRules: number;
  scheduledWorkouts: number;
  workouts: number;
  workoutSets: number;
  hasSettings: boolean;
}

export interface ExistingExerciseRef {
  id: string;
  slug: string | null;
  name: string;
  is_custom: boolean;
  archived_at: string | null;
}

export function buildBackupImportSummary(
  backup: ValidatedJsonBackup
): BackupImportSummary {
  const { data } = backup;
  return {
    exportedAt: backup.exportedAt,
    exercises: data.exercises.length,
    routines: data.routines.length,
    routineExercises: data.routineExercises.length,
    weeklySplitRules: data.weeklySplitRules.length,
    scheduledWorkouts: data.scheduledWorkouts.length,
    workouts: data.workouts.length,
    workoutSets: data.workoutSets.length,
    hasSettings: data.settings !== null,
  };
}

export function validateBackupIntegrity(
  backup: ValidatedJsonBackup
): string | null {
  const { data } = backup;
  const exerciseIds = new Set(data.exercises.map((ex) => ex.id));
  const routineIds = new Set(data.routines.map((r) => r.id));
  const workoutIds = new Set(data.workouts.map((w) => w.id));

  for (const re of data.routineExercises) {
    if (!routineIds.has(re.routine_id)) {
      return `Routine exercise references missing routine (${re.routine_id}).`;
    }
    if (!exerciseIds.has(re.exercise_id)) {
      return `Routine exercise references missing exercise (${re.exercise_id}).`;
    }
  }

  for (const rule of data.weeklySplitRules) {
    if (!routineIds.has(rule.routine_id)) {
      return `Weekly split rule references missing routine (${rule.routine_id}).`;
    }
  }

  for (const sw of data.scheduledWorkouts) {
    if (!routineIds.has(sw.routine_id)) {
      return `Scheduled workout references missing routine (${sw.routine_id}).`;
    }
  }

  for (const ws of data.workoutSets) {
    if (!workoutIds.has(ws.workout_id)) {
      return `Workout set references missing workout (${ws.workout_id}).`;
    }
    if (!exerciseIds.has(ws.exercise_id)) {
      return `Workout set references missing exercise (${ws.exercise_id}).`;
    }
  }

  return null;
}

export function parseBackupJsonText(
  rawText: string
):
  | { ok: true; backup: ValidatedJsonBackup; summary: BackupImportSummary }
  | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "File is not valid JSON." };
  }

  const parsed = pumpedJsonBackupSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "backup";
    return {
      ok: false,
      error: `Invalid Pumped v1 backup (${path}): ${issue?.message ?? "schema mismatch"}.`,
    };
  }

  const integrityError = validateBackupIntegrity(parsed.data);
  if (integrityError) {
    return { ok: false, error: integrityError };
  }

  return {
    ok: true,
    backup: parsed.data,
    summary: buildBackupImportSummary(parsed.data),
  };
}

/**
 * Maps imported exercise UUIDs to existing DB exercises matched by `slug` first,
 * then active case-insensitive `name`, preventing duplicate key / unique-index conflicts.
 */
export function buildExerciseIdRemap(
  importedExercises: BackupExercise[],
  existingDbExercises: ExistingExerciseRef[]
): {
  idMap: Map<string, string>;
  exercisesToUpsert: BackupExercise[];
} {
  const bySlug = new Map<string, ExistingExerciseRef>();
  const byActiveName = new Map<string, ExistingExerciseRef>();

  for (const existing of existingDbExercises) {
    if (existing.slug) {
      bySlug.set(existing.slug.trim().toLowerCase(), existing);
    }
    if (existing.archived_at === null) {
      byActiveName.set(existing.name.trim().toLowerCase(), existing);
    }
  }

  const idMap = new Map<string, string>();
  const exercisesToUpsert: BackupExercise[] = [];
  const usedTargetIds = new Set<string>();

  for (const imp of importedExercises) {
    const slugMatch = imp.slug
      ? bySlug.get(imp.slug.trim().toLowerCase())
      : undefined;
    const nameMatch =
      imp.archived_at === null
        ? byActiveName.get(imp.name.trim().toLowerCase())
        : undefined;
    const matched = slugMatch ?? nameMatch;

    if (matched) {
      idMap.set(imp.id, matched.id);
      if (imp.is_custom && matched.is_custom && !usedTargetIds.has(matched.id)) {
        usedTargetIds.add(matched.id);
        exercisesToUpsert.push({
          ...imp,
          id: matched.id,
        });
      }
      continue;
    }

    idMap.set(imp.id, imp.id);
    if (!usedTargetIds.has(imp.id)) {
      usedTargetIds.add(imp.id);
      exercisesToUpsert.push(imp);
    }
  }

  return { idMap, exercisesToUpsert };
}

export function remapBackupData(
  data: ValidatedJsonBackup["data"],
  idMap: Map<string, string>
): ValidatedJsonBackup["data"] {
  return {
    ...data,
    routineExercises: data.routineExercises.map((re) => ({
      ...re,
      exercise_id: idMap.get(re.exercise_id) ?? re.exercise_id,
    })),
    workoutSets: data.workoutSets.map((ws) => ({
      ...ws,
      exercise_id: idMap.get(ws.exercise_id) ?? ws.exercise_id,
    })),
  };
}
