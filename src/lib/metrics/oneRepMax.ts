function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Estimates 1-Rep Max using the Epley formula.
 * Returns 0 when weight or reps are non-positive, and returns exact weight for 1RM singles.
 */
export function calculateEpley1RM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) {
    return 0;
  }
  if (weight <= 0 || reps <= 0) {
    return 0;
  }
  if (reps === 1) {
    return roundToTwoDecimals(weight);
  }
  return roundToTwoDecimals(weight * (1 + reps / 30));
}
