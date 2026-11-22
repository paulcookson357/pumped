import { NextRequest, NextResponse } from "next/server";
import { getSyncVersions } from "@/lib/cache/loaders";
import { invalidateDomains } from "@/lib/cache/tags";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { SyncDomain } from "@/lib/types/domain";
import { syncMutateRequestSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = syncMutateRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }

  const supabase = getSupabaseAdmin();
  const touchedDomains = new Set<SyncDomain>();
  const appliedIds: string[] = [];

  try {
    for (const mutation of parsed.data.mutations) {
      switch (mutation.type) {
        case "CREATE_EXERCISE": {
          const { payload } = mutation;
          const { error } = await supabase.from("exercises").upsert(
            {
              id: payload.id,
              slug: null,
              name: payload.name,
              muscle_group: payload.muscle_group,
              secondary_muscles: payload.secondary_muscles,
              equipment: payload.equipment,
              tracking_type: payload.tracking_type,
              media_gif_url: null,
              media_image_start_url: payload.media_image_start_url,
              media_image_end_url: null,
              custom_video_url: payload.custom_video_url,
              instructions: payload.instructions,
              is_custom: true,
              archived_at: null,
            },
            { onConflict: "id" }
          );

          if (error) {
            const status = error.code === "23505" ? 409 : 500;
            return NextResponse.json(
              {
                error:
                  error.code === "23505"
                    ? `An exercise named "${payload.name}" already exists.`
                    : error.message,
              },
              { status }
            );
          }

          touchedDomains.add("exercises");
          appliedIds.push(mutation.id);
          break;
        }

        case "UPDATE_EXERCISE": {
          const { payload } = mutation;
          const { error } = await supabase
            .from("exercises")
            .update({
              name: payload.name,
              muscle_group: payload.muscle_group,
              secondary_muscles: payload.secondary_muscles,
              equipment: payload.equipment,
              tracking_type: payload.tracking_type,
              media_image_start_url: payload.media_image_start_url,
              custom_video_url: payload.custom_video_url,
              instructions: payload.instructions,
            })
            .eq("id", payload.id)
            .eq("is_custom", true);

          if (error) {
            const status = error.code === "23505" ? 409 : 500;
            return NextResponse.json(
              {
                error:
                  error.code === "23505"
                    ? `An exercise named "${payload.name}" already exists.`
                    : error.message,
              },
              { status }
            );
          }

          touchedDomains.add("exercises");
          appliedIds.push(mutation.id);
          break;
        }

        case "ARCHIVE_EXERCISE": {
          const { payload } = mutation;
          const { error } = await supabase
            .from("exercises")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", payload.id)
            .eq("is_custom", true);

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

          touchedDomains.add("exercises");
          appliedIds.push(mutation.id);
          break;
        }

        case "UPSERT_ROUTINE": {
          const { payload } = mutation;
          const { error: routineErr } = await supabase.from("routines").upsert(
            {
              id: payload.id,
              name: payload.name,
              color: payload.color,
              notes: payload.notes,
              sort_order: payload.sort_order,
              archived_at: null,
            },
            { onConflict: "id" }
          );

          if (routineErr) {
            return NextResponse.json(
              { error: routineErr.message },
              { status: 500 }
            );
          }

          const { error: deleteErr } = await supabase
            .from("routine_exercises")
            .delete()
            .eq("routine_id", payload.id);

          if (deleteErr) {
            return NextResponse.json(
              { error: deleteErr.message },
              { status: 500 }
            );
          }

          if (payload.exercises.length > 0) {
            const rows = payload.exercises.map((ex, index) => ({
              id: ex.id,
              routine_id: payload.id,
              exercise_id: ex.exercise_id,
              sort_order: index,
              superset_group: ex.superset_group,
              target_sets: ex.target_sets,
              target_reps_min: ex.target_reps_min,
              target_reps_max: ex.target_reps_max,
              target_rpe: ex.target_rpe,
              rest_seconds: ex.rest_seconds,
              notes: ex.notes,
            }));

            const { error: insertErr } = await supabase
              .from("routine_exercises")
              .insert(rows);

            if (insertErr) {
              return NextResponse.json(
                { error: insertErr.message },
                { status: 500 }
              );
            }
          }

          touchedDomains.add("routines");
          appliedIds.push(mutation.id);
          break;
        }

        case "REORDER_ROUTINES": {
          const { payload } = mutation;
          for (let i = 0; i < payload.orderedIds.length; i += 1) {
            const routineId = payload.orderedIds[i];
            if (!routineId) continue;
            const { error } = await supabase
              .from("routines")
              .update({ sort_order: i })
              .eq("id", routineId)
              .is("archived_at", null);

            if (error) {
              return NextResponse.json({ error: error.message }, { status: 500 });
            }
          }

          touchedDomains.add("routines");
          appliedIds.push(mutation.id);
          break;
        }

        case "ARCHIVE_ROUTINE": {
          const { payload } = mutation;
          const { error: archiveErr } = await supabase
            .from("routines")
            .update({ archived_at: new Date().toISOString() })
            .eq("id", payload.id);

          if (archiveErr) {
            return NextResponse.json(
              { error: archiveErr.message },
              { status: 500 }
            );
          }

          const { error: rulesErr } = await supabase
            .from("weekly_split_rules")
            .delete()
            .eq("routine_id", payload.id);

          if (rulesErr) {
            return NextResponse.json(
              { error: rulesErr.message },
              { status: 500 }
            );
          }

          const { error: schedErr } = await supabase
            .from("scheduled_workouts")
            .delete()
            .eq("routine_id", payload.id)
            .eq("status", "planned");

          if (schedErr) {
            return NextResponse.json(
              { error: schedErr.message },
              { status: 500 }
            );
          }

          touchedDomains.add("routines");
          touchedDomains.add("schedule");
          appliedIds.push(mutation.id);
          break;
        }

        case "SAVE_WEEKLY_SPLIT": {
          const { payload } = mutation;

          if (payload.removePlannedIds.length > 0) {
            const { error: delSchedErr } = await supabase
              .from("scheduled_workouts")
              .delete()
              .in("id", payload.removePlannedIds)
              .eq("status", "planned");

            if (delSchedErr) {
              return NextResponse.json(
                { error: delSchedErr.message },
                { status: 500 }
              );
            }
          }

          const { error: clearRulesErr } = await supabase
            .from("weekly_split_rules")
            .delete()
            .neq("id", "00000000-0000-0000-0000-000000000000");

          if (clearRulesErr) {
            return NextResponse.json(
              { error: clearRulesErr.message },
              { status: 500 }
            );
          }

          if (payload.rules.length > 0) {
            const { error: insertRulesErr } = await supabase
              .from("weekly_split_rules")
              .insert(
                payload.rules.map((r) => ({
                  id: r.id,
                  day_of_week: r.day_of_week,
                  routine_id: r.routine_id,
                  sort_order: r.sort_order,
                  is_active: r.is_active,
                }))
              );

            if (insertRulesErr) {
              return NextResponse.json(
                { error: insertRulesErr.message },
                { status: 500 }
              );
            }
          }

          if (payload.generatedWorkouts.length > 0) {
            const { error: insertSchedErr } = await supabase
              .from("scheduled_workouts")
              .upsert(
                payload.generatedWorkouts.map((sw) => ({
                  id: sw.id,
                  routine_id: sw.routine_id,
                  scheduled_date: sw.scheduled_date,
                  status: sw.status,
                  workout_id: sw.workout_id,
                  source_split_rule_id: sw.source_split_rule_id,
                  notes: sw.notes,
                })),
                { onConflict: "id" }
              );

            if (insertSchedErr) {
              return NextResponse.json(
                { error: insertSchedErr.message },
                { status: 500 }
              );
            }
          }

          touchedDomains.add("schedule");
          appliedIds.push(mutation.id);
          break;
        }

        case "UPSERT_SCHEDULED_WORKOUT": {
          const { payload } = mutation;
          const { error } = await supabase.from("scheduled_workouts").upsert(
            {
              id: payload.id,
              routine_id: payload.routine_id,
              scheduled_date: payload.scheduled_date,
              status: payload.status,
              workout_id: payload.workout_id,
              source_split_rule_id: payload.source_split_rule_id,
              notes: payload.notes,
            },
            { onConflict: "id" }
          );

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

          touchedDomains.add("schedule");
          appliedIds.push(mutation.id);
          break;
        }

        case "DELETE_SCHEDULED_WORKOUT": {
          const { payload } = mutation;
          const { error } = await supabase
            .from("scheduled_workouts")
            .delete()
            .eq("id", payload.id);

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

          touchedDomains.add("schedule");
          appliedIds.push(mutation.id);
          break;
        }
      }
    }

    const domainList = Array.from(touchedDomains);
    for (const domain of domainList) {
      const { error: bumpErr } = await supabase.rpc("bump_sync_domain", {
        p_domain: domain,
      });
      if (bumpErr) {
        return NextResponse.json({ error: bumpErr.message }, { status: 500 });
      }
    }

    invalidateDomains(domainList);
    const { versions } = await getSyncVersions();

    return NextResponse.json(
      {
        ok: true,
        appliedIds,
        versions,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to apply sync mutations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
