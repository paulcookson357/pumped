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
