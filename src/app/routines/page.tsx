import Link from "next/link";
import { ClipboardList } from "lucide-react";

export default function RoutinesPage() {
  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Routines & Weekly Split
        </h1>
        <p className="text-sm text-zinc-400">
          Reusable strength templates, supersets, target RPE, and rest timers.
        </p>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-[#111114] p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-400">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-base font-semibold text-zinc-100">
              No routines saved yet
            </h2>
            <p className="text-sm leading-relaxed text-zinc-400">
              Routine creation, superset grouping, and repeating weekly split
              rules will populate from your database and local cache in the
              upcoming build phases.
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800/80 pt-4">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-sm font-medium text-zinc-200 transition-colors hover:border-zinc-600"
          >
            Back to Calendar
          </Link>
        </div>
      </section>
    </div>
  );
}
