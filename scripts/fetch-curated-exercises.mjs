import fs from "node:fs";
import path from "node:path";

const GIF_CSV_URL =
  "https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/exercises.csv";
const GIF_ASSET_BASE =
  "https://raw.githubusercontent.com/omercotkd/exercises-gifs/main/assets";
const FREE_DB_JSON_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const FREE_DB_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";

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

const CURATED_EXERCISES = [
  // CHEST (8)
  {
    slug: "barbell-bench-press",
    name: "Barbell Bench Press",
    muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0025",
    freeDbIds: ["Barbell_Bench_Press_-_Medium_Grip"],
  },
  {
    slug: "incline-barbell-bench-press",
    name: "Incline Barbell Bench Press",
    muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0047",
    freeDbIds: ["Barbell_Incline_Bench_Press_-_Medium_Grip"],
  },
  {
    slug: "incline-dumbbell-press",
    name: "Incline Dumbbell Press",
    muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0314",
    freeDbIds: ["Incline_Dumbbell_Press"],
  },
  {
    slug: "dumbbell-bench-press",
    name: "Dumbbell Bench Press",
    muscle_group: "chest",
    secondary_muscles: ["shoulders", "triceps"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0289",
    freeDbIds: ["Dumbbell_Bench_Press"],
  },
  {
    slug: "cable-chest-fly",
    name: "Cable Chest Fly",
    muscle_group: "chest",
    secondary_muscles: ["shoulders"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0227",
    freeDbIds: ["Flat_Bench_Cable_Flyes"],
  },
  {
    slug: "pec-deck-fly",
    name: "Pec Deck Fly",
    muscle_group: "chest",
    secondary_muscles: ["shoulders"],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0596",
    freeDbIds: ["Butterfly"],
  },
  {
    slug: "chest-dip",
    name: "Chest Dip",
    muscle_group: "chest",
    secondary_muscles: ["triceps", "shoulders"],
    equipment: "bodyweight",
    tracking_type: "weighted_bodyweight",
    gifId: "0251",
    freeDbIds: ["Dips_-_Chest_Version"],
  },
  {
    slug: "push-up",
    name: "Push-Up",
    muscle_group: "chest",
    secondary_muscles: ["triceps", "shoulders", "core"],
    equipment: "bodyweight",
    tracking_type: "bodyweight_reps",
    gifId: "0662",
    freeDbIds: ["Pushups"],
  },

  // BACK (8)
  {
    slug: "pull-up",
    name: "Pull-Up",
    muscle_group: "back",
    secondary_muscles: ["biceps", "forearms"],
    equipment: "bodyweight",
    tracking_type: "weighted_bodyweight",
    gifId: "0652",
    freeDbIds: ["Pullups"],
  },
  {
    slug: "lat-pulldown",
    name: "Lat Pulldown",
    muscle_group: "back",
    secondary_muscles: ["biceps"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0197",
    freeDbIds: ["Wide-Grip_Lat_Pulldown", "Full_Range-Of-Motion_Lat_Pulldown"],
  },
  {
    slug: "barbell-bent-over-row",
    name: "Barbell Bent-Over Row",
    muscle_group: "back",
    secondary_muscles: ["biceps", "forearms"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0027",
    freeDbIds: ["Bent_Over_Barbell_Row", "Reverse_Grip_Bent-Over_Rows"],
  },
  {
    slug: "seated-cable-row",
    name: "Seated Cable Row",
    muscle_group: "back",
    secondary_muscles: ["biceps"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0861",
    freeDbIds: ["Seated_Cable_Rows"],
  },
  {
    slug: "single-arm-dumbbell-row",
    name: "Single-Arm Dumbbell Row",
    muscle_group: "back",
    secondary_muscles: ["biceps", "forearms"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0292",
    freeDbIds: ["One-Arm_Dumbbell_Row"],
  },
  {
    slug: "chest-supported-row",
    name: "Chest-Supported Dumbbell Row",
    muscle_group: "back",
    secondary_muscles: ["biceps", "shoulders"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0327",
    freeDbIds: ["Dumbbell_Incline_Row"],
  },
  {
    slug: "conventional-deadlift",
    name: "Conventional Deadlift",
    muscle_group: "back",
    secondary_muscles: ["hamstrings", "glutes", "forearms"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0032",
    freeDbIds: ["Barbell_Deadlift"],
  },
  {
    slug: "face-pull",
    name: "Cable Face Pull",
    muscle_group: "back",
    secondary_muscles: ["shoulders"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0203",
    freeDbIds: ["Face_Pull"],
  },

  // SHOULDERS (6)
  {
    slug: "barbell-overhead-press",
    name: "Barbell Overhead Press",
    muscle_group: "shoulders",
    secondary_muscles: ["triceps", "core"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0091",
    freeDbIds: ["Standing_Military_Press", "Barbell_Shoulder_Press"],
  },
  {
    slug: "seated-dumbbell-shoulder-press",
    name: "Seated Dumbbell Shoulder Press",
    muscle_group: "shoulders",
    secondary_muscles: ["triceps"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0405",
    freeDbIds: ["Dumbbell_Shoulder_Press"],
  },
  {
    slug: "dumbbell-lateral-raise",
    name: "Dumbbell Lateral Raise",
    muscle_group: "shoulders",
    secondary_muscles: [],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0334",
    freeDbIds: ["Side_Lateral_Raise"],
  },
  {
    slug: "cable-lateral-raise",
    name: "Cable Lateral Raise",
    muscle_group: "shoulders",
    secondary_muscles: [],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0178",
    freeDbIds: ["Cable_Seated_Lateral_Raise"],
  },
  {
    slug: "reverse-pec-deck-fly",
    name: "Reverse Pec Deck Fly",
    muscle_group: "shoulders",
    secondary_muscles: ["back"],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0602",
    freeDbIds: ["Reverse_Flyes", "Cable_Rear_Delt_Fly"],
  },
  {
    slug: "dumbbell-front-raise",
    name: "Dumbbell Front Raise",
    muscle_group: "shoulders",
    secondary_muscles: ["chest"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0310",
    freeDbIds: ["Front_Dumbbell_Raise", "Side_Laterals_to_Front_Raise"],
  },

  // BICEPS (6)
  {
    slug: "barbell-curl",
    name: "Barbell Bicep Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0031",
    freeDbIds: ["Barbell_Curl"],
  },
  {
    slug: "dumbbell-bicep-curl",
    name: "Dumbbell Bicep Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0294",
    freeDbIds: ["Dumbbell_Bicep_Curl"],
  },
  {
    slug: "hammer-curl",
    name: "Dumbbell Hammer Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0313",
    freeDbIds: ["Hammer_Curls"],
  },
  {
    slug: "incline-dumbbell-curl",
    name: "Incline Dumbbell Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0318",
    freeDbIds: ["Incline_Dumbbell_Curl"],
  },
  {
    slug: "cable-bicep-curl",
    name: "Cable Bicep Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0868",
    freeDbIds: ["Standing_Biceps_Cable_Curl"],
  },
  {
    slug: "preacher-curl",
    name: "Preacher Curl",
    muscle_group: "biceps",
    secondary_muscles: ["forearms"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0070",
    freeDbIds: ["Preacher_Curl"],
  },

  // TRICEPS (5)
  {
    slug: "cable-triceps-pushdown",
    name: "Cable Rope Triceps Pushdown",
    muscle_group: "triceps",
    secondary_muscles: [],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0200",
    freeDbIds: ["Triceps_Pushdown_-_Rope_Attachment"],
  },
  {
    slug: "overhead-cable-triceps-extension",
    name: "Overhead Cable Triceps Extension",
    muscle_group: "triceps",
    secondary_muscles: [],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0194",
    freeDbIds: ["Cable_Rope_Overhead_Triceps_Extension"],
  },
  {
    slug: "barbell-skullcrusher",
    name: "Skullcrusher (Lying Triceps Extension)",
    muscle_group: "triceps",
    secondary_muscles: [],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0060",
    freeDbIds: ["EZ-Bar_Skullcrusher", "Lying_Triceps_Press"],
  },
  {
    slug: "dumbbell-overhead-triceps-extension",
    name: "Dumbbell Overhead Triceps Extension",
    muscle_group: "triceps",
    secondary_muscles: [],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "2188",
    freeDbIds: ["Dumbbell_One-Arm_Triceps_Extension", "Seated_Triceps_Press"],
  },
  {
    slug: "close-grip-bench-press",
    name: "Close-Grip Bench Press",
    muscle_group: "triceps",
    secondary_muscles: ["chest", "shoulders"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0030",
    freeDbIds: ["Close-Grip_Barbell_Bench_Press"],
  },

  // QUADS (7)
  {
    slug: "barbell-back-squat",
    name: "Barbell Back Squat",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "hamstrings", "core"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0043",
    freeDbIds: ["Barbell_Full_Squat", "Barbell_Squat"],
  },
  {
    slug: "front-squat",
    name: "Barbell Front Squat",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "core"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0042",
    freeDbIds: ["Front_Squat_Clean_Grip"],
  },
  {
    slug: "leg-press",
    name: "Leg Press",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "hamstrings"],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0739",
    freeDbIds: ["Leg_Press"],
  },
  {
    slug: "bulgarian-split-squat",
    name: "Dumbbell Bulgarian Split Squat",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "hamstrings"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0410",
    freeDbIds: ["Split_Squat_with_Dumbbells"],
  },
  {
    slug: "dumbbell-lunge",
    name: "Dumbbell Lunge",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "hamstrings"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0336",
    freeDbIds: ["Dumbbell_Lunges"],
  },
  {
    slug: "leg-extension",
    name: "Leg Extension",
    muscle_group: "quads",
    secondary_muscles: [],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0585",
    freeDbIds: ["Leg_Extensions"],
  },
  {
    slug: "goblet-squat",
    name: "Dumbbell Goblet Squat",
    muscle_group: "quads",
    secondary_muscles: ["glutes", "core"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "1760",
    freeDbIds: ["Goblet_Squat"],
  },

  // HAMSTRINGS (4)
  {
    slug: "romanian-deadlift",
    name: "Barbell Romanian Deadlift",
    muscle_group: "hamstrings",
    secondary_muscles: ["glutes", "back"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "0085",
    freeDbIds: ["Romanian_Deadlift"],
  },
  {
    slug: "dumbbell-romanian-deadlift",
    name: "Dumbbell Romanian Deadlift",
    muscle_group: "hamstrings",
    secondary_muscles: ["glutes", "back"],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "1459",
    freeDbIds: ["Stiff-Legged_Dumbbell_Deadlift", "Romanian_Deadlift"],
  },
  {
    slug: "lying-leg-curl",
    name: "Lying Leg Curl",
    muscle_group: "hamstrings",
    secondary_muscles: ["calves"],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0586",
    freeDbIds: ["Lying_Leg_Curls"],
  },
  {
    slug: "seated-leg-curl",
    name: "Seated Leg Curl",
    muscle_group: "hamstrings",
    secondary_muscles: ["calves"],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0599",
    freeDbIds: ["Seated_Leg_Curl"],
  },

  // GLUTES (4)
  {
    slug: "barbell-hip-thrust",
    name: "Barbell Hip Thrust",
    muscle_group: "glutes",
    secondary_muscles: ["hamstrings", "quads"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "3562",
    freeDbIds: ["Barbell_Hip_Thrust"],
  },
  {
    slug: "cable-pull-through",
    name: "Cable Pull-Through",
    muscle_group: "glutes",
    secondary_muscles: ["hamstrings"],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0196",
    freeDbIds: ["Pull_Through"],
  },
  {
    slug: "glute-bridge",
    name: "Barbell Glute Bridge",
    muscle_group: "glutes",
    secondary_muscles: ["hamstrings"],
    equipment: "barbell",
    tracking_type: "weight_reps",
    gifId: "1409",
    freeDbIds: ["Barbell_Glute_Bridge"],
  },
  {
    slug: "hip-abduction-machine",
    name: "Seated Hip Abduction Machine",
    muscle_group: "glutes",
    secondary_muscles: [],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0597",
    freeDbIds: ["Thigh_Abductor"],
  },

  // CALVES (2)
  {
    slug: "standing-calf-raise",
    name: "Standing Calf Raise",
    muscle_group: "calves",
    secondary_muscles: [],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0605",
    freeDbIds: ["Standing_Calf_Raises", "Smith_Machine_Calf_Raise"],
  },
  {
    slug: "seated-calf-raise",
    name: "Seated Calf Raise",
    muscle_group: "calves",
    secondary_muscles: [],
    equipment: "machine",
    tracking_type: "weight_reps",
    gifId: "0594",
    freeDbIds: ["Seated_Calf_Raise"],
  },

  // CORE (5)
  {
    slug: "plank",
    name: "Plank",
    muscle_group: "core",
    secondary_muscles: ["shoulders"],
    equipment: "bodyweight",
    tracking_type: "duration",
    gifId: "0464",
    freeDbIds: ["Plank"],
  },
  {
    slug: "hanging-leg-raise",
    name: "Hanging Leg Raise",
    muscle_group: "core",
    secondary_muscles: ["forearms"],
    equipment: "bodyweight",
    tracking_type: "bodyweight_reps",
    gifId: "0472",
    freeDbIds: ["Hanging_Leg_Raise"],
  },
  {
    slug: "cable-crunch",
    name: "Kneeling Cable Crunch",
    muscle_group: "core",
    secondary_muscles: [],
    equipment: "cable",
    tracking_type: "weight_reps",
    gifId: "0175",
    freeDbIds: ["Cable_Crunch"],
  },
  {
    slug: "ab-wheel-rollout",
    name: "Ab Wheel Rollout",
    muscle_group: "core",
    secondary_muscles: ["shoulders"],
    equipment: "other",
    tracking_type: "bodyweight_reps",
    gifId: "0857",
    freeDbIds: ["Barbell_Ab_Rollout_-_On_Knees"],
  },
  {
    slug: "russian-twist",
    name: "Russian Twist",
    muscle_group: "core",
    secondary_muscles: [],
    equipment: "bodyweight",
    tracking_type: "weight_reps",
    gifId: "0687",
    freeDbIds: ["Russian_Twist"],
  },

  // FOREARMS (1)
  {
    slug: "dumbbell-wrist-curl",
    name: "Dumbbell Wrist Curl",
    muscle_group: "forearms",
    secondary_muscles: [],
    equipment: "dumbbell",
    tracking_type: "weight_reps",
    gifId: "0369",
    freeDbIds: ["Palms-Up_Dumbbell_Wrist_Curl_Over_A_Bench"],
  },
];

async function downloadFile(url, destPath, minBytes) {
  const res = await fetch(url);
  if (!res.ok) {
    return { ok: false, reason: `HTTP ${res.status}` };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < minBytes) {
    return { ok: false, reason: `Too small (${buf.length} bytes)` };
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, buf);
  return { ok: true, bytes: buf.length };
}

function extractCsvInstructions(row) {
  const steps = [];
  for (let i = 0; i <= 10; i += 1) {
    const val = (row[`instructions/${i}`] ?? "").trim();
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

async function main() {
  console.log("Fetching upstream exercise catalogs...");
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

  const rootDir = process.cwd();
  const gifsDir = path.join(rootDir, "public", "exercises", "gifs");
  const photosDir = path.join(rootDir, "public", "exercises", "photos");
  fs.mkdirSync(gifsDir, { recursive: true });
  fs.mkdirSync(photosDir, { recursive: true });

  const sqlRows = [];
  let gifSuccessCount = 0;
  let photoSuccessCount = 0;

  for (const spec of CURATED_EXERCISES) {
    const gifRow = spec.gifId ? gifById.get(spec.gifId) : undefined;
    let freeDbItem;
    for (const candidateId of spec.freeDbIds) {
      const found = freeDbById.get(candidateId);
      if (found) {
        freeDbItem = found;
        break;
      }
    }

    let mediaGifUrl = null;
    if (gifRow) {
      const gifUrl = `${GIF_ASSET_BASE}/${gifRow.id}.gif`;
      const gifPath = path.join(gifsDir, `${spec.slug}.gif`);
      const dl = await downloadFile(gifUrl, gifPath, 5000);
      if (dl.ok) {
        mediaGifUrl = `/exercises/gifs/${spec.slug}.gif`;
        gifSuccessCount += 1;
      } else {
        console.warn(`[WARN] GIF skipped for ${spec.slug} (${gifRow.id}): ${dl.reason}`);
      }
    } else {
      console.warn(`[WARN] No GIF row found for ${spec.slug} (${spec.gifId})`);
    }

    let mediaStartUrl = null;
    let mediaEndUrl = null;
    if (freeDbItem && Array.isArray(freeDbItem.images) && freeDbItem.images.length >= 2) {
      const img0Url = `${FREE_DB_IMAGE_BASE}/${freeDbItem.images[0]}`;
      const img1Url = `${FREE_DB_IMAGE_BASE}/${freeDbItem.images[1]}`;
      const img0Path = path.join(photosDir, `${spec.slug}-0.jpg`);
      const img1Path = path.join(photosDir, `${spec.slug}-1.jpg`);
      const [dl0, dl1] = await Promise.all([
        downloadFile(img0Url, img0Path, 2000),
        downloadFile(img1Url, img1Path, 2000),
      ]);
      if (dl0.ok && dl1.ok) {
        mediaStartUrl = `/exercises/photos/${spec.slug}-0.jpg`;
        mediaEndUrl = `/exercises/photos/${spec.slug}-1.jpg`;
        photoSuccessCount += 1;
      } else {
        console.warn(
          `[WARN] Photos skipped for ${spec.slug} (${freeDbItem.id}): start=${dl0.ok}, end=${dl1.ok}`
        );
      }
    } else {
      console.warn(`[WARN] No 2-frame free-exercise-db entry for ${spec.slug}`);
    }

    if (!mediaGifUrl && (!mediaStartUrl || !mediaEndUrl)) {
      throw new Error(`Exercise ${spec.slug} failed to obtain either GIF or 2-frame photos.`);
    }

    const csvSteps = gifRow ? extractCsvInstructions(gifRow) : [];
    const freeSteps = Array.isArray(freeDbItem?.instructions)
      ? freeDbItem.instructions.map((s) => String(s).trim()).filter(Boolean).slice(0, 5)
      : [];
    const instructions = freeSteps.length > 0 ? freeSteps : csvSteps;

    console.log(
      `[OK] ${spec.slug} | gif=${mediaGifUrl ? `${gifRow.id} (${gifRow.name})` : "NONE"} | photos=${
        mediaStartUrl ? freeDbItem.id : "NONE"
      } | steps=${instructions.length}`
    );

    sqlRows.push(
      `  (${sqlString(spec.slug)}, ${sqlString(spec.name)}, ${sqlString(
        spec.muscle_group
      )}::public.muscle_group, ${sqlMuscleArray(
        spec.secondary_muscles
      )}, ${sqlString(spec.equipment)}::public.equipment_type, ${sqlString(
        spec.tracking_type
      )}::public.tracking_type, ${sqlString(mediaGifUrl)}, ${sqlString(
        mediaStartUrl
      )}, ${sqlString(mediaEndUrl)}, ${sqlTextArray(instructions)}, FALSE)`
    );
  }

  const seedSql = `-- Pumped: Curated Standard Strength Exercises Seed (${CURATED_EXERCISES.length} exercises)
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

  console.log(
    `\nDone! Total: ${CURATED_EXERCISES.length} | With GIF: ${gifSuccessCount} | With 2-frame Photos: ${photoSuccessCount}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
