import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getFullExportDataset } from "@/lib/cache/loaders";
import { toLocalDateString } from "@/lib/dates/localDate";
import { buildJsonBackup, buildWorkoutsCsv } from "@/lib/export/workoutExport";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const exportFormatSchema = z.enum(["json", "csv"]);

export async function GET(request: NextRequest) {
  const rawFormat = request.nextUrl.searchParams.get("format") ?? "json";
  const parsedFormat = exportFormatSchema.safeParse(rawFormat.toLowerCase());

  if (!parsedFormat.success) {
    return NextResponse.json(
      { error: "Invalid format. Expected 'json' or 'csv'." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const dataset = await getFullExportDataset();
    const dateStamp = toLocalDateString(new Date());

    if (parsedFormat.data === "csv") {
      const csv = buildWorkoutsCsv(dataset);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="pumped-workouts-${dateStamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const backup = buildJsonBackup(dataset);
    return new NextResponse(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="pumped-backup-${dateStamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to export workout data";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
