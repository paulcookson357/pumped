import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { CURATED_EXERCISES } from "./curated-exercises-catalog.mjs";

const GIF_CSV_URL =
  "https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/exercises.csv";
const GIF_ASSET_BASE =
  "https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/assets";
const FREE_DB_JSON_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const FREE_DB_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

const VALID_MUSCLES = new Set([
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "forearms",
  "cardio",
]);

const VALID_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "smith_machine",
  "cardio_machine",
  "other",
]);

const VALID_TRACKING = new Set([
  "weight_reps",
  "bodyweight_reps",
  "weighted_bodyweight",
  "duration",
  "cardio",
]);

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\r") {
      // ignore CR
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  const header = rows[0] ?? [];
  return rows.slice(1).map((cols) => {
    const record = {};
    for (let idx = 0; idx < header.length; idx += 1) {
      const key = header[idx];
      if (key) {
        record[key] = cols[idx] ?? "";
      }
    }
    return record;
  });
}

function validateCatalogSpecs() {
  const slugs = new Set();
  const namesLower = new Set();

  for (const spec of CURATED_EXERCISES) {
    if (!spec.slug || !/^[a-z0-9-]+$/.test(spec.slug)) {
      throw new Error(`Invalid exercise slug: "${spec.slug}"`);
    }
    if (slugs.has(spec.slug)) {
      throw new Error(`Duplicate exercise slug: "${spec.slug}"`);
    }
    slugs.add(spec.slug);

    const normalizedName = spec.name.trim().toLowerCase();
    if (!normalizedName) {
      throw new Error(`Empty name for slug: "${spec.slug}"`);
    }
    if (namesLower.has(normalizedName)) {
      throw new Error(`Duplicate exercise name (case-insensitive): "${spec.name}"`);
    }
    namesLower.add(normalizedName);

    if (!VALID_MUSCLES.has(spec.muscle_group)) {
      throw new Error(`Invalid muscle_group "${spec.muscle_group}" for ${spec.slug}`);
    }
    for (const sec of spec.secondary_muscles) {
      if (!VALID_MUSCLES.has(sec)) {
        throw new Error(`Invalid secondary muscle "${sec}" for ${spec.slug}`);
      }
    }
    if (!VALID_EQUIPMENT.has(spec.equipment)) {
      throw new Error(`Invalid equipment "${spec.equipment}" for ${spec.slug}`);
    }
    if (!VALID_TRACKING.has(spec.tracking_type)) {
      throw new Error(`Invalid tracking_type "${spec.tracking_type}" for ${spec.slug}`);
    }
  }

  if (!slugs.has("dumbbell-walking-lunge")) {
    throw new Error('Mandatory exercise "dumbbell-walking-lunge" is missing from catalog.');
  }
}

async function downloadFileIfNeeded(url, destPath, minBytes, force = false) {
  if (!force && fs.existsSync(destPath)) {
    const st = fs.statSync(destPath);
    if (st.isFile() && st.size >= minBytes) {
      return { ok: true, bytes: st.size, cached: true };
    }
  }

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (attempt === 2) {
          return { ok: false, reason: `HTTP ${res.status}` };
        }
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < minBytes) {
        return { ok: false, reason: `Too small (${buf.length} bytes)` };
      }
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, buf);
      return { ok: true, bytes: buf.length, cached: false };
    } catch (err) {
      if (attempt === 2) {
        return {
          ok: false,
          reason: err instanceof Error ? err.message : "Network error",
        };
      }
    }
  }

  return { ok: false, reason: "Unknown download failure" };
}

function cleanStepText(raw) {
  return String(raw ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCsvInstructions(row) {
  const steps = [];
  for (let i = 0; i <= 10; i += 1) {
    const val = cleanStepText(row[`instructions/${i}`] ?? "");
    if (val) {
      steps.push(val);
    }
  }
  return steps.slice(0, 5);
}

function sqlString(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlTextArray(values) {
  if (!values || values.length === 0) {
    return "'{}'::text[]";
  }
  return `ARRAY[${values.map((v) => sqlString(v)).join(", ")}]::text[]`;
}

function sqlMuscleArray(values) {
  if (!values || values.length === 0) {
    return "'{}'::public.muscle_group[]";
  }
  return `ARRAY[${values.map((v) => sqlString(v)).join(", ")}]::public.muscle_group[]`;
}

export async function buildAndSyncCatalog({
  downloadAssets = true,
  forceDownload = false,
  writeSeedSql = true,
  concurrency = 8,
} = {}) {
  validateCatalogSpecs();

  console.log(
    `Validating ${CURATED_EXERCISES.length} curated exercises against upstream catalogs...`
  );

  const [csvText, freeDbList] = await Promise.all([
    fetch(GIF_CSV_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed GIF CSV: ${r.status}`);
      return r.text();
    }),
    fetch(FREE_DB_JSON_URL).then((r) => {
      if (!r.ok) throw new Error(`Failed free-exercise-db: ${r.status}`);
      return r.json();
    }),
  ]);

  const gifRows = parseCsv(csvText);
  const gifById = new Map(gifRows.map((row) => [row.id.trim(), row]));
  const freeDbById = new Map(freeDbList.map((item) => [item.id, item]));

  for (const spec of CURATED_EXERCISES) {
    if (spec.gifId && !gifById.has(spec.gifId)) {
      throw new Error(`Missing upstream gifId "${spec.gifId}" for ${spec.slug}`);
    }
  }

  const rootDir = process.cwd();
  const gifsDir = path.join(rootDir, "public", "exercises", "gifs");
  const photosDir = path.join(rootDir, "public", "exercises", "photos");
  if (downloadAssets) {
    fs.mkdirSync(gifsDir, { recursive: true });
    fs.mkdirSync(photosDir, { recursive: true });
  }

  const resolvedRows = new Array(CURATED_EXERCISES.length);
  let cursor = 0;
  let gifSuccessCount = 0;
  let photoSuccessCount = 0;
  let downloadedCount = 0;
  let cachedCount = 0;

  async function processOne(spec, index) {
    const gifRow = spec.gifId ? gifById.get(spec.gifId) : undefined;
    let freeDbItem;
    for (const candidateId of spec.freeDbIds ?? []) {
      const found = freeDbById.get(candidateId);
      if (found) {
        freeDbItem = found;
        break;
      }
    }

    let mediaGifUrl = null;
    if (gifRow) {
      const gifPath = path.join(gifsDir, `${spec.slug}.gif`);
      if (downloadAssets) {
        const gifUrl = `${GIF_ASSET_BASE}/${gifRow.id}.gif`;
        const dl = await downloadFileIfNeeded(gifUrl, gifPath, 5000, forceDownload);
        if (dl.ok) {
          mediaGifUrl = `/exercises/gifs/${spec.slug}.gif`;
          gifSuccessCount += 1;
          if (dl.cached) cachedCount += 1;
          else downloadedCount += 1;
        } else {
          console.warn(
            `[WARN] GIF skipped for ${spec.slug} (${gifRow.id}): ${dl.reason}`
          );
        }
      } else if (fs.existsSync(gifPath) && fs.statSync(gifPath).size >= 5000) {
        mediaGifUrl = `/exercises/gifs/${spec.slug}.gif`;
        gifSuccessCount += 1;
      }
    }

    let mediaStartUrl = null;
    let mediaEndUrl = null;
    const shouldFetchPhotos = Boolean(spec.keepFallbackPhotos) || !mediaGifUrl;
    if (
      shouldFetchPhotos &&
      freeDbItem &&
      Array.isArray(freeDbItem.images) &&
      freeDbItem.images.length >= 2
    ) {
      const img0Path = path.join(photosDir, `${spec.slug}-0.jpg`);
      const img1Path = path.join(photosDir, `${spec.slug}-1.jpg`);
      if (downloadAssets) {
        const img0Url = `${FREE_DB_IMAGE_BASE}/${freeDbItem.images[0]}`;
        const img1Url = `${FREE_DB_IMAGE_BASE}/${freeDbItem.images[1]}`;
        const [dl0, dl1] = await Promise.all([
          downloadFileIfNeeded(img0Url, img0Path, 2000, forceDownload),
          downloadFileIfNeeded(img1Url, img1Path, 2000, forceDownload),
        ]);
        if (dl0.ok && dl1.ok) {
          mediaStartUrl = `/exercises/photos/${spec.slug}-0.jpg`;
          mediaEndUrl = `/exercises/photos/${spec.slug}-1.jpg`;
          photoSuccessCount += 1;
        }
      } else if (
        fs.existsSync(img0Path) &&
        fs.existsSync(img1Path) &&
        fs.statSync(img0Path).size >= 2000 &&
        fs.statSync(img1Path).size >= 2000
      ) {
        mediaStartUrl = `/exercises/photos/${spec.slug}-0.jpg`;
        mediaEndUrl = `/exercises/photos/${spec.slug}-1.jpg`;
        photoSuccessCount += 1;
      }
    }

    if (!mediaGifUrl && (!mediaStartUrl || !mediaEndUrl)) {
      throw new Error(
        `Exercise ${spec.slug} failed to obtain either GIF or 2-frame photos.`
      );
    }

    const customSteps = Array.isArray(spec.customInstructions)
      ? spec.customInstructions.map(cleanStepText).filter(Boolean).slice(0, 5)
      : [];
    const freeSteps = Array.isArray(freeDbItem?.instructions)
      ? freeDbItem.instructions.map(cleanStepText).filter(Boolean).slice(0, 5)
      : [];
    const csvSteps = gifRow ? extractCsvInstructions(gifRow) : [];

    const instructions =
      customSteps.length > 0
        ? customSteps
        : freeSteps.length > 0
          ? freeSteps
          : csvSteps;

    if (instructions.length === 0) {
      throw new Error(`Exercise ${spec.slug} resolved 0 instructions.`);
    }

    resolvedRows[index] = {
      slug: spec.slug,
      name: spec.name,
      muscle_group: spec.muscle_group,
      secondary_muscles: spec.secondary_muscles,
      equipment: spec.equipment,
      tracking_type: spec.tracking_type,
      media_gif_url: mediaGifUrl,
      media_image_start_url: mediaStartUrl,
      media_image_end_url: mediaEndUrl,
      instructions,
      is_custom: false,
      archived_at: null,
    };
  }

  async function worker() {
    while (true) {
      const idx = cursor;
      cursor += 1;
      if (idx >= CURATED_EXERCISES.length) break;
      const spec = CURATED_EXERCISES[idx];
      await processOne(spec, idx);
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  if (writeSeedSql) {
    const sqlRows = resolvedRows.map(
      (row) =>
        `  (${sqlString(row.slug)}, ${sqlString(row.name)}, ${sqlString(
          row.muscle_group
        )}::public.muscle_group, ${sqlMuscleArray(
          row.secondary_muscles
        )}, ${sqlString(row.equipment)}::public.equipment_type, ${sqlString(
          row.tracking_type
        )}::public.tracking_type, ${sqlString(row.media_gif_url)}, ${sqlString(
          row.media_image_start_url
        )}, ${sqlString(row.media_image_end_url)}, ${sqlTextArray(
          row.instructions
        )}, FALSE)`
    );

    const seedSql = `-- Pumped: Curated Standard Strength Exercises Seed (${resolvedRows.length} exercises)
-- Generated by scripts/fetch-curated-exercises.mjs (idempotent upsert by slug)

INSERT INTO public.exercises (
  slug,
  name,
  muscle_group,
  secondary_muscles,
  equipment,
  tracking_type,
  media_gif_url,
  media_image_start_url,
  media_image_end_url,
  instructions,
  is_custom
)
VALUES
${sqlRows.join(",\n")}
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  muscle_group = EXCLUDED.muscle_group,
  secondary_muscles = EXCLUDED.secondary_muscles,
  equipment = EXCLUDED.equipment,
  tracking_type = EXCLUDED.tracking_type,
  media_gif_url = EXCLUDED.media_gif_url,
  media_image_start_url = EXCLUDED.media_image_start_url,
  media_image_end_url = EXCLUDED.media_image_end_url,
  instructions = EXCLUDED.instructions,
  is_custom = FALSE,
  archived_at = NULL;

SELECT public.bump_sync_domain('exercises');
`;

    fs.mkdirSync(path.join(rootDir, "supabase"), { recursive: true });
    fs.writeFileSync(path.join(rootDir, "supabase", "seed.sql"), seedSql, "utf8");
  }

  const byMuscle = {};
  for (const row of resolvedRows) {
    byMuscle[row.muscle_group] = (byMuscle[row.muscle_group] ?? 0) + 1;
  }

  console.log(
    `Resolved ${resolvedRows.length} exercises | GIFs: ${gifSuccessCount} (${downloadedCount} downloaded, ${cachedCount} cached) | 2-frame fallback photos: ${photoSuccessCount}`
  );
  console.log("By muscle group:", byMuscle);

  return resolvedRows;
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  const forceDownload = process.argv.includes("--force");
  buildAndSyncCatalog({ downloadAssets: true, forceDownload }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
