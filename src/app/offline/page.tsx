"use client";

import { RefreshCw, WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <div className="w-full rounded-2xl border border-zinc-800 bg-[#111114] p-6">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
          <WifiOff className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-zinc-100">
          You&apos;re offline
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
          This route isn&apos;t cached locally yet. Previously visited screens
          and active workout data remain available offline.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Retry Connection</span>
        </button>
      </div>
    </div>
  );
}
