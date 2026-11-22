"use client";

import { create } from "zustand";
import {
  clearInstallBannerDismissal,
  detectInstallPlatform,
  dismissInstallBanner,
  isInstallBannerDismissed,
  isStandaloneDisplayMode,
  type InstallPlatform,
} from "@/lib/pwa/install";

export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export type ServiceWorkerStatus =
  | "idle"
  | "dev-disabled"
  | "unsupported"
  | "registering"
  | "active"
  | "update-ready"
  | "error";

interface PwaState {
  platform: InstallPlatform;
  isStandalone: boolean;
  deferredPrompt: BeforeInstallPromptEventLike | null;
  bannerDismissed: boolean;
  installGuideOpen: boolean;
  swStatus: ServiceWorkerStatus;
  swError: string | null;
  waitingWorker: ServiceWorker | null;
  registration: ServiceWorkerRegistration | null;
  syncEnvironment: () => void;
  setDeferredPrompt: (event: BeforeInstallPromptEventLike | null) => void;
  markInstalled: () => void;
  dismissBanner: () => void;
  openInstallGuide: () => void;
  closeInstallGuide: () => void;
  setSwState: (patch: {
    swStatus: ServiceWorkerStatus;
    swError?: string | null;
    waitingWorker?: ServiceWorker | null;
    registration?: ServiceWorkerRegistration | null;
  }) => void;
  promptNativeInstall: () => Promise<"accepted" | "dismissed" | "unavailable">;
  applySwUpdate: () => void;
  checkForSwUpdate: () => Promise<void>;
}

export const usePwaStore = create<PwaState>((set, get) => ({
  platform: "other",
  isStandalone: false,
  deferredPrompt: null,
  bannerDismissed: false,
  installGuideOpen: false,
  swStatus: "idle",
  swError: null,
  waitingWorker: null,
  registration: null,

  syncEnvironment: () => {
    if (typeof window === "undefined") return;
    const standalone = isStandaloneDisplayMode();
    const platform = detectInstallPlatform({
      userAgent: window.navigator.userAgent,
      maxTouchPoints: window.navigator.maxTouchPoints ?? 0,
      isStandalone: standalone,
    });
    const dismissed = isInstallBannerDismissed();
    set({
      isStandalone: standalone,
      platform,
      bannerDismissed: dismissed,
    });
  },

  setDeferredPrompt: (event) => {
    set({ deferredPrompt: event });
  },

  markInstalled: () => {
    clearInstallBannerDismissal();
    set({
      isStandalone: true,
      platform: "installed",
      deferredPrompt: null,
      installGuideOpen: false,
      bannerDismissed: true,
    });
  },

  dismissBanner: () => {
    dismissInstallBanner();
    set({ bannerDismissed: true });
  },

  openInstallGuide: () => set({ installGuideOpen: true }),
  closeInstallGuide: () => set({ installGuideOpen: false }),

  setSwState: (patch) =>
    set((state) => ({
      swStatus: patch.swStatus,
      swError: patch.swError !== undefined ? patch.swError : state.swError,
      waitingWorker:
        patch.waitingWorker !== undefined
          ? patch.waitingWorker
          : state.waitingWorker,
      registration:
        patch.registration !== undefined
          ? patch.registration
          : state.registration,
    })),

  promptNativeInstall: async () => {
    const promptEvent = get().deferredPrompt;
    if (!promptEvent) {
      return "unavailable";
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        get().markInstalled();
      } else {
        set({ deferredPrompt: null });
      }
      return choice.outcome;
    } catch {
      set({ deferredPrompt: null });
      return "unavailable";
    }
  },

  applySwUpdate: () => {
    const waiting = get().waitingWorker;
    if (!waiting) {
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return;
    }
    waiting.postMessage({ type: "SKIP_WAITING" });
  },

  checkForSwUpdate: async () => {
    const reg = get().registration;
    if (!reg) return;
    try {
      await reg.update();
      if (reg.waiting) {
        set({
          swStatus: "update-ready",
          waitingWorker: reg.waiting,
        });
      }
    } catch (error: unknown) {
      set({
        swStatus: "error",
        swError: error instanceof Error ? error.message : "Update check failed.",
      });
    }
  },
}));
