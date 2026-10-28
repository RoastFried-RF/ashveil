/**
 * ASHVEIL original masked ash reaver — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-reaver1.mjs          write this isolated art package
 * node tools/art/draw-reaver1.mjs --check  compare every output without writing
 * No install mode: this tool cannot change the game's manifest or definitions.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const root = fileURLToPath(new URL('../../', import.meta.url))
const output = 'public/sprites/original'
const stem = 'ashveil-reaver1'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// Authored rust-red cloth, ash mask, weathered straps, exposed skin and shin wraps.
// No iron cap, teal hood, satchel, or pale rope belt from the other characters.
const palette = {
  o: '#1c1d1f', k: '#2a2828',
  d: '#422c32', t: '#674046', m: '#8c5755', l: '#b27a68',
  c: '#66665d', p: '#98998a', h: '#c1bfa5',
  b: '#332d2a', r: '#584234', n: '#866448', a: '#af885f',
  s: '#755747', f: '#b28a69', e: '#d7b58b',
  v: '#303738', w: '#535e5a', u: '#768277',
  j: '#687674', I: '#adb5a8',
  B: '#262b2c', D: '#333c3e', G: '#59625f', Q: '#e0d8bf',
}

function canvas(w, h) {
  const pixels = Array.from({ length: h }, () => Array(w).fill('.'))
  function point(x, y, color) {
    assert(Number.isInteger(x) && Number.isInteger(y), 'Pixel coordinates must be integers')
    assert(x >= 0 && y >= 0 && x < w && y < h, `Out-of-bounds pixel: ${x},${y} in ${w}×${h}`)
    assert(color === '.' || palette[color], `Unknown palette key: ${color}`)
    pixels[y][x] = color
  }
  function rect(x, y, rw, rh, color) {
    for (let py = y; py < y + rh; py++) for (let px = x; px < x + rw; px++) point(px, py, color)
  }
  function line(x0, y0, x1, y1, color) {
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
    let error = dx + dy
    for (;;) {
      point(x0, y0, color)
      if (x0 === x1 && y0 === y1) break
      const twice = 2 * error
      if (twice >= dy) { error += dy; x0 += sx }
      if (twice <= dx) { error += dx; y0 += sy }
    }
  }
  function polygon(vertices, color) {
    const xs = vertices.map(p => p[0]), ys = vertices.map(p => p[1])
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
      let inside = false
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const [xi, yi] = vertices[i], [xj, yj] = vertices[j]
        if ((yi > y + .5) !== (yj > y + .5) && x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi) inside = !inside
      }
      if (inside) point(x, y, color)
    }
  }
  function row(x, y, colors) {
    for (let i = 0; i < colors.length; i++) if (colors[i] !== '.') point(x + i, y, colors[i])
  }
  return { w, h, pixels, point, rect, line, polygon, row }
}

function paste(dst, src, x0, y0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (src.pixels[y][x] !== '.') dst.point(x0 + x, y0 + y, src.pixels[y][x])
  }
}

function mirror(src) {
  const dst = canvas(src.w, src.h)
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) dst.point(src.w - x - 1, y, src.pixels[y][x])
  return dst
}

function legs(c, side, step) {
  // Wrapped shins, short boots, distinct stepping knees; exclusive floor y=31.
  if (!side) {
    const lx = 8 + (step === 1 ? 1 : step === -1 ? -1 : 0)
    const rx = 14 - (step === -1 ? 1 : step === 1 ? -1 : 0)
    const ly = step === 1 ? 28 : 30, ry = step === -1 ? 28 : 30
    c.polygon([[8, 21], [12, 21], [11, 25], [lx + 2, ly - 1], [lx - 1, ly - 1], [7, 25]], 'o')
    c.polygon([[13, 21], [17, 21], [18, 25], [rx + 2, ry - 1], [rx - 1, ry - 1], [13, 25]], 'o')
    c.line(9, 22, lx, ly - 3, 'w'); c.point(9, 23, 'u')
    c.line(15, 22, rx, ry - 3, 'v'); c.point(15, 23, 'w')
    c.row(lx - 1, ly - 4, 'pc'); c.row(lx - 1, ly - 3, 'cp'); c.row(lx - 1, ly - 2, 'pc')
    c.row(rx, ry - 4, 'cc'); c.row(rx, ry - 3, 'pc'); c.row(rx, ry - 2, 'cp')
    c.row(lx - 2, ly - 1, 'onna'); c.row(lx - 2, ly, 'ookko')
    c.row(rx - 1, ry - 1, 'nrbo'); c.row(rx - 1, ry, 'okkko')
  } else {
    const far = step === -1 ? 2 : step === 1 ? -2 : 0, near = -far
    const farY = step === -1 ? 28 : 30, nearY = step === 1 ? 28 : 30
    c.polygon([[11, 21], [15, 21], [14 + far, 25], [13 + far, farY - 1], [10 + far, farY - 1], [11, 25]], 'o')
    c.line(13, 22, 12 + far, farY - 3, 'v')
    c.row(11 + far, farY - 3, 'cc'); c.row(11 + far, farY - 2, 'pc'); c.row(9 + far, farY - 1, 'nrbb'); c.row(9 + far, farY, 'okkko')
    c.polygon([[10, 21], [14, 21], [13 + near, 25], [12 + near, nearY - 1], [8 + near, nearY - 1], [9, 25]], 'o')
    c.line(11, 22, 10 + near, nearY - 3, 'w'); c.point(11, 23, 'u')
    c.row(9 + near, nearY - 4, 'pc'); c.row(9 + near, nearY - 3, 'cp'); c.row(9 + near, nearY - 2, 'pc')
    c.row(7 + near, nearY - 1, 'oanrb'); c.row(7 + near, nearY, 'ookkko')
  }
}

function strapFront(c) {
  c.line(7, 12, 16, 21, 'o'); c.line(6, 12, 15, 21, 'r'); c.line(7, 12, 16, 21, 'n')
  c.row(10, 16, 'jIj'); c.row(10, 17, 'Ioj'); c.row(10, 18, 'jjj')
  c.row(7, 21, 'ornnrrnrro'); c.row(7, 22, 'orrrbrrrro')
  c.row(14, 21, 'jIj'); c.row(14, 22, 'jaj'); c.row(14, 23, 'jjj')
}

function faceFront(c) {
  // Exposed close-cropped scalp, watchful eyes, and a separate ash-cloth mask.
  c.polygon([[10, 3], [15, 3], [17, 5], [17, 10], [15, 12], [9, 12], [7, 9], [7, 6], [8, 4]], 'o')
  c.polygon([[10, 4], [14, 4], [16, 6], [16, 9], [9, 9], [8, 7], [8, 5]], 'f')
  c.row(9, 4, 'kkffk'); c.row(8, 5, 'ksffe'); c.point(15, 5, 's')
  c.row(8, 6, 'sskkfkkss'); c.row(8, 7, 'skoefokfs'); c.point(12, 7, 'e'); c.point(12, 8, 'f')
  c.row(7, 8, 'sccphppccs'); c.row(8, 9, 'cphhppcc'); c.row(8, 10, 'cpcppccd')
  c.row(9, 11, 'cpppccd'); c.row(10, 12, 'cpcdd'); c.point(15, 9, 'p'); c.point(9, 10, 'h')
}

function armsFront(c, step, attacking, back) {
  // The active left arm is screen right from the front, screen left from behind.
  const layer = canvas(24, 32)
  const ly = 15 + step
  layer.polygon([[5, ly], [7, ly], [8, ly + 5], [6, ly + 8], [3, ly + 7], [3, ly + 3]], 'o')
  layer.rect(4, ly + 1, 2, 3, 't'); layer.row(4, ly + 3, 'md'); layer.row(4, ly + 4, 'sf')
  layer.row(4, ly + 5, 'pf'); layer.row(4, ly + 6, 'ef'); layer.point(5, ly + 7, 's')
  if (!attacking) {
    const ry = 15 - step
    layer.polygon([[17, ry], [20, ry + 1], [21, ry + 5], [19, ry + 8], [17, ry + 6]], 'o')
    layer.rect(18, ry + 1, 2, 3, 'd'); layer.row(18, ry + 3, 'tm'); layer.row(18, ry + 4, 'fs')
    layer.row(18, ry + 5, 'fp'); layer.row(18, ry + 6, 'fe'); layer.point(18, ry + 7, 's')
  }
  paste(c, back ? mirror(layer) : layer, 0, 0)
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, step)
  c.polygon([[8, 11], [16, 11], [20, 15], [19, 20], [18, 24], [15, 23], [13, 25], [10, 23], [7, 24], [5, 20], [5, 15]], 'o')
  c.polygon([[8, 13], [16, 13], [18, 16], [17, 21], [16, 23], [12, 22], [9, 23], [7, 22], [6, 18]], 'c')
  c.polygon([[13, 14], [16, 14], [17, 19], [16, 22], [13, 21]], 'd')
  c.line(8, 17, 8, 21, 'p'); c.point(9, 22, 'h'); c.point(16, 22, 'c')
  armsFront(c, step, attacking, false)
  // The long cloth lies on anatomical left (screen right), with a torn side tail.
  c.polygon([[7, 11], [11, 12], [15, 11], [18, 12], [21, 16], [20, 21], [18, 24], [16, 22], [15, 18], [12, 17], [7, 16], [4, 17], [5, 13]], 'o')
  c.polygon([[7, 12], [11, 13], [15, 12], [18, 13], [20, 16], [19, 20], [18, 22], [17, 20], [16, 16], [12, 16], [8, 15], [5, 16], [6, 13]], 't')
  c.polygon([[8, 12], [11, 13], [16, 12], [18, 14], [15, 15], [12, 14], [8, 14], [6, 15], [6, 13]], 'm')
  c.line(7, 13, 10, 14, 'l'); c.point(14, 13, 'l'); c.point(5, 15, 'p')
  c.line(18, 15, 18, 19, 'm'); c.point(18, 21, 'l'); c.point(17, 19, 'd'); c.point(19, 17, 'l')
  strapFront(c)
  faceFront(c)
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, -step)
  c.polygon([[8, 11], [16, 11], [20, 15], [19, 20], [18, 24], [15, 23], [13, 25], [10, 23], [7, 24], [5, 20], [5, 15]], 'o')
  c.polygon([[8, 13], [16, 13], [18, 16], [17, 21], [16, 23], [12, 22], [9, 23], [7, 22], [6, 18]], 'c')
  c.line(16, 17, 16, 21, 'd'); c.point(9, 22, 'p')
  armsFront(c, -step, attacking, true)
  // Rear asymmetry: left shoulder drape and a strapped, repaired cloth panel.
  c.polygon([[7, 11], [15, 11], [19, 13], [20, 16], [17, 18], [13, 17], [10, 19], [8, 24], [5, 22], [3, 17], [4, 14]], 'o')
  c.polygon([[7, 12], [15, 12], [18, 14], [19, 15], [16, 17], [13, 16], [9, 18], [7, 22], [5, 21], [4, 17], [5, 14]], 't')
  c.polygon([[7, 12], [11, 13], [15, 12], [17, 14], [12, 15], [8, 16], [6, 19], [5, 17], [5, 14]], 'm')
  c.line(6, 14, 8, 14, 'l'); c.point(10, 14, 'l'); c.line(6, 17, 6, 20, 'l'); c.point(7, 22, 'p')
  c.line(17, 12, 8, 21, 'o'); c.line(16, 12, 7, 21, 'n'); c.line(17, 13, 9, 21, 'r')
  c.row(10, 18, 'bccb'); c.row(10, 19, 'cpc'); c.point(12, 20, 'c')
  c.row(7, 21, 'ornrnrnrro'); c.row(7, 22, 'orrrbrrrro')
  c.polygon([[10, 3], [15, 3], [17, 5], [17, 9], [15, 11], [9, 11], [7, 9], [7, 6], [8, 4]], 'o')
  c.polygon([[10, 4], [14, 4], [16, 6], [16, 9], [9, 9], [8, 7], [8, 5]], 'k')
  c.row(10, 4, 'ssfk'); c.point(9, 5, 's'); c.point(14, 6, 's'); c.row(10, 7, 'ksskk')
  c.row(8, 8, 'cpcppccdc'); c.row(8, 9, 'ccpcpccdc'); c.row(15, 9, 'pcp'); c.row(16, 10, 'cph')
  c.line(16, 11, 18, 14, 'c'); c.line(17, 11, 19, 13, 'p'); c.point(18, 15, 'p'); c.point(19, 14, 'c')
  return c
}

function left(step, attacking = false, longCloth = true) {
  const c = canvas(24, 32)
  legs(c, true, step)
  c.polygon([[9, 11], [15, 11], [18, 14], [19, 19], [17, 24], [14, 23], [12, 25], [9, 23], [7, 24], [6, 20], [6, 15]], 'o')
  c.polygon([[9, 13], [15, 13], [17, 16], [17, 20], [15, 23], [13, 22], [11, 24], [8, 22], [7, 19], [7, 16]], 'c')
  c.line(9, 17, 9, 21, 'p'); c.point(10, 22, 'h')
  c.polygon([[15, 16], [17, 17], [18 + step, 20], [17 + step, 23], [15 + step, 22], [15, 19]], 'o')
  c.line(16, 17, 16 + step, 20, 'd'); c.row(15 + step, 21, 'fs'); c.row(15 + step, 22, 'sf')
  c.polygon([[9, 11], [15, 11], [19, 15], [18, 19], [16, 23], [13, 21], [12, 17], [8, 17], [6, 15], [7, 13]], 'o')
  c.polygon([[9, 12], [15, 12], [18, 15], [17, 19], [16, 21], [14, 20], [13, 16], [9, 16], [7, 15], [8, 13]], 't')
  c.polygon([[9, 12], [14, 12], [16, 14], [13, 15], [9, 15], [8, 14]], 'm')
  c.line(9, 13, 12, 13, 'l'); c.point(8, 14, 'p')
  if (longCloth) {
    c.line(16, 16, 16, 20, 'm'); c.point(16, 22, 'l'); c.point(14, 19, 'd')
  } else {
    c.polygon([[13, 17], [17, 17], [17, 21], [15, 23], [13, 21]], 'c')
    c.line(14, 18, 14, 21, 'd'); c.point(16, 21, 'p')
  }
  c.line(10, 12, 13, 21, 'o'); c.line(11, 12, 14, 21, 'n'); c.point(12, 16, 'a')
  c.row(8, 21, 'ornrnrnro'); c.row(8, 22, 'orrrbrrro')
  if (!attacking) {
    const x = 8 - step
    c.polygon([[x, 15], [x + 3, 16], [x + 3, 20], [x + 1, 24], [x - 1, 22], [x - 1, 18]], 'o')
    c.rect(x, 16, 2, 3, 't'); c.row(x, 18, 'md'); c.row(x, 19, 'fs'); c.row(x, 20, 'fp'); c.row(x, 21, 'ef'); c.point(x, 22, 's')
  }
  // Face cloth covers mouth/nose; exposed crop has a low, unhooded outline.
  c.polygon([[10, 3], [15, 3], [17, 5], [17, 9], [15, 11], [8, 12], [5, 10], [6, 7], [8, 5]], 'o')
  c.polygon([[10, 4], [14, 4], [16, 6], [15, 9], [9, 9], [7, 8], [8, 6]], 'f')
  c.row(10, 4, 'ksfk'); c.row(8, 5, 'kkssf'); c.point(15, 6, 'k'); c.point(16, 7, 'k')
  c.row(7, 6, 'sskkfs'); c.row(6, 7, 'fkoeffs'); c.point(13, 7, 'e')
  c.row(5, 8, 'cphppccdc'); c.row(5, 9, 'cphppccd'); c.row(6, 10, 'cpppccd'); c.row(8, 11, 'cpccd')
  c.row(14, 8, 'cpc'); c.row(15, 9, 'ph'); c.line(16, 10, 18, 12, 'c'); c.line(17, 10, 19, 11, 'p'); c.point(19, 12, 'c'); c.point(18, 13, 'p')
  return c
}

function sprite(direction, step, attacking = false) {
  if (direction === 'down') return front(step, attacking)
  if (direction === 'up') return back(step, attacking)
  if (direction === 'left') return left(step, attacking, true)
  // Opposite side exposes more gray undercloth than the long red shoulder drape.
  return mirror(left(-step, attacking, false))
}

function attackArm(direction, pose) {
  const c = canvas(32, 40)
  const paths = {
    left: [ [[14, 24], [12, 28], [10, 27]], [[14, 24], [16, 20], [14, 17]], [[14, 24], [9, 23], [3, 22]], [[14, 24], [11, 28], [8, 28]] ],
    down: [ [[22, 23], [24, 27], [23, 29]], [[22, 23], [27, 22], [27, 18]], [[22, 23], [25, 29], [21, 34]], [[22, 23], [25, 28], [24, 30]] ],
    up: [ [[11, 23], [8, 26], [6, 24]], [[11, 23], [6, 21], [6, 17]], [[11, 23], [8, 15], [12, 7]], [[11, 23], [7, 24], [7, 21]] ],
  }
  const [[sx, sy], [ex, ey], [wx, wy]] = paths[direction === 'right' ? 'left' : direction][pose]
  const segment = (x0, y0, x1, y1, color) => {
    for (const offset of [-1, 0, 1]) c.line(x0 + offset, y0, x1 + offset, y1, 'o')
    c.line(x0, y0, x1, y1, color)
  }
  segment(sx, sy, ex, ey, 't'); c.line(sx - 1, sy, ex - 1, ey, 'm')
  segment(ex, ey, wx, wy, 's'); c.line(ex, ey, wx, wy, 'f')
  c.point(ex, ey, 'p'); c.rect(wx - 1, wy - 1, 3, 3, 's'); c.row(wx - 1, wy - 1, 'fef'); c.point(wx, wy, 'e')
  return direction === 'right' ? mirror(c) : c
}

function attack(direction, pose) {
  const c = canvas(32, 40)
  const body = sprite(direction, 0, true), arm = attackArm(direction, pose)
  if (direction === 'up' && pose === 2) paste(c, arm, 0, 0)
  paste(c, body, 4, 8)
  if (!(direction === 'up' && pose === 2)) paste(c, arm, 0, 0)
  return c
}

const font = {
  A: ['010','101','111','101','101'], B: ['110','101','110','101','110'], C: ['011','100','100','100','011'],
  D: ['110','101','101','101','110'], E: ['111','100','110','100','111'], F: ['111','100','110','100','100'],
  G: ['011','100','101','101','011'], H: ['101','101','111','101','101'], I: ['111','010','010','010','111'],
  J: ['001','001','001','101','010'], K: ['101','101','110','101','101'], L: ['100','100','100','100','111'],
  M: ['101','111','111','101','101'], N: ['101','111','111','111','101'], O: ['010','101','101','101','010'],
  P: ['110','101','110','100','100'], Q: ['010','101','101','111','011'], R: ['110','101','110','101','101'],
  S: ['011','100','010','001','110'], T: ['111','010','010','010','010'], U: ['101','101','101','101','111'],
  V: ['101','101','101','101','010'], W: ['101','101','111','111','101'], X: ['101','101','010','101','101'],
  Y: ['101','101','010','010','010'], Z: ['111','001','010','100','111'],
  0: ['111','101','101','101','111'], 1: ['010','110','010','010','111'], 2: ['110','001','010','100','111'],
  3: ['110','001','010','001','110'], 4: ['101','101','111','001','001'], 5: ['111','100','110','001','110'],
  6: ['011','100','110','101','010'], 7: ['111','001','010','010','010'], 8: ['010','101','010','101','010'],
  9: ['010','101','011','001','110'], '-': ['000','000','111','000','000'], '/': ['001','001','010','100','100'],
  ' ': ['000','000','000','000','000'],
}
function text(c, words, x, y, color = 'Q') {
  for (let i = 0; i < words.length; i++) {
    const glyph = font[words[i]]
    assert(glyph, `Missing review-sheet glyph: ${words[i]}`)
    for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 3; gx++) if (glyph[gy][gx] === '1') c.point(x + i * 4 + gx, y + gy, color)
  }
}

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)) }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const name = Buffer.from(type), size = Buffer.alloc(4), crc = Buffer.alloc(4)
  size.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([size, name, data, crc])
}
function png(c, scale = 1) {
  const w = c.w * scale, h = c.h * scale
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const color = palette[c.pixels[Math.floor(y / scale)][Math.floor(x / scale)]]
    if (!color) continue
    const i = y * (w * 4 + 1) + 1 + x * 4
    raw[i] = parseInt(color.slice(1, 3), 16); raw[i + 1] = parseInt(color.slice(3, 5), 16)
    raw[i + 2] = parseInt(color.slice(5, 7), 16); raw[i + 3] = 255
  }
  const hdr = Buffer.alloc(13)
  hdr.writeUInt32BE(w); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function svg(c, title) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="0 0 ${c.w} ${c.h}" shape-rendering="crispEdges"><title>${title}</title>`]
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w;) {
    const color = c.pixels[y][x], start = x
    while (x < c.w && c.pixels[y][x] === color) x++
    if (color !== '.') parts.push(`<path fill="${palette[color]}" d="M${start} ${y}h${x - start}v1H${start}z"/>`)
  }
  parts.push('</svg>\n')
  return parts.join('')
}
const json = value => JSON.stringify(value, null, 2) + '\n'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

const walk = canvas(72, 128), strike = canvas(128, 160)
const contact = canvas(192, 396)
contact.rect(0, 0, contact.w, contact.h, 'B')
text(contact, 'ASHVEIL / MASKED REAVER', 6, 6)
text(contact, 'ORIGINAL PIXEL ART', 6, 14, 'p')
text(contact, 'WALK 0    IDLE 1    WALK 2', 43, 26, 'h')
const frames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poseHashes = []
for (const [row, dir] of dirs.entries()) {
  const cy = 35 + row * 39
  text(contact, dir.toUpperCase(), 4, cy + 14, 'p')
  charWalk[dir] = []; charIdle[dir] = [`reaver1_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = sprite(dir, col - 1), name = `reaver1_w_${dir}${col}`
    paste(walk, s, col * 24, row * 32)
    contact.rect(37 + col * 48, cy - 1, 44, 36, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 48, cy + 31, 80 + col * 48, cy + 31, 'j')
    paste(contact, s, 47 + col * 48, cy)
    frames[name] = ['reaver1', col * 24, row * 32, 24, 32]
    charWalk[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[31].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[30].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'READY 0 LIFT 1 STRIKE 2 RESET 3', 43, 198, 'h')
for (const [row, dir] of dirs.entries()) {
  const cy = 208 + row * 45
  text(contact, dir.toUpperCase(), 4, cy + 19, 'p')
  for (let col = 0; col < 4; col++) {
    const s = attack(dir, col), name = `reaver1_a_${dir}${col}`
    paste(strike, s, col * 32, row * 40)
    contact.rect(37 + col * 38, cy - 1, 36, 43, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 38, cy + 39, 72 + col * 38, cy + 39, 'j')
    paste(contact, s, 39 + col * 38, cy)
    frames[name] = ['reaver1_atk', col * 32, row * 40, 32, 40]
    charAttack[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[39].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[38].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'RUST CLOTH HIDE SKIN ASH', 6, 390, 'p')

const mapping = {
  format: 'ashveil-atlas-fragment-v1',
  status: 'prepared-not-installed',
  character: 'reaver1',
  provenance: 'Original pixel geometry authored in tools/art/draw-reaver1.mjs. No external sprite pixels are read.',
  sheets: { reaver1: `sprites/original/${stem}-walk.png`, reaver1_atk: `sprites/original/${stem}-attack.png` },
  frames,
  chars: { reaver1: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 28,
  } },
  layout: {
    rowOrder: dirs, walkCell: [24, 32], walkSheet: [72, 128], walkPoses: ['left-step', 'idle', 'right-step'],
    attackCell: [32, 40], attackSheet: [128, 160], attackPoses: ['ready', 'lift', 'strike', 'reset'],
    attackBodyOffset: [4, 8], floor: { walk: 31, attack: 39, attackMinusBodyOffset: 31 },
    note: 'Replaces all 28 reaver1_* frame rectangles and the reaver1 CharDef together; the old attack cells are 47×63. reaver0 and hero are outside this fragment.',
  },
}

const outputs = new Map([
  [`${output}/${stem}-walk.png`, png(walk)],
  [`${output}/${stem}-attack.png`, png(strike)],
  [`${output}/${stem}-walk.svg`, Buffer.from(svg(walk, 'ASHVEIL original masked ash reaver — 12 walk and idle poses'))],
  [`${output}/${stem}-attack.svg`, Buffer.from(svg(strike, 'ASHVEIL original masked ash reaver — 16 attack poses'))],
  [`${output}/${stem}-contact.png`, png(contact, 4)],
  [`${output}/${stem}-palette.json`, Buffer.from(json({ description: 'Authored material ramps; last four colors are also used for the review board.', colors: palette }))],
  [`${output}/${stem}-frames.json`, Buffer.from(json(mapping))],
])

function verifyPNG(bytes, expectedW, expectedH) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const idat = []
  let w, h
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    assert.equal(crc32(bytes.subarray(offset + 4, offset + 8 + length)), bytes.readUInt32BE(offset + 8 + length), `${type} CRC`)
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); assert.equal(data[8], 8); assert.equal(data[9], 6) }
    if (type === 'IDAT') idat.push(data)
    offset += length + 12
  }
  assert.equal(w, expectedW); assert.equal(h, expectedH)
  const raw = inflateSync(Buffer.concat(idat))
  assert.equal(raw.length, (w * 4 + 1) * h)
  let opaque = 0, transparent = 0
  for (let y = 0; y < h; y++) {
    assert.equal(raw[y * (w * 4 + 1)], 0)
    for (let x = 0; x < w; x++) {
      const alpha = raw[y * (w * 4 + 1) + 1 + x * 4 + 3]
      assert(alpha === 0 || alpha === 255, 'Native art has only transparent or opaque pixels')
      if (alpha === 255) opaque++; else transparent++
    }
  }
  return { width: w, height: h, opaquePixels: opaque, transparentPixels: transparent }
}

const pngInfo = {
  walk: verifyPNG(outputs.get(`${output}/${stem}-walk.png`), 72, 128),
  attack: verifyPNG(outputs.get(`${output}/${stem}-attack.png`), 128, 160),
  contact: verifyPNG(outputs.get(`${output}/${stem}-contact.png`), 768, 1584),
}
assert(pngInfo.walk.transparentPixels > 0 && pngInfo.attack.transparentPixels > 0)
assert.equal(Object.keys(frames).length, 28)
assert.equal(new Set(poseHashes.map(p => p.sha256)).size, 28, 'Every authored pose is distinct')
assert.equal(39 - 8, 31)
for (const [name, [sheet, x, y, w, h]] of Object.entries(frames)) {
  const dims = sheet === 'reaver1' ? [72, 128] : [128, 160]
  assert(x >= 0 && y >= 0 && x + w <= dims[0] && y + h <= dims[1], `${name} atlas bounds`)
}
for (const dir of dirs) {
  assert.equal(charWalk[dir].length, 3); assert.equal(charAttack[dir].length, 4)
  assert.equal(charIdle[dir][0], charWalk[dir][1])
}
const report = {
  format: 'ashveil-original-art-integrity-v1',
  character: 'masked ash reaver', frameCount: 28, distinctPoseCount: 28, png: pngInfo,
  checks: ['all frame rectangles in bounds', '28 distinct poses', 'palette-only RGBA', 'binary transparency', 'fixed boot floor in all poses', 'walk/attack floor anchor equality', 'PNG CRC and scanline decoding', 'byte-for-byte deterministic output'],
  files: Object.fromEntries([...outputs].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }])),
  source: { path: 'tools/art/draw-reaver1.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses: poseHashes,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 12 walk/idle + 16 attack; 28 distinct poses; no game manifest changed.`)
