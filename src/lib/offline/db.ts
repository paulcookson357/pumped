import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { OutboxItem } from "@/lib/offline/outbox";
import type {
  AppSettings,
  Exercise,
  Routine,
  RoutineExercise,
  ScheduledWorkout,
  SyncDomain,
  WeeklySplitRule,
  Workout,
  WorkoutSet,
} from "@/lib/types/domain";

export interface SyncVersionsRecord {
  key: "sync_versions";
  versions: Record<SyncDomain, number>;
  updatedAt: string;
}

export interface PreviousPerformanceRecord {
  exercise_id: string;
  workout_id: string;
  sets: Array<{
    set_number: number;
    set_type: WorkoutSet["set_type"];
    weight: number | null;
    reps: number | null;
    rpe: number | null;
    duration_seconds: number | null;
  }>;
  updated_at: string;
}

interface PumpedDBSchema extends DBSchema {
  meta: {
    key: "sync_versions";
    value: SyncVersionsRecord;
  };
  exercises: {
    key: string;
    value: Exercise;
  };
  routines: {
    key: string;
    value: Routine;
  };
  routine_exercises: {
    key: string;
    value: RoutineExercise;
  };
  weekly_split_rules: {
    key: string;
    value: WeeklySplitRule;
  };
  scheduled_workouts: {
    key: string;
    value: ScheduledWorkout;
  };
  workouts: {
    key: string;
    value: Workout;
  };
  workout_sets: {
    key: string;
    value: WorkoutSet;
  };
  previous_performance: {
    key: string;
    value: PreviousPerformanceRecord;
  };
  settings: {
    key: number;
    value: AppSettings;
  };
  outbox: {
    key: string;
    value: OutboxItem;
  };
}

const DB_NAME = "pumped-offline-db";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PumpedDBSchema>> | null = null;

function getDB(): Promise<IDBPDatabase<PumpedDBSchema>> | null {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB<PumpedDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("exercises")) {
          db.createObjectStore("exercises", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("routines")) {
          db.createObjectStore("routines", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("routine_exercises")) {
          db.createObjectStore("routine_exercises", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("weekly_split_rules")) {
          db.createObjectStore("weekly_split_rules", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("scheduled_workouts")) {
          db.createObjectStore("scheduled_workouts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("workouts")) {
          db.createObjectStore("workouts", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("workout_sets")) {
          db.createObjectStore("workout_sets", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("previous_performance")) {
          db.createObjectStore("previous_performance", {
            keyPath: "exercise_id",
          });
        }
        if (!db.objectStoreNames.contains("settings")) {
          db.createObjectStore("settings", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("outbox")) {
          db.createObjectStore("outbox", { keyPath: "key" });
        }
      },
    });
  }

  return dbPromise;
}

export interface LocalSnapshotData {
  exercises: Exercise[];
  routines: Routine[];
  routineExercises: RoutineExercise[];
  weeklySplitRules: WeeklySplitRule[];
  scheduledWorkouts: ScheduledWorkout[];
  workouts: Workout[];
  workoutSets: WorkoutSet[];
  settings: AppSettings | null;
  outbox: OutboxItem[];
}

export async function readAllLocalData(): Promise<LocalSnapshotData> {
  const db = await getDB();
  if (!db) {
    return {
      exercises: [],
      routines: [],
      routineExercises: [],
      weeklySplitRules: [],
      scheduledWorkouts: [],
      workouts: [],
      workoutSets: [],
      settings: null,
      outbox: [],
    };
  }

  const [
    exercises,
    routines,
    routineExercises,
    weeklySplitRules,
    scheduledWorkouts,
    workouts,
    workoutSets,
    settingsList,
    outbox,
  ] = await Promise.all([
    db.getAll("exercises"),
    db.getAll("routines"),
    db.getAll("routine_exercises"),
    db.getAll("weekly_split_rules"),
    db.getAll("scheduled_workouts"),
    db.getAll("workouts"),
    db.getAll("workout_sets"),
    db.getAll("settings"),
    db.getAll("outbox"),
  ]);

  exercises.sort((a, b) => {
    if (a.is_custom !== b.is_custom) {
      return a.is_custom ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  routines.sort((a, b) => a.sort_order - b.sort_order);
  routineExercises.sort((a, b) => a.sort_order - b.sort_order);
  weeklySplitRules.sort((a, b) => {
    if (a.day_of_week !== b.day_of_week) {
      return a.day_of_week - b.day_of_week;
    }
    return a.sort_order - b.sort_order;
  });
  scheduledWorkouts.sort((a, b) =>
    a.scheduled_date.localeCompare(b.scheduled_date)
  );

  return {
    exercises,
    routines,
    routineExercises,
    weeklySplitRules,
    scheduledWorkouts,
    workouts,
    workoutSets,
    settings: settingsList[0] ?? null,
    outbox,
  };
}

export async function readLocalVersions(): Promise<Record<
  SyncDomain,
  number
> | null> {
  const db = await getDB();
  if (!db) return null;
  const record = await db.get("meta", "sync_versions");
  return record ? record.versions : null;
}

export async function readLocalExerciseCount(): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  return db.count("exercises");
}

export async function writeLocalVersions(
  versions: Record<SyncDomain, number>
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put("meta", {
    key: "sync_versions",
    versions,
    updatedAt: new Date().toISOString(),
  });
}

async function replaceStoreValues<
  Name extends
    | "exercises"
    | "routines"
    | "routine_exercises"
    | "weekly_split_rules"
    | "scheduled_workouts"
    | "workouts"
    | "workout_sets"
    | "settings"
>(
  db: IDBPDatabase<PumpedDBSchema>,
  storeName: Name,
  items: PumpedDBSchema[Name]["value"][]
): Promise<void> {
  const tx = db.transaction(storeName, "readwrite");
  await tx.store.clear();
  for (const item of items) {
    await tx.store.put(item);
  }
  await tx.done;
}

export interface SnapshotDomainPayloads {
  exercises?: Exercise[];
  routines?: {
    routines: Routine[];
    routineExercises: RoutineExercise[];
  };
  schedule?: {
    weeklySplitRules: WeeklySplitRule[];
    scheduledWorkouts: ScheduledWorkout[];
  };
  workouts?: {
    workouts: Workout[];
    workoutSets: WorkoutSet[];
  };
  settings?: AppSettings | null;
}

export async function writeDomainSnapshot(
  payload: SnapshotDomainPayloads
): Promise<void> {
  const db = await getDB();
  if (!db) return;

  if (payload.exercises !== undefined) {
    await replaceStoreValues(db, "exercises", payload.exercises);
  }
  if (payload.routines !== undefined) {
    await replaceStoreValues(db, "routines", payload.routines.routines);
    await replaceStoreValues(
      db,
      "routine_exercises",
      payload.routines.routineExercises
    );
  }
  if (payload.schedule !== undefined) {
    await replaceStoreValues(
      db,
      "weekly_split_rules",
      payload.schedule.weeklySplitRules
    );
    await replaceStoreValues(
      db,
      "scheduled_workouts",
      payload.schedule.scheduledWorkouts
    );
  }
  if (payload.workouts !== undefined) {
    await replaceStoreValues(db, "workouts", payload.workouts.workouts);
    await replaceStoreValues(db, "workout_sets", payload.workouts.workoutSets);
  }
  if (payload.settings !== undefined) {
    await replaceStoreValues(
      db,
      "settings",
      payload.settings ? [payload.settings] : []
    );
  }
}

export async function putLocalExercise(exercise: Exercise): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put("exercises", exercise);
}

export async function deleteLocalExercise(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete("exercises", id);
}

export async function putLocalRoutineBundle(
  routine: Routine,
  exercises: RoutineExercise[]
): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction(["routines", "routine_exercises"], "readwrite");
  await tx.objectStore("routines").put(routine);

  const reStore = tx.objectStore("routine_exercises");
  const existing = await reStore.getAll();
  for (const row of existing) {
    if (row.routine_id === routine.id) {
      await reStore.delete(row.id);
    }
  }
  for (const row of exercises) {
    await reStore.put(row);
  }
  await tx.done;
}

export async function reorderLocalRoutines(orderedIds: string[]): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const orderMap = new Map(orderedIds.map((id, idx) => [id, idx]));
  const now = new Date().toISOString();
  const tx = db.transaction("routines", "readwrite");
  const existing = await tx.store.getAll();
  for (const routine of existing) {
    const nextOrder = orderMap.get(routine.id);
    if (nextOrder !== undefined) {
      await tx.store.put({
        ...routine,
        sort_order: nextOrder,
        updated_at: now,
      });
    }
  }
  await tx.done;
}

export async function archiveLocalRoutine(routineId: string): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction(
    ["routines", "routine_exercises", "weekly_split_rules", "scheduled_workouts"],
    "readwrite"
  );

  await tx.objectStore("routines").delete(routineId);

  const reStore = tx.objectStore("routine_exercises");
  for (const row of await reStore.getAll()) {
    if (row.routine_id === routineId) {
      await reStore.delete(row.id);
    }
  }

  const ruleStore = tx.objectStore("weekly_split_rules");
  for (const rule of await ruleStore.getAll()) {
    if (rule.routine_id === routineId) {
      await ruleStore.delete(rule.id);
    }
  }

  const schedStore = tx.objectStore("scheduled_workouts");
  for (const sw of await schedStore.getAll()) {
    if (sw.routine_id === routineId && sw.status === "planned") {
      await schedStore.delete(sw.id);
    }
  }

  await tx.done;
}

export async function putLocalWeeklySplitAndSchedule(params: {
  rules: WeeklySplitRule[];
  removePlannedIds: string[];
  generatedWorkouts: ScheduledWorkout[];
}): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const tx = db.transaction(
    ["weekly_split_rules", "scheduled_workouts"],
    "readwrite"
  );

  const ruleStore = tx.objectStore("weekly_split_rules");
  await ruleStore.clear();
  for (const rule of params.rules) {
    await ruleStore.put(rule);
  }

  const schedStore = tx.objectStore("scheduled_workouts");
  for (const removeId of params.removePlannedIds) {
    await schedStore.delete(removeId);
  }
  for (const sw of params.generatedWorkouts) {
    await schedStore.put(sw);
  }

  await tx.done;
}

export async function putLocalScheduledWorkout(
  item: ScheduledWorkout
): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put("scheduled_workouts", item);
}

export async function deleteLocalScheduledWorkout(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete("scheduled_workouts", id);
}

export async function getOutboxItem(
  key: string
): Promise<OutboxItem | undefined> {
  const db = await getDB();
  if (!db) return undefined;
  return db.get("outbox", key);
}

export async function getOutboxItems(): Promise<OutboxItem[]> {
  const db = await getDB();
  if (!db) return [];
  return db.getAll("outbox");
}

export async function putOutboxItem(item: OutboxItem): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.put("outbox", item);
}

export async function deleteOutboxItem(key: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete("outbox", key);
}

export async function removeOutboxItems(keys: string[]): Promise<void> {
  const db = await getDB();
  if (!db || keys.length === 0) return;
  const tx = db.transaction("outbox", "readwrite");
  for (const key of keys) {
    await tx.store.delete(key);
  }
  await tx.done;
}
