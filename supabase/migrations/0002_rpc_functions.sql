-- Pumped: Authoritative PostgreSQL RPC Functions

-- ============================================================================
-- 1. GET PREVIOUS EXERCISE SETS
-- Returns all completed sets from the most recent completed workout per exercise
-- ============================================================================
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
  completed_at     TIMESTAMPTZ
)
LANGUAGE sql
STABLE
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
    COALESCE(ws.completed_at, w.completed_at) AS completed_at
  FROM latest_workouts lw
  INNER JOIN public.workouts w ON w.id = lw.workout_id
  INNER JOIN public.workout_sets ws
    ON ws.workout_id = lw.workout_id
   AND ws.exercise_id = lw.exercise_id
   AND ws.is_completed = TRUE
  ORDER BY ws.exercise_id, ws.exercise_order ASC, ws.set_number ASC;
$$;

-- ============================================================================
-- 2. GET EXERCISE PROGRESS
-- Aggregates completed sessions into chronological Max Weight, Epley Est. 1RM,
-- Total Working Volume, and Best Set per workout (excluding warmup sets)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_exercise_progress(p_exercise_id UUID)
RETURNS TABLE (
  workout_id      UUID,
  workout_name    TEXT,
  workout_date    DATE,
  completed_at    TIMESTAMPTZ,
  max_weight      NUMERIC,
  best_est_1rm    NUMERIC,
  total_volume    NUMERIC,
  best_set_weight NUMERIC,
  best_set_reps   SMALLINT
)
LANGUAGE sql
STABLE
AS $$
  WITH working_sets AS (
    SELECT
      w.id AS workout_id,
      w.name AS workout_name,
      w.workout_date,
      w.completed_at,
      ws.weight,
      ws.reps,
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
    MAX(CASE WHEN rs.rn = 1 THEN rs.reps END)::SMALLINT AS best_set_reps
  FROM ranked_sets rs
  GROUP BY rs.workout_id, rs.workout_name, rs.workout_date, rs.completed_at
  ORDER BY rs.workout_date ASC, rs.completed_at ASC;
$$;

-- ============================================================================
-- 3. FINALIZE WORKOUT STATS
-- Prunes uncompleted sets, recalculates authoritative PRs against strictly
-- earlier completed workouts, updates totals & routine timestamp, marks
-- optional scheduled workout completed, and bumps sync_meta watermarks
-- ============================================================================
CREATE OR REPLACE FUNCTION public.finalize_workout_stats(
  p_workout_id UUID,
  p_scheduled_workout_id UUID DEFAULT NULL
)
RETURNS public.workouts
LANGUAGE plpgsql
AS $$
DECLARE
  v_workout         public.workouts%ROWTYPE;
  v_completed_at    TIMESTAMPTZ;
  v_duration        INTEGER;
  v_total_volume    NUMERIC(12, 2);
  v_total_sets      INTEGER;
  v_pr_count        SMALLINT;
  v_exercise_rec    RECORD;
  v_prior_max_wt    NUMERIC;
  v_prior_max_1rm   NUMERIC;
  v_prior_max_vol   NUMERIC;
  v_best_wt_set_id  UUID;
  v_best_1rm_set_id UUID;
  v_best_vol_set_id UUID;
BEGIN
  SELECT * INTO v_workout
  FROM public.workouts
  WHERE id = p_workout_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workout % not found', p_workout_id;
  END IF;

  -- Remove uncompleted template/draft sets
  DELETE FROM public.workout_sets
  WHERE workout_id = p_workout_id
    AND is_completed = FALSE;

  v_completed_at := COALESCE(v_workout.completed_at, now());
  v_duration := COALESCE(
    v_workout.duration_seconds,
    GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (v_completed_at - v_workout.started_at)))::INTEGER)
  );

  -- Reset PR flags cleanly before recomputing
  UPDATE public.workout_sets
  SET is_pr_weight = FALSE,
      is_pr_1rm = FALSE,
      is_pr_volume = FALSE
  WHERE workout_id = p_workout_id;

  -- Evaluate each exercise in this workout against strictly earlier completed workouts
  FOR v_exercise_rec IN
    SELECT DISTINCT exercise_id
    FROM public.workout_sets
    WHERE workout_id = p_workout_id
      AND is_completed = TRUE
      AND set_type <> 'warmup'
  LOOP
    SELECT
      COALESCE(MAX(ws2.weight), 0),
      COALESCE(MAX(
        CASE
          WHEN ws2.weight IS NULL OR ws2.reps IS NULL OR ws2.weight <= 0 OR ws2.reps <= 0 THEN 0
          WHEN ws2.reps = 1 THEN ROUND(ws2.weight, 2)
          ELSE ROUND(ws2.weight * (1 + ws2.reps / 30.0), 2)
        END
      ), 0),
      COALESCE(MAX(COALESCE(ws2.weight, 0) * COALESCE(ws2.reps, 0)), 0)
    INTO v_prior_max_wt, v_prior_max_1rm, v_prior_max_vol
    FROM public.workout_sets ws2
    INNER JOIN public.workouts w2 ON w2.id = ws2.workout_id
    WHERE ws2.exercise_id = v_exercise_rec.exercise_id
      AND ws2.is_completed = TRUE
      AND ws2.set_type <> 'warmup'
      AND w2.status = 'completed'
      AND w2.id <> p_workout_id
      AND (
        w2.completed_at < v_completed_at
        OR (w2.completed_at = v_completed_at AND w2.created_at < v_workout.created_at)
      );

    -- Best Weight PR set in this workout
    SELECT ws.id INTO v_best_wt_set_id
    FROM public.workout_sets ws
    WHERE ws.workout_id = p_workout_id
      AND ws.exercise_id = v_exercise_rec.exercise_id
      AND ws.is_completed = TRUE
      AND ws.set_type <> 'warmup'
      AND COALESCE(ws.weight, 0) > 0
      AND ws.weight > v_prior_max_wt
    ORDER BY ws.weight DESC, COALESCE(ws.reps, 0) DESC, ws.set_number ASC
    LIMIT 1;

    IF v_best_wt_set_id IS NOT NULL THEN
      UPDATE public.workout_sets SET is_pr_weight = TRUE WHERE id = v_best_wt_set_id;
    END IF;

    -- Best Estimated 1RM PR set in this workout
    SELECT ws.id INTO v_best_1rm_set_id
    FROM public.workout_sets ws
    WHERE ws.workout_id = p_workout_id
      AND ws.exercise_id = v_exercise_rec.exercise_id
      AND ws.is_completed = TRUE
      AND ws.set_type <> 'warmup'
      AND COALESCE(ws.weight, 0) > 0
      AND COALESCE(ws.reps, 0) > 0
      AND (
        CASE
          WHEN ws.reps = 1 THEN ROUND(ws.weight, 2)
          ELSE ROUND(ws.weight * (1 + ws.reps / 30.0), 2)
        END
      ) > v_prior_max_1rm
    ORDER BY (
      CASE
        WHEN ws.reps = 1 THEN ROUND(ws.weight, 2)
        ELSE ROUND(ws.weight * (1 + ws.reps / 30.0), 2)
      END
    ) DESC, ws.set_number ASC
    LIMIT 1;

    IF v_best_1rm_set_id IS NOT NULL THEN
      UPDATE public.workout_sets SET is_pr_1rm = TRUE WHERE id = v_best_1rm_set_id;
    END IF;

    -- Best Single-Set Volume PR in this workout
    SELECT ws.id INTO v_best_vol_set_id
    FROM public.workout_sets ws
    WHERE ws.workout_id = p_workout_id
      AND ws.exercise_id = v_exercise_rec.exercise_id
      AND ws.is_completed = TRUE
      AND ws.set_type <> 'warmup'
      AND COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0) > 0
      AND (COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)) > v_prior_max_vol
    ORDER BY (COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)) DESC, ws.set_number ASC
    LIMIT 1;

    IF v_best_vol_set_id IS NOT NULL THEN
      UPDATE public.workout_sets SET is_pr_volume = TRUE WHERE id = v_best_vol_set_id;
    END IF;
  END LOOP;

  -- Aggregate workout totals (working sets only for volume; all completed sets for set count)
  SELECT
    COALESCE(SUM(
      CASE
        WHEN set_type <> 'warmup' THEN COALESCE(weight, 0) * COALESCE(reps, 0)
        ELSE 0
      END
    ), 0)::NUMERIC(12, 2),
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE is_pr_weight OR is_pr_1rm OR is_pr_volume)::SMALLINT
  INTO v_total_volume, v_total_sets, v_pr_count
  FROM public.workout_sets
  WHERE workout_id = p_workout_id
    AND is_completed = TRUE;

  UPDATE public.workouts
  SET status = 'completed',
      completed_at = v_completed_at,
      duration_seconds = v_duration,
      total_volume = v_total_volume,
      total_sets = v_total_sets,
      pr_count = v_pr_count
  WHERE id = p_workout_id
  RETURNING * INTO v_workout;

  IF v_workout.routine_id IS NOT NULL THEN
    UPDATE public.routines
    SET last_performed_at = GREATEST(COALESCE(last_performed_at, v_completed_at), v_completed_at)
    WHERE id = v_workout.routine_id;

    PERFORM public.bump_sync_domain('routines');
  END IF;

  IF p_scheduled_workout_id IS NOT NULL THEN
    UPDATE public.scheduled_workouts
    SET status = 'completed',
        workout_id = p_workout_id
    WHERE id = p_scheduled_workout_id;

    PERFORM public.bump_sync_domain('schedule');
  END IF;

  PERFORM public.bump_sync_domain('workouts');

  RETURN v_workout;
END;
$$;
