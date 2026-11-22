"use client";

import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <WifiOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-bold text-zinc-950">
        You&apos;re offline
      </h1>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-600">
        This route isn&apos;t cached locally yet. Previously visited screens and
        active workout data remain available offline.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        <span>Retry Connection</span>
      </button>
    </div>
  );
}
