"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Database, HardDrive, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { readLocalCacheStats, type LocalCacheStats } from "@/lib/offline/db";
import { forceRebuildLocalCache, syncIfStale } from "@/lib/offline/syncEngine";
import type { SyncDomain } from "@/lib/types/domain";
import { useSyncStore } from "@/stores/useSyncStore";

interface SyncCacheInspectorSectionProps {
  isConfigured: boolean;
  initialRemoteVersions: Record<SyncDomain, number>;
}

const DOMAIN_ORDER: SyncDomain[] = [
  "exercises",
  "routines",
  "schedule",
  "workouts",
  "settings",
];

function formatSyncTimestamp(iso: string | null): string {
  if (!iso) return "Not synced this session";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function SyncCacheInspectorSection({
  isConfigured,
  initialRemoteVersions,
}: SyncCacheInspectorSectionProps) {
  const router = useRouter();
  const { status, pendingCount, lastSyncedAt, errorMessage } = useSyncStore();

  const [remoteVersions, setRemoteVersions] = useState<
    Record<SyncDomain, number>
  >(initialRemoteVersions);
  const [localStats, setLocalStats] = useState<LocalCacheStats | null>(null);
  const [syncingNow, setSyncingNow] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [confirmRebuild, setConfirmRebuild] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const refreshInspector = useCallback(async () => {
    const stats = await readLocalCacheStats();
    setLocalStats(stats);

    const online = typeof navigator === "undefined" ? true : navigator.onLine;
    if (online && isConfigured) {
      try {
        const res = await fetch("/api/sync/versions", { cache: "no-store" });
        if (res.ok) {
          const payload = (await res.json()) as {
            versions?: Record<SyncDomain, number>;
          };
          if (payload.versions) {
            setRemoteVersions(payload.versions);
          }
        }
      } catch {
        // ignore network hiccup while inspecting
      }
    }
  }, [isConfigured]);

  useEffect(() => {
    void refreshInspector();
  }, [refreshInspector, status, pendingCount]);

  async function handleSyncNow() {
    setSyncingNow(true);
    setFeedback(null);
    try {
      const { changedDomains } = await syncIfStale();
      await refreshInspector();
      router.refresh();

      const nextState = useSyncStore.getState();
      if (nextState.status === "offline") {
        setFeedback({
          kind: "error",
          text: "Device is offline — queued changes will sync automatically when reconnected.",
        });
      } else if (nextState.status === "error") {
        setFeedback({
          kind: "error",
          text: nextState.errorMessage ?? "Sync check failed.",
        });
      } else if (changedDomains.length === 0) {
        setFeedback({
          kind: "success",
          text: "Up to date — 0 domains reloaded.",
        });
      } else {
        setFeedback({
          kind: "success",
          text: `Synced: ${changedDomains.join(", ")}.`,
        });
      }
    } finally {
      setSyncingNow(false);
    }
  }

  async function handleConfirmRebuild() {
    setConfirmRebuild(false);
    setRebuilding(true);
    setFeedback(null);
    try {
      const result = await forceRebuildLocalCache();
      await refreshInspector();
      router.refresh();

      setFeedback({
        kind: result.ok ? "success" : "error",
        text: result.ok
          ? "Local IndexedDB cache rebuilt from server."
          : (result.error ?? "Failed to rebuild local cache."),
      });
    } finally {
      setRebuilding(false);
    }
  }

  const cacheCountItems: Array<{ label: string; value: number | string }> = [
    { label: "Exercises", value: localStats?.counts.exercises ?? "—" },
    { label: "Routines", value: localStats?.counts.routines ?? "—" },
    { label: "Scheduled", value: localStats?.counts.scheduledWorkouts ?? "—" },
    { label: "Workouts", value: localStats?.counts.workouts ?? "—" },
    { label: "Logged Sets", value: localStats?.counts.workoutSets ?? "—" },
    { label: "Outbox Queue", value: localStats?.counts.outbox ?? pendingCount },
  ];

  return (
    <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Sync &amp; Cache Inspector
        </h2>
      </div>

      <div className="divide-y divide-zinc-200">
        {/* Connection Diagnostics */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
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
              isConfigured
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {isConfigured ? "Connected" : "Awaiting env vars"}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldCheck
              className="h-5 w-5 shrink-0 text-zinc-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Database Access Mode
              </p>
              <p className="text-xs text-zinc-500">
                Default-deny RLS, zero public browser keys
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
            Server-Only
          </span>
        </div>

        {/* Live Outbox & Sync State */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <HardDrive className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Sync Engine Status
              </p>
              <p className="tabular-nums text-xs text-zinc-500">
                {pendingCount} pending outbox • Last sync:{" "}
                {formatSyncTimestamp(lastSyncedAt)}
              </p>
              {errorMessage && (
                <p className="mt-0.5 text-xs font-medium text-rose-600">
                  {errorMessage}
                </p>
              )}
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-zinc-700">
            {status}
          </span>
        </div>

        {/* Domain Version Watermarks */}
        <div className="px-4 py-3.5 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Domain Watermarks (sync_meta)
          </p>
          <div className="mt-2 divide-y divide-zinc-100 border-y border-zinc-100">
            {DOMAIN_ORDER.map((domain) => {
              const localVer = localStats?.versions?.[domain] ?? null;
              const serverVer = isConfigured ? remoteVersions[domain] : null;
              const inSync =
                localVer !== null && serverVer !== null && localVer === serverVer;

              return (
                <div
                  key={domain}
                  className="flex items-center justify-between gap-2 py-2 text-xs"
                >
                  <span className="font-medium capitalize text-zinc-800">
                    {domain}
                  </span>
                  <div className="tabular-nums flex items-center gap-2">
                    <span className="text-zinc-500">
                      Local {localVer !== null ? `v${localVer}` : "—"} / Server{" "}
                      {serverVer !== null ? `v${serverVer}` : "—"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        !isConfigured
                          ? "border-zinc-200 bg-zinc-50 text-zinc-500"
                          : inSync
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : localVer === null
                              ? "border-zinc-200 bg-zinc-50 text-zinc-600"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                      }`}
                    >
                      {!isConfigured
                        ? "Offline"
                        : inSync
                          ? "In sync"
                          : localVer === null
                            ? "Uncached"
                            : "Update ready"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* IndexedDB Store Counts */}
        <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-3">
          {cacheCountItems.map((item) => (
            <div key={item.label} className="px-4 py-3 sm:px-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {item.label}
              </p>
              <p className="tabular-nums mt-0.5 text-base font-bold text-zinc-950">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* Sync Now & Rebuild Cache Actions */}
        <div className="space-y-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              disabled={syncingNow || rebuilding || !isConfigured}
              onClick={() => void handleSyncNow()}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${syncingNow ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              <span>{syncingNow ? "Syncing..." : "Sync Now"}</span>
            </button>

            <button
              type="button"
              disabled={rebuilding || pendingCount > 0 || !isConfigured}
              onClick={() => setConfirmRebuild((prev) => !prev)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 text-zinc-500" aria-hidden="true" />
              <span>Rebuild Local Cache</span>
            </button>
          </div>

          {pendingCount > 0 && (
            <p className="text-xs text-amber-700">
              Sync pending changes before rebuilding local cache.
            </p>
          )}

          {confirmRebuild && (
            <div className="space-y-2.5 border-l-2 border-amber-500 pl-3.5">
              <p className="text-xs font-medium text-zinc-700">
                Clear cached exercises, routines, schedule, workouts &amp; settings
                and re-download fresh snapshots from Supabase?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRebuild(false)}
                  className="min-h-[40px] flex-1 rounded-lg border border-zinc-200 bg-white text-xs font-semibold text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmRebuild()}
                  className="min-h-[40px] flex-1 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Confirm Rebuild
                </button>
              </div>
            </div>
          )}

          {feedback && (
            <p
              role="status"
              className={`text-xs font-medium ${
                feedback.kind === "error" ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {feedback.text}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
