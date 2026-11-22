export interface IsoDayLabel {
  day: number;
  short: string;
  full: string;
}

export const ISO_DAY_LABELS: readonly IsoDayLabel[] = [
  { day: 1, short: "Mon", full: "Monday" },
  { day: 2, short: "Tue", full: "Tuesday" },
  { day: 3, short: "Wed", full: "Wednesday" },
  { day: 4, short: "Thu", full: "Thursday" },
  { day: 5, short: "Fri", full: "Friday" },
  { day: 6, short: "Sat", full: "Saturday" },
  { day: 7, short: "Sun", full: "Sunday" },
] as const;

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Formats a Date into a local calendar date string (YYYY-MM-DD).
 * Never uses UTC toISOString(), avoiding timezone date shifts.
 */
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(date.getDate())}`;
}

export function getTodayLocalDate(): string {
  return toLocalDateString(new Date());
}

/**
 * Parses YYYY-MM-DD into a local Date anchored at 12:00 noon
 * to avoid DST midnight boundary shifts when stepping days.
 */
export function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-");
  const year = Number(parts[0] ?? 1970);
  const month = Number(parts[1] ?? 1);
  const day = Number(parts[2] ?? 1);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Returns ISO weekday number: 1 (Monday) through 7 (Sunday).
 */
export function getIsoDayOfWeek(dateStr: string): number {
  const jsDay = parseLocalDate(dateStr).getDay();
  return jsDay === 0 ? 7 : jsDay;
}

export function addDays(dateStr: string, days: number): string {
  const date = parseLocalDate(dateStr);
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

/**
 * Returns Monday-first grid dates covering the requested month.
 */
export function getMonthGridDates(year: number, monthIndex0: number): string[] {
  const firstOfMonth = toLocalDateString(
    new Date(year, monthIndex0, 1, 12, 0, 0, 0)
  );
  const leadDays = getIsoDayOfWeek(firstOfMonth) - 1;
  const daysInMonth = new Date(year, monthIndex0 + 1, 0).getDate();
  const totalCells = Math.ceil((leadDays + daysInMonth) / 7) * 7;
  const gridStart = addDays(firstOfMonth, -leadDays);

  const dates: string[] = [];
  for (let i = 0; i < totalCells; i += 1) {
    dates.push(addDays(gridStart, i));
  }
  return dates;
}

/**
 * Returns the 7 dates (Monday..Sunday) for the week containing anchorDateStr.
 */
export function getWeekDates(anchorDateStr: string): string[] {
  const offset = getIsoDayOfWeek(anchorDateStr) - 1;
  const monday = addDays(anchorDateStr, -offset);
  const dates: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    dates.push(addDays(monday, i));
  }
  return dates;
}

export function shiftMonth(
  year: number,
  monthIndex0: number,
  deltaMonths: number
): { year: number; monthIndex0: number } {
  const shifted = new Date(year, monthIndex0 + deltaMonths, 1, 12, 0, 0, 0);
  return {
    year: shifted.getFullYear(),
    monthIndex0: shifted.getMonth(),
  };
}

export function formatDayHeader(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseLocalDate(dateStr));
}

export function formatMonthTitle(year: number, monthIndex0: number): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, monthIndex0, 1, 12, 0, 0, 0));
}
