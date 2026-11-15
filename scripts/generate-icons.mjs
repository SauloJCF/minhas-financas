// Gera os ícones PNG do PWA sem dependências externas.
// Uso: node scripts/generate-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const GREEN = [4, 120, 87]
const WHITE = [255, 255, 255]

// Barras do gráfico em coordenadas de uma grade 512x512: [x, y, largura, altura].
const BARS = [
  [136, 272, 64, 104],
  [224, 208, 64, 168],
  [312, 136, 64, 240],
]

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data])
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  body.copy(out, 4)
  out.writeUInt32BE(crc32(body), 8 + data.length)
  return out
}

/** `rounded`: cantos arredondados transparentes (ícone comum); sem isso, fundo cheio (maskable). */
function png(size, { rounded }) {
  const scale = size / 512
  const radius = 96 * scale
  const raw = Buffer.alloc(size * (1 + size * 4))
  for (let y = 0; y < size; y++) {
    const row = y * (1 + size * 4)
    for (let x = 0; x < size; x++) {
      const gx = x / scale
      const gy = y / scale
      const inBar = BARS.some(([bx, by, w, h]) => gx >= bx && gx < bx + w && gy >= by && gy < by + h)
      let alpha = 255
      if (rounded) {
        const dx = Math.max(radius - x, x - (size - 1 - radius), 0)
        const dy = Math.max(radius - y, y - (size - 1 - radius), 0)
        if (dx * dx + dy * dy > radius * radius) alpha = 0
      }
      const [r, g, b] = inBar ? WHITE : GREEN
      raw.set([r, g, b, alpha], row + 1 + x * 4)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.set([8, 6, 0, 0, 0], 8) // 8 bits, RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const icons = [
  ['pwa-192x192.png', 192, { rounded: true }],
  ['pwa-512x512.png', 512, { rounded: true }],
  ['pwa-maskable-512x512.png', 512, { rounded: false }],
  ['apple-touch-icon.png', 180, { rounded: false }],
]

for (const [name, size, options] of icons) {
  writeFileSync(new URL(`../public/${name}`, import.meta.url), png(size, options))
  console.log(`public/${name}`)
}
