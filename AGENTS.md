# Pumped — Engineering & AI Agent Workspace Rules

These rules apply across the entire `Pumped` repository and are always active.

## 1. Zero Hardcoded User Data
- NEVER hardcode user workouts, routines, weekly split schedules, calendar assignments, set logs, PRs, workout stats, or placeholder demo arrays in UI components, Zustand stores, or API routes.
- All user data MUST originate from Supabase PostgreSQL or the local IndexedDB / `localStorage` caches populated from real user actions and DB snapshots.
- When no data exists yet (or before Supabase environment variables are configured), render clean, honest empty states with actionable guidance.

## 2. Reference Seed Data Isolation
- The ONLY static dataset allowed in the repository is the curated ~55 standard strength exercises seed (`supabase/seed.sql`) and its static image/GIF assets in `public/exercises/`.
- Never import seed JSON/SQL directly into React components or stores as a fake fallback if a database query fails or is unconfigured.

## 3. Strict TypeScript & Runtime Validation
- `strict: true` and `noUncheckedIndexedAccess: true` are mandatory in `tsconfig.json`.
- Zero `any`, zero `@ts-ignore`, zero `@ts-expect-error`, and zero unsafe type assertions without validation.
- Every `/api/*` Route Handler and offline sync mutation payload MUST be validated at runtime with `zod` before touching the database.

## 4. Single-User Security Without Login Friction
- This is a personal 1-user app with no public auth screen.
- Every table in Supabase MUST have `ENABLE ROW LEVEL SECURITY` with zero `anon` policies (default-deny).
- All Supabase reads and writes MUST execute exclusively inside Next.js Server Components or `/api/*` Route Handlers using the server-only `SUPABASE_SERVICE_ROLE_KEY`.
- NEVER expose `SUPABASE_SERVICE_ROLE_KEY` via `NEXT_PUBLIC_*` or import `@/lib/supabase/server` into any `'use client'` module.

## 5. Cache-First Speed & Selective Invalidation
- Client views hydrate immediately from IndexedDB (`idb`) and `localStorage` (active workout + rest timer) so gym-floor renders take ~0ms.
- On app focus, load, or network reconnect, check `/api/sync/versions` (`sync_meta`) first and fetch snapshots ONLY for domains whose version incremented.
- Every server write MUST bump the affected domain(s) in `sync_meta` (`exercises`, `routines`, `schedule`, `workouts`, `settings`) and call Next.js `revalidateTag(...)`.

## 6. Mobile-First Gym Floor UX Standards
- Default weight unit is `kg` (configurable in Settings).
- Interactive buttons and set checkmarks MUST have minimum `44x44px` touch targets.
- Numeric inputs (`weight`, `reps`) MUST use `font-size >= 16px` (`text-base`) and `inputMode="decimal"` / `"numeric"` to prevent iOS Safari zoom.
- Use `tabular-nums` on weights, reps, timers, and volumes.
- Always store and render calendar dates as local `YYYY-MM-DD` strings—never shift calendar days with `toISOString().slice(0, 10)`.
- Maintain zero horizontal overflow down to `375px` viewport width and respect `env(safe-area-inset-*)`.

## 7. Modularity & Quality Gates
- Keep components focused and modular (avoid monolithic files > ~250 lines).
- Put pure calculations (`oneRepMax`, `volume`, `prDetector`, `weeklySplit`, `outbox`) in `src/lib/` with Vitest unit tests.
- Before concluding any implementation phase, run and verify:
  `npm run typecheck && npm run lint && npm run test && npm run build`

## 8. Visual Design System (Light Theme, Hairline Dividers, Full-Page Modals)
- **Crisp Light Theme:** Use a `#FFFFFF` canvas, `text-zinc-950` primary ink, `text-zinc-500` / `text-zinc-600` secondary ink, subtle `#E4E4E7` hairline dividers (`border-zinc-200`, `divide-zinc-200`), and `emerald-600` primary actions/highlights.
- **Minimal Cards & Full-Space Layout:** Avoid boxed card containers (`rounded-2xl border bg-... p-5`). Utilize the full viewport width with clean horizontal padding (`px-4 sm:px-6`) and separate sections, lists, and settings rows with full-bleed hairline borders (`border-b border-zinc-200`, `divide-y divide-zinc-200`).
- **Full-Page Modals:** All popup dialogs, detail views, pickers, and creation forms MUST render as true full-page overlays (`fixed inset-0 z-50 flex h-dvh w-full flex-col bg-white`) with a sticky header (`border-b border-zinc-200`) and full-height scrollable content—never cramped floating boxes or partial bottom sheets.
