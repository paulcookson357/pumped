"use client";

import { useEffect, useState } from "react";

/**
 * Returns true if the browser exposes the Screen Wake Lock API.
 */
export function isWakeLockSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "wakeLock" in navigator &&
    typeof navigator.wakeLock?.request === "function"
  );
}

/**
 * Keep the mobile device screen awake while an active gym session sheet is open.
 */
export function useWakeLock(enabled: boolean): {
  active: boolean;
  supported: boolean;
} {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    setSupported(isWakeLockSupported());
  }, []);

  useEffect(() => {
    if (!enabled || !isWakeLockSupported()) {
      setActive(false);
      return;
    }

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    async function requestLock() {
      if (cancelled || document.visibilityState !== "visible") {
        return;
      }

      try {
        const nextSentinel = await navigator.wakeLock.request("screen");
        if (cancelled) {
          void nextSentinel.release().catch(() => {});
          return;
        }
        sentinel = nextSentinel;
        setActive(true);
        nextSentinel.addEventListener("release", () => {
          if (!cancelled) {
            setActive(false);
          }
        });
      } catch {
        // Ignore battery-saver or OS denial gracefully
        if (!cancelled) {
          setActive(false);
        }
      }
    }

    void requestLock();

    const handleVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        (!sentinel || sentinel.released)
      ) {
        void requestLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (sentinel) {
        void sentinel.release().catch(() => {});
        sentinel = null;
      }
      setActive(false);
    };
  }, [enabled]);

  return { active, supported };
}
