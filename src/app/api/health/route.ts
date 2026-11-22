import { NextResponse } from "next/server";
import { getSyncVersions } from "@/lib/cache/loaders";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        ok: true,
        supabase: "unconfigured",
        timestamp,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const { versions } = await getSyncVersions();
    return NextResponse.json(
      {
        ok: true,
        supabase: "connected",
        versions,
        timestamp,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Database healthcheck failed";
    return NextResponse.json(
      {
        ok: false,
        supabase: "error",
        error: message,
        timestamp,
      },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
