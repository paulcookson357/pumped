"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { hydrateFromIndexedDB, syncIfStale } from "@/lib/offline/syncEngine";
import { useSyncStore } from "@/stores/useSyncStore";

const VISIBILITY_COOLDOWN_MS = 3000;

export function SyncBootstrap() {
  const router = useRouter();
  const lastSyncCheckRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function runCheck(force: boolean) {
      const now = Date.now();
      if (!force && now - lastSyncCheckRef.current < VISIBILITY_COOLDOWN_MS) {
        return;
      }
      lastSyncCheckRef.current = now;

      const { changedDomains } = await syncIfStale();
      if (active && changedDomains.length > 0) {
        router.refresh();
      }
    }

    async function init() {
      await hydrateFromIndexedDB();
      if (!active) return;
      await runCheck(true);
    }

    void init();

    const handleOnline = () => {
      void runCheck(true);
    };

    const handleOffline = () => {
      useSyncStore.getState().setStatus("offline");
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void runCheck(false);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  return null;
}
