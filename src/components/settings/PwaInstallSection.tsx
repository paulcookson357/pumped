"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { isWakeLockSupported } from "@/lib/pwa/useWakeLock";
import { usePwaStore, type ServiceWorkerStatus } from "@/stores/usePwaStore";

function getSwBadge(swStatus: ServiceWorkerStatus): {
  label: string;
  classes: string;
} {
  switch (swStatus) {
    case "active":
      return {
        label: "Offline Ready",
        classes: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "update-ready":
      return {
        label: "Update Ready",
        classes: "border-blue-200 bg-blue-50 text-blue-700",
      };
    case "registering":
      return {
        label: "Registering...",
        classes: "border-blue-200 bg-blue-50 text-blue-700",
      };
    case "dev-disabled":
      return {
        label: "Dev Mode",
        classes: "border-zinc-200 bg-zinc-50 text-zinc-600",
      };
    case "error":
      return {
        label: "SW Error",
        classes: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "unsupported":
      return {
        label: "Unsupported",
        classes: "border-zinc-200 bg-zinc-50 text-zinc-500",
      };
    default:
      return {
        label: "Initializing",
        classes: "border-zinc-200 bg-zinc-50 text-zinc-600",
      };
  }
}

export function PwaInstallSection() {
  const {
    isStandalone,
    deferredPrompt,
    swStatus,
    swError,
    registration,
    promptNativeInstall,
    openInstallGuide,
    applySwUpdate,
    checkForSwUpdate,
  } = usePwaStore();

  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);

  useEffect(() => {
    setWakeLockSupported(isWakeLockSupported());
  }, []);

  const swBadge = getSwBadge(swStatus);

  async function handleInstallAction() {
    if (deferredPrompt) {
      const outcome = await promptNativeInstall();
      if (outcome === "unavailable") {
        openInstallGuide();
      }
      return;
    }
    openInstallGuide();
  }

  async function handleCheckUpdates() {
    if (swStatus === "update-ready") {
      applySwUpdate();
      return;
    }
    setCheckingUpdate(true);
    setUpdateNotice(null);
    try {
      await checkForSwUpdate();
      const nextStatus = usePwaStore.getState().swStatus;
      setUpdateNotice(
        nextStatus === "update-ready"
          ? "Update downloaded — tap Reload to Update."
          : "App shell is up to date."
      );
    } finally {
      setCheckingUpdate(false);
    }
  }

  return (
    <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
      <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
        <Smartphone className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Mobile App (PWA)
        </h2>
      </div>

      <div className="divide-y divide-zinc-200">
        {/* App Installation */}
        <div className="space-y-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Download
                className="h-5 w-5 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-950">
                  App Installation
                </p>
                <p className="text-xs text-zinc-500">
                  Install Pumped to iPhone or Android home screen
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                isStandalone
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-zinc-200 bg-zinc-50 text-zinc-600"
              }`}
            >
              {isStandalone ? "Installed (Standalone)" : "Browser Mode"}
            </span>
          </div>

          {!isStandalone && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleInstallAction()}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Install App</span>
              </button>

              {deferredPrompt && (
                <button
                  type="button"
                  onClick={openInstallGuide}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50"
                >
                  Setup Guide
                </button>
              )}
            </div>
          )}
        </div>

        {/* Offline App Shell */}
        <div className="space-y-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <ShieldCheck
                className="h-5 w-5 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-950">
                  Offline App Shell
                </p>
                <p className="text-xs text-zinc-500">
                  Service worker precache for routes, icons &amp; /offline fallback
                </p>
              </div>
            </div>

            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${swBadge.classes}`}
            >
              {swBadge.label}
            </span>
          </div>

          <button
            type="button"
            disabled={
              checkingUpdate ||
              (swStatus !== "update-ready" && !registration)
            }
            onClick={() => void handleCheckUpdates()}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 text-sm font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 text-emerald-600 ${
                checkingUpdate ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            <span>
              {swStatus === "update-ready"
                ? "Reload to Update"
                : checkingUpdate
                  ? "Checking..."
                  : "Check Updates"}
            </span>
          </button>

          {swError && (
            <p className="text-xs font-medium text-rose-600">{swError}</p>
          )}

          {updateNotice && (
            <p role="status" className="text-xs font-medium text-emerald-700">
              {updateNotice}
            </p>
          )}
        </div>

        {/* Screen Wake Lock */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Sun className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium text-zinc-950">
                Gym Screen Wake Lock
              </p>
              <p className="text-xs text-zinc-500">
                Automatically prevents screen sleep while an active workout is open
              </p>
            </div>
          </div>

          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${
              wakeLockSupported
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-500"
            }`}
          >
            {wakeLockSupported ? "Supported" : "Not Supported"}
          </span>
        </div>
      </div>
    </section>
  );
}
