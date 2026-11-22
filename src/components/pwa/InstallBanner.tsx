"use client";

import { Download, Smartphone, X } from "lucide-react";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { usePwaStore } from "@/stores/usePwaStore";

export function InstallBanner() {
  const sheetOpen = useActiveWorkoutStore((state) => state.sheetOpen);
  const {
    platform,
    isStandalone,
    deferredPrompt,
    bannerDismissed,
    dismissBanner,
    openInstallGuide,
    promptNativeInstall,
  } = usePwaStore();

  const isIosBrowser =
    platform === "ios-safari" || platform === "ios-other-browser";
  const canInstallPrompt = deferredPrompt !== null;

  if (
    isStandalone ||
    bannerDismissed ||
    sheetOpen ||
    (!canInstallPrompt && !isIosBrowser)
  ) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Install Pumped mobile app"
      className="border-b border-emerald-200 bg-emerald-50/70 px-4 py-2.5 sm:px-6"
    >
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Smartphone className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-zinc-950">
              Install Pumped on your phone
            </p>
            <p className="truncate text-[11px] text-zinc-600">
              {canInstallPrompt
                ? "Full-screen gym tracker with offline caching"
                : "Add to Home Screen for full-screen offline use"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {canInstallPrompt ? (
            <button
              type="button"
              onClick={() => void promptNativeInstall()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Install</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={openInstallGuide}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss install banner"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-emerald-100/70 hover:text-zinc-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
