"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { ImportBackupModal } from "@/components/settings/ImportBackupModal";
import { toLocalDateString } from "@/lib/dates/localDate";
import {
  buildJsonBackup,
  buildWorkoutsCsv,
  type ExportDataset,
} from "@/lib/export/workoutExport";
import { readAllLocalData } from "@/lib/offline/db";
import { useSyncStore } from "@/stores/useSyncStore";

interface DataExportSectionProps {
  isConfigured: boolean;
}

function triggerFileDownload(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function DataExportSection({ isConfigured }: DataExportSectionProps) {
  const pendingCount = useSyncStore((state) => state.pendingCount);
  const [exporting, setExporting] = useState<"json" | "csv" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  async function exportFromLocal(format: "json" | "csv", dateStamp: string) {
    const local = await readAllLocalData();
    const dataset: ExportDataset = {
      exercises: local.exercises,
      routines: local.routines,
      routineExercises: local.routineExercises,
      weeklySplitRules: local.weeklySplitRules,
      scheduledWorkouts: local.scheduledWorkouts,
      workouts: local.workouts,
      workoutSets: local.workoutSets,
      settings: local.settings,
    };

    if (format === "csv") {
      const csv = buildWorkoutsCsv(dataset);
      triggerFileDownload(
        csv,
        `pumped-workouts-${dateStamp}.csv`,
        "text/csv;charset=utf-8"
      );
      setFeedback({
        kind: "success",
        text: "Exported workout sets CSV from local cache.",
      });
      return;
    }

    const backup = buildJsonBackup(dataset);
    triggerFileDownload(
      JSON.stringify(backup, null, 2),
      `pumped-backup-${dateStamp}.json`,
      "application/json;charset=utf-8"
    );
    setFeedback({
      kind: "success",
      text: "Exported full backup JSON from local cache.",
    });
  }

  async function handleExport(format: "json" | "csv") {
    setExporting(format);
    setFeedback(null);

    const dateStamp = toLocalDateString(new Date());
    const online = typeof navigator === "undefined" ? true : navigator.onLine;

    try {
      if (online && isConfigured) {
        const res = await fetch(`/api/export?format=${format}`, {
          cache: "no-store",
        });
        if (res.ok) {
          const content = await res.text();
          if (format === "csv") {
            triggerFileDownload(
              content,
              `pumped-workouts-${dateStamp}.csv`,
              "text/csv;charset=utf-8"
            );
            setFeedback({
              kind: "success",
              text: "Downloaded full workout sets CSV.",
            });
          } else {
            triggerFileDownload(
              content,
              `pumped-backup-${dateStamp}.json`,
              "application/json;charset=utf-8"
            );
            setFeedback({
              kind: "success",
              text: "Downloaded complete database backup JSON.",
            });
          }
          return;
        }
      }

      await exportFromLocal(format, dateStamp);
    } catch (error: unknown) {
      setFeedback({
        kind: "error",
        text:
          error instanceof Error ? error.message : "Failed to export workout data.",
      });
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
          Data &amp; Backups
        </h2>
      </div>

      <div className="divide-y divide-zinc-200">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Download className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-950">
                Full Backup (JSON)
              </p>
              <p className="text-xs text-zinc-500">
                All exercises, routines, calendar schedule, workouts &amp; settings
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => void handleExport("json")}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-60 sm:w-auto"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>
              {exporting === "json" ? "Exporting..." : "Export Full Backup (JSON)"}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FileSpreadsheet
              className="h-5 w-5 shrink-0 text-zinc-500"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-950">
                Workout Sets Spreadsheet (CSV)
              </p>
              <p className="text-xs text-zinc-500">
                Per-set log with Epley Est. 1RM, working volume &amp; PR flags
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => void handleExport("csv")}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-60 sm:w-auto"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            <span>
              {exporting === "csv" ? "Exporting..." : "Export Workout Sets (CSV)"}
            </span>
          </button>
        </div>

        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Upload className="h-5 w-5 shrink-0 text-zinc-500" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-950">
                Restore Backup (JSON)
              </p>
              <p className="text-xs text-zinc-500">
                Merge routines, schedule, workouts &amp; settings from an exported file
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={!isConfigured || pendingCount > 0}
            onClick={() => {
              setFeedback(null);
              setImportOpen(true);
            }}
            className="inline-flex min-h-[44px] w-full shrink-0 items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3.5 text-xs font-semibold text-zinc-800 transition-colors hover:bg-zinc-50 disabled:opacity-50 sm:w-auto"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Import Backup (JSON)</span>
          </button>
        </div>

        {feedback && (
          <div
            role="status"
            className={`px-4 py-2.5 text-xs font-medium sm:px-6 ${
              feedback.kind === "error"
                ? "bg-rose-50 text-rose-700"
                : "bg-emerald-50/70 text-emerald-800"
            }`}
          >
            {feedback.text}
          </div>
        )}
      </div>

      <ImportBackupModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={(summary) =>
          setFeedback({
            kind: "success",
            text: `Imported ${summary.routines} routines, ${summary.workouts} workouts, and ${summary.workoutSets} sets.`,
          })
        }
      />
    </section>
  );
}
