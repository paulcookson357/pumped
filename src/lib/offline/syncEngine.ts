"use client";

import {
  deleteOutboxItem,
  getOutboxItem,
  getOutboxItems,
  putOutboxItem,
  readAllLocalData,
  readLocalVersions,
  removeOutboxItems,
  writeDomainSnapshot,
  writeLocalVersions,
  type SnapshotDomainPayloads,
} from "@/lib/offline/db";
import {
  buildOutboxItem,
  coalesceMutation,
  sortOutboxItems,
  toSyncMutation,
} from "@/lib/offline/outbox";
import type { SyncDomain } from "@/lib/types/domain";
import type { SyncMutation } from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

const ALL_DOMAINS: SyncDomain[] = [
  "exercises",
  "routines",
  "schedule",
  "workouts",
  "settings",
];

let syncInFlight: Promise<{ changedDomains: SyncDomain[] }> | null = null;

function isBrowserOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

export async function hydrateFromIndexedDB(): Promise<void> {
  const local = await readAllLocalData();
  const hasAnyCachedData =
    local.exercises.length > 0 ||
    local.routines.length > 0 ||
    local.workouts.length > 0 ||
    local.settings !== null;

  if (hasAnyCachedData) {
    useAppDataStore.getState().hydrateAll(local);
  }
  useSyncStore.getState().setPendingCount(local.outbox.length);
  if (!isBrowserOnline()) {
    useSyncStore.getState().setStatus("offline");
  }
}

export async function flushOutbox(): Promise<boolean> {
  const syncStore = useSyncStore.getState();
  const items = sortOutboxItems(await getOutboxItems());
  syncStore.setPendingCount(items.length);

  if (items.length === 0) {
    return true;
  }

  if (!isBrowserOnline()) {
    syncStore.setStatus("offline");
    return false;
  }

  syncStore.setStatus("syncing");
  syncStore.setError(null);

  try {
    const response = await fetch("/api/sync/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        mutations: items.map(toSyncMutation),
      }),
    });

    if (!response.ok) {
      let message = `Sync failed (${response.status})`;
      try {
        const errBody = (await response.json()) as { error?: string };
        if (errBody.error) {
          message = errBody.error;
        }
      } catch {
        // ignore JSON parse failure
      }
      syncStore.setError(message);
      return false;
    }

    const result = (await response.json()) as {
      ok: boolean;
      appliedIds?: string[];
      versions?: Record<SyncDomain, number>;
    };

    const appliedSet = new Set(result.appliedIds ?? []);
    const keysToDelete = items
      .filter((item) => appliedSet.has(item.id))
      .map((item) => item.key);

    await removeOutboxItems(keysToDelete);
    const remaining = await getOutboxItems();
    syncStore.setPendingCount(remaining.length);

    if (result.versions) {
      const existingVersions = await readLocalVersions();
      if (existingVersions) {
        await writeLocalVersions(result.versions);
      }
    }

    if (remaining.length === 0) {
      syncStore.setSynced(new Date().toISOString());
    }
    return true;
  } catch {
    syncStore.setStatus(isBrowserOnline() ? "error" : "offline");
    return false;
  }
}

async function runSyncIfStale(): Promise<{ changedDomains: SyncDomain[] }> {
  const syncStore = useSyncStore.getState();

  if (!isBrowserOnline()) {
    syncStore.setStatus("offline");
    return { changedDomains: [] };
  }

  syncStore.setStatus("syncing");

  await flushOutbox();

  try {
    const versionsRes = await fetch("/api/sync/versions", {
      cache: "no-store",
    });

    if (!versionsRes.ok) {
      if (versionsRes.status === 503) {
        syncStore.setStatus("idle");
        return { changedDomains: [] };
      }
      syncStore.setError(`Version check failed (${versionsRes.status})`);
      return { changedDomains: [] };
    }

    const remoteMeta = (await versionsRes.json()) as {
      versions: Record<SyncDomain, number>;
    };

    const localVersions = await readLocalVersions();
    const staleDomains = localVersions
      ? ALL_DOMAINS.filter(
          (domain) => remoteMeta.versions[domain] !== localVersions[domain]
        )
      : [...ALL_DOMAINS];

    if (staleDomains.length === 0) {
      const remaining = await getOutboxItems();
      if (remaining.length === 0) {
        syncStore.setSynced(new Date().toISOString());
      }
      return { changedDomains: [] };
    }

    const snapshotRes = await fetch(
      `/api/sync/snapshot?domains=${staleDomains.join(",")}`,
      { cache: "no-store" }
    );

    if (!snapshotRes.ok) {
      syncStore.setError(`Snapshot sync failed (${snapshotRes.status})`);
      return { changedDomains: [] };
    }

    const snapshot = (await snapshotRes.json()) as {
      versions: Record<SyncDomain, number>;
      data: SnapshotDomainPayloads;
    };

    await writeDomainSnapshot(snapshot.data);
    await writeLocalVersions(snapshot.versions);
    useAppDataStore.getState().applyDomainPayloads(snapshot.data);

    const remaining = await getOutboxItems();
    syncStore.setPendingCount(remaining.length);
    if (remaining.length === 0) {
      syncStore.setSynced(new Date().toISOString());
    }

    return { changedDomains: staleDomains };
  } catch {
    syncStore.setStatus(isBrowserOnline() ? "error" : "offline");
    return { changedDomains: [] };
  }
}

export function syncIfStale(): Promise<{ changedDomains: SyncDomain[] }> {
  if (!syncInFlight) {
    syncInFlight = runSyncIfStale().finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

export async function enqueueAndSync(
  mutation: SyncMutation,
  entityKey: string
): Promise<void> {
  const existing = await getOutboxItem(entityKey);
  const incoming = buildOutboxItem(mutation, entityKey);
  const coalesced = coalesceMutation(existing, incoming);

  if (coalesced === null) {
    await deleteOutboxItem(entityKey);
  } else {
    await putOutboxItem(coalesced);
  }

  const remaining = await getOutboxItems();
  useSyncStore.getState().setPendingCount(remaining.length);

  if (isBrowserOnline()) {
    await flushOutbox();
  } else {
    useSyncStore.getState().setStatus("offline");
  }
}
