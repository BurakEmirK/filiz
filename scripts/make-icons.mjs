// Uygulama simgelerini (PNG) bağımlılık olmadan üretir: iki yapraklı filiz, sıcak toprak rengi zemin.
// Çalıştırma: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const BG = [0xa6, 0x5a, 0x33]
const FG = [0xff, 0xff, 0xff]

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png(size, pixels) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// Şekiller 0..1 birim kare koordinatlarında
const inRoundRect = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
const inCapsule = (x, y, ax, ay, bx, by, w) => {
  const dx = bx - ax, dy = by - ay
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)))
  return (x - (ax + t * dx)) ** 2 + (y - (ay + t * dy)) ** 2 <= w * w
}
const inEllipse = (x, y, cx, cy, rx, ry, rot) => {
  const c = Math.cos(rot), s = Math.sin(rot)
  const px = (x - cx) * c + (y - cy) * s, py = -(x - cx) * s + (y - cy) * c
  return (px / rx) ** 2 + (py / ry) ** 2 <= 1
}

function sprout(x, y, scale) {
  // İçerik merkez etrafında ölçeklenir (maskelenebilir simgede güvenli alan için)
  const u = 0.5 + (x - 0.5) / scale, v = 0.5 + (y - 0.5) / scale
  return (
    inCapsule(u, v, 0.5, 0.78, 0.5, 0.47, 0.035) ||
    inEllipse(u, v, 0.36, 0.42, 0.17, 0.085, Math.PI * 0.2) ||
    inEllipse(u, v, 0.63, 0.38, 0.15, 0.075, -Math.PI * 0.22)
  )
}

function render(size, { rounded, scale }) {
  const SS = 4
  const px = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let bg = 0, fg = 0
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size, v = (y + (sy + 0.5) / SS) / size
          const inside = rounded ? inRoundRect(u, v, 0.22) : true
          if (!inside) continue
          if (sprout(u, v, scale)) fg++
          else bg++
        }
      const n = SS * SS, a = (bg + fg) / n, i = (y * size + x) * 4
      for (let c = 0; c < 3; c++) px[i + c] = a ? Math.round((BG[c] * bg + FG[c] * fg) / (bg + fg)) : 0
      px[i + 3] = Math.round(a * 255)
    }
  return png(size, px)
}

mkdirSync('public', { recursive: true })
writeFileSync('public/apple-touch-icon.png', render(180, { rounded: false, scale: 1 })) // iOS köşeleri kendisi yuvarlar
writeFileSync('public/icon-192.png', render(192, { rounded: true, scale: 1 }))
writeFileSync('public/icon-512.png', render(512, { rounded: true, scale: 1 }))
writeFileSync('public/icon-512-maskable.png', render(512, { rounded: false, scale: 0.8 }))
writeFileSync(
  'public/icon.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#a65a33"/><path d="M32 50V30" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M32 33c-2-9-9-13-17-12 0 8 7 14 17 12z" fill="#fff"/><path d="M32 29c2-8 8-12 16-11 0 8-7 13-16 11z" fill="#fff" opacity=".85"/></svg>\n`,
)
console.log('Simgeler public/ klasörüne yazıldı.')
