import { SettingsClient } from "@/components/settings/SettingsClient";
import { getCachedSettings, getSyncVersions } from "@/lib/cache/loaders";
import { isSupabaseConfigured } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const configured = isSupabaseConfigured();
  const [initialSettings, versionsPayload] = await Promise.all([
    getCachedSettings(),
    getSyncVersions(),
  ]);

  return (
    <SettingsClient
      isConfigured={configured}
      initialSettings={initialSettings}
      initialRemoteVersions={versionsPayload.versions}
    />
  );
}
