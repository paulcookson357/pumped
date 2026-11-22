import { describe, expect, it } from "vitest";
import {
  buildOutboxItem,
  coalesceMutation,
  sortOutboxItems,
} from "@/lib/offline/outbox";

const EXERCISE_ID = "11111111-1111-4111-8111-111111111111";

describe("outbox coalescing and ordering", () => {
  it("merges CREATE_EXERCISE followed by UPDATE_EXERCISE into a single CREATE_EXERCISE", () => {
    const createItem = buildOutboxItem(
      {
        id: "mut-1",
        type: "CREATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "Cable Y-Raise",
          muscle_group: "shoulders",
          secondary_muscles: [],
          equipment: "cable",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      `exercise:${EXERCISE_ID}`,
      100
    );

    const updateItem = buildOutboxItem(
      {
        id: "mut-2",
        type: "UPDATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:01:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "Standing Cable Y-Raise",
          muscle_group: "shoulders",
          secondary_muscles: ["back"],
          equipment: "cable",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: "https://example.com/demo",
          instructions: ["Pull up and out into a Y shape."],
        },
      },
      `exercise:${EXERCISE_ID}`,
      200
    );

    const merged = coalesceMutation(createItem, updateItem);
    expect(merged).not.toBeNull();
    expect(merged?.type).toBe("CREATE_EXERCISE");
    expect(merged?.id).toBe("mut-1");
    expect(merged?.clientUpdatedAt).toBe("2026-11-22T10:01:00.000Z");
    if (merged?.type === "CREATE_EXERCISE") {
      expect(merged.payload.name).toBe("Standing Cable Y-Raise");
      expect(merged.payload.custom_video_url).toBe("https://example.com/demo");
    }
  });

  it("cancels out CREATE_EXERCISE followed by ARCHIVE_EXERCISE before sync", () => {
    const createItem = buildOutboxItem(
      {
        id: "mut-1",
        type: "CREATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "Temp Lift",
          muscle_group: "chest",
          secondary_muscles: [],
          equipment: "dumbbell",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      `exercise:${EXERCISE_ID}`,
      100
    );

    const archiveItem = buildOutboxItem(
      {
        id: "mut-2",
        type: "ARCHIVE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:02:00.000Z",
        payload: { id: EXERCISE_ID },
      },
      `exercise:${EXERCISE_ID}`,
      200
    );

    expect(coalesceMutation(createItem, archiveItem)).toBeNull();
  });

  it("overwrites UPDATE_EXERCISE with newer UPDATE_EXERCISE while preserving createdAt", () => {
    const first = buildOutboxItem(
      {
        id: "mut-1",
        type: "UPDATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "V1",
          muscle_group: "back",
          secondary_muscles: [],
          equipment: "machine",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      `exercise:${EXERCISE_ID}`,
      100
    );

    const second = buildOutboxItem(
      {
        id: "mut-2",
        type: "UPDATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:05:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "V2",
          muscle_group: "back",
          secondary_muscles: [],
          equipment: "machine",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      `exercise:${EXERCISE_ID}`,
      500
    );

    const merged = coalesceMutation(first, second);
    expect(merged?.type).toBe("UPDATE_EXERCISE");
    expect(merged?.createdAt).toBe(100);
    if (merged?.type === "UPDATE_EXERCISE") {
      expect(merged.payload.name).toBe("V2");
    }
  });

  it("sorts outbox items by priority ascending then createdAt ascending", () => {
    const archiveItem = buildOutboxItem(
      {
        id: "m-arch",
        type: "ARCHIVE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: { id: EXERCISE_ID },
      },
      "k3",
      10
    );
    const createLater = buildOutboxItem(
      {
        id: "m-c2",
        type: "CREATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:01:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "B",
          muscle_group: "core",
          secondary_muscles: [],
          equipment: "bodyweight",
          tracking_type: "bodyweight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      "k2",
      200
    );
    const createEarlier = {
      ...createLater,
      id: "m-c1",
      key: "k1",
      createdAt: 50,
    };

    const sorted = sortOutboxItems([archiveItem, createLater, createEarlier]);
    expect(sorted.map((s) => s.id)).toEqual(["m-c1", "m-c2", "m-arch"]);
  });

  it("orders exercises -> routines -> weekly split -> scheduled workouts by priority", () => {
    const routineId = "22222222-2222-4222-8222-222222222222";
    const scheduleId = "33333333-3333-4333-8333-333333333333";

    const scheduled = buildOutboxItem(
      {
        id: "m-sched",
        type: "UPSERT_SCHEDULED_WORKOUT",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: scheduleId,
          routine_id: routineId,
          scheduled_date: "2026-11-23",
          status: "planned",
          workout_id: null,
          source_split_rule_id: null,
          notes: null,
        },
      },
      `scheduled:${scheduleId}`,
      10
    );

    const split = buildOutboxItem(
      {
        id: "m-split",
        type: "SAVE_WEEKLY_SPLIT",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          rules: [],
          removePlannedIds: [],
          generatedWorkouts: [],
        },
      },
      "schedule:weekly_split",
      20
    );

    const routine = buildOutboxItem(
      {
        id: "m-routine",
        type: "UPSERT_ROUTINE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: routineId,
          name: "Push A",
          color: "#059669",
          notes: null,
          sort_order: 0,
          exercises: [],
        },
      },
      `routine:${routineId}`,
      30
    );

    const exercise = buildOutboxItem(
      {
        id: "m-ex",
        type: "CREATE_EXERCISE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: EXERCISE_ID,
          name: "Cable Fly",
          muscle_group: "chest",
          secondary_muscles: [],
          equipment: "cable",
          tracking_type: "weight_reps",
          media_image_start_url: null,
          custom_video_url: null,
          instructions: [],
        },
      },
      `exercise:${EXERCISE_ID}`,
      40
    );

    const sorted = sortOutboxItems([scheduled, split, routine, exercise]);
    expect(sorted.map((s) => s.id)).toEqual([
      "m-ex",
      "m-routine",
      "m-split",
      "m-sched",
    ]);
  });

  it("coalesces two UPSERT_ROUTINE items keeping latest payload and original createdAt", () => {
    const routineId = "22222222-2222-4222-8222-222222222222";
    const first = buildOutboxItem(
      {
        id: "m-r1",
        type: "UPSERT_ROUTINE",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: routineId,
          name: "Push v1",
          color: "#059669",
          notes: null,
          sort_order: 0,
          exercises: [],
        },
      },
      `routine:${routineId}`,
      100
    );

    const second = buildOutboxItem(
      {
        id: "m-r2",
        type: "UPSERT_ROUTINE",
        clientUpdatedAt: "2026-11-22T10:05:00.000Z",
        payload: {
          id: routineId,
          name: "Push v2",
          color: "#2563EB",
          notes: "Heavy bench day",
          sort_order: 0,
          exercises: [],
        },
      },
      `routine:${routineId}`,
      500
    );

    const merged = coalesceMutation(first, second);
    expect(merged?.type).toBe("UPSERT_ROUTINE");
    expect(merged?.createdAt).toBe(100);
    if (merged?.type === "UPSERT_ROUTINE") {
      expect(merged.payload.name).toBe("Push v2");
      expect(merged.payload.color).toBe("#2563EB");
    }
  });

  it("coalesces UPSERT_SCHEDULED_WORKOUT followed by DELETE_SCHEDULED_WORKOUT", () => {
    const routineId = "22222222-2222-4222-8222-222222222222";
    const scheduleId = "33333333-3333-4333-8333-333333333333";

    const upsertItem = buildOutboxItem(
      {
        id: "m-s1",
        type: "UPSERT_SCHEDULED_WORKOUT",
        clientUpdatedAt: "2026-11-22T10:00:00.000Z",
        payload: {
          id: scheduleId,
          routine_id: routineId,
          scheduled_date: "2026-11-23",
          status: "planned",
          workout_id: null,
          source_split_rule_id: null,
          notes: null,
        },
      },
      `scheduled:${scheduleId}`,
      100
    );

    const deleteItem = buildOutboxItem(
      {
        id: "m-s2",
        type: "DELETE_SCHEDULED_WORKOUT",
        clientUpdatedAt: "2026-11-22T10:02:00.000Z",
        payload: { id: scheduleId },
      },
      `scheduled:${scheduleId}`,
      300
    );

    const merged = coalesceMutation(upsertItem, deleteItem);
    expect(merged?.type).toBe("DELETE_SCHEDULED_WORKOUT");
    expect(merged?.createdAt).toBe(100);
  });
});
