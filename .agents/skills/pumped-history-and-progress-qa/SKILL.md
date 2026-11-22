---
name: pumped-history-and-progress-qa
description: Standard operating procedure for verifying Pumped's Workout History (/history), Session Detail (/history/[id]), Exercise Progress Charts (/exercises/[id]), Repeat Workout, DELETE_WORKOUT sync, and clean Supabase teardown.
---

# Pumped Phase 5 History & Progress QA

## Static & Unit Test Gate
Run before launching the browser or build:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
cmd /c "npm run typecheck && npm run lint && npm run test"
```
Expected: `0` TypeScript/ESLint errors and all unit test suites (including `progress.test.ts` and `outbox.test.ts` `FINISH_WORKOUT` + `DELETE_WORKOUT` coalescing) pass.

## End-to-End Mobile Browser + Supabase Verification (`390×844`)
1. Start the dev server in background (`npm.cmd run dev`, ensuring no external `next dev` process already holds `.next/`).
2. Seed 2 historical QA workouts (`Phase5 QA Bench Old` 45 days ago and `Phase5 QA Bench Recent` today via `finalize_workout_stats` RPC or UI logging) so both multi-session trend lines and `1M` cutoff filtering are exercised.
3. Verify via Chrome DevTools MCP (`390×844`, passing `pageId` on every call):
   - `/history`: verify 4-cell overview stats, month grouping, workout search (`#history-search`), and `PRs Only` filter.
   - `/history/[id]`: click a workout to inspect Duration, Volume, Sets, PR count, Est. 1RM column, PR badges (`Weight PR`, `1RM PR`, `Volume PR`), and `Repeat Workout` trigger.
   - `/exercises/[id]`: follow the exercise link from session detail (or `Progress` from `ExerciseDetailDrawer`) and verify Personal Bests (`Best Est. 1RM`, `Max Weight`, `Best Set Volume`, `Sessions`), SVG chart curves across `Est. 1RM`, `Max Weight`, and `Volume`, time range filtering (`All` vs `1M`), point selection telemetry callout, and Session History rows.
   - Back on `/history/[id]`, trigger **Delete** -> **Confirm Delete** and confirm optimistic removal plus `POST /api/sync/mutate` (`DELETE_WORKOUT`, HTTP `200`).
   - Confirm `0` console errors and `0` failed network requests.
4. Clean up any remaining temporary QA rows from Supabase (`DELETE FROM public.workouts WHERE name LIKE 'Phase5 QA%';`) and clear browser `localStorage` / IndexedDB QA state.

## Clean Production Build
Stop the dev server and verify port `3000` is clear before building:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
cmd /c "npm run typecheck && npm run lint && npm run test && npm run build"
```
