import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * stride;
    raw[rowStart] = 0; // filter type 0
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

function packIco(entries) {
  const count = entries.length;
  const headerSize = 6 + count * 16;
  const header = Buffer.alloc(headerSize);

  // ICO header: reserved=0, type=1 (icon), image count
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  let offset = headerSize;
  for (let i = 0; i < count; i += 1) {
    const { size, png } = entries[i];
    const dirOffset = 6 + i * 16;
    header[dirOffset] = size >= 256 ? 0 : size;
    header[dirOffset + 1] = size >= 256 ? 0 : size;
    header[dirOffset + 2] = 0; // color count
    header[dirOffset + 3] = 0; // reserved
    header.writeUInt16LE(1, dirOffset + 4); // planes
    header.writeUInt16LE(32, dirOffset + 6); // bits per pixel
    header.writeUInt32LE(png.length, dirOffset + 8);
    header.writeUInt32LE(offset, dirOffset + 12);
    offset += png.length;
  }

  return Buffer.concat([header, ...entries.map((entry) => entry.png)]);
}

function signedDistRoundedBox(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

// Brand colors aligned with Pumped light theme (TopHeader emerald-600 badge + crisp white dumbbell)
const EMERALD_600 = [5, 150, 105];
const WHITE = [255, 255, 255];

function sampleIconPixel(nx, ny, { scale, fullBleed, aaOuter, aaShape }) {
  // 1. Background alpha (rounded squircle with 25% corner radius, or full-bleed square)
  let bgAlpha = 1;
  if (!fullBleed) {
    const bgDist = signedDistRoundedBox(nx, ny, 0, 0, 1.0, 1.0, 0.5);
    bgAlpha = Math.min(1, Math.max(0, 0.5 - bgDist / (2 * aaOuter)));
    if (bgAlpha <= 0) {
      return [0, 0, 0, 0];
    }
  }

  // 2. Rotate screen coords by +45 deg (inverse of SVG rotate(-45)) for diagonal bottom-left -> top-right bar
  const rx = (nx - ny) * Math.SQRT1_2;
  const ry = (nx + ny) * Math.SQRT1_2;
  const sx = rx / scale;
  const sy = ry / scale;

  // 3. Dumbbell union SDF matching src/app/icon.svg
  const barDist = signedDistRoundedBox(sx, sy, 0, 0, 0.72, 0.072, 0.036);
  const leftInnerPlate = signedDistRoundedBox(sx, sy, -0.31, 0, 0.085, 0.31, 0.042);
  const leftOuterPlate = signedDistRoundedBox(sx, sy, -0.525, 0, 0.072, 0.22, 0.036);
  const rightInnerPlate = signedDistRoundedBox(sx, sy, 0.31, 0, 0.085, 0.31, 0.042);
  const rightOuterPlate = signedDistRoundedBox(sx, sy, 0.525, 0, 0.072, 0.22, 0.036);

  const dumbbellDist = Math.min(
    barDist,
    leftInnerPlate,
    leftOuterPlate,
    rightInnerPlate,
    rightOuterPlate
  );

  const fgCov = Math.min(1, Math.max(0, 0.5 - dumbbellDist / (2 * aaShape)));

  const r = EMERALD_600[0] * (1 - fgCov) + WHITE[0] * fgCov;
  const g = EMERALD_600[1] * (1 - fgCov) + WHITE[1] * fgCov;
  const b = EMERALD_600[2] * (1 - fgCov) + WHITE[2] * fgCov;

  return [r, g, b, bgAlpha];
}

function renderIcon(size, { maskable = false, fullBleed = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.78 : 1.02;
  const effectiveFullBleed = fullBleed || maskable;
  const samples = size <= 192 ? 4 : 2;
  const sampleCount = samples * samples;
  const aaOuter = 1.0 / size;
  const aaShape = 1.0 / (size * scale);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let accR = 0;
      let accG = 0;
      let accB = 0;
      let accA = 0;

      for (let sy = 0; sy < samples; sy += 1) {
        const py = y + (sy + 0.5) / samples;
        const ny = (py / size) * 2 - 1;
        for (let sx = 0; sx < samples; sx += 1) {
          const px = x + (sx + 0.5) / samples;
          const nx = (px / size) * 2 - 1;
          const [sr, sg, sb, sa] = sampleIconPixel(nx, ny, {
            scale,
            fullBleed: effectiveFullBleed,
            aaOuter,
            aaShape,
          });
          // Accumulate premultiplied alpha so rounded edge blends cleanly without dark fringes
          accR += sr * sa;
          accG += sg * sa;
          accB += sb * sa;
          accA += sa;
        }
      }

      const avgA = accA / sampleCount;
      const idx = (y * size + x) * 4;
      if (avgA <= 0) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
      } else {
        rgba[idx] = Math.min(255, Math.round(accR / accA));
        rgba[idx + 1] = Math.min(255, Math.round(accG / accA));
        rgba[idx + 2] = Math.min(255, Math.round(accB / accA));
        rgba[idx + 3] = Math.min(255, Math.round(avgA * 255));
      }
    }
  }

  return encodePng(size, size, rgba);
}

const publicIconsDir = path.resolve(process.cwd(), "public", "icons");
const appDir = path.resolve(process.cwd(), "src", "app");
fs.mkdirSync(publicIconsDir, { recursive: true });
fs.mkdirSync(appDir, { recursive: true });

const pngTargets = [
  { outPath: path.join(publicIconsDir, "icon-192.png"), size: 192, maskable: false, fullBleed: false },
  { outPath: path.join(publicIconsDir, "icon-512.png"), size: 512, maskable: false, fullBleed: false },
  { outPath: path.join(publicIconsDir, "icon-maskable-192.png"), size: 192, maskable: true, fullBleed: true },
  { outPath: path.join(publicIconsDir, "icon-maskable-512.png"), size: 512, maskable: true, fullBleed: true },
  { outPath: path.join(publicIconsDir, "apple-touch-icon.png"), size: 180, maskable: false, fullBleed: true },
  { outPath: path.join(appDir, "apple-icon.png"), size: 180, maskable: false, fullBleed: true },
];

for (const target of pngTargets) {
  const png = renderIcon(target.size, {
    maskable: target.maskable,
    fullBleed: target.fullBleed,
  });
  fs.writeFileSync(target.outPath, png);
  console.log(`Generated ${path.relative(process.cwd(), target.outPath)} (${png.length} bytes)`);
}

const icoSizes = [16, 32, 48];
const icoEntries = icoSizes.map((size) => ({
  size,
  png: renderIcon(size, { maskable: false, fullBleed: false }),
}));
const icoBuffer = packIco(icoEntries);
const faviconPath = path.join(appDir, "favicon.ico");
fs.writeFileSync(faviconPath, icoBuffer);
console.log(`Generated ${path.relative(process.cwd(), faviconPath)} (${icoBuffer.length} bytes, sizes: ${icoSizes.join(",")})`);
