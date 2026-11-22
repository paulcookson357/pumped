"use client";

import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "synced" | "offline" | "error";

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  errorMessage: string | null;
  setStatus: (status: SyncStatus) => void;
  setPendingCount: (count: number) => void;
  setSynced: (lastSyncedAt: string) => void;
  setError: (message: string | null) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  errorMessage: null,
  setStatus: (status) => set({ status }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setSynced: (lastSyncedAt) =>
    set({ status: "synced", lastSyncedAt, errorMessage: null }),
  setError: (errorMessage) =>
    set((state) => ({
      errorMessage,
      status: errorMessage ? "error" : state.status,
    })),
}));
