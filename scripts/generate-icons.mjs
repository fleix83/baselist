// Erzeugt die PWA-Icons (rose Fläche mit weissem "b") ohne Bild-Dependencies.
// Aufruf: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256).map((_, n) => {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      return c
    })
  }
  let crc = -1
  for (const byte of buf) crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xFF]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function makeIcon(size) {
  const S = size
  const raw = Buffer.alloc(S * (1 + S * 4))
  // Farbwerte
  const bg = [225, 29, 72] // rose-600
  const fg = [255, 255, 255]

  const barX0 = 0.30 * S, barX1 = 0.42 * S, barY0 = 0.20 * S, barY1 = 0.78 * S
  const cx = 0.55 * S, cy = 0.60 * S, rOuter = 0.185 * S, rInner = 0.095 * S

  for (let y = 0; y < S; y++) {
    raw[y * (1 + S * 4)] = 0 // Filter: none
    for (let x = 0; x < S; x++) {
      let color = bg
      const inBar = x >= barX0 && x <= barX1 && y >= barY0 && y <= barY1
      const dist = Math.hypot(x - cx, y - cy)
      const inRing = dist <= rOuter && dist >= rInner
      if (inBar || inRing) color = fg
      const offset = y * (1 + S * 4) + 1 + x * 4
      raw[offset] = color[0]
      raw[offset + 1] = color[1]
      raw[offset + 2] = color[2]
      raw[offset + 3] = 255
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(S, 0)
  ihdr.writeUInt32BE(S, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public/icons', { recursive: true })
for (const size of [180, 192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, makeIcon(size))
  console.log(`public/icons/icon-${size}.png`)
}
