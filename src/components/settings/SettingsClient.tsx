"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Scale, SlidersHorizontal, Timer, Volume2 } from "lucide-react";
import { DataExportSection } from "@/components/settings/DataExportSection";
import { SyncCacheInspectorSection } from "@/components/settings/SyncCacheInspectorSection";
import { playRestCompleteFeedback } from "@/lib/audio/restChime";
import { putLocalSettings } from "@/lib/offline/db";
import { enqueueAndSync } from "@/lib/offline/syncEngine";
import type { AppSettings, SyncDomain, WeightUnit } from "@/lib/types/domain";
import { updateSettingsPayloadSchema } from "@/lib/validation/schemas";
import { useAppDataStore } from "@/stores/useAppDataStore";
import { useSyncStore } from "@/stores/useSyncStore";

interface SettingsClientProps {
  isConfigured: boolean;
  initialSettings: AppSettings | null;
  initialRemoteVersions: Record<SyncDomain, number>;
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 1,
  weight_unit: "kg",
  default_rest_seconds: 90,
  auto_start_rest_timer: true,
  show_rpe_column: true,
  timer_sound_enabled: true,
  timer_haptics_enabled: true,
  updated_at: "",
};

const REST_PRESETS = [30, 60, 90, 120, 180] as const;

interface SwitchRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  onToggle,
}: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
        <p className="text-sm font-medium text-zinc-950">{label}</p>
        <p className="text-xs text-zinc-500">{description}</p>
      </label>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className="inline-flex min-h-[44px] min-w-[48px] shrink-0 items-center justify-end"
      >
        <span
          aria-hidden="true"
          className={`inline-flex h-7 w-12 items-center rounded-full p-0.5 transition-colors ${
            checked ? "bg-emerald-600" : "bg-zinc-200"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-sm transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </span>
      </button>
    </div>
  );
}

export function SettingsClient({
  isConfigured,
  initialSettings,
  initialRemoteVersions,
}: SettingsClientProps) {
  const router = useRouter();
  const { hydrated, touchedDomains, settings: storeSettings } =
    useAppDataStore();
  const pendingCount = useSyncStore((state) => state.pendingCount);

  const shouldReconcileSettings =
    hydrated &&
    !touchedDomains.settings &&
    storeSettings === null &&
    initialSettings !== null &&
    pendingCount === 0;

  useEffect(() => {
    if (shouldReconcileSettings && initialSettings) {
      useAppDataStore.getState().setSettings(initialSettings);
      void putLocalSettings(initialSettings);
    }
  }, [shouldReconcileSettings, initialSettings]);

  const effectiveSettings: AppSettings =
    (!hydrated || shouldReconcileSettings ? initialSettings : storeSettings) ??
    initialSettings ??
    DEFAULT_SETTINGS;

  const [restInput, setRestInput] = useState(
    String(effectiveSettings.default_rest_seconds)
  );
  const [restError, setRestError] = useState<string | null>(null);
  const [chimeNotice, setChimeNotice] = useState<string | null>(null);

  useEffect(() => {
    setRestInput(String(effectiveSettings.default_rest_seconds));
  }, [effectiveSettings.default_rest_seconds]);

  async function saveSettingsPatch(
    patch: Partial<Omit<AppSettings, "id" | "updated_at">>
  ): Promise<boolean> {
    const now = new Date().toISOString();
    const candidate = {
      weight_unit: patch.weight_unit ?? effectiveSettings.weight_unit,
      default_rest_seconds:
        patch.default_rest_seconds ?? effectiveSettings.default_rest_seconds,
      auto_start_rest_timer:
        patch.auto_start_rest_timer ?? effectiveSettings.auto_start_rest_timer,
      show_rpe_column:
        patch.show_rpe_column ?? effectiveSettings.show_rpe_column,
      timer_sound_enabled:
        patch.timer_sound_enabled ?? effectiveSettings.timer_sound_enabled,
      timer_haptics_enabled:
        patch.timer_haptics_enabled ?? effectiveSettings.timer_haptics_enabled,
    };

    const parsed = updateSettingsPayloadSchema.safeParse(candidate);
    if (!parsed.success) {
      setRestError("Enter a rest duration between 0 and 900 seconds.");
      return false;
    }

    setRestError(null);
    const optimisticSettings: AppSettings = {
      id: 1,
      ...parsed.data,
      updated_at: now,
    };

    useAppDataStore.getState().setSettings(optimisticSettings);
    await putLocalSettings(optimisticSettings);

    void enqueueAndSync(
      {
        id: crypto.randomUUID(),
        type: "UPDATE_SETTINGS",
        clientUpdatedAt: now,
        payload: parsed.data,
      },
      "settings:1"
    ).then(() => {
      if (useSyncStore.getState().pendingCount === 0) {
        router.refresh();
      }
    });

    return true;
  }

  function handleApplyCustomRest() {
    const trimmed = restInput.trim();
    const num = Number(trimmed);
    if (trimmed.length === 0 || !Number.isFinite(num) || !Number.isInteger(num)) {
      setRestError("Rest duration must be a whole number (0–900s).");
      return;
    }
    void saveSettingsPatch({ default_rest_seconds: num });
  }

  function handleUnitChange(unit: WeightUnit) {
    if (unit === effectiveSettings.weight_unit) return;
    void saveSettingsPatch({ weight_unit: unit });
  }

  function handleTestChime() {
    if (
      !effectiveSettings.timer_sound_enabled &&
      !effectiveSettings.timer_haptics_enabled
    ) {
      setChimeNotice("Enable sound or haptics to preview.");
      return;
    }
    playRestCompleteFeedback({
      soundEnabled: effectiveSettings.timer_sound_enabled,
      hapticsEnabled: effectiveSettings.timer_haptics_enabled,
    });
    setChimeNotice("Played");
    window.setTimeout(() => setChimeNotice(null), 2000);
  }

  return (
    <div>
      <section className="pb-4">
        <h1 className="text-xl font-bold tracking-tight text-zinc-950">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Personal training defaults, data backups, and backend sync inspector.
        </p>
      </section>

      {/* Training Defaults */}
      <section className="-mx-4 border-y border-zinc-200 bg-white sm:-mx-6">
        <div className="flex items-center gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
          <SlidersHorizontal
            className="h-3.5 w-3.5 text-zinc-500"
            aria-hidden="true"
          />
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Training Defaults
          </h2>
        </div>

        <div className="divide-y divide-zinc-200">
          {/* Weight Unit */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Scale
                className="h-5 w-5 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-zinc-950">
                  Default Weight Unit
                </p>
                <p className="text-xs text-zinc-500">
                  Applied to new workouts, history totals, and charts
                </p>
              </div>
            </div>

            <div
              role="group"
              aria-label="Default weight unit"
              className="inline-flex shrink-0 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 p-0.5"
            >
              {(["kg", "lbs"] as const).map((unit) => {
                const active = effectiveSettings.weight_unit === unit;
                return (
                  <button
                    key={unit}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleUnitChange(unit)}
                    className={`min-h-[40px] min-w-[52px] rounded-md px-3 text-xs font-bold uppercase transition-colors ${
                      active
                        ? "bg-emerald-600 text-white"
                        : "text-zinc-600 hover:text-zinc-950"
                    }`}
                  >
                    {unit}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Default Rest Duration */}
          <div className="space-y-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Timer
                className="h-5 w-5 shrink-0 text-zinc-500"
                aria-hidden="true"
              />
              <div>
                <label
                  htmlFor="settings-default-rest"
                  className="text-sm font-medium text-zinc-950"
                >
                  Default Rest Duration
                </label>
                <p className="text-xs text-zinc-500">
                  Used for newly added exercises (0–900 seconds)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {REST_PRESETS.map((secs) => {
                const active = effectiveSettings.default_rest_seconds === secs;
                return (
                  <button
                    key={secs}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setRestInput(String(secs));
                      void saveSettingsPatch({ default_rest_seconds: secs });
                    }}
                    className={`tabular-nums min-h-[40px] rounded-lg border px-3 text-xs font-semibold transition-colors ${
                      active
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
                    }`}
                  >
                    {secs}s
                  </button>
                );
              })}

              <div className="flex items-center gap-1.5">
                <input
                  id="settings-default-rest"
                  type="text"
                  inputMode="numeric"
                  value={restInput}
                  onChange={(e) => setRestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyCustomRest();
                    }
                  }}
                  aria-label="Custom default rest duration in seconds"
                  className="tabular-nums min-h-[44px] w-20 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 text-center text-base font-semibold text-zinc-950 focus:border-emerald-600 focus:bg-white focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomRest}
                  className="min-h-[44px] rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50"
                >
                  Apply
                </button>
              </div>
            </div>

            {restError && (
              <p className="text-xs font-medium text-rose-600">{restError}</p>
            )}
          </div>

          <SwitchRow
            id="settings-auto-start-rest"
            label="Auto-Start Rest Timer"
            description="Begin countdown automatically when checking off a set"
            checked={effectiveSettings.auto_start_rest_timer}
            onToggle={() =>
              void saveSettingsPatch({
                auto_start_rest_timer: !effectiveSettings.auto_start_rest_timer,
              })
            }
          />

          <SwitchRow
            id="settings-show-rpe"
            label="Show RPE Column"
            description="Display Rating of Perceived Exertion selector during workouts"
            checked={effectiveSettings.show_rpe_column}
            onToggle={() =>
              void saveSettingsPatch({
                show_rpe_column: !effectiveSettings.show_rpe_column,
              })
            }
          />
        </div>
      </section>

      {/* Timer Feedback */}
      <section className="-mx-4 border-b border-zinc-200 bg-white sm:-mx-6">
        <div className="flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50/70 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-zinc-500" aria-hidden="true" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Timer Feedback
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {chimeNotice && (
              <span className="text-xs font-medium text-emerald-700">
                {chimeNotice}
              </span>
            )}
            <button
              type="button"
              onClick={handleTestChime}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
            >
              <Volume2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              <span>Test Chime</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-zinc-200">
          <SwitchRow
            id="settings-timer-sound"
            label="Timer Sound Chime"
            description="Play a two-tone audio cue when rest completes"
            checked={effectiveSettings.timer_sound_enabled}
            onToggle={() =>
              void saveSettingsPatch({
                timer_sound_enabled: !effectiveSettings.timer_sound_enabled,
              })
            }
          />

          <SwitchRow
            id="settings-timer-haptics"
            label="Timer Haptics"
            description="Vibrate supported mobile devices when rest ends"
            checked={effectiveSettings.timer_haptics_enabled}
            onToggle={() =>
              void saveSettingsPatch({
                timer_haptics_enabled: !effectiveSettings.timer_haptics_enabled,
              })
            }
          />
        </div>
      </section>

      <DataExportSection isConfigured={isConfigured} />

      <SyncCacheInspectorSection
        isConfigured={isConfigured}
        initialRemoteVersions={initialRemoteVersions}
      />

      {!isConfigured && (
        <section className="-mx-4 border-b border-amber-200 bg-amber-50/70 px-4 py-4 text-sm text-amber-900 sm:-mx-6 sm:px-6">
          <p className="font-medium">Setup Next Step</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            Copy <code className="rounded bg-amber-100 px-1 py-0.5">.env.example</code>{" "}
            to <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
            and add <code className="rounded bg-amber-100 px-1 py-0.5">SUPABASE_URL</code>{" "}
            and{" "}
            <code className="rounded bg-amber-100 px-1 py-0.5">
              SUPABASE_SERVICE_ROLE_KEY
            </code>
            .
          </p>
        </section>
      )}
    </div>
  );
}
