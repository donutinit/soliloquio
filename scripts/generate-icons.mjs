// Genera los iconos PNG de la PWA sin dependencias externas (solo node:zlib).
// Se ejecuta como paso "prebuild" en CI/Docker; no requiere herramientas gráficas.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function writePng(path, size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let off = 0;
  for (let y = 0; y < size; y++) {
    raw[off++] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixelAt(x, y);
      raw[off++] = r;
      raw[off++] = g;
      raw[off++] = b;
      raw[off++] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  writeFileSync(path, png);
  console.log(`wrote ${path} (${size}x${size})`);
}

const BG = [15, 17, 21, 255];
const FG = [232, 234, 237, 255];
const ACCENT = [76, 141, 255, 255];
const TRANSPARENT = [0, 0, 0, 0];

function inRoundedRect(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x >= x0 + w || y >= y0 + h) return false;
  const cx = Math.max(x0 + r, Math.min(x, x0 + w - r));
  const cy = Math.max(y0 + r, Math.min(y, y0 + h - r));
  return (x - cx) ** 2 + (y - cy) ** 2 <= r ** 2 || (x >= x0 + r && x < x0 + w - r) || (y >= y0 + r && y < y0 + h - r);
}

// Tres líneas de "texto" (dos claras, una azul), el motivo del prompter.
function icon(size, { rounded, pad }) {
  const bars = [
    { y: 0.3, w: 0.6, color: FG },
    { y: 0.45, w: 0.48, color: FG },
    { y: 0.6, w: 0.36, color: ACCENT }
  ];
  return (x, y) => {
    if (rounded && !inRoundedRect(x, y, 0, 0, size, size, size * 0.22)) return TRANSPARENT;
    const s = (v) => pad * size + v * size * (1 - 2 * pad);
    for (const bar of bars) {
      const bh = 0.075 * size * (1 - 2 * pad);
      const bx = s(0.2);
      const by = s(bar.y);
      const bw = bar.w * size * (1 - 2 * pad);
      if (inRoundedRect(x, y, bx, by, bw, bh, bh / 2)) return bar.color;
    }
    return BG;
  };
}

writePng(join(outDir, 'icon-192.png'), 192, icon(192, { rounded: true, pad: 0 }));
writePng(join(outDir, 'icon-512.png'), 512, icon(512, { rounded: true, pad: 0 }));
writePng(join(outDir, 'icon-512-maskable.png'), 512, icon(512, { rounded: false, pad: 0.12 }));
writePng(join(outDir, 'apple-touch-icon.png'), 180, icon(180, { rounded: false, pad: 0 }));
