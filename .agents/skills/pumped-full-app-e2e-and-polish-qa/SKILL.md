---
name: pumped-full-app-e2e-and-polish-qa
description: Standard operating procedure for end-to-end verification of Pumped's full workout lifecycle including example Push/Pull/Leg routines, weekly split calendar scheduling, smart mid-workout swap (muscle filter + routine update), completed workout editing (UPDATE_WORKOUT), Save as Routine, JSON backup export/import round-trip, and mobile responsive inspection.
---

# Pumped Full-App E2E & Polish QA Protocol

## Static & Unit Test Gate
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
cmd /c "npm run typecheck && npm run lint && npm run test"
```
Expected: `0` TypeScript/ESLint errors and all `12` test suites (`outbox.test.ts`, `swap.test.ts`, `workoutImport.test.ts`, etc.) passing.

## End-to-End Browser Verification (`390×844` & `375×812`)
1. Ensure port `3000` is clear and start `npm.cmd run dev`.
2. **Routines & Weekly Split (`/routines`, `/`):**
   - Create realistic example routines (`Push Day`, `Pull Day`, `Leg Day`) with supersets (`A1`/`A2`) and assign a Mon/Wed/Fri repeating split.
   - Verify Month and Week views on `/` render scheduled routine pills cleanly without horizontal overflow.
3. **Active Workout & Smart Swap:**
   - Start **Push Day**, inspect exercise demo modal, log sets with `kg` and `RPE`, trigger wall-clock Rest Timer (`+15s`, `Skip`), minimize to `ActiveWorkoutMiniBar` and resume.
   - Trigger **Swap Exercise** -> confirm `ExercisePickerModal` defaults to the original exercise's muscle group, then choose **Swap Today Only** or **Swap & Update Routine** and verify template persistence in `/routines`.
   - Finish workout and navigate to `/history/[id]`.
4. **History Detail: Edit Workout & Save as Routine (`/history/[id]`, `/exercises/[id]`):**
   - Click **Edit**, adjust a working set weight and session notes, click **Save** -> verify `POST /api/sync/mutate` (`UPDATE_WORKOUT`, `200`), updated Volume/PR/1RM, and live Supabase persistence.
   - Click **Save as Routine**, verify pre-filled template exercises/superset, save, confirm on `/routines` (then archive temporary test copy).
   - Verify `/exercises/[id]` chart & personal bests match edited set data.
5. **JSON Backup Export & Import Restore (`/settings`):**
   - Download JSON backup via `/api/export?format=json`, delete the test workout via `/history/[id]`, open **Import Backup (JSON)** -> preview counts -> **Confirm Import** -> confirm `POST /api/import` (`200`) and restored workout visibility across `/history` and Supabase.
6. **UX & Console/Network Audit:**
   - Confirm `scrollWidth <= innerWidth` (`overflowX <= 0`) at `375px` & `390px`, inspect key screenshots, and verify `0` console errors and `0` failed network requests.

## Final Production Build
Kill dev server, confirm port `3000` has no listener, remove `.next`, and run:
```powershell
Set-Location C:\Users\pccoo\.gemini\antigravity\scratch\Pumped
if (Test-Path .next) { Remove-Item -Recurse -Force .next }
cmd /c "npm run typecheck && npm run lint && npm run test && npm run build"
```
