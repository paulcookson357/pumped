"use client";

import { useEffect } from "react";
import {
  usePwaStore,
  type BeforeInstallPromptEventLike,
} from "@/stores/usePwaStore";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const store = usePwaStore.getState();
    store.syncEnvironment();

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      usePwaStore
        .getState()
        .setDeferredPrompt(event as BeforeInstallPromptEventLike);
      usePwaStore.getState().syncEnvironment();
    };

    const handleAppInstalled = () => {
      usePwaStore.getState().markInstalled();
    };

    const standaloneMedia =
      typeof window.matchMedia === "function"
        ? window.matchMedia("(display-mode: standalone)")
        : null;

    const handleDisplayModeChange = () => {
      usePwaStore.getState().syncEnvironment();
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneMedia?.addEventListener("change", handleDisplayModeChange);

    let detachSwListeners: (() => void) | undefined;

    if (!("serviceWorker" in navigator)) {
      store.setSwState({ swStatus: "unsupported" });
    } else if (process.env.NODE_ENV !== "production") {
      store.setSwState({ swStatus: "dev-disabled" });

      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((reg) => reg.unregister()))
        )
        .catch(() => {});

      if ("caches" in window) {
        window.caches
          .keys()
          .then((keys) =>
            Promise.all(
              keys
                .filter((key) => key.startsWith("pumped-"))
                .map((key) => window.caches.delete(key))
            )
          )
          .catch(() => {});
      }
    } else {
      let active = true;
      let reloadingFromUpdate = false;
      store.setSwState({ swStatus: "registering", swError: null });

      const hadInitialController = Boolean(navigator.serviceWorker.controller);

      const handleControllerChange = () => {
        if (!hadInitialController || reloadingFromUpdate) {
          return;
        }
        reloadingFromUpdate = true;
        window.location.reload();
      };

      navigator.serviceWorker.addEventListener(
        "controllerchange",
        handleControllerChange
      );

      const attachRegistrationListeners = (reg: ServiceWorkerRegistration) => {
        const bindInstallingWorker = (worker: ServiceWorker) => {
          worker.addEventListener("statechange", () => {
            if (!active) return;
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              usePwaStore.getState().setSwState({
                swStatus: "update-ready",
                waitingWorker: reg.waiting ?? worker,
                registration: reg,
              });
            } else if (worker.state === "activated") {
              usePwaStore.getState().setSwState({
                swStatus: reg.waiting ? "update-ready" : "active",
                waitingWorker: reg.waiting,
                registration: reg,
              });
            }
          });
        };

        if (reg.waiting) {
          usePwaStore.getState().setSwState({
            swStatus: "update-ready",
            waitingWorker: reg.waiting,
            registration: reg,
          });
        } else {
          usePwaStore.getState().setSwState({
            swStatus: "active",
            waitingWorker: null,
            registration: reg,
          });
        }

        if (reg.installing) {
          bindInstallingWorker(reg.installing);
        }

        const handleUpdateFound = () => {
          if (!active || !reg.installing) return;
          bindInstallingWorker(reg.installing);
        };

        reg.addEventListener("updatefound", handleUpdateFound);
        return () => reg.removeEventListener("updatefound", handleUpdateFound);
      };

      let removeUpdateListener: (() => void) | undefined;

      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          if (!active) return;
          removeUpdateListener = attachRegistrationListeners(reg);
        })
        .catch((error: unknown) => {
          if (!active) return;
          usePwaStore.getState().setSwState({
            swStatus: "error",
            swError:
              error instanceof Error
                ? error.message
                : "Service worker registration failed.",
          });
        });

      detachSwListeners = () => {
        active = false;
        removeUpdateListener?.();
        navigator.serviceWorker.removeEventListener(
          "controllerchange",
          handleControllerChange
        );
      };
    }

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneMedia?.removeEventListener("change", handleDisplayModeChange);
      detachSwListeners?.();
    };
  }, []);

  return null;
}
