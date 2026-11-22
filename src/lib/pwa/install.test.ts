import { describe, expect, it } from "vitest";
import {
  clearInstallBannerDismissal,
  detectInstallPlatform,
  dismissInstallBanner,
  INSTALL_DISMISS_TTL_MS,
  isInstallBannerDismissed,
} from "@/lib/pwa/install";

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe("detectInstallPlatform", () => {
  it("returns installed when standalone display mode is active", () => {
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        maxTouchPoints: 5,
        isStandalone: true,
      })
    ).toBe("installed");
  });

  it("identifies iPhone Safari vs iOS third-party browsers", () => {
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
        maxTouchPoints: 5,
        isStandalone: false,
      })
    ).toBe("ios-safari");

    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1",
        maxTouchPoints: 5,
        isStandalone: false,
      })
    ).toBe("ios-other-browser");
  });

  it("identifies iPadOS desktop-mode Safari using maxTouchPoints", () => {
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15",
        maxTouchPoints: 5,
        isStandalone: false,
      })
    ).toBe("ios-safari");
  });

  it("identifies Android Chrome and Desktop Chromium browsers", () => {
    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
        maxTouchPoints: 5,
        isStandalone: false,
      })
    ).toBe("android-chromium");

    expect(
      detectInstallPlatform({
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        maxTouchPoints: 0,
        isStandalone: false,
      })
    ).toBe("desktop-chromium");
  });
});

describe("install banner dismissal TTL", () => {
  it("expires stored dismissal after 7 days and clears cleanly", () => {
    const storage = new MemoryStorage();
    const startMs = 1_700_000_000_000;

    expect(isInstallBannerDismissed(storage, startMs)).toBe(false);

    dismissInstallBanner(storage, startMs);
    expect(isInstallBannerDismissed(storage, startMs + 1000)).toBe(true);
    expect(
      isInstallBannerDismissed(storage, startMs + INSTALL_DISMISS_TTL_MS - 1)
    ).toBe(true);
    expect(
      isInstallBannerDismissed(storage, startMs + INSTALL_DISMISS_TTL_MS)
    ).toBe(false);

    dismissInstallBanner(storage, startMs);
    clearInstallBannerDismissal(storage);
    expect(isInstallBannerDismissed(storage, startMs + 1000)).toBe(false);
  });
});
