import type { WeightUnit } from "@/lib/types/domain";

export type DistanceUnit = "km" | "mi";
export type SpeedUnit = "km/h" | "mph";

export interface CardioMetricValues {
  duration_seconds?: number | null;
  distance?: number | null;
  speed?: number | null;
  resistance?: number | null;
  incline?: number | null;
}

export function getDistanceUnit(weightUnit: WeightUnit): DistanceUnit {
  return weightUnit === "lbs" ? "mi" : "km";
}

export function getSpeedUnit(weightUnit: WeightUnit): SpeedUnit {
  return weightUnit === "lbs" ? "mph" : "km/h";
}

/**
 * Parses user-entered cardio time into integer seconds.
 * Accepts "mm:ss" (e.g. "20:30" -> 1230), "hh:mm:ss" (e.g. "1:05:00" -> 3900),
 * or decimal minutes (e.g. "20" -> 1200, "12.5" -> 750).
 */
export function parseCardioTimeInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2 && parts.length !== 3) return null;

    const nums = parts.map((p) => {
      const cleaned = p.trim();
      if (cleaned.length === 0) return NaN;
      return Number(cleaned);
    });
    if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;

    let totalSeconds = 0;
    if (nums.length === 2) {
      const mins = nums[0] ?? 0;
      const secs = nums[1] ?? 0;
      if (secs >= 60) return null;
      totalSeconds = Math.round(mins * 60 + secs);
    } else {
      const hrs = nums[0] ?? 0;
      const mins = nums[1] ?? 0;
      const secs = nums[2] ?? 0;
      if (mins >= 60 || secs >= 60) return null;
      totalSeconds = Math.round(hrs * 3600 + mins * 60 + secs);
    }

    return totalSeconds >= 0 && totalSeconds <= 86400 ? totalSeconds : null;
  }

  const minutes = Number(trimmed);
  if (!Number.isFinite(minutes) || minutes < 0) return null;
  const totalSeconds = Math.round(minutes * 60);
  return totalSeconds <= 86400 ? totalSeconds : null;
}

/**
 * Formats integer seconds into an editable "m:ss" / "h:mm:ss" string (empty if null/<=0).
 */
export function formatCardioDurationInput(
  seconds: number | null | undefined
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "";
  }
  const safe = Math.max(0, Math.round(seconds));
  if (safe === 0) return "";
  return formatCardioDurationDisplay(safe);
}

/**
 * Formats seconds as clock duration: "m:ss" or "h:mm:ss".
 */
export function formatCardioDurationDisplay(
  seconds: number | null | undefined
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "0:00";
  }
  const safe = Math.max(0, Math.round(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  const totalMins = Math.floor(safe / 60);
  return `${totalMins}:${String(secs).padStart(2, "0")}`;
}

/**
 * Formats seconds into compact KPI text such as "45s", "20m", "20m 30s", or "1h 05m".
 */
export function formatCardioDurationCompact(
  seconds: number | null | undefined
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return "0m";
  }
  const safe = Math.max(0, Math.round(seconds));
  if (safe === 0) return "0m";
  if (safe < 60) return `${safe}s`;

  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hrs > 0) {
    return mins > 0 ? `${hrs}h ${String(mins).padStart(2, "0")}m` : `${hrs}h`;
  }
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export function formatCardioDecimal(
  value: number | null | undefined,
  maxDecimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "";
  }
  return Number(value.toFixed(maxDecimals)).toString();
}

export function hasAnyCardioMetrics(set: CardioMetricValues): boolean {
  return Boolean(
    (set.duration_seconds !== null &&
      set.duration_seconds !== undefined &&
      set.duration_seconds > 0) ||
      (set.distance !== null && set.distance !== undefined && set.distance > 0) ||
      (set.speed !== null && set.speed !== undefined && set.speed > 0) ||
      (set.resistance !== null && set.resistance !== undefined) ||
      (set.incline !== null && set.incline !== undefined)
  );
}

export function formatCardioSetSummary(
  set: CardioMetricValues,
  weightUnit: WeightUnit
): string {
  const parts: string[] = [];

  if (
    set.duration_seconds !== null &&
    set.duration_seconds !== undefined &&
    set.duration_seconds > 0
  ) {
    parts.push(formatCardioDurationDisplay(set.duration_seconds));
  }

  if (set.distance !== null && set.distance !== undefined && set.distance > 0) {
    parts.push(
      `${formatCardioDecimal(set.distance)} ${getDistanceUnit(weightUnit)}`
    );
  }

  if (set.speed !== null && set.speed !== undefined && set.speed > 0) {
    parts.push(
      `${formatCardioDecimal(set.speed)} ${getSpeedUnit(weightUnit)}`
    );
  }

  if (set.resistance !== null && set.resistance !== undefined) {
    parts.push(`Lvl ${formatCardioDecimal(set.resistance)}`);
  }

  if (set.incline !== null && set.incline !== undefined) {
    parts.push(`${formatCardioDecimal(set.incline)}% inc`);
  }

  return parts.length > 0 ? parts.join(" • ") : "—";
}

export function computeCardioTotals(
  sets: ReadonlyArray<CardioMetricValues & { is_completed?: boolean }>
): {
  totalCardioSeconds: number;
  totalDistance: number;
  cardioSets: number;
} {
  let totalCardioSeconds = 0;
  let totalDistance = 0;
  let cardioSets = 0;

  for (const s of sets) {
    if (s.is_completed === false) continue;
    if (!hasAnyCardioMetrics(s)) continue;
    cardioSets += 1;
    if (
      s.duration_seconds !== null &&
      s.duration_seconds !== undefined &&
      s.duration_seconds > 0
    ) {
      totalCardioSeconds += s.duration_seconds;
    }
    if (s.distance !== null && s.distance !== undefined && s.distance > 0) {
      totalDistance += s.distance;
    }
  }

  return {
    totalCardioSeconds,
    totalDistance: Math.round(totalDistance * 100) / 100,
    cardioSets,
  };
}
