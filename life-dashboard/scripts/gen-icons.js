// Génère les icônes PNG de la PWA sans dépendance (zlib uniquement).
const zlib = require('node:zlib'), fs = require('node:fs'), path = require('node:path');
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = b => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function png(size, maskable) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const R = size / 2, rad = size * (maskable ? 0 : 0.22);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      // coins arrondis (non maskable)
      const dx = Math.max(rad - x, 0, x - (size - 1 - rad)), dy = Math.max(rad - y, 0, y - (size - 1 - rad));
      const inside = rad === 0 || dx * dx + dy * dy <= rad * rad;
      const t = (x + y) / (2 * size);
      let r = 0 * (1 - t) + 4 * t, g = 168 * (1 - t) + 60 * t, b = 150 * (1 - t) + 55 * t; // dégradé corail -> bordeaux
      // anneau de progression (≈ 70 %) blanc
      const d = Math.hypot(x - R, y - R), ring = size * (maskable ? 0.22 : 0.27), th = size * 0.065;
      let a = inside ? 255 : 0;
      if (Math.abs(d - ring) < th / 2) {
        let ang = Math.atan2(y - R, x - R) + Math.PI / 2; if (ang < 0) ang += 2 * Math.PI;
        const on = ang < 2 * Math.PI * 0.7;
        const k = on ? 1 : 0.25; r = r * (1 - k) + 255 * k; g = g * (1 - k) + 255 * k; b = b * (1 - k) + 255 * k;
      }
      if (d < size * 0.055) { r = g = b = 255; }
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const out = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon-192.png'), png(192, false));
fs.writeFileSync(path.join(out, 'icon-512.png'), png(512, false));
fs.writeFileSync(path.join(out, 'maskable-512.png'), png(512, true));
fs.writeFileSync(path.join(out, 'apple-touch-icon.png'), png(180, true));
console.log('icônes générées');
