"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronRight, TrendingUp } from "lucide-react";
import { formatDayHeader } from "@/lib/dates/localDate";
import type { WeightUnit } from "@/lib/types/domain";
import {
  filterProgressByTimeRange,
  type ExerciseProgressPoint,
  type ProgressMetric,
  type ProgressTimeRange,
} from "@/lib/workouts/progress";
import { formatNumberCompact } from "@/lib/workouts/stats";

interface ExerciseProgressChartProps {
  points: ExerciseProgressPoint[];
  weightUnit: WeightUnit;
}

const TIME_RANGES: ReadonlyArray<{ id: ProgressTimeRange; label: string }> = [
  { id: "1M", label: "1M" },
  { id: "3M", label: "3M" },
  { id: "6M", label: "6M" },
  { id: "1Y", label: "1Y" },
  { id: "ALL", label: "All" },
];

const METRICS: ReadonlyArray<{ id: ProgressMetric; label: string }> = [
  { id: "est_1rm", label: "Est. 1RM" },
  { id: "max_weight", label: "Max Weight" },
  { id: "total_volume", label: "Volume" },
];

const SVG_WIDTH = 640;
const SVG_HEIGHT = 240;
const PAD_LEFT = 52;
const PAD_RIGHT = 20;
const PAD_TOP = 20;
const PAD_BOTTOM = 34;

function getMetricValue(
  point: ExerciseProgressPoint,
  metric: ProgressMetric
): number {
  switch (metric) {
    case "est_1rm":
      return point.best_est_1rm;
    case "max_weight":
      return point.max_weight;
    case "total_volume":
      return point.total_volume;
  }
}

export function ExerciseProgressChart({
  points,
  weightUnit,
}: ExerciseProgressChartProps) {
  const [range, setRange] = useState<ProgressTimeRange>("ALL");
  const [metric, setMetric] = useState<ProgressMetric>("est_1rm");
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const filtered = useMemo(
    () => filterProgressByTimeRange(points, range),
    [points, range]
  );

  useEffect(() => {
    setSelectedIndex(Math.max(0, filtered.length - 1));
  }, [filtered.length, range, metric]);

  const activeIndex =
    filtered.length === 0
      ? 0
      : Math.min(selectedIndex, filtered.length - 1);
  const selectedPoint = filtered[activeIndex];

  const chartGeometry = useMemo(() => {
    if (filtered.length === 0) {
      return null;
    }

    const values = filtered.map((p) => getMetricValue(p, metric));
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);

    let yMin: number;
    let yMax: number;

    if (rawMax === rawMin) {
      const pad = Math.max(5, Math.round(rawMax * 0.15));
      yMin = Math.max(0, rawMin - pad);
      yMax = rawMax + pad;
    } else {
      const span = rawMax - rawMin;
      yMin = Math.max(0, rawMin - span * 0.15);
      yMax = rawMax + span * 0.15;
    }

    if (yMax <= yMin) {
      yMax = yMin + 10;
    }

    const plotW = SVG_WIDTH - PAD_LEFT - PAD_RIGHT;
    const plotH = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;

    const coords = filtered.map((p, idx) => {
      const val = getMetricValue(p, metric);
      const x =
        filtered.length === 1
          ? PAD_LEFT + plotW / 2
          : PAD_LEFT + (idx / (filtered.length - 1)) * plotW;
      const ratio = (val - yMin) / (yMax - yMin);
      const y = PAD_TOP + plotH - ratio * plotH;
      return { point: p, val, x, y };
    });

    const ticks = [0, 1, 2, 3].map((step) => {
      const ratio = step / 3;
      const tickVal = yMin + (yMax - yMin) * ratio;
      const tickY = PAD_TOP + plotH - ratio * plotH;
      return { tickVal, tickY };
    });

    const linePoints = coords.map((c) => `${c.x},${c.y}`).join(" ");
    const first = coords[0];
    const last = coords[coords.length - 1];
    const baselineY = PAD_TOP + plotH;
    const areaPath =
      first && last && coords.length > 1
        ? `M ${first.x},${baselineY} L ${coords
            .map((c) => `${c.x},${c.y}`)
            .join(" L ")} L ${last.x},${baselineY} Z`
        : "";

    return {
      coords,
      ticks,
      linePoints,
      areaPath,
      baselineY,
    };
  }, [filtered, metric]);

  const metricLabel =
    METRICS.find((m) => m.id === metric)?.label ?? "Est. 1RM";

  return (
    <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
      <div className="space-y-3 px-4 py-4 sm:px-6">
        {/* Metric + Time Range controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Progress metric">
            {METRICS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMetric(m.id)}
                className={`min-h-[36px] rounded-full border px-3 text-xs font-semibold transition-colors ${
                  metric === m.id
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5" role="group" aria-label="Time range">
            {TIME_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRange(r.id)}
                className={`min-h-[32px] rounded-md px-2.5 text-xs font-semibold transition-colors ${
                  range === r.id
                    ? "bg-white text-zinc-950 shadow-xs"
                    : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Selected Data Point Telemetry Header */}
        {selectedPoint ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-zinc-50/70 px-3.5 py-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                {formatDayHeader(selectedPoint.workout_date)} • {metricLabel}
              </p>
              <div className="tabular-nums mt-0.5 flex flex-wrap items-baseline gap-2">
                <span className="text-xl font-bold text-zinc-950">
                  {formatNumberCompact(getMetricValue(selectedPoint, metric))}{" "}
                  {weightUnit}
                </span>
                {selectedPoint.best_set_weight !== null &&
                  selectedPoint.best_set_reps !== null && (
                    <span className="text-xs font-medium text-zinc-500">
                      Best set: {formatNumberCompact(selectedPoint.best_set_weight)}{" "}
                      {weightUnit} × {selectedPoint.best_set_reps}
                    </span>
                  )}
              </div>
            </div>

            <Link
              href={`/history/${selectedPoint.workout_id}`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-emerald-700 hover:bg-zinc-50"
            >
              <span>Session</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="mt-2.5 text-sm font-semibold text-zinc-950">
              No chart data for {range}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {points.length === 0
                ? "Complete working sets for this exercise to chart strength progress."
                : "Try selecting All to view earlier logged sessions."}
            </p>
          </div>
        )}

        {/* Responsive Vector SVG Chart */}
        {chartGeometry && (
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              role="img"
              aria-label={`${metricLabel} progression chart`}
              className="h-auto w-full select-none overflow-visible"
            >
              <defs>
                <linearGradient
                  id="pumpedProgressArea"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#059669" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#059669" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal dashed gridlines & Y labels */}
              {chartGeometry.ticks.map((t, i) => (
                <g key={i}>
                  <line
                    x1={PAD_LEFT}
                    y1={t.tickY}
                    x2={SVG_WIDTH - PAD_RIGHT}
                    y2={t.tickY}
                    stroke="#E4E4E7"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_LEFT - 8}
                    y={t.tickY + 4}
                    textAnchor="end"
                    fontSize="11"
                    fill="#71717A"
                    style={{ fontVariantNumeric: "tabular-nums" }}
                  >
                    {formatNumberCompact(Math.round(t.tickVal))}
                  </text>
                </g>
              ))}

              {/* Shaded area under curve */}
              {chartGeometry.areaPath && (
                <path
                  d={chartGeometry.areaPath}
                  fill="url(#pumpedProgressArea)"
                />
              )}

              {/* Polyline */}
              {chartGeometry.coords.length > 1 && (
                <polyline
                  fill="none"
                  stroke="#059669"
                  strokeWidth="2.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={chartGeometry.linePoints}
                />
              )}

              {/* Single-point horizontal guide */}
              {chartGeometry.coords.length === 1 && chartGeometry.coords[0] && (
                <line
                  x1={PAD_LEFT}
                  y1={chartGeometry.coords[0].y}
                  x2={SVG_WIDTH - PAD_RIGHT}
                  y2={chartGeometry.coords[0].y}
                  stroke="#A7F3D0"
                  strokeDasharray="6 4"
                  strokeWidth="2"
                />
              )}

              {/* Selected vertical crosshair */}
              {chartGeometry.coords[activeIndex] && (
                <line
                  x1={chartGeometry.coords[activeIndex].x}
                  y1={PAD_TOP}
                  x2={chartGeometry.coords[activeIndex].x}
                  y2={chartGeometry.baselineY}
                  stroke="#10B981"
                  strokeDasharray="3 3"
                  strokeWidth="1.25"
                />
              )}

              {/* X-axis start/end dates */}
              {chartGeometry.coords[0] && (
                <text
                  x={chartGeometry.coords[0].x}
                  y={SVG_HEIGHT - 8}
                  textAnchor={
                    chartGeometry.coords.length === 1 ? "middle" : "start"
                  }
                  fontSize="11"
                  fill="#71717A"
                >
                  {chartGeometry.coords[0].point.workout_date.slice(5)}
                </text>
              )}
              {chartGeometry.coords.length > 1 &&
                chartGeometry.coords[chartGeometry.coords.length - 1] && (
                  <text
                    x={
                      chartGeometry.coords[chartGeometry.coords.length - 1]?.x ??
                      0
                    }
                    y={SVG_HEIGHT - 8}
                    textAnchor="end"
                    fontSize="11"
                    fill="#71717A"
                  >
                    {chartGeometry.coords[
                      chartGeometry.coords.length - 1
                    ]?.point.workout_date.slice(5)}
                  </text>
                )}

              {/* Interactive data points */}
              {chartGeometry.coords.map((c, idx) => {
                const isSelected = idx === activeIndex;
                return (
                  <g
                    key={c.point.workout_id}
                    onClick={() => setSelectedIndex(idx)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className="cursor-pointer"
                  >
                    <circle cx={c.x} cy={c.y} r="16" fill="transparent" />
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r={isSelected ? "6.5" : "4.5"}
                      fill={isSelected ? "#059669" : "#FFFFFF"}
                      stroke="#059669"
                      strokeWidth="2.5"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
