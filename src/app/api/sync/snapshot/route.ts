import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  getCachedExercises,
  getCachedRoutines,
  getCachedSchedule,
  getCachedSettings,
  getCachedWorkouts,
  getSyncVersions,
} from "@/lib/cache/loaders";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import type { SyncDomain } from "@/lib/types/domain";
import { syncDomainSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

const ALL_DOMAINS: SyncDomain[] = [
  "exercises",
  "routines",
  "schedule",
  "workouts",
  "settings",
];

const domainsQuerySchema = z.array(syncDomainSchema).min(1);

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const rawParam = request.nextUrl.searchParams.get("domains");
  let requestedDomains: SyncDomain[] = ALL_DOMAINS;

  if (rawParam !== null && rawParam.trim().length > 0) {
    const parsed = domainsQuerySchema.safeParse(
      rawParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid domains query parameter" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    requestedDomains = Array.from(new Set(parsed.data));
  }

  try {
    const domainSet = new Set<SyncDomain>(requestedDomains);
    const [versionsPayload, exercises, routines, schedule, workouts, settings] =
      await Promise.all([
        getSyncVersions(),
        domainSet.has("exercises") ? getCachedExercises() : Promise.resolve(undefined),
        domainSet.has("routines") ? getCachedRoutines() : Promise.resolve(undefined),
        domainSet.has("schedule") ? getCachedSchedule() : Promise.resolve(undefined),
        domainSet.has("workouts") ? getCachedWorkouts() : Promise.resolve(undefined),
        domainSet.has("settings") ? getCachedSettings() : Promise.resolve(undefined),
      ]);

    return NextResponse.json(
      {
        versions: versionsPayload.versions,
        updatedAt: versionsPayload.updatedAt,
        data: {
          ...(exercises !== undefined ? { exercises } : {}),
          ...(routines !== undefined ? { routines } : {}),
          ...(schedule !== undefined ? { schedule } : {}),
          ...(workouts !== undefined ? { workouts } : {}),
          ...(settings !== undefined ? { settings } : {}),
        },
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch sync snapshot";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
