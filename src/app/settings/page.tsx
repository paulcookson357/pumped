import { Database, Scale, ShieldCheck, Timer } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div>
      <section className="pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Personal training defaults and backend sync diagnostics.
        </p>
      </section>

      <section className="-mx-4 divide-y divide-zinc-200 border-y border-zinc-200 sm:-mx-6">
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Supabase Connection
              </p>
              <p className="text-xs text-zinc-500">
                Server-side service role via environment variables
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              configured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {configured ? "Connected" : "Awaiting env vars"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Default Weight Unit
              </p>
              <p className="text-xs text-zinc-500">
                Configured baseline unit for sets & charts
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase text-zinc-800">
            kg
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Timer className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Default Rest Duration
              </p>
              <p className="text-xs text-zinc-500">
                Schema baseline for new exercises
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-800">
            90s
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Database Access Mode
              </p>
              <p className="text-xs text-zinc-500">
                Default-deny RLS, no public browser keys
              </p>
            </div>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Server-Only
          </span>
        </div>
      </section>

      {!configured && (
        <section className="-mx-4 border-b border-amber-200 bg-amber-50/70 px-4 py-4 text-sm text-amber-900 sm:-mx-6 sm:px-6">
          <p className="font-medium">Setup Next Step</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Copy <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code>{" "}
            to <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
            and add <code className="rounded bg-amber-100 px-1 py-0.5">SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            .
          </p>
        </section>
      )}
    </div>
  );
}
