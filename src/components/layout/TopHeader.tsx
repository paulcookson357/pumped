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

  let pillClasses = "border-emerald-200 bg-emerald-50 text-emerald-700";
  let pillLabel = "Online";
  let PillIcon = Wifi;
  let iconSpin = false;

  if (effectiveOffline) {
    pillClasses = "border-amber-200 bg-amber-50 text-amber-700";
    pillLabel = pendingCount > 0 ? `Offline (${pendingCount})` : "Offline";
    PillIcon = WifiOff;
  } else if (status === "syncing") {
    pillClasses = "border-blue-200 bg-blue-50 text-blue-700";
    pillLabel = pendingCount > 0 ? `Syncing (${pendingCount})` : "Syncing";
    PillIcon = RefreshCw;
    iconSpin = true;
  } else if (status === "error") {
    pillClasses = "border-rose-200 bg-rose-50 text-rose-700";
    pillLabel = pendingCount > 0 ? `Pending (${pendingCount})` : "Sync error";
    PillIcon = AlertCircle;
  } else if (pendingCount > 0) {
    pillClasses = "border-blue-200 bg-blue-50 text-blue-700";
    pillLabel = `Pending (${pendingCount})`;
    PillIcon = RefreshCw;
  } else if (status === "synced") {
    pillClasses = "border-emerald-200 bg-emerald-50 text-emerald-700";
    pillLabel = "Synced";
    PillIcon = CheckCircle2;
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
      <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex min-h-[44px] items-center gap-2.5 pr-2 text-zinc-950"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Dumbbell className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight text-zinc-950">
            Pumped
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
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
            className={`flex h-11 w-11 items-center justify-center rounded-lg transition-colors ${
              isSettingsActive
                ? "bg-emerald-50 text-emerald-700"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
            }`}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
