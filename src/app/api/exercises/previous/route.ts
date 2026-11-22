import { NextRequest, NextResponse } from "next/server";
import type { PreviousPerformanceRecord } from "@/lib/offline/db";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/server";
import type { SetType } from "@/lib/types/domain";
import { previousExerciseSetsRequestSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

interface PreviousRpcRow {
  exercise_id: string;
  workout_id: string;
  set_number: number;
  set_type: SetType;
  weight: number | string | null;
  reps: number | null;
  rpe: number | string | null;
  duration_seconds: number | null;
  distance: number | string | null;
  speed: number | string | null;
  resistance: number | string | null;
  incline: number | string | null;
  completed_at: string | null;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { previous: {} },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = previousExerciseSetsRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const uniqueIds = Array.from(new Set(parsed.data.exerciseIds));
    const { data, error } = await supabase.rpc("get_previous_exercise_sets", {
      p_exercise_ids: uniqueIds,
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    const previous: Record<string, PreviousPerformanceRecord> = {};
    for (const row of (data ?? []) as PreviousRpcRow[]) {
      let existing = previous[row.exercise_id];
      if (!existing) {
        existing = {
          exercise_id: row.exercise_id,
          workout_id: row.workout_id,
          sets: [],
          updated_at: row.completed_at ?? new Date().toISOString(),
        };
        previous[row.exercise_id] = existing;
      }

      existing.sets.push({
        set_number: Number(row.set_number),
        set_type: row.set_type,
        weight: row.weight !== null ? Number(row.weight) : null,
        reps: row.reps !== null ? Number(row.reps) : null,
        rpe: row.rpe !== null ? Number(row.rpe) : null,
        duration_seconds:
          row.duration_seconds !== null ? Number(row.duration_seconds) : null,
        distance:
          row.distance !== null && row.distance !== undefined
            ? Number(row.distance)
            : null,
        speed:
          row.speed !== null && row.speed !== undefined
            ? Number(row.speed)
            : null,
        resistance:
          row.resistance !== null && row.resistance !== undefined
            ? Number(row.resistance)
            : null,
        incline:
          row.incline !== null && row.incline !== undefined
            ? Number(row.incline)
            : null,
      });
    }

    return NextResponse.json(
      { previous },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load previous exercise sets";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
