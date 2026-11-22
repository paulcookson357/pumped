---
name: pumped-dev-cache-and-sw-triage
description: Standard operating procedure for diagnosing unstyled HTML, 404 /_next/static/* chunks, .next build/dev collisions, and stale localhost Service Workers in Pumped.
---

# Pumped Dev Cache & Service Worker Triage Protocol

Use this protocol whenever a local Next.js page renders unstyled HTML, shows missing styles/JS bundles, or exhibits chunk `404` errors on `localhost:3000`.

## 1. Root Cause Checklist
1. **`.next` Production/Dev Collision:** Running `npm run build` followed by `npm run dev` without clearing `.next/` leaves production manifests (`BUILD_ID`, `prerender-manifest.json`, `routes-manifest.json`) that collide with `next dev` dynamic chunk compilation, causing `/_next/static/css/app/layout.css` or page JS bundles to `404`.
2. **Stale `localhost:3000` Service Worker:** Any prior PWA on `localhost:3000` leaves `/sw.js` active in Chrome, which can auto-update to `public/sw.js` during dev and trigger concurrent `PRECACHE_ROUTES` navigation requests or cache stale `404`/dev chunks.

## 2. Diagnostic Commands

### Inspect `.next` Artifacts & Port 3000 Listener
```powershell
Get-ChildItem .next -Name
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object LocalPort, State, OwningProcess
```

### Verify Every Referenced `/_next/static/*` Asset Returns HTTP 200
```powershell
@'
const html = await fetch('http://localhost:3000/exercises').then(r => r.text());
const urls = [...html.matchAll(/(?:href|src)="(\/_next\/static\/[^"]+)"/g)].map(m => m[1]);
for (const u of urls) {
  const res = await fetch('http://localhost:3000' + u);
  console.log(res.status, res.headers.get('content-type'), u);
  if (res.status !== 200) process.exitCode = 1;
}
'@ | node --input-type=module
```

## 3. Remediation Verification
1. Confirm `scripts/clean-next-before-dev.mjs` runs via `"predev"` in `package.json` whenever `next dev` starts.
2. Confirm `ServiceWorkerRegistrar.tsx` actively unregisters Service Workers and deletes `pumped-*` caches when `NODE_ENV !== "production"`.
3. Confirm `public/sw.js` skips Next.js dev chunks (`?v=...`, `/_next/static/development/`, `/_next/static/webpack/`).
4. Re-run `npm run typecheck && npm run lint && npm run test && npm run build`, start `npm.cmd run dev`, verify HTTP `200` on all static assets, and inspect `list_network_requests` + `take_screenshot` via `chrome-devtools-mcp`.
