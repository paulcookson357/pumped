import Link from "next/link";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Workout History
        </h1>
        <p className="text-sm text-zinc-400">
          Completed sessions, total volume, duration, and personal records.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#111114] p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-zinc-100">
              No completed workouts yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Completed lifting sessions and PR milestones will appear here
              once workouts are logged.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800/80 pt-4">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600"
          >
            Go to Calendar
          </Link>
        </div>
      </section>
    </div>
  );
}
