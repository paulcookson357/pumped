---
name: pumped-active-workout-qa
description: Standard operating procedure for verifying Pumped's Active Workout Logger, wall-clock Rest Timer, Previous pre-fill, Set Types, RPE, Exercise Swap, Finish Summary with PR detection, offline outbox sync, and clean Supabase teardown.
---

# Pumped Phase 4 Active Workout & Offline Sync QA

## Static & Unit Test Gate
Run before launching the browser or build:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
cmd /c "npm run typecheck && npm run lint && npm run test"
```
Expected: `0` TypeScript/ESLint errors and all unit test suites (including `stats.test.ts`, `restTimer.test.ts`, and `outbox.test.ts`) pass.

## End-to-End Mobile Browser + Supabase Verification (`390×844`)
1. Start the dev server in the background (`npm.cmd run dev`, ensuring no external `pnpm dev` / `next dev` process is already holding `.next/`).
2. Open Chrome DevTools MCP (`390×844` mobile viewport, passing `pageId` on all calls):
   - Navigate to `/routines`, create a temporary QA routine (e.g., `Phase4 QA Push`) with 2 exercises, and tap **Start**.
   - Confirm `ActiveWorkoutSheet` opens cleanly full-screen (`h-dvh w-full bg-white`).
   - Tap an exercise thumbnail/title to open inline `ExerciseDetailDrawer` (`readOnly`), verify GIF demo renders cleanly, and close back to the active workout.
   - Change Set 1 type to `W` (Warmup), enter weight (`60`) and reps (`10`) on Set 2 (`N` normal), pick an RPE (`8.5`), and tap the checkmark (`✓`).
   - Confirm the wall-clock `RestTimerBanner` starts automatically; verify `-15s`, `+15s`, and `Skip`.
   - Use exercise options -> **Swap** to replace exercise 2 with another exercise.
   - Minimize the sheet (`Minimize workout`), navigate to `/exercises`, verify `ActiveWorkoutMiniBar` stays docked above `BottomNav` showing live duration and logged set count, and tap to expand back with all logged sets preserved.
   - Tap **Finish**, complete the confirmation if unfinished sets remain, and verify `WorkoutFinishModal` displays Duration, Volume, Completed Sets, and Personal Records badges, then tap **Done**.
   - Start a second session with the same exercise and confirm the **Previous** column displays `60 kg × 10`, then discard that second workout via **Discard Workout** -> **Confirm Discard**.
   - Verify `0` console errors and `0` failed network requests (`POST /api/exercises/previous`, `POST /api/sync/mutate`).
3. Verify persisted rows in Supabase via `execute_sql`:
   - `workouts` (`status = 'completed'`, `total_volume`, `total_sets`, `pr_count`).
   - `workout_sets` (`is_pr_weight`, `is_pr_1rm`, `is_pr_volume`, sequential `exercise_order` and `set_number`).
   - `routines.last_performed_at` updated cleanly.
4. Clean up all QA test rows in Supabase (`DELETE` test `workouts`, `workout_sets`, `routines`, `scheduled_workouts`) and clear browser `localStorage` so the app returns to its clean pre-QA state.

## Clean Production Build
Always terminate the background dev server before running `next build`:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
cmd /c "npm run typecheck && npm run lint && npm run test && npm run build"
```
