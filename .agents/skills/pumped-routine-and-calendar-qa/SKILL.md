---
name: pumped-routine-and-calendar-qa
description: Standard operating procedure for verifying Pumped's Routine Builder (/routines), Weekly Split scheduler, Calendar Hub (/), mobile responsiveness, sync mutations, and clean database teardown.
---

# Pumped Routine Builder & Calendar Hub QA Protocol

Use this protocol after modifying routine creation, superset grouping, `@dnd-kit` drag-and-drop, weekly split generation, calendar assignment/rescheduling, or offline outbox handlers.

## 1. Automated Code & Unit Verification
Run typecheck, ESLint, Vitest suites (including `supersets.test.ts`, `weeklySplit.test.ts`, `localDate.test.ts`, `outbox.test.ts`), and production Next.js build:
```cmd
cmd /c "cd /d C:\Users\pccoo\.gemini\antigravity\scratch\Pumped && npm run typecheck && npm run lint && npm run test && npm run build"
```
All 4 commands must exit `0`.

## 2. Live Browser E2E Verification (`chrome-devtools-mcp`)
1. Ensure a clean dev server is running (`npm.cmd run dev`, checking output for whether port `3000` or `3001` is bound).
2. Set mobile viewport (`390x844`) via `resize_page`.
3. **Verify `/routines` Empty State & Light Hairline UI**:
   - Confirm zero horizontal overflow (`document.documentElement.scrollWidth <= window.innerWidth`).
   - Confirm zero `console` errors and zero HTTP `>= 400` network responses.
4. **Routine Creation & Full-Page Exercise Picker + Supersets**:
   - Click `New`, enter routine name (e.g. `QA Push A`), pick color swatch, tap `Add` to open full-page `ExercisePickerModal`.
   - Select 2 exercises, confirm `Add (2)`, link them into Superset (`A1`/`A2`), adjust sets/reps/RPE/rest, click `Save`.
   - Confirm `POST /api/sync/mutate` returns `200` and routine row appears with `[A1]` / `[A2]`.
5. **Weekly Split Application**:
   - Open `Weekly Split`, assign `QA Push A` to Monday, apply for 4 weeks, click `Save`.
   - Confirm `POST /api/sync/mutate` returns `200` and Mon indicator activates on the split strip.
6. **Calendar & Agenda Verification (`/`)**:
   - Switch Month / Week view, click a scheduled Monday, verify `QA Push A` exercises (`A1`/`A2`) appear.
   - Tap an exercise row to confirm full-page `ExerciseDetailDrawer` visual demo opens cleanly.
   - Exercise `Move Date`, `Skip` / `Restore` actions on the scheduled item.
7. **Archive & Clean Database Teardown**:
   - Edit `QA Push A` on `/routines` -> `Archive Routine` -> `Confirm Archive`.
   - Confirm routine disappears from `/routines` and its planned calendar entries disappear from `/`.
   - Remove archived QA rows from `public.routines` via Supabase SQL so zero synthetic QA records remain (`count(*) == 0` for `routines`, `weekly_split_rules`, `scheduled_workouts` when clean).

## 3. Production Smoke Check
Navigate to `https://pumped-ten.vercel.app/exercises`, reload once, and verify all 56 curated exercises remain rendered cleanly with zero flash-to-empty and zero console errors.
