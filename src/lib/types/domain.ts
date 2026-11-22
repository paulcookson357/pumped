export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "core"
  | "forearms"
  | "cardio";

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "kettlebell"
  | "smith_machine"
  | "cardio_machine"
  | "other";

export type TrackingType =
  | "weight_reps"
  | "bodyweight_reps"
  | "weighted_bodyweight"
  | "duration"
  | "cardio";

export type WorkoutStatus = "in_progress" | "completed" | "discarded";

export type ScheduleStatus = "planned" | "completed" | "skipped";

export type SetType = "warmup" | "normal" | "dropset" | "failure";

export type WeightUnit = "kg" | "lbs";

export type SyncDomain =
  | "exercises"
  | "routines"
  | "schedule"
  | "workouts"
  | "settings";

export interface SyncMeta {
  domain: SyncDomain;
  version: number;
  updated_at: string;
}

export interface Exercise {
  id: string;
  slug: string | null;
  name: string;
  muscle_group: MuscleGroup;
  secondary_muscles: MuscleGroup[];
  equipment: EquipmentType;
  tracking_type: TrackingType;
  media_gif_url: string | null;
  media_image_start_url: string | null;
  media_image_end_url: string | null;
  custom_video_url: string | null;
  instructions: string[];
  is_custom: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Routine {
  id: string;
  name: string;
  color: string;
  notes: string | null;
  sort_order: number;
  last_performed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  sort_order: number;
  superset_group: number | null;
  target_sets: number;
  target_reps_min: number | null;
  target_reps_max: number | null;
  target_rpe: number | null;
  rest_seconds: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Workout {
  id: string;
  routine_id: string | null;
  name: string;
  notes: string | null;
  status: WorkoutStatus;
  workout_date: string;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  weight_unit: WeightUnit;
  total_volume: number;
  total_sets: number;
  pr_count: number;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  exercise_order: number;
  superset_group: number | null;
  set_number: number;
  set_type: SetType;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  duration_seconds: number | null;
  distance: number | null;
  speed: number | null;
  resistance: number | null;
  incline: number | null;
  rest_seconds: number | null;
  is_completed: boolean;
  completed_at: string | null;
  is_pr_weight: boolean;
  is_pr_1rm: boolean;
  is_pr_volume: boolean;
  notes: string | null;
  client_updated_at: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklySplitRule {
  id: string;
  day_of_week: number;
  routine_id: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScheduledWorkout {
  id: string;
  routine_id: string;
  scheduled_date: string;
  status: ScheduleStatus;
  workout_id: string | null;
  source_split_rule_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  id: 1;
  weight_unit: WeightUnit;
  default_rest_seconds: number;
  auto_start_rest_timer: boolean;
  show_rpe_column: boolean;
  timer_sound_enabled: boolean;
  timer_haptics_enabled: boolean;
  updated_at: string;
}
