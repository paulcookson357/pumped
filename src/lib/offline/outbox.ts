import type {
  ArchiveExerciseInput,
  ArchiveRoutinePayload,
  CreateExerciseInput,
  DeleteScheduledWorkoutPayload,
  DeleteWorkoutPayload,
  FinishWorkoutPayload,
  ReorderRoutinesPayload,
  SaveWeeklySplitPayload,
  SyncMutation,
  UpdateExerciseInput,
  UpdateSettingsPayload,
  UpdateWorkoutPayload,
  UpsertRoutinePayload,
  UpsertScheduledWorkoutPayload,
} from "@/lib/validation/schemas";

export const MUTATION_PRIORITY: Record<SyncMutation["type"], number> = {
  CREATE_EXERCISE: 10,
  UPDATE_EXERCISE: 11,
  ARCHIVE_EXERCISE: 12,
  UPSERT_ROUTINE: 20,
  REORDER_ROUTINES: 21,
  ARCHIVE_ROUTINE: 22,
  SAVE_WEEKLY_SPLIT: 30,
  UPSERT_SCHEDULED_WORKOUT: 31,
  DELETE_SCHEDULED_WORKOUT: 32,
  FINISH_WORKOUT: 40,
  UPDATE_WORKOUT: 41,
  DELETE_WORKOUT: 42,
  UPDATE_SETTINGS: 50,
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
    })
  | (OutboxBase & {
      type: "UPSERT_ROUTINE";
      payload: UpsertRoutinePayload;
    })
  | (OutboxBase & {
      type: "REORDER_ROUTINES";
      payload: ReorderRoutinesPayload;
    })
  | (OutboxBase & {
      type: "ARCHIVE_ROUTINE";
      payload: ArchiveRoutinePayload;
    })
  | (OutboxBase & {
      type: "SAVE_WEEKLY_SPLIT";
      payload: SaveWeeklySplitPayload;
    })
  | (OutboxBase & {
      type: "UPSERT_SCHEDULED_WORKOUT";
      payload: UpsertScheduledWorkoutPayload;
    })
  | (OutboxBase & {
      type: "DELETE_SCHEDULED_WORKOUT";
      payload: DeleteScheduledWorkoutPayload;
    })
  | (OutboxBase & {
      type: "FINISH_WORKOUT";
      payload: FinishWorkoutPayload;
    })
  | (OutboxBase & {
      type: "UPDATE_WORKOUT";
      payload: UpdateWorkoutPayload;
    })
  | (OutboxBase & {
      type: "DELETE_WORKOUT";
      payload: DeleteWorkoutPayload;
    })
  | (OutboxBase & {
      type: "UPDATE_SETTINGS";
      payload: UpdateSettingsPayload;
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
    case "UPSERT_ROUTINE":
      return { ...base, type: "UPSERT_ROUTINE", payload: mutation.payload };
    case "REORDER_ROUTINES":
      return { ...base, type: "REORDER_ROUTINES", payload: mutation.payload };
    case "ARCHIVE_ROUTINE":
      return { ...base, type: "ARCHIVE_ROUTINE", payload: mutation.payload };
    case "SAVE_WEEKLY_SPLIT":
      return { ...base, type: "SAVE_WEEKLY_SPLIT", payload: mutation.payload };
    case "UPSERT_SCHEDULED_WORKOUT":
      return {
        ...base,
        type: "UPSERT_SCHEDULED_WORKOUT",
        payload: mutation.payload,
      };
    case "DELETE_SCHEDULED_WORKOUT":
      return {
        ...base,
        type: "DELETE_SCHEDULED_WORKOUT",
        payload: mutation.payload,
      };
    case "FINISH_WORKOUT":
      return {
        ...base,
        type: "FINISH_WORKOUT",
        payload: mutation.payload,
      };
    case "UPDATE_WORKOUT":
      return {
        ...base,
        type: "UPDATE_WORKOUT",
        payload: mutation.payload,
      };
    case "DELETE_WORKOUT":
      return {
        ...base,
        type: "DELETE_WORKOUT",
        payload: mutation.payload,
      };
    case "UPDATE_SETTINGS":
      return {
        ...base,
        type: "UPDATE_SETTINGS",
        payload: mutation.payload,
      };
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

  // Logged offline then edited offline before ever syncing -> keep FINISH_WORKOUT with scheduled link
  if (
    existing.type === "FINISH_WORKOUT" &&
    incoming.type === "UPDATE_WORKOUT"
  ) {
    return {
      ...existing,
      clientUpdatedAt: incoming.clientUpdatedAt,
      payload: {
        ...incoming.payload,
        scheduled_workout_id: existing.payload.scheduled_workout_id,
      },
    };
  }

  // Logged offline then deleted offline before ever syncing -> cancel out
  if (
    existing.type === "FINISH_WORKOUT" &&
    incoming.type === "DELETE_WORKOUT"
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
    case "UPSERT_ROUTINE":
      return {
        id: item.id,
        type: "UPSERT_ROUTINE",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "REORDER_ROUTINES":
      return {
        id: item.id,
        type: "REORDER_ROUTINES",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "ARCHIVE_ROUTINE":
      return {
        id: item.id,
        type: "ARCHIVE_ROUTINE",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "SAVE_WEEKLY_SPLIT":
      return {
        id: item.id,
        type: "SAVE_WEEKLY_SPLIT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "UPSERT_SCHEDULED_WORKOUT":
      return {
        id: item.id,
        type: "UPSERT_SCHEDULED_WORKOUT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "DELETE_SCHEDULED_WORKOUT":
      return {
        id: item.id,
        type: "DELETE_SCHEDULED_WORKOUT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "FINISH_WORKOUT":
      return {
        id: item.id,
        type: "FINISH_WORKOUT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "UPDATE_WORKOUT":
      return {
        id: item.id,
        type: "UPDATE_WORKOUT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "DELETE_WORKOUT":
      return {
        id: item.id,
        type: "DELETE_WORKOUT",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
    case "UPDATE_SETTINGS":
      return {
        id: item.id,
        type: "UPDATE_SETTINGS",
        clientUpdatedAt: item.clientUpdatedAt,
        payload: item.payload,
      };
  }
}
