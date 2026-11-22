import fs from "node:fs";
import path from "node:path";

const nextDir = path.join(process.cwd(), ".next");
const prodMarkers = ["BUILD_ID", "prerender-manifest.json", "routes-manifest.json"];

const hasProdArtifacts = prodMarkers.some((marker) =>
  fs.existsSync(path.join(nextDir, marker))
);

if (hasProdArtifacts) {
  fs.rmSync(nextDir, { recursive: true, force: true });
  console.log(
    "[predev] Removed leftover production .next build artifacts before starting next dev."
  );
}
