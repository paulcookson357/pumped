---
name: pumped-settings-export-and-responsive-qa
description: Standard operating procedure for verifying Pumped Settings (/settings) offline-first sync, Sync & Cache Inspector, selective sync_meta reloads, full JSON/CSV data exports (/api/export), Service Worker route isolation, and responsive mobile viewports (375px, 390px, 430px).
---

# Pumped Phase 6 Settings, Data Export & Responsive QA

## Static & Unit Test Gate
Run before launching the browser or build:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
cmd /c "npm run typecheck && npm run lint && npm run test"
```
Expected: `0` TypeScript/ESLint errors and all unit test suites (including `workoutExport.test.ts` and `outbox.test.ts` `UPDATE_SETTINGS` coalescing) pass.

## End-to-End API, Settings Sync, Export & Multi-Viewport Verification
1. Ensure port `3000` is clear and start the dev server in background (`npm.cmd run dev`), waiting until `http://localhost:3000/api/health` returns `200` with `supabase: "connected"`.
2. Seed 1 temporary QA workout (`Phase6 QA Export Bench` with `1` warmup set `40 kg × 8` and `1` working set `60 kg × 8`) via `finalize_workout_stats` RPC so full export endpoints have realistic set/PR/1RM rows.
3. Verify server APIs directly (`Cache-Control: no-store`):
   - `GET /api/health` -> `200` (`ok: true`, `supabase: "connected"`, `versions`).
   - `GET /api/export?format=xml` -> `400` validation error.
   - `GET /api/export?format=json` -> `200` (`schemaVersion: 1`, `counts.workouts === 1`, `counts.exercises >= 250`).
   - `GET /api/export?format=csv` -> `200` containing CSV headers, `Phase6 QA Export Bench`, warmup `0` volume / blank `est_1rm`, and working `est_1rm` `76`.
4. Verify `/settings` in Chrome DevTools MCP (`390×844`, passing `pageId` on every call):
   - Toggle `lbs`, `120s` rest, `Show RPE Column` off -> confirm `POST /api/sync/mutate` (`UPDATE_SETTINGS`, `200`), Supabase `public.app_settings` updated, and `sync_meta.settings` bumped.
   - Click **Sync Now** -> confirm `"Up to date — 0 domains reloaded"` with zero redundant `/api/sync/snapshot` calls.
   - Click **Export Full Backup (JSON)** & **Export Workout Sets (CSV)** -> confirm `200` and inline download confirmation.
   - Click **Rebuild Local Cache** -> **Confirm Rebuild** -> confirm IndexedDB counts repopulate cleanly.
   - Restore baseline defaults (`kg`, `90s`, `Auto-Start Rest Timer` on, `Show RPE Column` on, `Timer Sound Chime` on, `Timer Haptics` on) via the UI and confirm Supabase `public.app_settings` matches defaults.
5. Multi-Viewport Responsive Sweep across `/`, `/routines`, `/exercises`, `/history`, and `/settings` at `375×812`, `390×844`, and `430×932`:
   - Confirm `document.documentElement.scrollWidth <= window.innerWidth` on every route and width.
   - Visually inspect screenshots at `375×812` and `430×932` on `/settings`.
   - Confirm `0` console errors and `0` failed network requests.
6. Teardown:
   - Delete temporary QA rows (`DELETE FROM public.workouts WHERE name LIKE 'Phase6 QA%';`) and verify `routines_cnt = 0`, `workouts_cnt = 0`, `sets_cnt = 0`, and `public.app_settings` matches defaults.
   - Clear browser `localStorage` and `indexedDB.deleteDatabase('pumped-offline-db')`.

## Clean Production Build
Stop the dev server and confirm port `3000` is clear before running the final build gate:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
cmd /c "npm run typecheck && npm run lint && npm run test && npm run build"
```
