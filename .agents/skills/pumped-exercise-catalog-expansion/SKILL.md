---
name: pumped-exercise-catalog-expansion
description: Standard operating procedure for safely expanding Pumped's curated standard exercise catalog, verifying upstream GIF IDs and local static media, regenerating supabase/seed.sql, and batch-seeding Supabase.
---

# Pumped Curated Exercise Catalog Expansion Protocol

Use this workflow whenever adding, renaming, or updating standard exercises in `Pumped`.

## 1. Rules & Integrity Constraints
- **Never change existing `slug`s** of previously seeded exercises: `ON CONFLICT (slug) DO UPDATE` preserves UUIDs referenced by `routines`, `routine_exercises`, `workouts`, and `workout_sets`.
- **Unique case-insensitive `name`s**: `idx_exercises_active_name` enforces `UNIQUE (LOWER(name)) WHERE archived_at IS NULL`.
- **Valid schema enums only**:
  - `muscle_group`: `chest`, `back`, `shoulders`, `biceps`, `triceps`, `quads`, `hamstrings`, `glutes`, `calves`, `core`, `forearms`
  - `equipment`: `barbell`, `dumbbell`, `machine`, `cable`, `bodyweight`, `kettlebell`, `smith_machine`, `other`
  - `tracking_type`: `weight_reps`, `bodyweight_reps`, `weighted_bodyweight`, `duration`
- **Local media guarantee**: Every entry in [curated-exercises-catalog.mjs](../../../scripts/curated-exercises-catalog.mjs) must resolve a valid local GIF in `/public/exercises/gifs/<slug>.gif` (or 2-frame JPG fallback in `/public/exercises/photos/`) and at least 1 clean instruction step.

## 2. Step-by-Step Procedure
1. Add or edit entries in [curated-exercises-catalog.mjs](../../../scripts/curated-exercises-catalog.mjs), verifying `gifId` against `omercotkd/exercises-gifs/main/exercises.csv`.
2. Download local media & regenerate `supabase/seed.sql`:
   ```powershell
   node scripts/fetch-curated-exercises.mjs
   ```
   (Already-downloaded valid local files are reused automatically; pass `--force` only to re-download everything.)
3. Seed live Supabase in batches and bump `sync_meta.exercises`:
   ```powershell
   node --env-file=.env.local scripts/seed-exercises-to-supabase.mjs
   ```
4. Verify in database & browser:
   - Confirm active count, breakdown per `muscle_group`, zero rows lacking media, and presence of newly added exercises via SQL or Supabase.
   - Open `/exercises` on desktop/mobile (`390x844`) and search for newly added movements to confirm animated GIFs load (`naturalWidth > 0`) with zero console errors or HTTP `404`s.
   - Commit & push both updated scripts/`supabase/seed.sql` AND `public/exercises/gifs/*.gif` before reloading the Vercel production deployment so Vercel serves every new GIF locally.
