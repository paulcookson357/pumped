"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  ISO_DAY_LABELS,
  formatMonthTitle,
  getMonthGridDates,
  getWeekDates,
  parseLocalDate,
} from "@/lib/dates/localDate";

export interface CalendarDot {
  color: string;
  status: "planned" | "completed" | "skipped";
}

interface CalendarGridProps {
  mode: "month" | "week";
  onModeChange: (mode: "month" | "week") => void;
  viewYear: number;
  viewMonthIndex0: number;
  selectedDate: string;
  todayDate: string;
  onSelectDate: (dateStr: string) => void;
  onStepPeriod: (delta: -1 | 1) => void;
  onJumpToday: () => void;
  dotsByDate: Map<string, CalendarDot[]>;
}

export function CalendarGrid({
  mode,
  onModeChange,
  viewYear,
  viewMonthIndex0,
  selectedDate,
  todayDate,
  onSelectDate,
  onStepPeriod,
  onJumpToday,
  dotsByDate,
}: CalendarGridProps) {
  const dates = useMemo(() => {
    if (mode === "week") {
      return getWeekDates(selectedDate);
    }
    return getMonthGridDates(viewYear, viewMonthIndex0);
  }, [mode, selectedDate, viewYear, viewMonthIndex0]);

  const headerTitle = useMemo(() => {
    if (mode === "week") {
      const parsed = parseLocalDate(selectedDate);
      return formatMonthTitle(parsed.getFullYear(), parsed.getMonth());
    }
    return formatMonthTitle(viewYear, viewMonthIndex0);
  }, [mode, selectedDate, viewYear, viewMonthIndex0]);

  return (
    <section className="-mx-4 border-y border-zinc-200 bg-white sm:-mx-6">
      {/* Month / Week navigation toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onStepPeriod(-1)}
            aria-label={mode === "week" ? "Previous week" : "Previous month"}
            className="-ml-2 flex h-11 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span className="min-w-[132px] text-center text-sm font-bold tracking-tight text-zinc-950">
            {headerTitle}
          </span>
          <button
            type="button"
            onClick={() => onStepPeriod(1)}
            aria-label={mode === "week" ? "Next week" : "Next month"}
            className="flex h-11 w-10 items-center justify-center rounded-lg text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onJumpToday}
            className="min-h-[36px] rounded-full border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Today
          </button>
          <div
            role="group"
            aria-label="Calendar view mode"
            className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
          >
            <button
              type="button"
              onClick={() => onModeChange("month")}
              className={`min-h-[32px] rounded-md px-2.5 text-xs font-medium transition-colors ${
                mode === "month"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => onModeChange("week")}
              className={`min-h-[32px] rounded-md px-2.5 text-xs font-medium transition-colors ${
                mode === "week"
                  ? "bg-white text-zinc-950 shadow-2xs"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Mon..Sun Weekday headers */}
      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/40">
        {ISO_DAY_LABELS.map(({ day, short }) => (
          <div
            key={day}
            className="py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
          >
            {short}
          </div>
        ))}
      </div>

      {/* Date cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100">
        {dates.map((dateStr) => {
          const parsed = parseLocalDate(dateStr);
          const dayNum = parsed.getDate();
          const inCurrentMonth =
            mode === "week" || parsed.getMonth() === viewMonthIndex0;
          const isToday = dateStr === todayDate;
          const isSelected = dateStr === selectedDate;
          const dots = dotsByDate.get(dateStr) ?? [];

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              aria-label={`Select ${dateStr}`}
              aria-pressed={isSelected}
              className={`flex min-h-[54px] flex-col items-center justify-start pt-1.5 pb-1.5 transition-colors hover:bg-zinc-50 active:bg-zinc-100 ${
                isSelected ? "bg-zinc-50" : "bg-white"
              }`}
            >
              <span
                className={`tabular-nums flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                  isSelected
                    ? "bg-zinc-950 font-semibold text-white"
                    : isToday
                      ? "font-bold text-emerald-700 ring-1 ring-emerald-600"
                      : inCurrentMonth
                        ? "font-medium text-zinc-900"
                        : "font-normal text-zinc-300"
                }`}
              >
                {dayNum}
              </span>

              <div className="mt-1 flex min-h-[8px] items-center justify-center gap-1">
                {dots.slice(0, 3).map((dot, idx) => {
                  if (dot.status === "completed") {
                    return (
                      <span
                        key={`${dateStr}-dot-${idx}`}
                        className="h-1.5 w-1.5 rounded-full bg-emerald-600"
                      />
                    );
                  }
                  if (dot.status === "skipped") {
                    return (
                      <span
                        key={`${dateStr}-dot-${idx}`}
                        className="h-1.5 w-1.5 rounded-full border"
                        style={{ borderColor: dot.color }}
                      />
                    );
                  }
                  return (
                    <span
                      key={`${dateStr}-dot-${idx}`}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: dot.color }}
                    />
                  );
                })}
                {dots.length > 3 && (
                  <span className="text-[9px] leading-none font-bold text-zinc-400">
                    +
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
