export type InstallPlatform =
  | "installed"
  | "android-chromium"
  | "ios-safari"
  | "ios-other-browser"
  | "desktop-chromium"
  | "other";

export interface PlatformDetectionInput {
  userAgent: string;
  maxTouchPoints: number;
  isStandalone: boolean;
}

export const INSTALL_DISMISS_STORAGE_KEY = "pumped_pwa_install_dismissed_until";
export const INSTALL_DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

/**
 * Determine whether the web app is already running as an installed standalone PWA.
 */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const nav = window.navigator as NavigatorWithStandalone;
  if (nav.standalone === true) {
    return true;
  }

  if (typeof window.matchMedia === "function") {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches
    );
  }

  return false;
}

/**
 * Identify mobile/desktop browser install capability from UA, touch points, and display mode.
 */
export function detectInstallPlatform({
  userAgent,
  maxTouchPoints,
  isStandalone,
}: PlatformDetectionInput): InstallPlatform {
  if (isStandalone) {
    return "installed";
  }

  const ua = userAgent;
  const isIosDevice =
    /iPhone|iPad|iPod/i.test(ua) ||
    (/Macintosh/i.test(ua) && maxTouchPoints > 1);

  if (isIosDevice) {
    const isAltIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
    return isAltIosBrowser ? "ios-other-browser" : "ios-safari";
  }

  const isAndroid = /Android/i.test(ua);
  const isChromium = /Chrome|Chromium|EdgA|Edg|SamsungBrowser/i.test(ua);

  if (isAndroid && isChromium) {
    return "android-chromium";
  }

  if (isChromium) {
    return "desktop-chromium";
  }

  return "other";
}

function getStorage(explicit?: Pick<Storage, "getItem" | "setItem" | "removeItem">): Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
> | null {
  if (explicit) return explicit;
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isInstallBannerDismissed(
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  nowMs: number = Date.now()
): boolean {
  const store = getStorage(storage);
  if (!store) return false;

  const raw = store.getItem(INSTALL_DISMISS_STORAGE_KEY);
  if (!raw) return false;

  const expiresAt = Number(raw);
  if (!Number.isFinite(expiresAt) || expiresAt <= nowMs) {
    store.removeItem(INSTALL_DISMISS_STORAGE_KEY);
    return false;
  }

  return true;
}

export function dismissInstallBanner(
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  nowMs: number = Date.now()
): void {
  const store = getStorage(storage);
  if (!store) return;
  store.setItem(
    INSTALL_DISMISS_STORAGE_KEY,
    String(nowMs + INSTALL_DISMISS_TTL_MS)
  );
}

export function clearInstallBannerDismissal(
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">
): void {
  const store = getStorage(storage);
  if (!store) return;
  store.removeItem(INSTALL_DISMISS_STORAGE_KEY);
}
