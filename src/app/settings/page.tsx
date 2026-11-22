import { Database, Scale, ShieldCheck, Timer } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const configured = isSupabaseConfigured();

  return (
    <div className="space-y-5">
      <section className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">
          Settings
        </h1>
        <p className="text-sm text-zinc-400">
          Personal training defaults and backend sync diagnostics.
        </p>
      </section>

      <section className="divide-y divide-zinc-800/80 rounded-2xl border border-zinc-800 bg-[#111114]">
        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Supabase Connection
              </p>
              <p className="text-xs text-zinc-400">
                Server-side service role via .env.local
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              configured
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {configured ? "Connected" : "Awaiting .env.local"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Scale className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Default Weight Unit
              </p>
              <p className="text-xs text-zinc-400">
                Configured baseline unit for sets & charts
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold uppercase text-zinc-200">
            kg
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <Timer className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Default Rest Duration
              </p>
              <p className="text-xs text-zinc-400">
                Schema baseline for new exercises
              </p>
            </div>
          </div>
          <span className="tabular-nums rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-semibold text-zinc-200">
            90s
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-zinc-400" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Database Access Mode
              </p>
              <p className="text-xs text-zinc-400">
                Default-deny RLS, no public browser keys
              </p>
            </div>
          </div>
          <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
            Server-Only
          </span>
        </div>
      </section>

      {!configured && (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-sm text-amber-200">
          <p className="font-medium text-amber-300">Setup Next Step</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
            Copy <code className="rounded bg-zinc-900 px-1 py-0.5">.env.example</code>{" "}
            to <code className="rounded bg-zinc-900 px-1 py-0.5">.env.local</code>{" "}
            and add <code className="rounded bg-zinc-900 px-1 py-0.5">SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-zinc-900 px-1 py-0.5">
              SUPABASE_SERVICE_ROLE_KEY
            </code>{" "}
            (or link a free Supabase project via MCP) before running Phase 2
            migrations.
          </p>
        </section>
      )}
    </div>
  );
}
