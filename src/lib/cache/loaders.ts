import "server-only";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  SyncDomain,
  SyncMeta,
  WeeklySplitRule,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";
import type { ExerciseProgressPoint } from "@/lib/workouts/progress";

export interface SyncVersionsPayload {
  versions: Record<SyncDomain, number>;
  updatedAt: Record<SyncDomain, string>;
}

const DEFAULT_VERSIONS: Record<SyncDomain, number> = {
  exercises: 1,
  routines: 1,
  schedule: 1,
  workouts: 1,
  settings: 1,
};

const DEFAULT_UPDATED_AT: Record<SyncDomain, string> = {
  exercises: "",
  routines: "",
  schedule: "",
  workouts: "",
  settings: "",
};

export async function getSyncVersions(): Promise<SyncVersionsPayload> {
  if (!isSupabaseConfigured()) {
    return {
      versions: { ...DEFAULT_VERSIONS },
      updatedAt: { ...DEFAULT_UPDATED_AT },
    };
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("sync_meta")
    .select("domain, version, updated_at");

  if (error) {
    throw new Error(`Failed to fetch sync_meta: ${error.message}`);
  }

  const versions: Record<SyncDomain, number> = { ...DEFAULT_VERSIONS };
  const updatedAt: Record<SyncDomain, string> = { ...DEFAULT_UPDATED_AT };

  for (const row of (data ?? []) as SyncMeta[]) {
    versions[row.domain] = Number(row.version);
    updatedAt[row.domain] = row.updated_at;
  }

  return { versions, updatedAt };
}

const fetchCachedExercises = unstable_cache(
  async (version: number): Promise<Exercise[]> => {
    void version;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("exercises")
      .select("*")
      .is("archived_at", null)
      .order("is_custom", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch exercises: ${error.message}`);
    }

    return (data ?? []) as Exercise[];
  },
  ["pumped-exercises-list-v2"],
  { tags: [CACHE_TAGS.exercises] }
);

export async function getCachedExercises(
  version?: number
): Promise<Exercise[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }
  const resolvedVersion =
    version ?? (await getSyncVersions()).versions.exercises;
  return fetchCachedExercises(resolvedVersion);
}

const fetchCachedRoutines = unstable_cache(
  async (
    version: number
  ): Promise<{
    routines: Routine[];
    routineExercises: RoutineExercise[];
  }> => {
    void version;
    const supabase = getSupabaseAdmin();
    const [routinesRes, routineExercisesRes] = await Promise.all([
      supabase
        .from("routines")
        .select("*")
        .is("archived_at", null)
        .order("sort_order", { ascending: true }),
      supabase
        .from("routine_exercises")
        .select("*")
        .order("sort_order", { ascending: true }),
    ]);

    if (routinesRes.error) {
      throw new Error(`Failed to fetch routines: ${routinesRes.error.message}`);
    }
    if (routineExercisesRes.error) {
      throw new Error(
        `Failed to fetch routine_exercises: ${routineExercisesRes.error.message}`
      );
    }

    const routines = (routinesRes.data ?? []) as Routine[];
    const activeIds = new Set(routines.map((r) => r.id));
    const routineExercises = (
      (routineExercisesRes.data ?? []) as RoutineExercise[]
    ).filter((re) => activeIds.has(re.routine_id));

    return {
      routines,
      routineExercises,
    };
  },
  ["pumped-routines-bundle-v2"],
  { tags: [CACHE_TAGS.routines] }
);

export async function getCachedRoutines(version?: number): Promise<{
  routines: Routine[];
  routineExercises: RoutineExercise[];
}> {
  if (!isSupabaseConfigured()) {
    return { routines: [], routineExercises: [] };
  }
  const resolvedVersion =
    version ?? (await getSyncVersions()).versions.routines;
  return fetchCachedRoutines(resolvedVersion);
}

const fetchCachedSchedule = unstable_cache(
  async (
    version: number
  ): Promise<{
    weeklySplitRules: WeeklySplitRule[];
    scheduledWorkouts: ScheduledWorkout[];
  }> => {
    void version;
    const supabase = getSupabaseAdmin();
    const [rulesRes, scheduledRes] = await Promise.all([
      supabase
        .from("weekly_split_rules")
        .select("*")
        .eq("is_active", true)
        .order("day_of_week", { ascending: true })
        .order("sort_order", { ascending: true }),
      supabase
        .from("scheduled_workouts")
        .select("*")
        .order("scheduled_date", { ascending: true }),
    ]);

    if (rulesRes.error) {
      throw new Error(
        `Failed to fetch weekly_split_rules: ${rulesRes.error.message}`
      );
    }
    if (scheduledRes.error) {
      throw new Error(
        `Failed to fetch scheduled_workouts: ${scheduledRes.error.message}`
      );
    }

    return {
      weeklySplitRules: (rulesRes.data ?? []) as WeeklySplitRule[],
      scheduledWorkouts: (scheduledRes.data ?? []) as ScheduledWorkout[],
    };
  },
  ["pumped-schedule-bundle-v2"],
  { tags: [CACHE_TAGS.schedule] }
);

export async function getCachedSchedule(version?: number): Promise<{
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
}> {
  if (!isSupabaseConfigured()) {
    return { weeklySplitRules: [], scheduledWorkouts: [] };
  }
  const resolvedVersion =
    version ?? (await getSyncVersions()).versions.schedule;
  return fetchCachedSchedule(resolvedVersion);
}

const fetchCachedWorkouts = unstable_cache(
  async (
    version: number
  ): Promise<{
    workouts: Workout[];
    workoutSets: WorkoutSet[];
  }> => {
    void version;
    const supabase = getSupabaseAdmin();
    const { data: workoutsData, error: workoutsErr } = await supabase
      .from("workouts")
      .select("*")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(200);

    if (workoutsErr) {
      throw new Error(`Failed to fetch workouts: ${workoutsErr.message}`);
    }

    const workouts = ((workoutsData ?? []) as Workout[]).map(
      normalizeWorkoutNumeric
    );
    if (workouts.length === 0) {
      return { workouts: [], workoutSets: [] };
    }

    const workoutIds = workouts.map((w) => w.id);
    const { data: setsData, error: setsErr } = await supabase
      .from("workout_sets")
      .select("*")
      .in("workout_id", workoutIds)
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true });

    if (setsErr) {
      throw new Error(`Failed to fetch workout_sets: ${setsErr.message}`);
    }

    return {
      workouts,
      workoutSets: ((setsData ?? []) as WorkoutSet[]).map(
        normalizeWorkoutSetNumeric
      ),
    };
  },
  ["pumped-workouts-bundle-v2"],
  { tags: [CACHE_TAGS.workouts] }
);

export async function getCachedWorkouts(version?: number): Promise<{
  workouts: Workout[];
  workoutSets: WorkoutSet[];
}> {
  if (!isSupabaseConfigured()) {
    return { workouts: [], workoutSets: [] };
  }
  const resolvedVersion =
    version ?? (await getSyncVersions()).versions.workouts;
  return fetchCachedWorkouts(resolvedVersion);
}

const fetchCachedSettings = unstable_cache(
  async (version: number): Promise<AppSettings | null> => {
    void version;
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch app_settings: ${error.message}`);
    }

    return (data as AppSettings | null) ?? null;
  },
  ["pumped-app-settings-v2"],
  { tags: [CACHE_TAGS.settings] }
);

export async function getCachedSettings(
  version?: number
): Promise<AppSettings | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const resolvedVersion =
    version ?? (await getSyncVersions()).versions.settings;
  return fetchCachedSettings(resolvedVersion);
}

const uuidSchema = z.string().uuid();

function normalizeWorkoutNumeric(raw: Workout): Workout {
  return {
    ...raw,
    total_volume: Number(raw.total_volume ?? 0),
    total_sets: Number(raw.total_sets ?? 0),
    pr_count: Number(raw.pr_count ?? 0),
    duration_seconds:
      raw.duration_seconds !== null ? Number(raw.duration_seconds) : null,
  };
}

function normalizeWorkoutSetNumeric(raw: WorkoutSet): WorkoutSet {
  return {
    ...raw,
    exercise_order: Number(raw.exercise_order),
    superset_group:
      raw.superset_group !== null ? Number(raw.superset_group) : null,
    set_number: Number(raw.set_number),
    weight: raw.weight !== null ? Number(raw.weight) : null,
    reps: raw.reps !== null ? Number(raw.reps) : null,
    rpe: raw.rpe !== null ? Number(raw.rpe) : null,
    duration_seconds:
      raw.duration_seconds !== null ? Number(raw.duration_seconds) : null,
    rest_seconds: raw.rest_seconds !== null ? Number(raw.rest_seconds) : null,
  };
}

export async function getWorkoutById(
  workoutId: string
): Promise<{ workout: Workout; sets: WorkoutSet[] } | null> {
  if (!isSupabaseConfigured() || !uuidSchema.safeParse(workoutId).success) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const [workoutRes, setsRes] = await Promise.all([
    supabase
      .from("workouts")
      .select("*")
      .eq("id", workoutId)
      .eq("status", "completed")
      .maybeSingle(),
    supabase
      .from("workout_sets")
      .select("*")
      .eq("workout_id", workoutId)
      .order("exercise_order", { ascending: true })
      .order("set_number", { ascending: true }),
  ]);

  if (workoutRes.error) {
    throw new Error(`Failed to fetch workout: ${workoutRes.error.message}`);
  }
  if (setsRes.error) {
    throw new Error(`Failed to fetch workout sets: ${setsRes.error.message}`);
  }

  if (!workoutRes.data) {
    return null;
  }

  return {
    workout: normalizeWorkoutNumeric(workoutRes.data as Workout),
    sets: ((setsRes.data ?? []) as WorkoutSet[]).map(normalizeWorkoutSetNumeric),
  };
}

interface ExerciseProgressRpcRow {
  workout_id: string;
  workout_name: string;
  workout_date: string;
  completed_at: string | null;
  max_weight: number | string;
  best_est_1rm: number | string;
  total_volume: number | string;
  best_set_weight: number | string | null;
  best_set_reps: number | null;
}

export async function getExerciseProgress(
  exerciseId: string
): Promise<ExerciseProgressPoint[]> {
  if (!isSupabaseConfigured() || !uuidSchema.safeParse(exerciseId).success) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("get_exercise_progress", {
    p_exercise_id: exerciseId,
  });

  if (error) {
    throw new Error(`Failed to fetch exercise progress: ${error.message}`);
  }

  return ((data ?? []) as ExerciseProgressRpcRow[]).map((row) => ({
    workout_id: row.workout_id,
    workout_name: row.workout_name,
    workout_date: row.workout_date,
    completed_at: row.completed_at ?? `${row.workout_date}T12:00:00.000Z`,
    max_weight: Number(row.max_weight ?? 0),
    best_est_1rm: Number(row.best_est_1rm ?? 0),
    total_volume: Number(row.total_volume ?? 0),
    best_set_weight:
      row.best_set_weight !== null ? Number(row.best_set_weight) : null,
    best_set_reps:
      row.best_set_reps !== null ? Number(row.best_set_reps) : null,
  }));
}
