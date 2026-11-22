export interface RoutineColorOption {
  hex: string;
  label: string;
}

export const ROUTINE_COLORS: readonly RoutineColorOption[] = [
  { hex: "#059669", label: "Emerald" },
  { hex: "#2563EB", label: "Blue" },
  { hex: "#7C3AED", label: "Violet" },
  { hex: "#D97706", label: "Amber" },
  { hex: "#E11D48", label: "Rose" },
  { hex: "#475569", label: "Slate" },
] as const;

export const SUPERSET_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function formatSupersetLabel(
  supersetGroup: number | null,
  positionInGroup?: number
): string | null {
  if (supersetGroup === null || supersetGroup < 1) {
    return null;
  }
  const letter = SUPERSET_LETTERS[(supersetGroup - 1) % SUPERSET_LETTERS.length] ?? "A";
  if (positionInGroup !== undefined && positionInGroup > 0) {
    return `${letter}${positionInGroup}`;
  }
  return letter;
}

export function getNextSupersetGroup(
  items: Array<{ superset_group: number | null }>
): number {
  let max = 0;
  for (const item of items) {
    if (item.superset_group !== null && item.superset_group > max) {
      max = item.superset_group;
    }
  }
  return max + 1;
}
