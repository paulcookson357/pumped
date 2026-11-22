import Link from "next/link";
import { CalendarDays, Database, Settings } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default function CalendarHomePage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-0">
      <section className="pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Training Calendar
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Schedule strength workouts by date or repeating weekly split.
        </p>
      </section>

      <section className="-mx-4 border-t border-zinc-200 px-4 py-6 sm:-mx-6 sm:px-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-950">
              No workouts scheduled yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              Once routines and weekly splits are configured in Phase 3,
              today&apos;s scheduled training and monthly calendar will appear
              here.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/routines"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            View Routines
          </Link>
          <Link
            href="/exercises"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Browse Exercises
          </Link>
        </div>
      </section>

      <section className="-mx-4 flex items-center justify-between border-y border-zinc-200 px-4 py-3.5 sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2.5 text-sm text-zinc-700">
          <Database className="h-4 w-4 text-zinc-500" aria-hidden="true" />
          <span>Supabase Backend</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              configured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {configured ? "Configured" : "Not linked yet"}
          </span>
          <Link
            href="/settings"
            aria-label="Open Settings"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
