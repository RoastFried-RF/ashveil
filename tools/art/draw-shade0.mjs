/**
 * ASHVEIL original small human shade-folk — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-shade0.mjs          write this isolated art package
 * node tools/art/draw-shade0.mjs --check  compare every output without writing
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
const stem = 'ashveil-shade0'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// Authored pale human skin, soot-gray sackcloth, old seams and muted ring metal.
// Skin is pale, pupils are dark, ears are round: no fantasy-goblin features.
const palette = {
  o: '#1d2225', k: '#2c2c2c',
  d: '#3c4645', c: '#626d65', p: '#959f8c', h: '#c2c5aa',
  b: '#342f2c', r: '#5d4c3b', n: '#8c7652', g: '#b9aa79',
  s: '#80847a', a: '#a6aaa0', f: '#c8cbbb', F: '#e0dfca',
  v: '#4a5550', w: '#35403d', u: '#7d8977', j: '#52625e',
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
  // Small adult proportions: bent knees and bare human toes, floor edge y=31.
  if (!side) {
    const lx = 8 + (step === 1 ? 1 : step === -1 ? -1 : 0)
    const rx = 14 - (step === -1 ? 1 : step === 1 ? -1 : 0)
    const ly = step === 1 ? 28 : 30, ry = step === -1 ? 28 : 30
    c.polygon([[8, 23], [12, 23], [11, 26], [lx + 2, ly - 1], [lx - 1, ly - 1], [7, 26]], 'o')
    c.polygon([[13, 23], [16, 23], [17, 26], [rx + 2, ry - 1], [rx - 1, ry - 1], [13, 26]], 'o')
    c.line(9, 24, lx, ly - 2, 'v'); c.point(9, 25, 'u'); c.point(lx, ly - 2, 'c')
    c.line(14, 24, rx, ry - 2, 'w'); c.point(15, 25, 'c')
    c.row(lx - 1, ly - 1, 'as'); c.row(lx - 2, ly, 'sfpso')
    c.row(rx, ry - 1, 'sa'); c.row(rx - 1, ry, 'osfps')
  } else {
    const far = step === -1 ? 2 : step === 1 ? -2 : 0, near = -far
    const farY = step === -1 ? 28 : 30, nearY = step === 1 ? 28 : 30
    c.polygon([[11, 23], [15, 23], [14 + far, 26], [13 + far, farY - 1], [10 + far, farY - 1], [11, 26]], 'o')
    c.line(13, 24, 12 + far, farY - 2, 'w'); c.point(13 + far, farY - 2, 'c')
    c.row(10 + far, farY - 1, 'as'); c.row(8 + far, farY, 'sfpsoo')
    c.polygon([[10, 23], [14, 23], [13 + near, 26], [12 + near, nearY - 1], [8 + near, nearY - 1], [9, 26]], 'o')
    c.line(11, 24, 10 + near, nearY - 2, 'v'); c.point(11, 25, 'u')
    c.row(9 + near, nearY - 1, 'af'); c.row(7 + near, nearY, 'sfpfso')
  }
}

function armsFront(c, step, attacking, behind) {
  const layer = canvas(24, 32)
  // The moving right arm is omitted when an attack arm replaces it.
  if (!attacking) {
    const y = 18 + step
    layer.polygon([[6, y], [8, y], [8, y + 4], [6, y + 7], [3, y + 6], [4, y + 2]], 'o')
    layer.rect(5, y + 1, 2, 3, 'c'); layer.point(5, y + 1, 'p')
    layer.row(5, y + 3, 'as'); layer.row(4, y + 4, 'af'); layer.row(4, y + 5, 'fF'); layer.row(4, y + 6, 'fs')
  }
  const y = 18 - step
  layer.polygon([[17, y], [20, y + 2], [20, y + 6], [17, y + 7], [16, y + 5]], 'o')
  layer.row(17, y + 1, 'cc'); layer.row(17, y + 2, 'cp'); layer.row(17, y + 3, 'sa')
  layer.row(17, y + 4, 'fa'); layer.row(18, y + 5, 'Ff'); layer.row(18, y + 6, 'sf')
  paste(c, behind ? mirror(layer) : layer, 0, 0)
}

function waist(c, reverse = false) {
  c.row(7, 23, 'orrrcrrrro'); c.point(reverse ? 15 : 8, 23, 'n')
  // A small dull ring fragment, not a light source or a new equipped item.
  const x = reverse ? 8 : 15
  c.row(x, 24, 'ng'); c.row(x, 25, 'ro'); c.point(x, 26, 'n')
}

function faceFront(c) {
  // Human adult face: rounded ears, angular cheeks, ordinary nose, wide pupils.
  c.polygon([[10, 9], [15, 9], [17, 11], [17, 15], [15, 17], [10, 17], [8, 15], [8, 11]], 'o')
  c.polygon([[10, 10], [14, 10], [16, 12], [16, 15], [14, 16], [10, 16], [9, 14], [9, 12]], 'a')
  c.row(10, 10, 'kksak'); c.row(9, 11, 'ksfffs'); c.point(15, 11, 's')
  c.row(8, 12, 'asfffssa'); c.row(9, 12, 'sooaoos'); c.row(9, 13, 'ffpffsa')
  c.row(9, 14, 'fFpffsa'); c.row(10, 15, 'sfrass'); c.row(11, 16, 'safs')
  c.point(12, 13, 'p'); c.point(12, 14, 'F'); c.point(14, 14, 's')
  c.point(8, 13, 'f'); c.point(16, 13, 's')
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, step)
  // Repaired sackcloth shirt, thin adult neck, shoulders set low below the head.
  c.polygon([[9, 16], [15, 16], [19, 18], [19, 22], [18, 25], [15, 24], [13, 26], [11, 24], [7, 25], [5, 22], [5, 19]], 'o')
  c.polygon([[9, 17], [15, 17], [18, 19], [17, 23], [16, 24], [13, 23], [11, 25], [8, 23], [6, 22], [6, 20]], 'c')
  c.polygon([[14, 18], [17, 19], [17, 23], [15, 24], [13, 22]], 'd')
  c.line(8, 19, 8, 22, 'p'); c.point(7, 22, 'h'); c.point(10, 24, 'p')
  c.line(12, 19, 11, 23, 'p'); c.point(12, 20, 'h'); c.point(15, 22, 'c')
  armsFront(c, step, attacking, false)
  // A stitched gray patch is on the anatomical left chest (screen right).
  c.row(14, 19, 'rrr'); c.row(14, 20, 'rpr'); c.row(14, 21, 'rcr'); c.point(15, 19, 'n')
  c.row(9, 17, 'dphppd'); c.row(10, 18, 'pcpd'); c.point(12, 19, 'c')
  waist(c)
  faceFront(c)
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, -step)
  c.polygon([[9, 16], [15, 16], [19, 18], [19, 22], [18, 25], [15, 24], [13, 26], [11, 24], [7, 25], [5, 22], [5, 19]], 'o')
  c.polygon([[9, 17], [15, 17], [18, 19], [17, 23], [16, 24], [13, 23], [11, 25], [8, 23], [6, 22], [6, 20]], 'c')
  c.polygon([[14, 18], [17, 19], [17, 23], [15, 24], [13, 22]], 'd')
  c.line(7, 20, 7, 22, 'p'); c.point(10, 24, 'p'); c.line(12, 19, 12, 22, 'd')
  armsFront(c, -step, attacking, true)
  c.row(8, 18, 'pccpppc'); c.point(9, 19, 'h')
  // Repaired seam and an old hem, no fantasy armor or long cape.
  c.line(10, 20, 13, 22, 'r'); c.point(11, 20, 'n'); c.point(12, 22, 'n')
  waist(c, true)
  c.polygon([[10, 9], [15, 9], [17, 11], [17, 15], [15, 17], [10, 17], [8, 15], [8, 11]], 'o')
  c.polygon([[10, 10], [14, 10], [16, 12], [16, 15], [14, 16], [10, 16], [9, 14], [9, 12]], 's')
  c.row(10, 10, 'kksak'); c.row(9, 11, 'kkassk'); c.row(9, 12, 'kasassk')
  c.row(9, 13, 'assfss'); c.row(9, 14, 'sfafass'); c.row(10, 15, 'affass'); c.row(11, 16, 'sfss')
  c.point(8, 13, 'f'); c.point(16, 13, 'a'); c.point(11, 11, 'a')
  return c
}

function left(step, attacking = false, chestPatch = true) {
  const c = canvas(24, 32)
  legs(c, true, step)
  // Head is slightly forward of a rounded back, a cautious human crouch.
  c.polygon([[10, 16], [15, 16], [18, 18], [20, 22], [17, 25], [14, 24], [12, 26], [9, 24], [7, 25], [6, 21], [7, 18]], 'o')
  c.polygon([[10, 17], [14, 17], [17, 19], [18, 22], [16, 24], [13, 23], [11, 25], [8, 23], [7, 20], [8, 18]], 'c')
  c.polygon([[14, 18], [17, 19], [18, 22], [16, 24], [14, 22]], 'd')
  c.line(9, 19, 8, 22, 'p'); c.point(9, 23, 'h'); c.point(15, 22, 'p')
  c.polygon([[15, 18], [18, 19], [19 + step, 22], [17 + step, 25], [15 + step, 24]], 'o')
  c.line(16, 19, 17 + step, 22, 'd'); c.row(16 + step, 23, 'sa'); c.row(16 + step, 24, 'af')
  if (chestPatch) { c.row(11, 19, 'rrr'); c.row(11, 20, 'rpr'); c.row(11, 21, 'rcr') }
  else { c.line(14, 20, 16, 22, 'r'); c.point(15, 20, 'n') }
  c.row(8, 23, 'orrrcrrro'); c.point(14, 24, 'g')
  if (!attacking) {
    const x = 8 - step
    c.polygon([[x, 18], [x + 3, 19], [x + 3, 22], [x + 1, 26], [x - 2, 25], [x - 1, 21]], 'o')
    c.rect(x, 19, 2, 3, 'c'); c.point(x, 19, 'p'); c.row(x, 21, 'pa')
    c.row(x - 1, 22, 'af'); c.row(x - 1, 23, 'fF'); c.row(x - 1, 24, 'fa'); c.point(x, 25, 's')
  }
  c.row(8, 17, 'pcpc'); c.point(9, 18, 'h')
  // Rounded human ear, modest nose and cheek; no points, fangs or glowing eyes.
  c.polygon([[9, 9], [14, 9], [16, 11], [16, 15], [14, 17], [9, 17], [6, 15], [6, 14], [6, 12], [7, 10]], 'o')
  c.polygon([[9, 10], [13, 10], [15, 12], [15, 15], [13, 16], [9, 16], [7, 14], [7, 12]], 'a')
  c.row(9, 10, 'kksak'); c.row(7, 11, 'ksfss'); c.row(6, 12, 'ssoos'); c.row(6, 13, 'ffpass')
  c.row(6, 14, 'fFpasa'); c.row(7, 15, 'sfrass'); c.row(8, 16, 'ssafs')
  c.point(12, 13, 'f'); c.point(13, 13, 's'); c.point(14, 14, 'a'); c.point(12, 14, 'F')
  return c
}

function sprite(direction, step, attacking = false) {
  if (direction === 'down') return front(step, attacking)
  if (direction === 'up') return back(step, attacking)
  if (direction === 'left') return left(step, attacking, true)
  return mirror(left(-step, attacking, false))
}

function attackArm(direction, pose) {
  const c = canvas(32, 40)
  const paths = {
    left: [ [[13, 28], [11, 30], [9, 29]], [[13, 28], [15, 24], [12, 22]], [[13, 28], [9, 27], [3, 28]], [[13, 28], [10, 31], [8, 30]] ],
    down: [ [[10, 27], [8, 30], [10, 32]], [[10, 27], [6, 25], [7, 21]], [[10, 27], [8, 32], [12, 35]], [[10, 27], [7, 31], [9, 33]] ],
    up: [ [[21, 27], [23, 30], [25, 28]], [[21, 27], [25, 25], [25, 21]], [[21, 27], [23, 21], [20, 14]], [[21, 27], [24, 28], [24, 24]] ],
  }
  const [[sx, sy], [ex, ey], [wx, wy]] = paths[direction === 'right' ? 'left' : direction][pose]
  const segment = (x0, y0, x1, y1, color) => {
    for (const offset of [-1, 0, 1]) c.line(x0 + offset, y0, x1 + offset, y1, 'o')
    c.line(x0, y0, x1, y1, color)
  }
  segment(sx, sy, ex, ey, 'c'); c.line(sx - 1, sy, ex - 1, ey, 'p')
  segment(ex, ey, wx, wy, 'a'); c.line(ex, ey, wx, wy, 'f')
  c.rect(wx - 1, wy - 1, 3, 3, 's'); c.row(wx - 1, wy - 1, 'fFf'); c.point(wx, wy, 'p')
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
text(contact, 'ASHVEIL / SHADE FOLK', 6, 6)
text(contact, 'ORIGINAL PIXEL ART', 6, 14, 'p')
text(contact, 'WALK 0    IDLE 1    WALK 2', 43, 26, 'h')
const frames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poseHashes = []
for (const [row, dir] of dirs.entries()) {
  const cy = 35 + row * 39
  text(contact, dir.toUpperCase(), 4, cy + 14, 'p')
  charWalk[dir] = []; charIdle[dir] = [`shade0_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = sprite(dir, col - 1), name = `shade0_w_${dir}${col}`
    paste(walk, s, col * 24, row * 32)
    contact.rect(37 + col * 48, cy - 1, 44, 36, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 48, cy + 31, 80 + col * 48, cy + 31, 'j')
    paste(contact, s, 47 + col * 48, cy)
    frames[name] = ['shade0', col * 24, row * 32, 24, 32]
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
    const s = attack(dir, col), name = `shade0_a_${dir}${col}`
    paste(strike, s, col * 32, row * 40)
    contact.rect(37 + col * 38, cy - 1, 36, 43, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 38, cy + 39, 72 + col * 38, cy + 39, 'j')
    paste(contact, s, 39 + col * 38, cy)
    frames[name] = ['shade0_atk', col * 32, row * 40, 32, 40]
    charAttack[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[39].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[38].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'PALE SKIN CLOTH SEAMS RING', 6, 390, 'p')

const mapping = {
  format: 'ashveil-atlas-fragment-v1',
  status: 'prepared-not-installed',
  character: 'shade0',
  provenance: 'Original pixel geometry authored in tools/art/draw-shade0.mjs. No external sprite pixels are read.',
  sheets: { shade0: `sprites/original/${stem}-walk.png`, shade0_atk: `sprites/original/${stem}-attack.png` },
  frames,
  chars: { shade0: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 22,
  } },
  contract: {
    existingWalkFrameCount: 12, existingAttackFrameCount: 0,
    preservedWalkNames: Object.keys(frames).filter(name => name.startsWith('shade0_w_')),
    newAttackNames: Object.keys(frames).filter(name => name.startsWith('shade0_a_')),
    existingIdle: 'walk frame 1 in each direction',
    extension: 'Optional CharDef.attack is already supported by the current renderer; this fragment adds frames, not a Core action.',
  },
  layout: {
    rowOrder: dirs, walkCell: [24, 32], walkSheet: [72, 128], walkPoses: ['left-step', 'idle', 'right-step'],
    attackCell: [32, 40], attackSheet: [128, 160], attackPoses: ['ready', 'lift', 'strike', 'reset'],
    attackBodyOffset: [4, 8], floor: { walk: 31, attack: 39, attackMinusBodyOffset: 31 },
    note: 'Preserves existing 12 shade0_w_* names and idle sequences. Adds 16 shade0_a_* poses through optional CharDef.attack; existing shade0 had no attack frames. Uses two new sheet keys and does not replace shared mon1, other shades, reavers, hero or Core definitions.',
  },
}

const outputs = new Map([
  [`${output}/${stem}-walk.png`, png(walk)],
  [`${output}/${stem}-attack.png`, png(strike)],
  [`${output}/${stem}-walk.svg`, Buffer.from(svg(walk, 'ASHVEIL original small human shade-folk — 12 walk and idle poses'))],
  [`${output}/${stem}-attack.svg`, Buffer.from(svg(strike, 'ASHVEIL original small human shade-folk — 16 attack poses'))],
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
  const dims = sheet === 'shade0' ? [72, 128] : [128, 160]
  assert(x >= 0 && y >= 0 && x + w <= dims[0] && y + h <= dims[1], `${name} atlas bounds`)
}
for (const dir of dirs) {
  assert.equal(charWalk[dir].length, 3); assert.equal(charAttack[dir].length, 4)
  assert.equal(charIdle[dir][0], charWalk[dir][1])
}
const report = {
  format: 'ashveil-original-art-integrity-v1',
  character: 'small human shade-folk', frameCount: 28, distinctPoseCount: 28, png: pngInfo,
  checks: ['all frame rectangles in bounds', '28 distinct poses', 'palette-only RGBA', 'binary transparency', 'fixed boot floor in all poses', 'walk/attack floor anchor equality', 'PNG CRC and scanline decoding', 'byte-for-byte deterministic output'],
  files: Object.fromEntries([...outputs].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }])),
  source: { path: 'tools/art/draw-shade0.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses: poseHashes,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 12 walk/idle + 16 attack; 28 distinct poses; no game manifest changed.`)
