import { formatSupersetLabel, getNextSupersetGroup } from "@/lib/routines/colors";

/**
 * Ensures every superset_group contains at least 2 exercises (clearing any orphan
 * single-exercise group to null) and compacts group numbers sequentially (1, 2, 3...)
 * in order of first appearance.
 */
export function normalizeSupersetGroups<
  T extends { superset_group: number | null }
>(items: T[]): T[] {
  const counts = new Map<number, number>();
  for (const item of items) {
    if (item.superset_group !== null) {
      counts.set(item.superset_group, (counts.get(item.superset_group) ?? 0) + 1);
    }
  }

  const remap = new Map<number, number>();
  let nextGroup = 1;

  return items.map((item) => {
    const group = item.superset_group;
    if (group === null || (counts.get(group) ?? 0) < 2) {
      return item.superset_group === null ? item : { ...item, superset_group: null };
    }

    let mapped = remap.get(group);
    if (mapped === undefined) {
      mapped = nextGroup;
      nextGroup += 1;
      remap.set(group, mapped);
    }

    return item.superset_group === mapped
      ? item
      : { ...item, superset_group: mapped };
  });
}

/**
 * Links item at `index` with its immediately following neighbor (`index + 1`)
 * into a shared superset group, normalizing group numbers afterward.
 */
export function linkAdjacentSuperset<
  T extends { superset_group: number | null }
>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length - 1) {
    return items;
  }

  const current = items[index];
  const next = items[index + 1];
  if (!current || !next) {
    return items;
  }

  if (
    current.superset_group !== null &&
    current.superset_group === next.superset_group
  ) {
    return items;
  }

  const targetGroup =
    current.superset_group ?? next.superset_group ?? getNextSupersetGroup(items);
  const mergeFromGroup =
    current.superset_group !== null &&
    next.superset_group !== null &&
    current.superset_group !== next.superset_group
      ? next.superset_group
      : null;

  const updated = items.map((item, i) => {
    if (i === index || i === index + 1) {
      return { ...item, superset_group: targetGroup };
    }
    if (mergeFromGroup !== null && item.superset_group === mergeFromGroup) {
      return { ...item, superset_group: targetGroup };
    }
    return item;
  });

  return normalizeSupersetGroups(updated);
}

/**
 * Removes item at `index` from its superset group and cleans up any remaining
 * single-exercise group left behind.
 */
export function unlinkSupersetItem<
  T extends { superset_group: number | null }
>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) {
    return items;
  }

  const updated = items.map((item, i) =>
    i === index ? { ...item, superset_group: null } : item
  );
  return normalizeSupersetGroups(updated);
}

/**
 * Returns formatted superset position labels ("A1", "A2", "B1", etc.) per index.
 */
export function getSupersetPositions<
  T extends { superset_group: number | null }
>(items: T[]): Array<string | null> {
  const groupCounts = new Map<number, number>();

  return items.map((item) => {
    if (item.superset_group === null) {
      return null;
    }
    const pos = (groupCounts.get(item.superset_group) ?? 0) + 1;
    groupCounts.set(item.superset_group, pos);
    return formatSupersetLabel(item.superset_group, pos);
  });
}
