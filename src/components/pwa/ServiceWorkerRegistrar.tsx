"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
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
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch((error: unknown) => {
        console.warn("Service worker registration failed:", error);
      });
  }, []);

  return null;
}
