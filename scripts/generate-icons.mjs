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

function signedDistRoundedBox(px, py, cx, cy, halfW, halfH, radius) {
  const dx = Math.abs(px - cx) - (halfW - radius);
  const dy = Math.abs(py - cy) - (halfH - radius);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const inside = Math.min(Math.max(dx, dy), 0);
  return outside + inside - radius;
}

function renderIcon(size, { maskable = false } = {}) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = maskable ? 0.68 : 0.84;

  // Base canvas #09090B -> (9, 9, 11)
  // Subtle elevated inner squircle #111116 -> (17, 17, 22)
  // Emerald accent #10B981 -> (16, 185, 129)
  // Bright white plates #F4F4F5 -> (244, 244, 245)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = (y * size + x) * 4;
      // Normalized coords in [-1, 1]
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ny = ((y + 0.5) / size) * 2 - 1;

      let r = 9;
      let g = 9;
      let b = 11;

      // Radial emerald ambient glow at center
      const distCenter = Math.hypot(nx, ny);
      const glow = Math.max(0, 1 - distCenter / 0.95);
      r = Math.round(r + glow * glow * 8);
      g = Math.round(g + glow * glow * 34);
      b = Math.round(b + glow * glow * 26);

      if (!maskable) {
        // Subtle rounded inner frame
        const cardDist = signedDistRoundedBox(nx, ny, 0, 0, 0.9, 0.9, 0.24);
        if (cardDist > -0.02 && cardDist <= 0) {
          r = 39;
          g = 39;
          b = 42;
        }
      }

      // Scale coordinates for dumbbell emblem
      const sx = nx / scale;
      const sy = ny / scale;

      // Dumbbell geometry (symmetrical left/right)
      const barDist = signedDistRoundedBox(sx, sy, 0, 0, 0.34, 0.065, 0.03);

      const leftInnerPlate = signedDistRoundedBox(sx, sy, -0.34, 0, 0.075, 0.28, 0.04);
      const leftOuterPlate = signedDistRoundedBox(sx, sy, -0.5, 0, 0.065, 0.2, 0.035);

      const rightInnerPlate = signedDistRoundedBox(sx, sy, 0.34, 0, 0.075, 0.28, 0.04);
      const rightOuterPlate = signedDistRoundedBox(sx, sy, 0.5, 0, 0.065, 0.2, 0.035);

      const barCapLeft = signedDistRoundedBox(sx, sy, -0.61, 0, 0.045, 0.055, 0.025);
      const barCapRight = signedDistRoundedBox(sx, sy, 0.61, 0, 0.045, 0.055, 0.025);

      const plateDist = Math.min(leftInnerPlate, leftOuterPlate, rightInnerPlate, rightOuterPlate);
      const metalDist = Math.min(barDist, barCapLeft, barCapRight);

      // Anti-aliased blending width
      const aa = 2.2 / (size * scale);

      if (metalDist < aa) {
        const cov = Math.min(1, Math.max(0, (aa - metalDist) / (2 * aa)));
        r = Math.round(r * (1 - cov) + 244 * cov);
        g = Math.round(g * (1 - cov) + 244 * cov);
        b = Math.round(b * (1 - cov) + 245 * cov);
      }

      if (plateDist < aa) {
        const cov = Math.min(1, Math.max(0, (aa - plateDist) / (2 * aa)));
        // Emerald plates (#10B981)
        r = Math.round(r * (1 - cov) + 16 * cov);
        g = Math.round(g * (1 - cov) + 185 * cov);
        b = Math.round(b * (1 - cov) + 129 * cov);
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = 255;
    }
  }

  return encodePng(size, size, rgba);
}

const outDir = path.resolve(process.cwd(), "public", "icons");
fs.mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-maskable-512.png", size: 512, maskable: true },
  { file: "apple-touch-icon.png", size: 180, maskable: false },
];

for (const target of targets) {
  const png = renderIcon(target.size, { maskable: target.maskable });
  fs.writeFileSync(path.join(outDir, target.file), png);
  console.log(`Generated ${target.file} (${png.length} bytes)`);
}
