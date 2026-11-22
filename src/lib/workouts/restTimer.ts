export function computeRemainingSeconds(
  endAt: number | null,
  nowMs = Date.now()
): number {
  if (endAt === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((endAt - nowMs) / 1000));
}

export function adjustTimerEndAt(
  endAt: number,
  deltaSeconds: number,
  durationSeconds: number,
  nowMs = Date.now()
): { endAt: number | null; durationSeconds: number } {
  const nextEndAt = endAt + deltaSeconds * 1000;
  const remaining = computeRemainingSeconds(nextEndAt, nowMs);
  if (remaining <= 0) {
    return {
      endAt: null,
      durationSeconds: 0,
    };
  }

  return {
    endAt: nextEndAt,
    durationSeconds: Math.max(durationSeconds, remaining),
  };
}

export function isTimerFinished(
  endAt: number | null,
  nowMs = Date.now()
): boolean {
  return endAt !== null && nowMs >= endAt;
}
