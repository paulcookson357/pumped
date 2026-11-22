---
name: Pumped Mobile PWA Verification Protocol
description: Standard operating procedure for verifying Pumped mobile PWA manifests, Service Worker offline precache, iOS/Android installability UI, Screen Wake Lock integration, and Lighthouse mobile compliance.
---

# Pumped Mobile PWA Verification Protocol

## 1. Dual-Source Manifest & Icons Verification
1. Ensure PNG icons (`icon-192.png`, `icon-512.png`, `icon-maskable-192.png`, `icon-maskable-512.png`, `apple-touch-icon.png`), `src/app/apple-icon.png`, and `src/app/favicon.ico` exist and match `node scripts/generate-icons.mjs`.
2. Confirm `src/app/manifest.ts` and `public/manifest.json` share identical JSON structure with `display: "standalone"`, `orientation: "portrait-primary"`, `start_url: "/"`, `scope: "/"`, `background_color: "#FFFFFF"`, `theme_color: "#FFFFFF"`, 4 icons, and 4 navigation shortcuts.
3. Verify HTTP responses under `next start`:
   - `GET /manifest.webmanifest` -> `200`, `orientation === "portrait-primary"`, `application/manifest+json`
   - `GET /manifest.json` -> `200`, `orientation === "portrait-primary"`, `application/manifest+json`
   - `GET /sw.js` -> `200`, `Service-Worker-Allowed: /`, `Cache-Control: no-cache, no-store, must-revalidate`

## 2. Production Build & Static Gate
Clean `.next` (with port 3000 idle) and run:
```cmd
cd /d C:\Users\pccoo\.gemini\antigravity\scratch\Pumped && npm run typecheck && npm run lint && npm run test && npm run build
```

## 3. Live Production Browser QA (`npm run start`)
Start `npm.cmd run start`, open Chrome DevTools MCP (`390x844` and `375x812` mobile touch emulation):
1. **Service Worker Activation & Precache:** Verify `navigator.serviceWorker.ready` resolves with `active.state === "activated"` and `pumped-shell-v5` contains `/`, `/routines`, `/exercises`, `/history`, `/settings`, `/offline`, and `/manifest.webmanifest`.
2. **iOS Safari Install UX:** Emulate iOS Safari user-agent at `390x844`, confirm `InstallBanner` displays `Install App`, open `InstallGuideModal`, confirm clean full-page modal rendering and `scrollWidth <= innerWidth` at `375x812`.
3. **Android Chromium & Settings Section:** Visit `/settings`, verify **Mobile App (PWA)** displays `Browser Mode`, `Offline Ready`, `Install App`, `Check Updates`, and `Gym Screen Wake Lock`, check `375x812` overflow (`scrollWidth <= innerWidth`), and confirm `beforeinstallprompt` integration displays native one-tap install state cleanly.
4. **True Offline Mode:** Visit `/`, `/routines`, `/history` online, switch Chrome DevTools network throttling to `Offline`, verify reloading `/`, navigating `/routines` and `/history`, and visiting an uncached route (`/uncached-offline-qa`) rendering `/offline` (`"You're offline"` + `"Retry Connection"`). Restore online status and confirm `0` console errors.
5. **Lighthouse Mobile Audit:** Run `lighthouse_audit` (`device: "mobile"`, `mode: "navigation"`) against `http://localhost:3000/` and inspect accessibility, best practices, SEO, and PWA findings.
