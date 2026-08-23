/*
  Regenerates every raster brand asset (app icons, favicons, splash, OG card)
  straight from the vector geometry in the zappr brand guidelines, so the
  bitmaps can never drift from the mark.

  Geometry is verbatim from the brand book: two polygons on a 100-unit grid
  under `translate(5.25,0) skewX(-6)` — the 6 degree lean is baked in, never
  applied twice. Zero dependencies: scanline fill plus a hand-rolled PNG
  writer, so this runs on a bare `node` in CI or on an EAS worker.

  Usage: node scripts/gen-brand-assets.js
*/
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Brand palette (guidelines 05 — COLOR)
const STRIKE = '#DD7B08'; // the one accent, light surfaces
const SIGNAL = '#F7931A'; // dark-mode accent, Bitcoin lineage
const INK = '#1b1a17';
const WHITE = '#FFFFFF';

// Mark geometry (guidelines 01/02)
const POLYGONS = [
  [[20, 16], [80, 16], [80, 31], [64.3, 48], [39.3, 48], [55, 31], [20, 31]],
  [[58.8, 54], [45, 69], [80, 69], [80, 84], [20, 84], [20, 69], [33.8, 54]],
];
const SKEW = Math.tan((-6 * Math.PI) / 180);

/** The mark's polygons resolved into plain 100-grid coordinates. */
function markPolygons() {
  return POLYGONS.map((poly) => poly.map(([x, y]) => [x + SKEW * y + 5.25, y]));
}

/*
  Places the 100-unit mark on a W x H canvas. `glyph` is the fraction of the
  short edge the mark spans — 0.6 reproduces the brand app icon exactly
  (512 * 0.6 / 100 = 3.072 scale at a 102.4 inset).
*/
function placeMark(W, H, glyph) {
  const scale = (Math.min(W, H) * glyph) / 100;
  const ox = (W - 100 * scale) / 2;
  const oy = (H - 100 * scale) / 2;
  return markPolygons().map((poly) => poly.map(([x, y]) => [ox + x * scale, oy + y * scale]));
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function pointInPolygon(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance to the inner rect — an exact rounded-rectangle hit test. */
function inRoundRect(x, y, W, H, r) {
  if (x < 0 || y < 0 || x > W || y > H) return false;
  if (r <= 0) return true;
  const cx = Math.min(Math.max(x, r), W - r);
  const cy = Math.min(Math.max(y, r), H - r);
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= r * r;
}

/*
  4x4 supersampled render. `bg` may be null for a transparent plate (Android
  adaptive foregrounds and monochrome layers carry the shape in alpha).
*/
function render(spec) {
  const W = spec.W;
  const H = spec.H;
  const radius = spec.radius || 0;
  const SS = 4;
  const polys = spec.glyph > 0 ? placeMark(W, H, spec.glyph) : [];
  const bgRgb = spec.bg ? hexToRgb(spec.bg) : null;
  const fgRgb = hexToRgb(spec.fg);
  const out = Buffer.alloc(W * H * 4);

  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      let hitsBg = 0;
      let hitsFg = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = px + (sx + 0.5) / SS;
          const y = py + (sy + 0.5) / SS;
          const inPlate = inRoundRect(x, y, W, H, radius);
          if (inPlate) hitsBg++;
          // The glyph is always clipped to the plate when there is one.
          if (inPlate || !bgRgb) {
            for (let p = 0; p < polys.length; p++) {
              if (pointInPolygon(x, y, polys[p])) {
                hitsFg++;
                break;
              }
            }
          }
        }
      }
      const total = SS * SS;
      const aFg = hitsFg / total;
      const aBg = bgRgb ? hitsBg / total : 0;
      // Source-over: glyph on plate.
      const aOut = aFg + aBg * (1 - aFg);
      const i = (py * W + px) * 4;
      if (aOut > 0) {
        for (let c = 0; c < 3; c++) {
          const base = bgRgb ? bgRgb[c] * aBg * (1 - aFg) : 0;
          out[i + c] = Math.round((fgRgb[c] * aFg + base) / aOut);
        }
      }
      out[i + 3] = Math.round(aOut * 255);
    }
  }
  return out;
}

// Minimal PNG writer (RGBA8, no interlace)
const CRC_TABLE = (function () {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(W, H, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: truecolour + alpha
  // Bytes 10-12 (compression / filter / interlace) stay zero.
  const stride = W * 4 + 1;
  const raw = Buffer.alloc(H * stride);
  for (let y = 0; y < H; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * W * 4, (y + 1) * W * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const ROOT = path.resolve(__dirname, '..');
const MOBILE = path.join(ROOT, 'mobile', 'assets', 'images');
const WEB = path.join(ROOT, 'public');

const ASSETS = [
  // iOS/store icon: square source — the OS applies its own squircle mask.
  { file: [MOBILE, 'icon.png'], W: 1024, H: 1024, bg: INK, fg: WHITE, glyph: 0.6 },
  /*
    Android adaptive icon. Launchers crop the outer ~25% of each layer, so the
    glyph drops to 0.4 to stay in the safe zone (0.6 * 0.66) — at 0.6 a round
    mask clips the bolt's shoulders.
  */
  { file: [MOBILE, 'android-icon-background.png'], W: 1024, H: 1024, bg: STRIKE, fg: STRIKE, glyph: 0 },
  { file: [MOBILE, 'android-icon-foreground.png'], W: 1024, H: 1024, bg: null, fg: WHITE, glyph: 0.4 },
  // Themed icons are read from alpha only; the fill colour is cosmetic.
  { file: [MOBILE, 'android-icon-monochrome.png'], W: 1024, H: 1024, bg: null, fg: WHITE, glyph: 0.4 },
  // Splash sits on ink (app.json), so it takes the dark-surface accent.
  { file: [MOBILE, 'splash-icon.png'], W: 512, H: 512, bg: null, fg: SIGNAL, glyph: 0.86 },
  { file: [MOBILE, 'favicon.png'], W: 64, H: 64, bg: INK, fg: WHITE, radius: 14, glyph: 0.6 },

  // Web: Safari/iOS home-screen icon plus PNG fallbacks for crawlers.
  { file: [ROOT, 'src', 'app', 'apple-icon.png'], W: 180, H: 180, bg: INK, fg: WHITE, glyph: 0.6 },
  { file: [WEB, 'icon-512.png'], W: 512, H: 512, bg: INK, fg: WHITE, glyph: 0.6 },
  { file: [WEB, 'icon-192.png'], W: 192, H: 192, bg: INK, fg: WHITE, glyph: 0.6 },
  // Link-preview card: the mark alone on ink, Signal Orange per 05.
  { file: [ROOT, 'src', 'app', 'opengraph-image.png'], W: 1200, H: 630, bg: INK, fg: SIGNAL, glyph: 0.42 },
];

/*
  The two apps live on different branches for now (the Expo app is still in a
  PR), so only emit the assets whose app is actually present in this checkout
  rather than conjuring an orphan mobile/ tree.
*/
const HAS_MOBILE = fs.existsSync(path.join(ROOT, 'mobile'));
const HAS_WEB = fs.existsSync(path.join(ROOT, 'src', 'app'));

let written = 0;
for (const a of ASSETS) {
  const out = path.join.apply(null, a.file);
  const isMobile = out.startsWith(path.join(ROOT, 'mobile'));
  if (isMobile ? !HAS_MOBILE : !HAS_WEB) continue;
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, encodePng(a.W, a.H, render(a)));
  console.log(path.relative(ROOT, out) + '  ' + a.W + 'x' + a.H);
  written++;
}
if (!written) {
  console.error('No app found in ' + ROOT + ' — expected mobile/ or src/app/.');
  process.exit(1);
}
