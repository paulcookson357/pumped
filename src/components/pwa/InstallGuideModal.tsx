"use client";

import { useEffect } from "react";
import {
  CheckCircle2,
  Download,
  MoreVertical,
  PlusSquare,
  Share,
  ShieldCheck,
  Smartphone,
  WifiOff,
  X,
} from "lucide-react";
import { usePwaStore } from "@/stores/usePwaStore";

export function InstallGuideModal() {
  const {
    installGuideOpen,
    closeInstallGuide,
    platform,
    isStandalone,
    deferredPrompt,
    promptNativeInstall,
  } = usePwaStore();

  useEffect(() => {
    if (!installGuideOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeInstallGuide();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [installGuideOpen, closeInstallGuide]);

  if (!installGuideOpen) {
    return null;
  }

  const isIos = platform === "ios-safari" || platform === "ios-other-browser";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install Pumped mobile app"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={closeInstallGuide}
            aria-label="Close install instructions"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>

          <h2 className="text-base font-bold text-zinc-950">
            Install Mobile App
          </h2>

          <button
            type="button"
            onClick={closeInstallGuide}
            className="min-h-[44px] rounded-lg border border-zinc-200 bg-white px-3.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
          >
            Done
          </button>
        </div>
      </header>

      <div className="pb-safe flex-1 overflow-y-auto divide-y divide-zinc-200">
        {/* App Identity Banner */}
        <section className="flex items-center gap-4 px-4 py-5 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/icon-192.png"
            alt="Pumped app icon"
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-2xl border border-zinc-200"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold tracking-tight text-zinc-950">
              Pumped — Strength Tracker
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              Launch from your home screen in full-screen standalone portrait mode.
            </p>
            <div className="mt-2">
              {isStandalone ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Installed on Device</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ready for Home Screen</span>
                </span>
              )}
            </div>
          </div>
        </section>

        {/* Native One-Tap Prompt if Available */}
        {deferredPrompt && !isStandalone && (
          <section className="space-y-3 bg-emerald-50/50 px-4 py-4 sm:px-6">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              One-Tap Install Available
            </p>
            <button
              type="button"
              onClick={() => void promptNativeInstall()}
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Install Pumped</span>
            </button>
          </section>
        )}

        {/* iPhone / iPad Instructions */}
        <section className="space-y-3 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              iPhone &amp; iPad (Safari)
            </h3>
            {isIos && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Your Device
              </span>
            )}
          </div>

          {platform === "ios-other-browser" && (
            <p className="border-l-2 border-amber-500 pl-3 text-xs leading-relaxed text-amber-800">
              On iOS, Safari (or the iOS Share sheet) is required to add web apps
              to the Home Screen cleanly.
            </p>
          )}

          <ol className="space-y-3 text-sm text-zinc-700">
            <li className="flex items-start gap-3">
              <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                1
              </span>
              <span className="pt-0.5">
                Tap the{" "}
                <strong className="inline-flex items-center gap-1 font-semibold text-zinc-950">
                  <Share className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  Share
                </strong>{" "}
                button in Safari&apos;s toolbar.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                2
              </span>
              <span className="pt-0.5">
                Scroll down and tap{" "}
                <strong className="inline-flex items-center gap-1 font-semibold text-zinc-950">
                  <PlusSquare
                    className="h-3.5 w-3.5 text-emerald-600"
                    aria-hidden="true"
                  />
                  Add to Home Screen
                </strong>
                .
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                3
              </span>
              <span className="pt-0.5">
                Tap <strong className="font-semibold text-zinc-950">Add</strong>{" "}
                in the top right, then launch <strong className="font-semibold text-zinc-950">Pumped</strong> from your home screen.
              </span>
            </li>
          </ol>
        </section>

        {/* Android Instructions */}
        <section className="space-y-3 px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Android (Chrome / Edge)
            </h3>
            {platform === "android-chromium" && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                Your Device
              </span>
            )}
          </div>

          <ol className="space-y-3 text-sm text-zinc-700">
            <li className="flex items-start gap-3">
              <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                1
              </span>
              <span className="pt-0.5">
                Tap <strong className="font-semibold text-zinc-950">Install</strong> above if prompted, or open the{" "}
                <strong className="inline-flex items-center gap-0.5 font-semibold text-zinc-950">
                  <MoreVertical
                    className="h-3.5 w-3.5 text-emerald-600"
                    aria-hidden="true"
                  />
                  browser menu
                </strong>
                .
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="tabular-nums flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-800">
                2
              </span>
              <span className="pt-0.5">
                Select{" "}
                <strong className="font-semibold text-zinc-950">
                  Install app
                </strong>{" "}
                or{" "}
                <strong className="font-semibold text-zinc-950">
                  Add to Home screen
                </strong>{" "}
                and confirm.
              </span>
            </li>
          </ol>
        </section>

        {/* Gym Floor Mobile Capabilities */}
        <section className="space-y-3 px-4 py-5 sm:px-6">
          <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Included Mobile Capabilities
          </h3>

          <div className="divide-y divide-zinc-100 border-y border-zinc-100">
            <div className="flex items-start gap-3 py-3">
              <WifiOff
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-zinc-950">
                  Offline Workout Logging
                </p>
                <p className="text-xs text-zinc-500">
                  App routes, IndexedDB workouts, and set outbox sync stay usable in dead-zone gyms.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 py-3">
              <ShieldCheck
                className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-zinc-950">
                  Screen Wake Lock &amp; Portrait Lock
                </p>
                <p className="text-xs text-zinc-500">
                  Keeps your screen awake during active workouts while enforcing upright portrait orientation.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
