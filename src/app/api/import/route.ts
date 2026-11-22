import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSyncVersions } from "@/lib/cache/loaders";
import { invalidateDomains } from "@/lib/cache/tags";
import {
  buildBackupImportSummary,
  buildExerciseIdRemap,
  pumpedJsonBackupSchema,
  remapBackupData,
  validateBackupIntegrity,
  type ExistingExerciseRef,
} from "@/lib/export/workoutImport";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { SyncDomain } from "@/lib/types/domain";

export const dynamic = "force-dynamic";

const ALL_DOMAINS: SyncDomain[] = [
  "exercises",
  "routines",
  "schedule",
  "workouts",
  "settings",
];

function chunkArray<T>(items: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fetchExistingExercises(
  supabase: SupabaseClient
): Promise<ExistingExerciseRef[]> {
  const pageSize = 1000;
  const rows: ExistingExerciseRef[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("exercises")
      .select("id, slug, name, is_custom, archived_at")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to read existing exercises: ${error.message}`);
    }

    const batch = (data ?? []) as ExistingExerciseRef[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

async function fetchExistingIdSet(
  supabase: SupabaseClient,
  table: "weekly_split_rules" | "workouts"
): Promise<Set<string>> {
  const pageSize = 1000;
  const ids = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(`Failed to read existing ${table}: ${error.message}`);
    }

    const batch = (data ?? []) as Array<{ id: string }>;
    for (const row of batch) {
      ids.add(row.id);
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = pumpedJsonBackupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid Pumped v1 backup payload",
        details: parsed.error.flatten(),
      },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const integrityError = validateBackupIntegrity(parsed.data);
  if (integrityError) {
    return NextResponse.json(
      { error: integrityError },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getSupabaseAdmin();

  try {
    const [existingExercises, existingRuleIds, existingWorkoutIds] =
      await Promise.all([
        fetchExistingExercises(supabase),
        fetchExistingIdSet(supabase, "weekly_split_rules"),
        fetchExistingIdSet(supabase, "workouts"),
      ]);

    const { idMap, exercisesToUpsert } = buildExerciseIdRemap(
      parsed.data.data.exercises,
      existingExercises
    );
    const data = remapBackupData(parsed.data.data, idMap);

    // 1. Upsert unmatched or matching custom exercises
    for (const batch of chunkArray(exercisesToUpsert)) {
      const { error } = await supabase.from("exercises").upsert(
        batch.map((ex) => ({
          id: ex.id,
          slug: ex.slug,
          name: ex.name,
          muscle_group: ex.muscle_group,
          secondary_muscles: ex.secondary_muscles,
          equipment: ex.equipment,
          tracking_type: ex.tracking_type,
          media_gif_url: ex.media_gif_url,
          media_image_start_url: ex.media_image_start_url,
          media_image_end_url: ex.media_image_end_url,
          custom_video_url: ex.custom_video_url,
          instructions: ex.instructions,
          is_custom: ex.is_custom,
          archived_at: ex.archived_at,
        })),
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Exercise import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 2. Upsert routines
    for (const batch of chunkArray(data.routines)) {
      const { error } = await supabase.from("routines").upsert(
        batch.map((r) => ({
          id: r.id,
          name: r.name,
          color: r.color,
          notes: r.notes,
          sort_order: r.sort_order,
          last_performed_at: r.last_performed_at,
          archived_at: r.archived_at,
        })),
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Routine import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 3. Replace routine_exercises for imported routines
    const importedRoutineIds = data.routines.map((r) => r.id);
    for (const idBatch of chunkArray(importedRoutineIds)) {
      const { error } = await supabase
        .from("routine_exercises")
        .delete()
        .in("routine_id", idBatch);
      if (error) {
        return NextResponse.json(
          { error: `Routine exercise cleanup failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    for (const batch of chunkArray(data.routineExercises)) {
      const { error } = await supabase.from("routine_exercises").insert(
        batch.map((re) => ({
          id: re.id,
          routine_id: re.routine_id,
          exercise_id: re.exercise_id,
          sort_order: re.sort_order,
          superset_group: re.superset_group,
          target_sets: re.target_sets,
          target_reps_min: re.target_reps_min,
          target_reps_max: re.target_reps_max,
          target_rpe: re.target_rpe,
          rest_seconds: re.rest_seconds,
          notes: re.notes,
        }))
      );
      if (error) {
        return NextResponse.json(
          { error: `Routine exercise insert failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 4. Upsert weekly split rules
    for (const batch of chunkArray(data.weeklySplitRules)) {
      const { error } = await supabase.from("weekly_split_rules").upsert(
        batch.map((rule) => {
          existingRuleIds.add(rule.id);
          return {
            id: rule.id,
            day_of_week: rule.day_of_week,
            routine_id: rule.routine_id,
            sort_order: rule.sort_order,
            is_active: rule.is_active,
          };
        }),
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Weekly split import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 5. Upsert completed workouts
    const nowIso = new Date().toISOString();
    for (const batch of chunkArray(data.workouts)) {
      const { error } = await supabase.from("workouts").upsert(
        batch.map((w) => {
          existingWorkoutIds.add(w.id);
          return {
            id: w.id,
            routine_id: w.routine_id,
            name: w.name,
            notes: w.notes,
            status: "completed" as const,
            workout_date: w.workout_date,
            started_at: w.started_at,
            completed_at: w.completed_at,
            duration_seconds: w.duration_seconds,
            weight_unit: w.weight_unit,
            total_volume: w.total_volume,
            total_sets: w.total_sets,
            pr_count: w.pr_count,
            client_updated_at: w.client_updated_at ?? nowIso,
          };
        }),
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Workout import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 6. Replace workout_sets for imported workouts
    const importedWorkoutIds = data.workouts.map((w) => w.id);
    for (const idBatch of chunkArray(importedWorkoutIds)) {
      const { error } = await supabase
        .from("workout_sets")
        .delete()
        .in("workout_id", idBatch);
      if (error) {
        return NextResponse.json(
          { error: `Workout sets cleanup failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    for (const batch of chunkArray(data.workoutSets)) {
      const { error } = await supabase.from("workout_sets").insert(
        batch.map((ws) => ({
          id: ws.id,
          workout_id: ws.workout_id,
          exercise_id: ws.exercise_id,
          exercise_order: ws.exercise_order,
          superset_group: ws.superset_group,
          set_number: ws.set_number,
          set_type: ws.set_type,
          weight: ws.weight,
          reps: ws.reps,
          rpe: ws.rpe,
          duration_seconds: ws.duration_seconds,
          distance: ws.distance,
          speed: ws.speed,
          resistance: ws.resistance,
          incline: ws.incline,
          rest_seconds: ws.rest_seconds,
          is_completed: ws.is_completed,
          completed_at: ws.completed_at,
          is_pr_weight: ws.is_pr_weight,
          is_pr_1rm: ws.is_pr_1rm,
          is_pr_volume: ws.is_pr_volume,
          notes: ws.notes,
          client_updated_at: ws.client_updated_at ?? nowIso,
        }))
      );
      if (error) {
        return NextResponse.json(
          { error: `Workout sets insert failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 7. Upsert scheduled workouts safely (null optional FK refs if missing)
    for (const batch of chunkArray(data.scheduledWorkouts)) {
      const { error } = await supabase.from("scheduled_workouts").upsert(
        batch.map((sw) => ({
          id: sw.id,
          routine_id: sw.routine_id,
          scheduled_date: sw.scheduled_date,
          status: sw.status,
          workout_id:
            sw.workout_id && existingWorkoutIds.has(sw.workout_id)
              ? sw.workout_id
              : null,
          source_split_rule_id:
            sw.source_split_rule_id && existingRuleIds.has(sw.source_split_rule_id)
              ? sw.source_split_rule_id
              : null,
          notes: sw.notes,
        })),
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Scheduled workouts import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    // 8. Upsert settings if included
    if (data.settings) {
      const { error } = await supabase.from("app_settings").upsert(
        {
          id: 1,
          ...data.settings,
        },
        { onConflict: "id" }
      );
      if (error) {
        return NextResponse.json(
          { error: `Settings import failed: ${error.message}` },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    for (const domain of ALL_DOMAINS) {
      const { error: bumpErr } = await supabase.rpc("bump_sync_domain", {
        p_domain: domain,
      });
      if (bumpErr) {
        return NextResponse.json(
          { error: bumpErr.message },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
    }

    invalidateDomains(ALL_DOMAINS);
    const { versions } = await getSyncVersions();

    return NextResponse.json(
      {
        ok: true,
        imported: buildBackupImportSummary(parsed.data),
        versions,
      },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to import backup JSON";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
