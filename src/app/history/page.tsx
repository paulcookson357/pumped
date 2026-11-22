import Link from "next/link";
import { History } from "lucide-react";

export default function HistoryPage() {
  return (
    <div>
      <section className="pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Workout History
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Completed sessions, total volume, duration, and personal records.
        </p>
      </section>

      <section className="-mx-4 border-y border-zinc-200 px-4 py-6 sm:-mx-6 sm:px-6">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <History className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-zinc-950">
              No completed workouts yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-600">
              Completed lifting sessions and PR milestones will appear here
              once workouts are logged.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50"
          >
            Go to Calendar
          </Link>
        </div>
      </section>
    </div>
  );
}
