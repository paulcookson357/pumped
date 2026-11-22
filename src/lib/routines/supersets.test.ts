import { describe, expect, it } from "vitest";
import {
  getSupersetPositions,
  linkAdjacentSuperset,
  normalizeSupersetGroups,
  unlinkSupersetItem,
} from "@/lib/routines/supersets";

interface DraftItem {
  id: string;
  superset_group: number | null;
}

describe("superset grouping helpers", () => {
  it("links two adjacent exercises into superset A1/A2", () => {
    const items: DraftItem[] = [
      { id: "1", superset_group: null },
      { id: "2", superset_group: null },
      { id: "3", superset_group: null },
    ];

    const linked = linkAdjacentSuperset(items, 0);
    expect(linked.map((x) => x.superset_group)).toEqual([1, 1, null]);
    expect(getSupersetPositions(linked)).toEqual(["A1", "A2", null]);
  });

  it("extends an existing superset into a triset A1/A2/A3", () => {
    const items: DraftItem[] = [
      { id: "1", superset_group: 1 },
      { id: "2", superset_group: 1 },
      { id: "3", superset_group: null },
    ];

    const extended = linkAdjacentSuperset(items, 1);
    expect(extended.map((x) => x.superset_group)).toEqual([1, 1, 1]);
    expect(getSupersetPositions(extended)).toEqual(["A1", "A2", "A3"]);
  });

  it("clears the remaining orphan when unlinking one item from a 2-exercise superset", () => {
    const items: DraftItem[] = [
      { id: "1", superset_group: 1 },
      { id: "2", superset_group: 1 },
    ];

    const unlinked = unlinkSupersetItem(items, 0);
    expect(unlinked.map((x) => x.superset_group)).toEqual([null, null]);
    expect(getSupersetPositions(unlinked)).toEqual([null, null]);
  });

  it("compacts later group letters when group A is cleared", () => {
    const items: DraftItem[] = [
      { id: "1", superset_group: 1 },
      { id: "2", superset_group: 1 },
      { id: "3", superset_group: 2 },
      { id: "4", superset_group: 2 },
    ];

    const unlinked = unlinkSupersetItem(items, 1);
    expect(unlinked.map((x) => x.superset_group)).toEqual([null, null, 1, 1]);
    expect(getSupersetPositions(unlinked)).toEqual([null, null, "A1", "A2"]);
  });

  it("normalizes standalone orphan groups to null and compacts gaps", () => {
    const items: DraftItem[] = [
      { id: "1", superset_group: 4 },
      { id: "2", superset_group: 7 },
      { id: "3", superset_group: 7 },
    ];

    const normalized = normalizeSupersetGroups(items);
    expect(normalized.map((x) => x.superset_group)).toEqual([null, 1, 1]);
  });
});
