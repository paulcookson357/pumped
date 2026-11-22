import { createClient } from "@supabase/supabase-js";
import { buildAndSyncCatalog } from "./fetch-curated-exercises.mjs";

const BATCH_SIZE = 50;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run via: node --env-file=.env.local scripts/seed-exercises-to-supabase.mjs"
    );
  }

  console.log("Resolving curated exercise rows...");
  const rows = await buildAndSyncCatalog({
    downloadAssets: false,
    writeSeedSql: false,
  });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from("exercises")
      .upsert(chunk, { onConflict: "slug" });

    if (error) {
      throw new Error(
        `Failed upserting batch ${i}..${i + chunk.length - 1}: ${error.message}`
      );
    }
    console.log(
      `Upserted exercises ${i + 1}-${i + chunk.length} of ${rows.length}`
    );
  }

  const { error: bumpErr } = await supabase.rpc("bump_sync_domain", {
    p_domain: "exercises",
  });
  if (bumpErr) {
    throw new Error(`Failed bumping sync_meta.exercises: ${bumpErr.message}`);
  }

  const { data: countsData, error: countErr } = await supabase
    .from("exercises")
    .select("slug, muscle_group, is_custom")
    .is("archived_at", null);

  if (countErr) {
    throw new Error(`Failed verifying seeded exercises: ${countErr.message}`);
  }

  const standard = (countsData ?? []).filter((r) => !r.is_custom);
  const hasWalkingLunge = standard.some(
    (r) => r.slug === "dumbbell-walking-lunge"
  );

  const perMuscle = {};
  for (const row of standard) {
    perMuscle[row.muscle_group] = (perMuscle[row.muscle_group] ?? 0) + 1;
  }

  console.log(
    `\nSupabase verification passed! Active standard exercises: ${standard.length} | dumbbell-walking-lunge present: ${hasWalkingLunge}`
  );
  console.log("DB breakdown:", perMuscle);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
