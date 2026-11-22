"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Upload, X } from "lucide-react";
import {
  parseBackupJsonText,
  type BackupImportSummary,
  type ValidatedJsonBackup,
} from "@/lib/export/workoutImport";
import { syncIfStale } from "@/lib/offline/syncEngine";

interface ImportBackupModalProps {
  open: boolean;
  onClose: () => void;
  onImported: (summary: BackupImportSummary) => void;
}

export function ImportBackupModal({
  open,
  onClose,
  onImported,
}: ImportBackupModalProps) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedBackup, setParsedBackup] = useState<ValidatedJsonBackup | null>(
    null
  );
  const [summary, setSummary] = useState<BackupImportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFileName(null);
    setParsedBackup(null);
    setSummary(null);
    setErrorMessage(null);
    setImporting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !importing) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, importing, onClose]);

  if (!open) {
    return null;
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setErrorMessage(null);
    setParsedBackup(null);
    setSummary(null);

    if (!file) {
      setFileName(null);
      return;
    }

    setFileName(file.name);
    try {
      const text = await file.text();
      const result = parseBackupJsonText(text);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }
      setParsedBackup(result.backup);
      setSummary(result.summary);
    } catch {
      setErrorMessage("Could not read selected file.");
    }
  }

  async function handleConfirmImport() {
    if (!parsedBackup || !summary) return;
    setImporting(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(parsedBackup),
      });

      if (!res.ok) {
        let message = `Import failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) {
            message = body.error;
          }
        } catch {
          // ignore invalid JSON error payload
        }
        setErrorMessage(message);
        return;
      }

      await syncIfStale();
      router.refresh();
      onImported(summary);
      onClose();
    } catch {
      setErrorMessage("Network error while importing backup.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Import Backup JSON"
      className="fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white"
    >
      <header className="pt-safe shrink-0 border-b border-zinc-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={importing}
              onClick={onClose}
              aria-label="Close backup importer"
              className="-ml-2 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <h2 className="text-base font-bold tracking-tight text-zinc-950">
              Import Backup (JSON)
            </h2>
          </div>

          <button
            type="button"
            disabled={!parsedBackup || importing}
            onClick={() => void handleConfirmImport()}
            className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-500"
          >
            {importing ? "Importing..." : "Confirm Import"}
          </button>
        </div>
      </header>

      <div className="pb-safe flex-1 overflow-y-auto bg-white">
        <div className="space-y-2 border-b border-zinc-200 px-4 py-4 sm:px-6">
          <label
            htmlFor="import-backup-file"
            className="block text-xs font-semibold uppercase tracking-wider text-zinc-500"
          >
            Select Pumped Backup JSON File
          </label>
          <p className="text-xs leading-relaxed text-zinc-500">
            Restores exercises, routines, weekly split rules, calendar slots,
            completed workouts, sets, and preferences without erasing unrelated
            local entries.
          </p>

          <label
            htmlFor="import-backup-file"
            className="mt-2 flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 transition-colors hover:border-emerald-500 hover:bg-emerald-50/40"
          >
            <Upload className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span className="truncate">
              {fileName ? fileName : "Choose pumped-backup-*.json"}
            </span>
          </label>
          <input
            id="import-backup-file"
            type="file"
            accept=".json,application/json"
            onChange={(e) => void handleFileChange(e)}
            className="sr-only"
          />
        </div>

        {errorMessage && (
          <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:px-6">
            {errorMessage}
          </div>
        )}

        {summary && (
          <section className="border-b border-zinc-200">
            <div className="flex items-center gap-2 border-b border-zinc-200 bg-emerald-50/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-emerald-800 sm:px-6">
              <CheckCircle2
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              <span>Valid Backup Ready to Restore</span>
            </div>

            <div className="border-b border-zinc-200 px-4 py-3 text-xs text-zinc-600 sm:px-6">
              Exported:{" "}
              <span className="font-semibold text-zinc-950">
                {new Date(summary.exportedAt).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 divide-x divide-y divide-zinc-200 sm:grid-cols-4">
              {[
                { label: "Exercises", val: summary.exercises },
                { label: "Routines", val: summary.routines },
                { label: "Routine Links", val: summary.routineExercises },
                { label: "Weekly Rules", val: summary.weeklySplitRules },
                { label: "Scheduled Slots", val: summary.scheduledWorkouts },
                { label: "Workouts", val: summary.workouts },
                { label: "Logged Sets", val: summary.workoutSets },
                {
                  label: "Settings",
                  val: summary.hasSettings ? "Included" : "Skipped",
                },
              ].map((cell) => (
                <div key={cell.label} className="px-4 py-3 sm:px-6">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                    {cell.label}
                  </p>
                  <p className="tabular-nums mt-0.5 text-base font-bold text-zinc-950">
                    {cell.val}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
