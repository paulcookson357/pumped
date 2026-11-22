import Link from "next/link";
import { CalendarDays, Database, Settings } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default function CalendarHomePage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Training Calendar
        </h1>
        <p className="text-sm text-zinc-400">
          Schedule strength workouts by date or repeating weekly split.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#111114] p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-zinc-100">
              No workouts scheduled yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Once your Supabase project is linked and routines are created,
              today&apos;s scheduled training and monthly calendar will appear
              here automatically.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3 border-t border-zinc-800/80 pt-4">
          <Link
            href="/routines"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
          >
            View Routines
          </Link>
          <Link
            href="/settings"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>Check Settings</span>
          </Link>
        </div>
      </section>

      <section className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-[#111114] px-4 py-3.5">
        <div className="flex items-center gap-2.5 text-sm text-zinc-300">
          <Database className="h-4 w-4 text-zinc-400" aria-hidden="true" />
          <span>Supabase Backend</span>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
            configured
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-amber-500/30 bg-amber-500/10 text-amber-300"
          }`}
        >
          {configured ? "Configured" : "Not linked yet"}
        </span>
      </section>
    </div>
  );
}
