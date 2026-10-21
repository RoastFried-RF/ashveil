/**
 * ASHVEIL original living fused patients — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-amalgam.mjs          write this isolated art package
 * node tools/art/draw-amalgam.mjs --check  compare every output without writing
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
const stem = 'ashveil-amalgam'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// Original fused patients: warm covered skin, gray fever patches, joined cloth.
// No third-party image is sampled; folds and hands are authored below.
const palette = {
  o: '#292426', k: '#3a302d',
  d: '#4b4c46', c: '#74766b', p: '#a4a492', h: '#cbc8ad',
  s: '#705e53', a: '#927c68', f: '#b29b82', F: '#d0b99b', x: '#81786d', l: '#8d6557',
  b: '#35312d', r: '#594939', n: '#67594f', u: '#a28d79', m: '#8d9283', j: '#535a53',
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

const WALK = [80, 64], ATTACK = [96, 80], OFFSET = [8, 16]
const HEADS = {
  down: [[40, 17, 'front', 0], [24, 26, 'left', 1], [56, 24, 'right', 2]],
  left: [[30, 20, 'left', 0], [47, 18, 'front', 1], [56, 30, 'right', 2]],
  right: [[50, 20, 'right', 0], [33, 18, 'front', 1], [24, 30, 'left', 2]],
  up: [[40, 17, 'back', 0], [24, 25, 'left', 1], [56, 26, 'right', 2]],
}
const ARMS = {
  down: [ [[27, 32], [14, 36], [8, 46]], [[53, 32], [66, 36], [72, 46]], [[28, 43], [20, 48], [12, 57]], [[52, 43], [60, 48], [68, 57]] ],
  left: [ [[28, 31], [15, 34], [8, 43]], [[54, 31], [66, 35], [72, 44]], [[29, 43], [20, 49], [11, 57]], [[53, 43], [62, 49], [69, 57]] ],
  right: [ [[26, 31], [14, 35], [8, 44]], [[52, 31], [65, 34], [72, 43]], [[27, 43], [18, 49], [11, 57]], [[51, 43], [60, 49], [69, 57]] ],
  up: [ [[27, 31], [14, 36], [8, 44]], [[53, 31], [66, 36], [72, 44]], [[28, 42], [20, 49], [12, 57]], [[52, 42], [60, 49], [68, 57]] ],
}

function ellipse(c, cx, cy, rx, ry, color) {
  assert(Number.isInteger(cx) && Number.isInteger(cy))
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    if ((x - cx) * (x - cx) * ry * ry + (y - cy) * (y - cy) * rx * rx <= rx * rx * ry * ry) c.point(x, y, color)
  }
}

function brush(c, points, radius, color) {
  for (let p = 1; p < points.length; p++) {
    let [x0, y0] = points[p - 1]
    const [x1, y1] = points[p]
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1
    const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1
    let error = dx + dy
    for (;;) {
      ellipse(c, x0, y0, radius, radius, color)
      if (x0 === x1 && y0 === y1) break
      const twice = 2 * error
      if (twice >= dy) { error += dy; x0 += sx }
      if (twice <= dx) { error += dx; y0 += sy }
    }
  }
}

function head(c, cx, cy, look, person) {
  // Three recognizably human adult faces: skin, eyelids, lips and ordinary ears.
  ellipse(c, cx, cy, 5, 6, 'o')
  ellipse(c, cx, cy, 4, 5, 'a')
  ellipse(c, cx - 1, cy, 3, 4, 'f')
  c.row(cx - 2, cy - 5, person === 1 ? 'kkka' : person === 0 ? 'kfxa' : 'fFfa')
  if (look === 'back') {
    c.row(cx - 3, cy - 3, 'kkxakk'); c.row(cx - 3, cy - 2, 'kxaskk'); c.row(cx - 2, cy + 1, 'afxss')
    c.row(cx - 2, cy + 3, 'safas'); c.point(cx, cy - 1, 'x')
  } else if (look === 'front') {
    c.row(cx - 3, cy - 2, 'ssafss'); c.row(cx - 3, cy - 1, 'fsospof')
    c.row(cx - 3, cy, 'ffafFas'); c.point(cx, cy + 1, 'F'); c.point(cx + 2, cy + 1, 'x')
    c.row(cx - 2, cy + 2, 'sffas'); c.row(cx - 1, cy + 3, person === 0 ? 'llfa' : 'lsaa')
  } else {
    const dx = look === 'left' ? -1 : 1
    c.point(cx - dx * 4, cy - 2, 'k'); c.point(cx + dx, cy - 1, 'o')
    c.point(cx + dx * 2, cy - 1, 's'); c.point(cx + dx * 4, cy, 'f'); c.point(cx + dx * 5, cy + 1, 'a')
    c.point(cx + dx * 3, cy + 1, 'F'); c.point(cx + dx * 2, cy + 2, 'x')
    c.point(cx + dx * 2, cy + 3, 'l'); c.point(cx + dx, cy + 3, 's'); c.point(cx - dx * 3, cy, 'a')
    c.point(cx - dx * 3, cy + 1, 's')
  }
  c.point(cx - 5, cy, 'a'); c.point(cx + 5, cy, 's')
  // Remnants of patient collars meet skin at the base of each neck.
  c.row(cx - 3, cy + 5, person === 2 ? 'dcpcdd' : 'cpcpdc')
}

function arm(c, path, index, phase = 0) {
  const shifted = path.map(([x, y], i) => [x + (i === 2 ? (index % 2 ? phase : -phase) : 0), y])
  brush(c, shifted, 4, 'o'); brush(c, shifted, 3, index < 2 ? 's' : 'a')
  brush(c, shifted.map(([x, y]) => [x - 1, y - 1]), 1, 'f')
  const [wx, wy] = shifted[2]
  ellipse(c, wx, wy, 4, 3, 's'); ellipse(c, wx - 1, wy - 1, 3, 2, 'a')
  c.row(wx - 2, wy - 2, 'ffaf'); c.point(wx + 2, wy, 'f'); c.point(wx - 2, wy + 1, 'f'); c.point(wx + 4, wy - 1, 'a')
  // Short digits stay soft, without talons or exposed finger bones.
  c.point(wx - 3, wy + 3, 'a'); c.point(wx - 1, wy + 3, 'f'); c.point(wx + 1, wy + 3, 'a'); c.point(wx + 3, wy + 2, 'f')
  c.row(wx - 2, wy - 4, index % 2 ? 'cpcpc' : 'pcpcp')
  const [ex, ey] = shifted[1]
  c.point(ex + 1, ey, 'x'); c.point(ex, ey + 1, 'u')
}

function mass(c, dir, phase, pulse = 0) {
  // No legs: a broad continuous skin base drags over the fixed ground edge.
  ellipse(c, 40, 49, 27, 13, 'o')
  ellipse(c, 40, 48, 25, 13, 's')
  ellipse(c, 37 + phase, 46, 23, 14, 'a')
  ellipse(c, 29, 36 + pulse, 13, 13, 's')
  ellipse(c, 49, 36 - pulse, 13, 13, 's')
  ellipse(c, 40, 36, 14, 19, 'a')
  ellipse(c, 34, 37 + pulse, 12, 16, 'f')
  ellipse(c, 51, 40 - pulse, 11, 13, 'a')
  // Folded skin and gray fever patches, without open organs or bloody cavities.
  c.polygon([[25, 33], [30, 29], [33, 35], [31, 44], [28, 47], [25, 43]], 's')
  c.polygon([[43, 29], [49, 28], [54, 33], [53, 41], [49, 45], [46, 39]], 's')
  c.line(34, 30, 37, 37, 'F'); c.line(37, 38, 36, 45, 'u')
  c.line(41, 40, 44, 47, 's'); c.line(44, 48, 47, 50, 'u'); c.point(39, 47, 'x')
  c.row(27, 47, 'suax'); c.row(50, 47, 'xsua'); c.point(31, 37, 'x'); c.point(49, 34, 'x')
  c.row(44, 31, 'xux'); c.row(45, 32, 'xx'); c.row(29, 41, 'ux'); c.point(30, 42, 'x')
  // Joined hospital garments give scale and human origin to the central body.
  if (dir === 'down' || dir === 'right') {
    c.polygon([[25, 33], [31, 35], [34, 45], [43, 49], [41, 55], [30, 51], [25, 45], [21, 40]], 'd')
    c.polygon([[25, 34], [29, 36], [31, 44], [36, 48], [40, 50], [39, 53], [31, 49], [27, 44], [23, 40]], 'c')
    c.line(26, 36, 28, 42, 'p'); c.line(29, 44, 33, 48, 'p'); c.point(36, 50, 'h')
    c.line(29, 36, 31, 40, 'm'); c.point(31, 41, 'p')
  } else {
    c.polygon([[48, 29], [57, 32], [58, 40], [54, 46], [45, 49], [42, 44], [48, 39]], 'd')
    c.polygon([[49, 31], [55, 33], [55, 40], [52, 44], [46, 47], [45, 44], [50, 39]], 'c')
    c.line(51, 33, 53, 37, 'p'); c.line(52, 40, 48, 44, 'p'); c.point(47, 45, 'h')
    c.line(48, 33, 50, 38, 'm')
  }
  // Blunt crawling lobes support weight, not feet or a field of spare legs.
  c.polygon([[19, 52], [30, 52], [34, 57], [45, 55], [56, 53], [64, 56], [65, 60], [61, 63], [52, 63], [46, 61], [37, 63], [27, 62], [20, 63], [15, 59]], 'o')
  c.polygon([[20, 53], [29, 54], [33, 58], [44, 57], [55, 54], [62, 57], [63, 60], [59, 62], [53, 61], [46, 60], [37, 62], [27, 61], [20, 62], [17, 59]], 's')
  c.polygon([[22, 54], [29, 55], [31, 58], [26, 59], [20, 60], [18, 58]], 'a')
  c.line(20, 58, 26, 57, 'f'); c.line(33 + phase, 60, 40 + phase, 59, 'a')
  c.line(49, 58, 56, 57, 'f'); c.row(52, 59, 'suax'); c.point(60, 59, 'x')
  // Always at least two broad support pixels at the same y=62 floor contact.
  c.row(22 + phase, 62, 'ss'); c.row(54 - phase, 62, 'ss')
}

function creature(dir, step = 0, pulse = 0, attackPose = -1) {
  const c = canvas(...WALK)
  assert.equal(HEADS[dir].length, 3); assert.equal(ARMS[dir].length, 4)
  for (let i = 0; i < 2; i++) arm(c, ARMS[dir][i], i, step)
  mass(c, dir, step, pulse)
  // Four human-derived arms remain distinguishable around the legless base.
  if (attackPose < 0) for (let i = 2; i < 4; i++) arm(c, ARMS[dir][i], i, step)
  for (const [x, y, look, person] of HEADS[dir]) head(c, x, y + (person === 2 ? pulse : 0), look, person)
  return c
}

function attack(dir, pose) {
  const c = canvas(...ATTACK), base = creature(dir, 0, 0, pose)
  paste(c, base, ...OFFSET)
  const strength = [0, -5, 14, -3][pose]
  for (let i = 2; i < 4; i++) {
    const path = ARMS[dir][i].map(([x, y]) => [x + OFFSET[0], y + OFFSET[1]])
    const [wx, wy] = path[2]
    if (dir === 'left') path[2] = [Math.max(4, wx - strength), wy - (pose === 1 ? 8 : 3)]
    else if (dir === 'right') path[2] = [Math.min(91, wx + strength), wy - (pose === 1 ? 8 : 3)]
    else if (dir === 'up') path[2] = [wx + (i === 2 ? -3 : 3), Math.max(25, wy - strength - 17)]
    else path[2] = [wx + (i === 2 ? -3 : 3), Math.min(74, wy + strength - 3)]
    if (pose === 1) path[1][1] -= 5
    arm(c, path, i, 0)
  }
  return c
}

function legacy(pose) {
  const c = canvas(96, 64)
  const step = [-1, 0, 1, 1, 0, -1][pose], pulse = [0, 1, 1, 0, -1, -1][pose]
  // Ground y=63 becomes y=59, matching the legacy 64×.92=58.88 anchor.
  paste(c, creature('down', step, pulse), 8, -4)
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

const walk = canvas(240, 256), strike = canvas(384, 320), oldLoop = canvas(576, 64)
const contact = canvas(432, 900)
contact.rect(0, 0, 432, 900, 'B')
text(contact, 'ASHVEIL / AMALGAM / ORIGINAL', 8, 6)
text(contact, 'THREE HUMAN HEADS / FOUR ARMS / NO LEGS', 8, 15, 'p')
text(contact, 'DIRECTIONAL WALK 0       IDLE 1       WALK 2', 52, 30, 'h')
const frames = {}, legacyFrames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poses = [], legacyPoses = [], bounds = []
function occupied(c) {
  let minX = c.w, minY = c.h, maxX = -1, maxY = -1
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (c.pixels[y][x] !== '.') {
    minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
  }
  return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
for (const [row, dir] of dirs.entries()) {
  const cy = 42 + row * 76
  text(contact, dir.toUpperCase(), 5, cy + 30, 'p')
  charWalk[dir] = []; charIdle[dir] = [`amalgam_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = creature(dir, col - 1), name = `amalgam_w_${dir}${col}`
    paste(walk, s, col * 80, row * 64)
    contact.rect(48 + col * 120, cy - 1, 108, 69, row % 2 ? 'D' : 'o')
    contact.line(48 + col * 120, cy + 63, 155 + col * 120, cy + 63, 'j')
    paste(contact, s, 62 + col * 120, cy)
    frames[name] = ['amalgam_walk', col * 80, row * 64, 80, 64]
    charWalk[dir].push(name)
    poses.push({ name, sha256: hash(png(s)) })
    bounds.push({ name, ...occupied(s) })
    assert(s.pixels[62].some(p => p !== '.'), `${name} ground contact`)
    assert(s.pixels[63].every(p => p === '.'), `${name} floor margin`)
  }
}
text(contact, 'ATTACK 0 READY     1 DRAW     2 SWEEP     3 RESET', 48, 346, 'h')
for (const [row, dir] of dirs.entries()) {
  const cy = 360 + row * 84
  text(contact, dir.toUpperCase(), 5, cy + 34, 'p')
  for (let col = 0; col < 4; col++) {
    const s = attack(dir, col), name = `amalgam_a_${dir}${col}`
    paste(strike, s, col * 96, row * 80)
    contact.rect(42 + col * 96, cy - 1, 96, 83, row % 2 ? 'D' : 'o')
    contact.line(42 + col * 96, cy + 79, 137 + col * 96, cy + 79, 'j')
    paste(contact, s, 42 + col * 96, cy)
    frames[name] = ['amalgam_atk', col * 96, row * 80, 96, 80]
    charAttack[dir].push(name)
    poses.push({ name, sha256: hash(png(s)) })
    bounds.push({ name, ...occupied(s) })
    assert(s.pixels[78].some(p => p !== '.'), `${name} ground contact`)
    assert(s.pixels[79].every(p => p === '.'), `${name} floor margin`)
  }
}
text(contact, 'EXISTING SIX NAMES / COMPATIBLE LOOP', 48, 714, 'h')
for (let col = 0; col < 6; col++) {
  const s = legacy(col), name = `amalgam${col}`
  paste(oldLoop, s, col * 96, 0)
  legacyFrames[name] = ['amalgam', col * 96, 0, 96, 64]
  const x = 50 + col % 3 * 120, y = 727 + Math.floor(col / 3) * 76
  contact.rect(x - 4, y - 1, 108, 71, col < 3 ? 'o' : 'D')
  contact.line(x - 4, y + 59, x + 103, y + 59, 'j')
  paste(contact, s, x, y)
  text(contact, String(col), x + 2, y + 64, 'p')
  legacyPoses.push({ name, sha256: hash(png(s)) })
  assert(s.pixels[58].some(p => p !== '.'), `${name} legacy ground`)
  assert(s.pixels[59].every(p => p === '.'), `${name} legacy floor margin`)
}
text(contact, 'AUTHORED PIXEL GEOMETRY / LIVING FAILED PATIENTS', 8, 889, 'p')

const loop = { frames: Array.from({ length: 6 }, (_, i) => `amalgam${i}`), fps: 6 }
const compatibility = {
  format: 'ashveil-atlas-fragment-v1', status: 'prepared-not-installed', mode: 'existing-animated-sprite',
  character: 'amalgam',
  sheets: { amalgam: `sprites/original/${stem}-legacy.png` }, frames: legacyFrames, anims: { amalgam: loop },
  contract: {
    preservedExistingNames: loop.frames, preservedCell: [96, 64], preservedAnimationMetadata: loop,
    noCharsEntry: true, rendererScale: .75, rendererAnchor: [.5, .92], nativeGround: 59,
    anchorPixelY: 58.88, groundMinusAnchorNative: .12, groundMinusAnchorWorld: .09,
    rendererHeadOffset: 44, rendererShadowRadii: [18, 4], rendererHealthBarWidth: 24,
    note: 'Preserves the current six-frame AnimatedSprite renderer branch. No direction or dedicated attack frames exist in this mode. Do not add chars.amalgam when selecting this fragment.',
  },
}
const mapping = {
  format: 'ashveil-atlas-fragment-v1', status: 'prepared-not-installed', mode: 'optional-directional-character',
  character: 'amalgam',
  provenance: 'Original directly authored living fused-patient geometry in tools/art/draw-amalgam.mjs; no input images.',
  sheets: { ...compatibility.sheets, amalgam_walk: `sprites/original/${stem}-walk.png`, amalgam_atk: `sprites/original/${stem}-attack.png` },
  frames: { ...legacyFrames, ...frames }, anims: { amalgam: loop },
  chars: { amalgam: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 63 / 64], attackAnchor: [.5, 79 / 80], renderScale: 1, headOffset: 52,
  } },
  contract: {
    preservedExistingFrameCount: 6, newWalkFrameCount: 12, newAttackFrameCount: 16, totalNamedFrames: 34,
    originalMode: 'anims.amalgam only; no chars.amalgam entry',
    idleInDirectionalRenderer: 'Only idle[dir][0] is displayed, plus existing scale-based breathing; legacy six-frame loop is retained by name but is not played by this branch.',
    knownRendererDifferences: {
      shadowRadii: { existingAnimated: [18, 4], currentCharacterBranch: [6, 2] },
      healthBarWidth: { existingAnimated: 24, currentCharacterBranch: 14 },
      headOffset: { existingAnimated: 44, proposedCharacter: 52 },
      scale: { existingAnimated: .75, proposedCharacter: 1 },
      integration: 'Root should assess boss-size shadow and health bar when choosing this optional chars.amalgam entry. Art package makes no renderer changes.',
    },
  },
  layout: {
    rowOrder: dirs, walkCell: WALK, walkSheet: [240, 256], walkPoses: ['drag-left', 'idle', 'drag-right'],
    attackCell: ATTACK, attackSheet: [384, 320], attackPoses: ['ready', 'draw-back', 'sweep', 'reset'],
    attackBodyOffset: OFFSET, floor: { walk: 63, attack: 79, attackMinusBodyOffset: 63 },
    measuredDirectionalBounds: bounds,
    note: 'Three heads, four arms, no legs in every base recipe. Names amalgam0..5 and anims.amalgam are preserved; new directional frames are explicitly additional. Core, body damage, noBack and multi-cell targeting do not change.',
  },
}
const outputs = new Map([
  [`${output}/${stem}-walk.png`, png(walk)],
  [`${output}/${stem}-attack.png`, png(strike)],
  [`${output}/${stem}-legacy.png`, png(oldLoop)],
  [`${output}/${stem}-walk.svg`, Buffer.from(svg(walk, 'ASHVEIL original living amalgam — 12 directional drag and idle poses'))],
  [`${output}/${stem}-attack.svg`, Buffer.from(svg(strike, 'ASHVEIL original living amalgam — 16 directional sweeps'))],
  [`${output}/${stem}-legacy.svg`, Buffer.from(svg(oldLoop, 'ASHVEIL original living amalgam — six-frame compatibility loop'))],
  [`${output}/${stem}-contact.png`, png(contact, 2)],
  [`${output}/${stem}-palette.json`, Buffer.from(json({ description: 'Authored warm skin, fever marks, gray patient cloth and muted connective fibers. Last four colors also serve the review board.', colors: palette }))],
  [`${output}/${stem}-frames.json`, Buffer.from(json(mapping))],
  [`${output}/${stem}-legacy-fragment.json`, Buffer.from(json(compatibility))],
])
const pngInfo = {
  walk: verifyPNG(outputs.get(`${output}/${stem}-walk.png`), 240, 256),
  attack: verifyPNG(outputs.get(`${output}/${stem}-attack.png`), 384, 320),
  legacy: verifyPNG(outputs.get(`${output}/${stem}-legacy.png`), 576, 64),
  contact: verifyPNG(outputs.get(`${output}/${stem}-contact.png`), 864, 1800),
}
assert.equal(Object.keys(frames).length, 28); assert.equal(Object.keys(legacyFrames).length, 6)
assert.equal(new Set(poses.map(p => p.sha256)).size, 28, '28 distinct directional poses')
assert.equal(new Set(legacyPoses.map(p => p.sha256)).size, 6, '6 distinct compatibility poses')
assert.equal(79 - 16, 63); assert.equal(48 - 8, 40)
assert.equal(Math.min(...bounds.filter(b => b.name.includes('_w_')).map(b => b.minY)), 11)
for (const [name, [sheet, x, y, w, h]] of Object.entries(mapping.frames)) {
  const dims = sheet === 'amalgam' ? [576, 64] : sheet === 'amalgam_walk' ? [240, 256] : [384, 320]
  assert(x >= 0 && y >= 0 && x + w <= dims[0] && y + h <= dims[1], `${name} atlas bounds`)
}
for (const dir of dirs) {
  assert.equal(charWalk[dir].length, 3); assert.equal(charAttack[dir].length, 4)
  assert.equal(charIdle[dir][0], charWalk[dir][1])
  assert.equal(HEADS[dir].length, 3); assert.equal(ARMS[dir].length, 4)
}
const report = {
  format: 'ashveil-original-art-integrity-v1', character: 'living amalgam',
  preservedLegacyFrames: 6, newDirectionalFrames: 28, totalNamedFrames: 34,
  png: pngInfo, directionalBounds: bounds,
  checks: ['all34 frame rectangles in bounds', '28 distinct directional poses', '6 distinct compatibility poses', 'three-head/four-arm recipes', 'palette-only RGBA', 'binary transparency', 'fixed broad base ground in every pose', 'walk/attack body anchor equality', 'PNG CRC and scanline decoding', 'byte-for-byte deterministic output'],
  files: Object.fromEntries([...outputs].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }])),
  source: { path: 'tools/art/draw-amalgam.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses, legacyPoses,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 6 preserved legacy names + 28 new directional poses; no game manifest changed.`)
