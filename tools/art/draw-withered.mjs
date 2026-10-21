/**
 * ASHVEIL original living wasted patient — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-withered.mjs          write this isolated art package
 * node tools/art/draw-withered.mjs --check  compare every output without writing
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
const stem = 'ashveil-withered'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// Warm ash-brown skin, lips and fever patches remain over a living human body.
// Ragged patient cloth and thin hair are authored here, not sampled from a skeleton.
const palette = {
  o: '#242123', k: '#3a302d',
  d: '#4b4c46', c: '#74766b', p: '#a4a492', h: '#cbc8ad',
  s: '#705e53', a: '#927c68', f: '#b29b82', F: '#d0b99b', x: '#81786d', l: '#8d6557',
  b: '#35312d', r: '#594939', n: '#8d7251', g: '#b49b70',
  u: '#6b6e5f', v: '#474b43', w: '#343a35', j: '#535a53',
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
  // Wasted adult calves retain skin. Cloth hems and a single ankle wrap cover joints.
  if (!side) {
    const lx = 9 + step, rx = 14 - step
    const ly = step > 0 ? 28 : 30, ry = step < 0 ? 28 : 30
    c.polygon([[9, 23], [12, 23], [11, 27], [lx + 1, ly], [lx - 2, ly], [8, 26]], 'o')
    c.polygon([[13, 23], [16, 23], [16, 26], [rx + 2, ry], [rx - 1, ry], [13, 27]], 'o')
    c.line(10, 24, lx, ly - 2, 'v'); c.point(lx, ly - 3, 'u')
    c.line(14, 24, rx, ry - 2, 'a'); c.point(rx, ry - 3, 'x')
    c.row(lx - 1, ly - 2, 'cp'); c.row(lx - 1, ly - 1, 'pa'); c.row(lx - 2, ly, 'sffso')
    c.row(rx, ry - 1, 'as'); c.row(rx - 1, ry, 'osffso')
  } else {
    const far = -step, near = step * 2
    const fy = step < 0 ? 28 : 30, ny = step > 0 ? 28 : 30
    c.polygon([[12, 23], [15, 23], [14 + far, 27], [13 + far, fy], [10 + far, fy], [11, 26]], 'o')
    c.line(13, 24, 12 + far, fy - 2, 'v'); c.row(11 + far, fy - 1, 'as'); c.row(9 + far, fy, 'sffsoo')
    c.polygon([[9, 23], [13, 23], [13 + near, 26], [12 + near, ny], [8 + near, ny], [9, 27]], 'o')
    c.line(11, 24, 10 + near, ny - 2, 'a'); c.point(10 + near, ny - 3, 'x')
    c.row(9 + near, ny - 2, 'cp'); c.row(9 + near, ny - 1, 'pa'); c.row(7 + near, ny, 'sffpso')
  }
}

function arms(c, step, attacking, back = false) {
  if (attacking) return
  const layer = canvas(24, 32), ly = 16 + step, ry = 16 - step
  layer.polygon([[6, ly], [8, ly], [8, ly + 5], [6, ly + 10], [3, ly + 9], [4, ly + 4]], 'o')
  layer.rect(5, ly + 1, 2, 4, 'c'); layer.point(5, ly + 2, 'p'); layer.row(5, ly + 4, 'ca')
  layer.row(5, ly + 5, 'af'); layer.row(4, ly + 6, 'af'); layer.row(4, ly + 7, 'fa'); layer.row(4, ly + 8, 'fx'); layer.row(4, ly + 9, 'as')
  layer.polygon([[17, ry], [20, ry + 2], [21, ry + 6], [19, ry + 10], [17, ry + 8]], 'o')
  layer.row(18, ry + 1, 'cc'); layer.row(18, ry + 2, 'dp'); layer.row(18, ry + 3, 'aa')
  layer.row(18, ry + 4, 'fx'); layer.row(18, ry + 5, 'fa'); layer.row(18, ry + 6, 'af'); layer.row(18, ry + 7, 'as'); layer.row(18, ry + 8, 'fa'); layer.point(19, ry + 9, 's')
  paste(c, back ? mirror(layer) : layer, 0, 0)
}

function face(c, back = false) {
  // Warm ash-brown living skin covers the skull, cheeks and jaw continuously.
  c.polygon([[10, 6], [14, 6], [16, 8], [17, 11], [16, 13], [14, 15], [10, 14], [8, 12], [8, 9], [9, 7]], 'o')
  c.polygon([[10, 7], [14, 7], [15, 9], [16, 11], [14, 14], [10, 13], [9, 11], [9, 9]], 'a')
  c.row(10, 7, 'kfFa'); c.row(9, 8, 'kkfffk'); c.point(9, 9, 'k'); c.point(15, 9, 's')
  if (back) {
    c.row(9, 9, 'kasssk'); c.row(9, 10, 'xafass'); c.row(10, 11, 'afFxss'); c.row(10, 12, 'saafss')
    c.row(11, 13, 'affa'); c.point(8, 11, 's'); c.point(16, 11, 'a'); c.point(14, 9, 'k')
    return
  }
  c.row(9, 9, 'ssfFsss'); c.row(9, 10, 'fsospof'); c.row(9, 11, 'ffafFas')
  c.row(9, 12, 'sxfafxs'); c.row(10, 13, 'sllfas'); c.point(12, 11, 'F'); c.point(14, 12, 'x')
  c.point(8, 10, 'a'); c.point(16, 10, 's')
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, step)
  c.polygon([[9, 14], [15, 14], [18, 15], [20, 19], [19, 24], [17, 26], [15, 24], [13, 26], [10, 25], [7, 26], [5, 22], [5, 18]], 'o')
  c.polygon([[9, 15], [15, 15], [17, 16], [18, 20], [17, 24], [16, 25], [14, 23], [12, 25], [10, 23], [8, 25], [6, 22], [6, 19]], 'c')
  c.polygon([[13, 16], [16, 17], [17, 21], [16, 24], [13, 23]], 'd')
  c.line(8, 17, 7, 22, 'p'); c.line(10, 18, 9, 23, 'p'); c.point(7, 24, 'h')
  c.line(13, 19, 12, 24, 'p'); c.point(16, 23, 'p'); c.point(10, 24, 'd')
  arms(c, step, attacking)
  // A frayed open neckline, stains and a stitched patient hem, never exposed ribs.
  c.row(9, 14, 'acppca'); c.row(9, 15, 'cpaapc'); c.row(10, 16, 'pcac'); c.point(12, 17, 'p')
  c.row(14, 19, 'cd'); c.row(14, 20, 'dc'); c.point(15, 21, 'x'); c.point(8, 20, 'x')
  c.point(6, 23, 'd'); c.row(7, 24, 'pc'); c.point(12, 24, 'h'); c.point(16, 24, 'p')
  // A cloth wrist marker is a visual remnant, not a newly registered item.
  if (!attacking) c.point(18, 23 - step, 'p')
  face(c)
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, -step)
  c.polygon([[10, 13], [15, 14], [19, 16], [20, 21], [18, 25], [16, 24], [14, 26], [11, 24], [8, 26], [5, 23], [5, 18]], 'o')
  c.polygon([[10, 14], [15, 15], [18, 17], [18, 21], [17, 24], [15, 23], [13, 25], [10, 23], [8, 25], [6, 22], [6, 19]], 'c')
  c.polygon([[14, 16], [17, 17], [18, 21], [16, 24], [14, 23]], 'd')
  c.line(7, 18, 7, 22, 'p'); c.line(10, 18, 10, 23, 'p'); c.point(8, 24, 'h')
  arms(c, -step, attacking, true)
  // Sloping shoulders and worn folds over a living back, fully clothed.
  c.row(9, 15, 'cppcc'); c.point(11, 16, 'h'); c.line(12, 17, 13, 22, 'd')
  c.point(16, 20, 'x'); c.point(8, 21, 'x'); c.row(10, 23, 'dpc'); c.point(15, 24, 'p')
  face(c, true)
  return c
}

function left(step, attacking = false, longSleeve = true) {
  const c = canvas(24, 32)
  legs(c, true, step)
  // The neck and head lean ahead of high, rounded shoulders and a narrow torso.
  c.polygon([[9, 13], [14, 13], [18, 15], [20, 19], [20, 22], [17, 26], [14, 24], [12, 26], [9, 25], [7, 26], [5, 23], [6, 18]], 'o')
  c.polygon([[9, 14], [14, 14], [17, 16], [18, 19], [18, 22], [16, 25], [14, 23], [12, 25], [9, 23], [7, 25], [6, 22], [7, 18]], 'c')
  c.polygon([[14, 16], [17, 17], [18, 21], [16, 24], [14, 23]], 'd')
  c.line(8, 17, 7, 22, 'p'); c.point(8, 24, 'h'); c.line(12, 18, 12, 23, 'p')
  c.row(14, 20, 'xd'); c.point(15, 22, 'x'); c.point(10, 24, 'd')
  if (!attacking) {
    c.polygon([[15, 16], [18, 18], [19 + step, 23], [17 + step, 26], [15 + step, 25]], 'o')
    c.polygon([[16, 18], [17, 19], [18 + step, 23], [17 + step, 25], [16 + step, 24]], 's')
    c.line(16, 18, 17 + step, 22, 'c'); c.row(16 + step, 23, 'af'); c.row(16 + step, 24, 'fx'); c.point(16 + step, 25, 's')
    const x = 8 - step
    c.polygon([[x, 16], [x + 3, 18], [x + 3, 21], [x, 27], [x - 2, 26], [x - 1, 20]], 'o')
    c.rect(x, 17, 2, longSleeve ? 5 : 3, 'c'); c.point(x, 18, 'p')
    c.row(x - 1, 21, longSleeve ? 'ca' : 'af'); c.row(x - 1, 22, 'af'); c.row(x - 1, 23, 'fx')
    c.row(x - 1, 24, 'fa'); c.row(x - 1, 25, 'as'); c.point(x, 26, 's')
    if (!longSleeve) c.row(x - 1, 23, 'pc')
  }
  c.row(8, 14, 'apc'); c.point(9, 15, 'a')
  c.polygon([[9, 7], [13, 7], [16, 9], [16, 12], [14, 15], [10, 16], [7, 14], [5, 12], [6, 10], [7, 8]], 'o')
  c.polygon([[9, 8], [13, 8], [15, 10], [15, 12], [13, 14], [10, 15], [8, 13], [6, 12], [7, 10]], 'a')
  c.row(9, 8, 'kfFa'); c.row(7, 9, 'kkfffk'); c.row(7, 10, 'ssafs'); c.row(6, 11, 'fsoafs')
  c.row(5, 12, 'affFass'); c.row(7, 13, 'xaffxs'); c.row(8, 14, 'sllfas'); c.row(10, 15, 'affs')
  c.point(13, 11, 'a'); c.point(14, 11, 's'); c.point(13, 12, 'f'); c.point(14, 9, 'k')
  return c
}

function sprite(direction, step, attacking = false) {
  if (direction === 'down') return front(step, attacking)
  if (direction === 'up') return back(step, attacking)
  if (direction === 'left') return left(step, attacking, true)
  return mirror(left(-step, attacking, false))
}

function attackArms(direction, pose) {
  const c = canvas(32, 40)
  // Two stiff living hands approach a grasp; no fixed weapon and no skeletal claws.
  const paths = {
    left: [
      [ [[13, 25], [11, 30], [10, 31]], [[21, 25], [18, 28], [16, 29]] ],
      [ [[13, 25], [10, 27], [8, 26]], [[21, 25], [17, 27], [14, 26]] ],
      [ [[13, 25], [8, 27], [3, 27]], [[21, 25], [13, 25], [5, 24]] ],
      [ [[13, 25], [9, 29], [7, 30]], [[21, 25], [16, 28], [13, 28]] ],
    ],
    down: [
      [ [[10, 25], [8, 30], [10, 32]], [[22, 25], [24, 30], [22, 32]] ],
      [ [[10, 25], [8, 27], [10, 28]], [[22, 25], [25, 27], [22, 28]] ],
      [ [[10, 25], [8, 30], [11, 35]], [[22, 25], [25, 30], [21, 35]] ],
      [ [[10, 25], [7, 29], [10, 32]], [[22, 25], [25, 29], [22, 32]] ],
    ],
    up: [
      [ [[11, 25], [8, 29], [7, 27]], [[21, 25], [24, 29], [25, 27]] ],
      [ [[11, 25], [8, 25], [10, 23]], [[21, 25], [25, 25], [23, 23]] ],
      [ [[11, 25], [8, 22], [11, 18]], [[21, 25], [25, 22], [22, 18]] ],
      [ [[11, 25], [7, 27], [8, 25]], [[21, 25], [25, 27], [24, 25]] ],
    ],
  }
  const both = paths[direction === 'right' ? 'left' : direction][pose]
  for (const [[sx, sy], [ex, ey], [wx, wy]] of [...both].reverse()) {
    for (const shift of [-1, 0, 1]) c.line(sx + shift, sy, ex + shift, ey, 'o')
    c.line(sx, sy, ex, ey, 'c'); c.line(sx - 1, sy, ex - 1, ey, 'p')
    for (const shift of [-1, 0, 1]) c.line(ex + shift, ey, wx + shift, wy, 'o')
    c.line(ex, ey, wx, wy, 'a'); c.line(ex - 1, ey, wx - 1, wy, 'f')
    c.rect(wx - 1, wy - 1, 3, 3, 's'); c.row(wx - 1, wy - 1, 'afa'); c.point(wx, wy, 'f')
  }
  return direction === 'right' ? mirror(c) : c
}

function attack(direction, pose) {
  const c = canvas(32, 40)
  paste(c, sprite(direction, 0, true), 4, 8)
  paste(c, attackArms(direction, pose), 0, 0)
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
text(contact, 'ASHVEIL / LIVING PATIENT', 6, 6)
text(contact, 'ORIGINAL PIXEL ART', 6, 14, 'p')
text(contact, 'WALK 0    IDLE 1    WALK 2', 43, 26, 'h')
const frames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poseHashes = []
for (const [row, dir] of dirs.entries()) {
  const cy = 35 + row * 39
  text(contact, dir.toUpperCase(), 4, cy + 14, 'p')
  charWalk[dir] = []; charIdle[dir] = [`withered_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = sprite(dir, col - 1), name = `withered_w_${dir}${col}`
    paste(walk, s, col * 24, row * 32)
    contact.rect(37 + col * 48, cy - 1, 44, 36, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 48, cy + 31, 80 + col * 48, cy + 31, 'j')
    paste(contact, s, 47 + col * 48, cy)
    frames[name] = ['withered', col * 24, row * 32, 24, 32]
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
    const s = attack(dir, col), name = `withered_a_${dir}${col}`
    paste(strike, s, col * 32, row * 40)
    contact.rect(37 + col * 38, cy - 1, 36, 43, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 38, cy + 39, 72 + col * 38, cy + 39, 'j')
    paste(contact, s, 39 + col * 38, cy)
    frames[name] = ['withered_atk', col * 32, row * 40, 32, 40]
    charAttack[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[39].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[38].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'SKIN PATIENT CLOTH FEVER', 6, 390, 'p')

const mapping = {
  format: 'ashveil-atlas-fragment-v1',
  status: 'prepared-not-installed',
  character: 'withered',
  provenance: 'Original pixel geometry authored in tools/art/draw-withered.mjs. No external sprite pixels are read.',
  sheets: { withered: `sprites/original/${stem}-walk.png`, withered_atk: `sprites/original/${stem}-attack.png` },
  frames,
  chars: { withered: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 25,
  } },
  contract: {
    existingWalkFrameCount: 12, existingAttackFrameCount: 0,
    preservedWalkNames: Object.keys(frames).filter(name => name.startsWith('withered_w_')),
    newAttackNames: Object.keys(frames).filter(name => name.startsWith('withered_a_')),
    existingIdle: 'walk frame 1 in each direction',
    extension: 'Optional CharDef.attack is already supported by the current renderer; this fragment adds frames, not a Core action.',
  },
  layout: {
    rowOrder: dirs, walkCell: [24, 32], walkSheet: [72, 128], walkPoses: ['left-step', 'idle', 'right-step'],
    attackCell: [32, 40], attackSheet: [128, 160], attackPoses: ['ready', 'lift', 'strike', 'reset'],
    attackBodyOffset: [4, 8], floor: { walk: 31, attack: 39, attackMinusBodyOffset: 31 },
    note: 'Preserves existing 12 withered_w_* names and idle sequences. Adds 16 withered_a_* poses through optional CharDef.attack; existing withered had no attack frames. Uses two new sheet keys and does not replace shared mon1_withered, withered_priest, other creatures, hero or Core definitions.',
  },
}

const outputs = new Map([
  [`${output}/${stem}-walk.png`, png(walk)],
  [`${output}/${stem}-attack.png`, png(strike)],
  [`${output}/${stem}-walk.svg`, Buffer.from(svg(walk, 'ASHVEIL original living wasted patient — 12 walk and idle poses'))],
  [`${output}/${stem}-attack.svg`, Buffer.from(svg(strike, 'ASHVEIL original living wasted patient — 16 attack poses'))],
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
  const dims = sheet === 'withered' ? [72, 128] : [128, 160]
  assert(x >= 0 && y >= 0 && x + w <= dims[0] && y + h <= dims[1], `${name} atlas bounds`)
}
for (const dir of dirs) {
  assert.equal(charWalk[dir].length, 3); assert.equal(charAttack[dir].length, 4)
  assert.equal(charIdle[dir][0], charWalk[dir][1])
}
const report = {
  format: 'ashveil-original-art-integrity-v1',
  character: 'living wasted patient', frameCount: 28, distinctPoseCount: 28, png: pngInfo,
  checks: ['all frame rectangles in bounds', '28 distinct poses', 'palette-only RGBA', 'binary transparency', 'fixed boot floor in all poses', 'walk/attack floor anchor equality', 'PNG CRC and scanline decoding', 'byte-for-byte deterministic output'],
  files: Object.fromEntries([...outputs].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }])),
  source: { path: 'tools/art/draw-withered.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses: poseHashes,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 12 walk/idle + 16 attack; 28 distinct poses; no game manifest changed.`)
