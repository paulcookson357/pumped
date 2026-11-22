"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Dumbbell,
  RefreshCw,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useSyncStore } from "@/stores/useSyncStore";

function subscribeOnlineStatus(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getOnlineSnapshot(): boolean {
  return navigator.onLine;
}

function getServerOnlineSnapshot(): boolean {
  return true;
}

export function TopHeader() {
  const pathname = usePathname();
  const isOnline = useSyncExternalStore(
    subscribeOnlineStatus,
    getOnlineSnapshot,
    getServerOnlineSnapshot
  );
  const { status, pendingCount } = useSyncStore();
  const isSettingsActive = pathname.startsWith("/settings");

  const effectiveOffline = !isOnline || status === "offline";

  let pillClasses =
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
  let pillLabel = "Online";
  let PillIcon = Wifi;
  let iconSpin = false;

  if (effectiveOffline) {
    pillClasses = "border-amber-500/30 bg-amber-500/10 text-amber-300";
    pillLabel = pendingCount > 0 ? `Offline (${pendingCount})` : "Offline";
    PillIcon = WifiOff;
  } else if (status === "syncing") {
    pillClasses = "border-blue-500/30 bg-blue-500/10 text-blue-300";
    pillLabel = pendingCount > 0 ? `Syncing (${pendingCount})` : "Syncing";
    PillIcon = RefreshCw;
    iconSpin = true;
  } else if (status === "error") {
    pillClasses = "border-rose-500/30 bg-rose-500/10 text-rose-300";
    pillLabel = pendingCount > 0 ? `Pending (${pendingCount})` : "Sync error";
    PillIcon = AlertCircle;
  } else if (pendingCount > 0) {
    pillClasses = "border-blue-500/30 bg-blue-500/10 text-blue-300";
    pillLabel = `Pending (${pendingCount})`;
    PillIcon = RefreshCw;
  } else if (status === "synced") {
    pillClasses = "border-emerald-500/25 bg-emerald-500/10 text-emerald-300";
    pillLabel = "Synced";
    PillIcon = CheckCircle2;
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-zinc-800/90 bg-[#09090B]/95 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
        <Link
          href="/"
          className="flex min-h-[44px] items-center gap-2.5 rounded-lg pr-2 text-zinc-100"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-400">
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight text-zinc-100">
            Pumped
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div
            role="status"
            aria-live="polite"
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium tabular-nums ${pillClasses}`}
          >
            <PillIcon
              className={`h-3.5 w-3.5 ${iconSpin ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            <span>{pillLabel}</span>
          </div>

          <Link
            href="/settings"
            aria-label="Settings"
            className={`flex h-11 w-11 items-center justify-center rounded-xl border transition-colors ${
              isSettingsActive
                ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                : "border-zinc-800 bg-[#111114] text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            }`}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
