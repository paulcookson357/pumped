"use client";

import { RefreshCw } from "lucide-react";
import { useActiveWorkoutStore } from "@/stores/useActiveWorkoutStore";
import { usePwaStore } from "@/stores/usePwaStore";

export function PwaUpdateBanner() {
  const sheetOpen = useActiveWorkoutStore((state) => state.sheetOpen);
  const { swStatus, applySwUpdate } = usePwaStore();

  if (swStatus !== "update-ready" || sheetOpen) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-blue-200 bg-blue-50/80 px-4 py-2.5 sm:px-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-blue-950">
            A newer version of Pumped is ready
          </p>
          <p className="truncate text-[11px] text-blue-700">
            Reload to apply offline cache and app updates
          </p>
        </div>
        <button
          type="button"
          onClick={applySwUpdate}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-blue-500"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Reload</span>
        </button>
      </div>
    </div>
  );
}
