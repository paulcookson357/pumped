---
name: pumped-supabase-env-check
description: Standard operating procedure for safely verifying Pumped server-only Supabase environment configuration (.env.local), .gitignore protection, and live database connectivity without exposing secret keys.
---

# Pumped Supabase Environment & Connectivity Check

Use this protocol whenever verifying `.env.local` changes, rotating Supabase secret keys, or debugging server-side Supabase connectivity in `Pumped`.

## 1. Security & Format Pre-Checks
1. Inspect `.gitignore` to confirm `.env*` is ignored (with `!.env.example` allowed) so secrets can never be committed.
2. Inspect `.env.local` to verify:
   - Keys are strictly `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (never prefixed with `NEXT_PUBLIC_`).
   - `SUPABASE_URL` uses `https://<project-ref>.supabase.co` with no trailing slash or surrounding quotes.
   - `SUPABASE_SERVICE_ROLE_KEY` is non-empty (`sb_secret_...` or JWT service_role format).
3. **Never** echo, log, or paste the full `SUPABASE_SERVICE_ROLE_KEY` in terminal output, artifacts, or chat responses—display only a short prefix and character length.

## 2. Live Server Connectivity Check
Run a one-shot Node verification command from the `Pumped` workspace root (`node --env-file=.env.local`):

```powershell
node --env-file=.env.local -e "const { createClient } = require('@supabase/supabase-js'); const u = process.env.SUPABASE_URL; const k = process.env.SUPABASE_SERVICE_ROLE_KEY; console.log('URL set:', Boolean(u), 'Key prefix:', k ? k.slice(0, 12) + '...' : 'MISSING', 'Key len:', k ? k.length : 0); if (!u || !k) process.exit(1); const sb = createClient(u, k, { auth: { persistSession: false, autoRefreshToken: false } }); Promise.all([sb.from('sync_meta').select('domain,version'), sb.from('app_settings').select('id,weight_unit,default_rest_seconds')]).then(([a, b]) => { console.log('sync_meta:', a.error || a.data); console.log('app_settings:', b.error || b.data); if (a.error || b.error) process.exit(1); });"
```

## 3. Expected Passing Output
- Exit code `0`
- `URL set: true` and `Key prefix: sb_secret_...` (non-zero length)
- `sync_meta` returns all 5 domains: `exercises`, `routines`, `schedule`, `workouts`, `settings`
- `app_settings` returns the single settings row (`id: 1`)
