import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

describe("PWA dual-source manifest parity", () => {
  it("keeps src/app/manifest.ts and public/manifest.json identical with portrait-primary standalone display", () => {
    const dynamicManifest = manifest();
    const staticManifestPath = path.resolve(
      process.cwd(),
      "public",
      "manifest.json"
    );
    const staticManifestRaw = fs.readFileSync(staticManifestPath, "utf8");
    const staticManifest = JSON.parse(staticManifestRaw) as Record<
      string,
      unknown
    >;

    expect(dynamicManifest.orientation).toBe("portrait-primary");
    expect(dynamicManifest.display).toBe("standalone");
    expect(dynamicManifest.start_url).toBe("/");
    expect(dynamicManifest.scope).toBe("/");
    expect(staticManifest).toEqual(dynamicManifest);
  });

  it("declares valid existing icon files including 192 and 512 maskable icons", () => {
    const dynamicManifest = manifest();
    const icons = dynamicManifest.icons ?? [];

    expect(icons.length).toBeGreaterThanOrEqual(4);
    expect(
      icons.some(
        (icon) => icon.sizes === "192x192" && icon.purpose === "maskable"
      )
    ).toBe(true);
    expect(
      icons.some(
        (icon) => icon.sizes === "512x512" && icon.purpose === "maskable"
      )
    ).toBe(true);

    for (const icon of icons) {
      const cleanRelPath = icon.src.replace(/^\//, "");
      const fullPath = path.resolve(process.cwd(), "public", cleanRelPath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }

    const shortcuts = dynamicManifest.shortcuts ?? [];
    expect(shortcuts.map((shortcut) => shortcut.url)).toEqual([
      "/",
      "/routines",
      "/exercises",
      "/history",
    ]);
  });
});
