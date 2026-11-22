import type {
  ArchiveExerciseInput,
  CreateExerciseInput,
  SyncMutation,
  UpdateExerciseInput,
} from "@/lib/validation/schemas";

export const MUTATION_PRIORITY: Record<SyncMutation["type"], number> = {
  CREATE_EXERCISE: 10,
  UPDATE_EXERCISE: 11,
  ARCHIVE_EXERCISE: 12,
};

interface OutboxBase {
  key: string;
  id: string;
  entityKey: string;
  priority: number;
  clientUpdatedAt: string;
  createdAt: number;
}

export type OutboxItem =
  | (OutboxBase & {
      type: "CREATE_EXERCISE";
      payload: CreateExerciseInput;
    })
  | (OutboxBase & {
      type: "UPDATE_EXERCISE";
      payload: UpdateExerciseInput;
    })
  | (OutboxBase & {
      type: "ARCHIVE_EXERCISE";
      payload: ArchiveExerciseInput;
    });

export function buildOutboxItem(
  mutation: SyncMutation,
  entityKey: string,
  createdAt = Date.now()
): OutboxItem {
  const base: OutboxBase = {
    key: entityKey,
    id: mutation.id,
    entityKey,
    priority: MUTATION_PRIORITY[mutation.type],
    clientUpdatedAt: mutation.clientUpdatedAt,
    createdAt,
  };

  switch (mutation.type) {
    case "CREATE_EXERCISE":
      return { ...base, type: "CREATE_EXERCISE", payload: mutation.payload };
    case "UPDATE_EXERCISE":
      return { ...base, type: "UPDATE_EXERCISE", payload: mutation.payload };
    case "ARCHIVE_EXERCISE":
      return { ...base, type: "ARCHIVE_EXERCISE", payload: mutation.payload };
  }
}

export function coalesceMutation(
  existing: OutboxItem | undefined,
  incoming: OutboxItem
): OutboxItem | null {
  if (!existing) {
    return incoming;
  }

  // Created offline then edited offline -> merge into one CREATE mutation
  if (
    existing.type === "CREATE_EXERCISE" &&
    incoming.type === "UPDATE_EXERCISE"
  ) {
    return {
      ...existing,
      clientUpdatedAt: incoming.clientUpdatedAt,
      payload: incoming.payload,
    };
  }

  // Created offline then archived offline before ever syncing -> cancel out
  if (
    existing.type === "CREATE_EXERCISE" &&
    incoming.type === "ARCHIVE_EXERCISE"
  ) {
    return null;
  }

  return {
    ...incoming,
    createdAt: existing.createdAt,
  };
}

export function sortOutboxItems(items: OutboxItem[]): OutboxItem[] {
  return [...items].sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.createdAt - b.createdAt;
  });
}

export function toSyncMutation(item: OutboxItem): SyncMutation {
  switch (item.type) {
    case "CREATE_EXERCISE":
      return {
        id: item.id,
        type: "CREATE_EXERCISE",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "UPDATE_EXERCISE":
      return {
        id: item.id,
        type: "UPDATE_EXERCISE",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "ARCHIVE_EXERCISE":
      return {
        id: item.id,
        type: "ARCHIVE_EXERCISE",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
  }
}
