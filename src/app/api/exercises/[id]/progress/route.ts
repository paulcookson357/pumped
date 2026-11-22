import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getExerciseProgress } from "@/lib/cache/loaders";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const uuidSchema = z.string().uuid();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const parsed = uuidSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid exercise ID" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { progress: [] },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const progress = await getExerciseProgress(parsed.data);
    return NextResponse.json(
      { progress },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to load exercise progress";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
