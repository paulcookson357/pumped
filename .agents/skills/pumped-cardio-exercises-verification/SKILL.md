---
name: pumped-cardio-exercises-verification
description: Standard operating procedure for verifying built-in cardio exercises, cardio telemetry logging (time, distance, speed, resistance, incline), edit persistence, cardio progress charts, export/import parity, and mobile 375px layout across Pumped.
---

# Pumped Cardio Exercises & Telemetry Verification Protocol

Follow this repeatable protocol after modifying cardio exercises, `workout_sets` cardio columns, cardio workout logging UI, or cardio progress analytics.

## 1. Database & Seed Integrity Check

1. Confirm migration `0004_cardio_support.sql` is applied in Supabase:
   - `public.muscle_group` contains `'cardio'`
   - `public.equipment_type` contains `'cardio_machine'`
   - `public.tracking_type` contains `'cardio'`
   - `public.workout_sets` has `distance`, `speed`, `resistance`, and `incline` nullable columns with non-negative / valid range constraints
   - `get_previous_exercise_sets` and `get_exercise_progress` enforce `SET search_path = ''` and return cardio columns/aggregates
2. Verify all 16 curated cardio exercises are active in Supabase:
   ```bash
   node --env-file=.env.local scripts/seed-exercises-to-supabase.mjs
   ```
   Expected result: 266 total standard exercises with `cardio: 16`.
3. Check Supabase security advisors (`get_advisors` -> `security`): verify zero `function_search_path_mutable` warnings.

## 2. Static & Automated Test Verification

Run the full TypeScript, ESLint, Vitest, and production build gate:

```powershell
cmd /c "npm run typecheck && npm run lint && npm run test && npm run build"
```

Verify zero TypeScript errors, zero lint warnings, 100% Vitest pass (including `src/lib/workouts/cardio.test.ts`), and a clean Next.js production build.

## 3. Live Browser E2E Verification (`390x844` and `375x812`)

Start production server (`npm run start`) on `http://localhost:3000` and drive Chrome DevTools MCP (`390x844`, then `375x812`):

1. **Exercise Library (`/exercises`)**:
   - Click `Cardio` muscle filter chip -> confirm 16 built-in cardio exercises display.
   - Click `Cardio Machine` equipment chip -> confirm machines (Treadmill Run, Incline Treadmill Walk, Stationary Bike, Recumbent Bike, Air Bike, Rowing Ergometer, Stair Climber, Elliptical Trainer, SkiErg, Arm Ergometer).
   - Inspect images: `Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)`.
   - Open Detail Drawer for Treadmill Run, Rowing Ergometer (Row Erg), Stationary Bike, and Stair Climber to verify visual playback and form steps.
2. **Active Workout Logging (`ActiveWorkoutSheet`)**:
   - Start an Empty Workout, add `Treadmill Run`, `Rowing Ergometer (Row Erg)`, and `Stationary Bike`.
   - Enter Time (`20:00` or `12.5`), Distance, Speed, Resistance, and Incline across intervals, tap completion checkmarks, and confirm live telemetry bar shows Cardio duration + distance instead of `Vol 0 kg`.
   - Confirm `WorkoutFinishModal` summarizes cardio intervals cleanly without `0 kg × 0`.
3. **History & Edit Persistence (`/history/[id]` & `EditWorkoutModal`)**:
   - Open finished session from `/history` -> confirm cardio headline telemetry and interval labels (`20:00 • 3.2 km • ...`).
   - Open `Edit Workout`, adjust time/speed/resistance/incline, save, hard-reload (`ignoreCache: true`), and verify persisted Supabase values.
4. **Cardio Exercise Progress (`/exercises/[id]`)**:
   - Navigate to `Treadmill Run` Progress page -> confirm KPIs (`Best Time`, `Best Distance`, `Top Speed`, `Sessions`) and interactive chart tabs (`Time (min)`, `Distance`, `Top Speed`) render cleanly.
5. **Previous Performance Copy & Routine Creation**:
   - Start a second quick workout with `Treadmill Run` -> confirm `Previous` shows prior interval telemetry and tapping copies time, distance, speed, resistance, and incline into inputs, then discard draft.
   - Verify Routine Editor defaults cardio exercises to 1 interval without required min/max reps.
6. **Export Verification & Layout Audit**:
   - Fetch `/api/export?format=csv` and `/api/export?format=json` and verify `distance,speed,resistance,incline` headers and values.
   - Confirm `document.documentElement.scrollWidth <= window.innerWidth` at `375x812` and zero console/network errors across all pages.
   - Clean up temporary QA workout via UI Delete confirmation so database state remains clean.
