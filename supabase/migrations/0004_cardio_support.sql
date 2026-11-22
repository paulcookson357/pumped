-- Pumped: Add Cardio Muscle Group, Machine Equipment, Cardio Tracking, and Cardio Set Metrics

-- 1. Extend PostgreSQL enums
ALTER TYPE public.muscle_group ADD VALUE IF NOT EXISTS 'cardio';
ALTER TYPE public.equipment_type ADD VALUE IF NOT EXISTS 'cardio_machine';
ALTER TYPE public.tracking_type ADD VALUE IF NOT EXISTS 'cardio';

-- 2. Add nullable cardio telemetry columns to workout_sets
ALTER TABLE public.workout_sets
  ADD COLUMN IF NOT EXISTS distance NUMERIC(7, 2) CHECK (distance >= 0),
  ADD COLUMN IF NOT EXISTS speed NUMERIC(6, 2) CHECK (speed >= 0),
  ADD COLUMN IF NOT EXISTS resistance NUMERIC(6, 2) CHECK (resistance >= 0),
  ADD COLUMN IF NOT EXISTS incline NUMERIC(5, 2) CHECK (incline >= -15 AND incline <= 50);

-- 3. Update get_previous_exercise_sets RPC to return cardio telemetry fields
DROP FUNCTION IF EXISTS public.get_previous_exercise_sets(UUID[]);

CREATE OR REPLACE FUNCTION public.get_previous_exercise_sets(p_exercise_ids UUID[])
RETURNS TABLE (
  exercise_id      UUID,
  workout_id       UUID,
  set_number       SMALLINT,
  set_type         public.set_type,
  weight           NUMERIC,
  reps             SMALLINT,
  rpe              NUMERIC,
  duration_seconds INTEGER,
  distance         NUMERIC,
  speed            NUMERIC,
  resistance       NUMERIC,
  incline          NUMERIC,
  completed_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH latest_workouts AS (
    SELECT DISTINCT ON (ws.exercise_id)
      ws.exercise_id,
      w.id AS workout_id
    FROM public.workout_sets ws
    INNER JOIN public.workouts w ON w.id = ws.workout_id
    WHERE ws.exercise_id = ANY(p_exercise_ids)
      AND ws.is_completed = TRUE
      AND w.status = 'completed'
    ORDER BY ws.exercise_id, w.completed_at DESC, w.created_at DESC
  )
  SELECT
    ws.exercise_id,
    ws.workout_id,
    ws.set_number,
    ws.set_type,
    ws.weight,
    ws.reps,
    ws.rpe,
    ws.duration_seconds,
    ws.distance,
    ws.speed,
    ws.resistance,
    ws.incline,
    COALESCE(ws.completed_at, w.completed_at) AS completed_at
  FROM latest_workouts lw
  INNER JOIN public.workouts w ON w.id = lw.workout_id
  INNER JOIN public.workout_sets ws
    ON ws.workout_id = lw.workout_id
   AND ws.exercise_id = lw.exercise_id
   AND ws.is_completed = TRUE
  ORDER BY ws.exercise_id, ws.exercise_order ASC, ws.set_number ASC;
$$;

-- 4. Update get_exercise_progress RPC to aggregate cardio telemetry per session
DROP FUNCTION IF EXISTS public.get_exercise_progress(UUID);

CREATE OR REPLACE FUNCTION public.get_exercise_progress(p_exercise_id UUID)
RETURNS TABLE (
  workout_id              UUID,
  workout_name            TEXT,
  workout_date            DATE,
  completed_at            TIMESTAMPTZ,
  max_weight              NUMERIC,
  best_est_1rm            NUMERIC,
  total_volume            NUMERIC,
  best_set_weight         NUMERIC,
  best_set_reps           SMALLINT,
  total_duration_seconds  INTEGER,
  total_distance          NUMERIC,
  max_speed               NUMERIC,
  max_resistance          NUMERIC,
  max_incline             NUMERIC
)
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH working_sets AS (
    SELECT
      w.id AS workout_id,
      w.name AS workout_name,
      w.workout_date,
      w.completed_at,
      ws.weight,
      ws.reps,
      ws.duration_seconds,
      ws.distance,
      ws.speed,
      ws.resistance,
      ws.incline,
      ws.set_number,
      CASE
        WHEN ws.weight IS NULL OR ws.reps IS NULL OR ws.weight <= 0 OR ws.reps <= 0 THEN 0::NUMERIC
        WHEN ws.reps = 1 THEN ROUND(ws.weight, 2)
        ELSE ROUND(ws.weight * (1 + ws.reps / 30.0), 2)
      END AS est_1rm
    FROM public.workout_sets ws
    INNER JOIN public.workouts w ON w.id = ws.workout_id
    WHERE ws.exercise_id = p_exercise_id
      AND ws.is_completed = TRUE
      AND ws.set_type <> 'warmup'
      AND w.status = 'completed'
  ),
  ranked_sets AS (
    SELECT
      *,
      ROW_NUMBER() OVER (
        PARTITION BY workout_id
        ORDER BY est_1rm DESC, COALESCE(weight, 0) DESC, COALESCE(reps, 0) DESC, set_number ASC
      ) AS rn
    FROM working_sets
  )
  SELECT
    rs.workout_id,
    rs.workout_name,
    rs.workout_date,
    rs.completed_at,
    COALESCE(MAX(rs.weight), 0)::NUMERIC AS max_weight,
    COALESCE(MAX(rs.est_1rm), 0)::NUMERIC AS best_est_1rm,
    COALESCE(SUM(COALESCE(rs.weight, 0) * COALESCE(rs.reps, 0)), 0)::NUMERIC AS total_volume,
    MAX(CASE WHEN rs.rn = 1 THEN rs.weight END)::NUMERIC AS best_set_weight,
    MAX(CASE WHEN rs.rn = 1 THEN rs.reps END)::SMALLINT AS best_set_reps,
    COALESCE(SUM(COALESCE(rs.duration_seconds, 0)), 0)::INTEGER AS total_duration_seconds,
    ROUND(COALESCE(SUM(COALESCE(rs.distance, 0)), 0), 2)::NUMERIC AS total_distance,
    ROUND(COALESCE(MAX(rs.speed), 0), 2)::NUMERIC AS max_speed,
    ROUND(COALESCE(MAX(rs.resistance), 0), 2)::NUMERIC AS max_resistance,
    ROUND(COALESCE(MAX(rs.incline), 0), 2)::NUMERIC AS max_incline
  FROM ranked_sets rs
  GROUP BY rs.workout_id, rs.workout_name, rs.workout_date, rs.completed_at
  ORDER BY rs.workout_date ASC, rs.completed_at ASC;
$$;
