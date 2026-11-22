-- Pumped: Initial PostgreSQL Schema (Single-user personal strength PWA)
-- All tables enforce RLS default-deny (zero anon policies).
-- Server-side Next.js API routes & Server Components access DB via SERVICE_ROLE_KEY.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- ENUMS
-- ============================================================================
CREATE TYPE public.muscle_group AS ENUM (
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'forearms'
);

CREATE TYPE public.equipment_type AS ENUM (
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'smith_machine',
  'other'
);

CREATE TYPE public.tracking_type AS ENUM (
  'weight_reps',
  'bodyweight_reps',
  'weighted_bodyweight',
  'duration'
);

CREATE TYPE public.workout_status AS ENUM (
  'in_progress',
  'completed',
  'discarded'
);

CREATE TYPE public.schedule_status AS ENUM (
  'planned',
  'completed',
  'skipped'
);

CREATE TYPE public.set_type AS ENUM (
  'warmup',
  'normal',
  'dropset',
  'failure'
);

CREATE TYPE public.weight_unit AS ENUM (
  'kg',
  'lbs'
);

-- ============================================================================
-- SHARED HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 1. SYNC_META (Lightweight version watermarks for fast cache invalidation)
-- ============================================================================
CREATE TABLE public.sync_meta (
  domain     TEXT PRIMARY KEY CHECK (domain IN ('exercises', 'routines', 'schedule', 'workouts', 'settings')),
  version    BIGINT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.sync_meta (domain) VALUES
  ('exercises'),
  ('routines'),
  ('schedule'),
  ('workouts'),
  ('settings');

CREATE OR REPLACE FUNCTION public.bump_sync_domain(p_domain TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.sync_meta
  SET version = version + 1,
      updated_at = now()
  WHERE domain = p_domain;
END;
$$;

-- ============================================================================
-- 2. EXERCISES (Curated ~55 standard + user custom, GIF + 2-frame fallback)
-- ============================================================================
CREATE TABLE public.exercises (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                  TEXT UNIQUE,
  name                  TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  muscle_group          public.muscle_group NOT NULL,
  secondary_muscles     public.muscle_group[] NOT NULL DEFAULT '{}',
  equipment             public.equipment_type NOT NULL,
  tracking_type         public.tracking_type NOT NULL DEFAULT 'weight_reps',
  media_gif_url         TEXT,
  media_image_start_url TEXT,
  media_image_end_url   TEXT,
  custom_video_url      TEXT,
  instructions          TEXT[] NOT NULL DEFAULT '{}',
  is_custom             BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_exercises_active_name
  ON public.exercises (LOWER(name))
  WHERE archived_at IS NULL;

CREATE INDEX idx_exercises_filter
  ON public.exercises (muscle_group, equipment)
  WHERE archived_at IS NULL;

CREATE TRIGGER trg_exercises_updated_at
  BEFORE UPDATE ON public.exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 3. ROUTINES (Reusable strength templates)
-- ============================================================================
CREATE TABLE public.routines (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL CHECK (char_length(trim(name)) > 0),
  color             TEXT NOT NULL DEFAULT '#3B82F6',
  notes             TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  last_performed_at TIMESTAMPTZ,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routines_order
  ON public.routines (sort_order)
  WHERE archived_at IS NULL;

CREATE TRIGGER trg_routines_updated_at
  BEFORE UPDATE ON public.routines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. ROUTINE_EXERCISES (Includes supersets, rep ranges, target RPE, rest)
-- ============================================================================
CREATE TABLE public.routine_exercises (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id      UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  exercise_id     UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  superset_group  SMALLINT,
  target_sets     SMALLINT NOT NULL DEFAULT 3 CHECK (target_sets BETWEEN 1 AND 30),
  target_reps_min SMALLINT CHECK (target_reps_min > 0),
  target_reps_max SMALLINT CHECK (target_reps_max >= target_reps_min),
  target_rpe      NUMERIC(3, 1) CHECK (target_rpe BETWEEN 5.0 AND 10.0),
  rest_seconds    INTEGER NOT NULL DEFAULT 90 CHECK (rest_seconds BETWEEN 0 AND 900),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_routine_exercises_order
  ON public.routine_exercises (routine_id, sort_order);

CREATE TRIGGER trg_routine_exercises_updated_at
  BEFORE UPDATE ON public.routine_exercises
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. WORKOUTS (Active & completed lifting sessions)
-- ============================================================================
CREATE TABLE public.workouts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id        UUID REFERENCES public.routines(id) ON DELETE SET NULL,
  name              TEXT NOT NULL DEFAULT 'Workout' CHECK (char_length(trim(name)) > 0),
  notes             TEXT,
  status            public.workout_status NOT NULL DEFAULT 'in_progress',
  workout_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ,
  duration_seconds  INTEGER CHECK (duration_seconds >= 0),
  weight_unit       public.weight_unit NOT NULL DEFAULT 'kg',
  total_volume      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_sets        INTEGER NOT NULL DEFAULT 0,
  pr_count          SMALLINT NOT NULL DEFAULT 0,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT workouts_completed_check CHECK (
    status <> 'completed' OR completed_at IS NOT NULL
  )
);

-- At most one active in-progress workout at a time
CREATE UNIQUE INDEX idx_workouts_single_active
  ON public.workouts ((1))
  WHERE status = 'in_progress';

CREATE INDEX idx_workouts_completed_date
  ON public.workouts (workout_date DESC, completed_at DESC)
  WHERE status = 'completed';

CREATE TRIGGER trg_workouts_updated_at
  BEFORE UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. WORKOUT_SETS (Sets with superset grouping, set type, weight, reps, RPE)
-- ============================================================================
CREATE TABLE public.workout_sets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id        UUID NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  exercise_id       UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  exercise_order    SMALLINT NOT NULL DEFAULT 0 CHECK (exercise_order >= 0),
  superset_group    SMALLINT,
  set_number        SMALLINT NOT NULL CHECK (set_number > 0),
  set_type          public.set_type NOT NULL DEFAULT 'normal',
  weight            NUMERIC(7, 2) CHECK (weight >= 0),
  reps              SMALLINT CHECK (reps >= 0),
  rpe               NUMERIC(3, 1) CHECK (rpe BETWEEN 5.0 AND 10.0),
  duration_seconds  INTEGER CHECK (duration_seconds >= 0),
  rest_seconds      INTEGER CHECK (rest_seconds >= 0),
  is_completed      BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at      TIMESTAMPTZ,
  is_pr_weight      BOOLEAN NOT NULL DEFAULT FALSE,
  is_pr_1rm         BOOLEAN NOT NULL DEFAULT FALSE,
  is_pr_volume      BOOLEAN NOT NULL DEFAULT FALSE,
  notes             TEXT,
  client_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_workout_sets_position
    UNIQUE (workout_id, exercise_order, set_number)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_workout_sets_workout
  ON public.workout_sets (workout_id, exercise_order, set_number);

CREATE INDEX idx_workout_sets_exercise_history
  ON public.workout_sets (exercise_id, completed_at DESC)
  WHERE is_completed = TRUE;

CREATE TRIGGER trg_workout_sets_updated_at
  BEFORE UPDATE ON public.workout_sets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. WEEKLY_SPLIT_RULES (Repeating weekly split: e.g. Mon=Push, Wed=Pull)
-- ============================================================================
CREATE TABLE public.weekly_split_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1=Mon .. 7=Sun
  routine_id  UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_weekly_split_active
  ON public.weekly_split_rules (day_of_week, sort_order)
  WHERE is_active = TRUE;

CREATE TRIGGER trg_weekly_split_updated_at
  BEFORE UPDATE ON public.weekly_split_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. SCHEDULED_WORKOUTS (Specific calendar date assignments + rescheduling)
-- ============================================================================
CREATE TABLE public.scheduled_workouts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id           UUID NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  scheduled_date       DATE NOT NULL,
  status               public.schedule_status NOT NULL DEFAULT 'planned',
  workout_id           UUID REFERENCES public.workouts(id) ON DELETE SET NULL,
  source_split_rule_id UUID REFERENCES public.weekly_split_rules(id) ON DELETE SET NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_workouts_date
  ON public.scheduled_workouts (scheduled_date, status);

CREATE TRIGGER trg_scheduled_workouts_updated_at
  BEFORE UPDATE ON public.scheduled_workouts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 9. APP_SETTINGS (Single-row personal preferences, kg default)
-- ============================================================================
CREATE TABLE public.app_settings (
  id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  weight_unit           public.weight_unit NOT NULL DEFAULT 'kg',
  default_rest_seconds  INTEGER NOT NULL DEFAULT 90 CHECK (default_rest_seconds BETWEEN 0 AND 900),
  auto_start_rest_timer BOOLEAN NOT NULL DEFAULT TRUE,
  show_rpe_column       BOOLEAN NOT NULL DEFAULT TRUE,
  timer_sound_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
  timer_haptics_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (id) VALUES (1);

CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (DEFAULT DENY FOR ANON / PUBLIC BROWSER CLIENTS)
-- ============================================================================
ALTER TABLE public.sync_meta          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routine_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workouts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_split_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings       ENABLE ROW LEVEL SECURITY;
