/**
 * ASHVEIL original small human shade-folk — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-shade2.mjs          write this isolated art package
 * node tools/art/draw-shade2.mjs --check  compare every output without writing
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
const stem = 'ashveil-shade2'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// New slate-blue rags, ochre repair and pale human face, authored as geometry.
// Reuses only the project's pixel canvas / PNG / SVG and verification structure.
const palette = {
  o: '#1d2327', k: '#302b28',
  d: '#36434d', c: '#52616a', p: '#849397', h: '#b4b9ab',
  b: '#35302a', r: '#5d4634', n: '#9b835d', g: '#c3ac79',
  s: '#858b80', a: '#aeb4a2', f: '#cdd2bb', F: '#e2e1c9',
  v: '#646c59', w: '#404136', u: '#8b9277', j: '#52625e',
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
  // One rolled trouser leg, one long torn leg; small adult feet stay on y=30.
  if (!side) {
    const lx = 9 + step, rx = 14 - step
    const ly = step > 0 ? 28 : 30, ry = step < 0 ? 28 : 30
    c.polygon([[9, 23], [12, 23], [12, 26], [lx + 1, ly - 1], [lx - 2, ly - 1], [8, 26]], 'o')
    c.polygon([[13, 23], [16, 23], [17, 26], [rx + 2, ry - 1], [rx - 1, ry - 1], [13, 26]], 'o')
    c.line(10, 24, lx, ly - 2, 'v'); c.point(10, 25, 'u'); c.point(lx, ly - 2, 'p')
    c.row(rx - 1, 25, 'vv'); c.row(rx - 1, 26, 'uv'); c.line(rx, 26, rx, ry - 1, 'a')
    c.row(lx - 1, ly - 1, 'as'); c.row(lx - 2, ly, 'ofFso')
    c.row(rx, ry - 1, 'fa'); c.row(rx - 1, ry, 'sfFso')
  } else {
    const far = -step, near = step * 2
    const fy = step < 0 ? 28 : 30, ny = step > 0 ? 28 : 30
    c.polygon([[12, 23], [15, 23], [14 + far, 26], [14 + far, fy - 1], [11 + far, fy - 1], [11, 25]], 'o')
    c.line(13, 24, 12 + far, fy - 2, 'v'); c.row(11 + far, fy - 1, 'as'); c.row(9 + far, fy, 'sfFsoo')
    c.polygon([[9, 23], [13, 23], [13 + near, 26], [12 + near, ny - 1], [9 + near, ny - 1], [9, 26]], 'o')
    c.row(10 + near, 25, 'vu'); c.row(10 + near, 26, 'uv'); c.line(10 + near, 26, 10 + near, ny - 1, 'a')
    c.row(9 + near, ny - 1, 'fa'); c.row(7 + near, ny, 'sfFpso')
  }
}

function arms(c, step, attacking, back = false) {
  const layer = canvas(24, 32)
  if (!attacking) {
    const y = 18 + step
    layer.polygon([[6, y], [8, y], [8, y + 4], [6, y + 7], [3, y + 6], [4, y + 2]], 'o')
    layer.row(5, y + 1, 'cc'); layer.row(5, y + 2, 'cp'); layer.row(5, y + 3, 'as')
    layer.row(4, y + 4, 'fa'); layer.row(4, y + 5, 'Ff'); layer.row(4, y + 6, 'sa')
  }
  const y = 17 - step
  layer.polygon([[17, y], [20, y + 2], [21, y + 5], [19, y + 8], [17, y + 6]], 'o')
  layer.row(18, y + 1, 'cc'); layer.row(18, y + 2, 'dc'); layer.row(18, y + 3, 'aa')
  layer.row(18, y + 4, 'fp'); layer.row(18, y + 5, 'pc'); layer.row(18, y + 6, 'fF'); layer.point(19, y + 7, 's')
  paste(c, back ? mirror(layer) : layer, 0, 0)
}

function face(c, back = false) {
  // A broad exposed forehead and sparse side hair distinguish this adult.
  c.polygon([[10, 9], [14, 9], [16, 10], [17, 13], [16, 16], [14, 18], [10, 17], [8, 15], [8, 12], [9, 10]], 'o')
  c.polygon([[10, 10], [14, 10], [16, 12], [16, 15], [14, 17], [10, 16], [9, 14], [9, 12]], 'a')
  c.row(10, 10, 'fFfa'); c.row(9, 11, 'kkfFfa'); c.point(9, 12, 'k'); c.point(15, 11, 's')
  if (back) {
    c.row(9, 12, 'kasssk'); c.row(9, 13, 'kafass'); c.row(10, 14, 'afFass'); c.row(10, 15, 'saafss')
    c.row(11, 16, 'affs'); c.point(8, 14, 's'); c.point(16, 14, 'a'); c.point(14, 12, 'k')
    return
  }
  c.row(9, 12, 'soofkoo'); c.row(9, 13, 'ffpffas'); c.point(8, 13, 'a'); c.point(16, 13, 's')
  c.row(9, 14, 'fFpFfas'); c.row(10, 15, 'srrfas'); c.row(11, 16, 'affa'); c.point(14, 14, 'n')
}

function belt(c, back = false) {
  c.row(7, 23, 'ocpccpccco'); c.point(10, 24, 'p'); c.point(14, 24, 'd')
  const x = back ? 15 : 7
  c.row(x, 24, 'rn'); c.row(x, 25, 'nb'); c.point(x, 26, 'r')
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, step)
  c.polygon([[9, 16], [15, 16], [19, 17], [20, 21], [18, 25], [16, 24], [14, 26], [12, 24], [8, 25], [6, 23], [5, 19]], 'o')
  c.polygon([[9, 17], [15, 17], [18, 18], [18, 22], [17, 24], [14, 23], [13, 25], [11, 23], [8, 24], [7, 22], [6, 19]], 'c')
  c.polygon([[13, 18], [16, 18], [17, 22], [16, 24], [13, 22]], 'd')
  c.line(8, 19, 8, 22, 'p'); c.point(9, 23, 'h'); c.line(11, 20, 12, 23, 'p')
  arms(c, step, attacking)
  // Ochre repair over the anatomical left shoulder, secured with pale stitches.
  c.polygon([[14, 17], [18, 17], [19, 20], [16, 21], [14, 19]], 'r')
  c.row(15, 18, 'ngn'); c.row(15, 19, 'nng'); c.point(14, 18, 'p'); c.point(18, 19, 'h')
  c.row(9, 17, 'ddpcc'); c.row(10, 18, 'pcd'); c.point(10, 19, 'h')
  c.line(8, 21, 12, 22, 'r'); c.point(9, 21, 'n'); c.point(11, 22, 'n')
  belt(c)
  face(c)
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, -step)
  c.polygon([[9, 16], [15, 16], [18, 18], [19, 22], [18, 25], [14, 24], [13, 26], [10, 24], [7, 25], [5, 22], [6, 18]], 'o')
  c.polygon([[9, 17], [15, 17], [17, 19], [17, 23], [15, 24], [13, 23], [12, 25], [9, 23], [7, 24], [6, 21], [7, 19]], 'c')
  c.polygon([[14, 18], [17, 19], [17, 23], [15, 24], [13, 22]], 'd')
  c.line(8, 19, 8, 22, 'p'); c.point(9, 23, 'h'); c.line(11, 20, 12, 23, 'p')
  arms(c, -step, attacking, true)
  c.polygon([[6, 18], [9, 17], [11, 19], [10, 21], [6, 20]], 'r')
  c.row(7, 18, 'nng'); c.row(7, 19, 'gnn'); c.point(6, 19, 'p'); c.point(10, 20, 'h')
  c.line(11, 19, 15, 22, 'r'); c.point(12, 20, 'n'); c.point(14, 21, 'n')
  belt(c, true)
  face(c, true)
  return c
}

function left(step, attacking = false, patch = true) {
  const c = canvas(24, 32)
  legs(c, true, step)
  c.polygon([[10, 16], [15, 16], [18, 18], [19, 22], [17, 25], [14, 24], [12, 26], [9, 24], [7, 25], [6, 21], [7, 18]], 'o')
  c.polygon([[10, 17], [14, 17], [17, 19], [17, 22], [16, 24], [13, 23], [11, 25], [8, 23], [7, 21], [8, 18]], 'c')
  c.polygon([[14, 18], [17, 19], [17, 22], [16, 24], [14, 22]], 'd')
  c.line(9, 19, 8, 22, 'p'); c.point(9, 23, 'h')
  c.polygon([[15, 18], [18, 19], [19 + step, 23], [17 + step, 25], [15 + step, 24]], 'o')
  c.line(16, 19, 17 + step, 22, 'd'); c.row(16 + step, 23, 'pc'); c.row(16 + step, 24, 'af')
  if (patch) {
    c.polygon([[9, 18], [12, 18], [14, 20], [11, 22], [8, 20]], 'r')
    c.row(9, 19, 'ngn'); c.row(10, 20, 'nng'); c.point(8, 19, 'p'); c.point(12, 21, 'h')
  } else {
    c.line(12, 19, 15, 22, 'r'); c.point(13, 20, 'n'); c.point(14, 21, 'n')
  }
  c.row(8, 23, 'ocpccpcco'); c.row(14, 24, 'rn'); c.point(14, 25, 'r')
  if (!attacking) {
    const x = 8 - step
    c.polygon([[x, 18], [x + 3, 19], [x + 3, 22], [x, 26], [x - 2, 25], [x - 1, 21]], 'o')
    c.rect(x, 19, 2, 2, 'c'); c.point(x, 19, 'p'); c.row(x - 1, 21, 'fa')
    c.row(x - 1, 22, 'fp'); c.row(x - 1, 23, 'pc'); c.row(x - 1, 24, 'fF'); c.point(x, 25, 's')
  }
  // Sparse hair on a receding crown, large dark pupil and ordinary adult profile.
  c.polygon([[10, 9], [14, 9], [16, 11], [16, 15], [14, 18], [9, 17], [7, 15], [6, 14], [7, 12], [8, 10]], 'o')
  c.polygon([[10, 10], [14, 10], [15, 12], [15, 15], [13, 17], [9, 16], [7, 14], [8, 12]], 'a')
  c.row(10, 10, 'fFfa'); c.row(9, 11, 'kfFfas'); c.row(7, 12, 'skoofas')
  c.row(7, 13, 'ffpffas'); c.row(6, 14, 'fFpafas'); c.row(8, 15, 'rrfass'); c.row(9, 16, 'affas')
  c.point(14, 12, 'k'); c.point(13, 14, 'n'); c.point(12, 13, 'F'); c.point(15, 13, 's')
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
    left: [ [[13, 28], [11, 31], [9, 30]], [[13, 28], [16, 27], [13, 24]], [[13, 28], [8, 28], [3, 26]], [[13, 28], [10, 30], [7, 29]] ],
    down: [ [[10, 27], [8, 30], [10, 31]], [[10, 27], [7, 26], [10, 23]], [[10, 27], [8, 32], [13, 35]], [[10, 27], [7, 31], [10, 33]] ],
    up: [ [[21, 27], [23, 30], [25, 28]], [[21, 27], [25, 27], [23, 23]], [[21, 27], [24, 22], [22, 14]], [[21, 27], [24, 28], [24, 25]] ],
  }
  const [[sx, sy], [ex, ey], [wx, wy]] = paths[direction === 'right' ? 'left' : direction][pose]
  const segment = (x0, y0, x1, y1, color) => {
    for (const offset of [-1, 0, 1]) c.line(x0 + offset, y0, x1 + offset, y1, 'o')
    c.line(x0, y0, x1, y1, color)
  }
  segment(sx, sy, ex, ey, 'c'); c.line(sx - 1, sy, ex - 1, ey, 'p')
  segment(ex, ey, wx, wy, 'a'); c.line(ex, ey, wx, wy, 'f'); c.point(ex, ey, 'c')
  c.rect(wx - 1, wy - 1, 3, 3, 's'); c.row(wx - 1, wy - 1, 'fFf'); c.point(wx, wy, 'p')
  return direction === 'right' ? mirror(c) : c
}

function attack(direction, pose) {
  const c = canvas(32, 40), body = sprite(direction, 0, true), arm = attackArm(direction, pose)
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
text(contact, 'ASHVEIL / SHADE TWO', 6, 6)
text(contact, 'ORIGINAL PIXEL ART', 6, 14, 'p')
text(contact, 'WALK 0    IDLE 1    WALK 2', 43, 26, 'h')
const frames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poseHashes = []
for (const [row, dir] of dirs.entries()) {
  const cy = 35 + row * 39
  text(contact, dir.toUpperCase(), 4, cy + 14, 'p')
  charWalk[dir] = []; charIdle[dir] = [`shade2_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = sprite(dir, col - 1), name = `shade2_w_${dir}${col}`
    paste(walk, s, col * 24, row * 32)
    contact.rect(37 + col * 48, cy - 1, 44, 36, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 48, cy + 31, 80 + col * 48, cy + 31, 'j')
    paste(contact, s, 47 + col * 48, cy)
    frames[name] = ['shade2', col * 24, row * 32, 24, 32]
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
    const s = attack(dir, col), name = `shade2_a_${dir}${col}`
    paste(strike, s, col * 32, row * 40)
    contact.rect(37 + col * 38, cy - 1, 36, 43, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 38, cy + 39, 72 + col * 38, cy + 39, 'j')
    paste(contact, s, 39 + col * 38, cy)
    frames[name] = ['shade2_atk', col * 32, row * 40, 32, 40]
    charAttack[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[39].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[38].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'PALE SKIN BLUE RAGS REPAIR', 6, 390, 'p')

const mapping = {
  format: 'ashveil-atlas-fragment-v1',
  status: 'prepared-not-installed',
  character: 'shade2',
  provenance: 'Original pixel geometry authored in tools/art/draw-shade2.mjs. No external sprite pixels are read.',
  sheets: { shade2: `sprites/original/${stem}-walk.png`, shade2_atk: `sprites/original/${stem}-attack.png` },
  frames,
  chars: { shade2: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 22,
  } },
  contract: {
    existingWalkFrameCount: 12, existingAttackFrameCount: 0,
    preservedWalkNames: Object.keys(frames).filter(name => name.startsWith('shade2_w_')),
    newAttackNames: Object.keys(frames).filter(name => name.startsWith('shade2_a_')),
    existingIdle: 'walk frame 1 in each direction',
    extension: 'Optional CharDef.attack is already supported by the current renderer; this fragment adds frames, not a Core action.',
  },
  layout: {
    rowOrder: dirs, walkCell: [24, 32], walkSheet: [72, 128], walkPoses: ['left-step', 'idle', 'right-step'],
    attackCell: [32, 40], attackSheet: [128, 160], attackPoses: ['ready', 'lift', 'strike', 'reset'],
    attackBodyOffset: [4, 8], floor: { walk: 31, attack: 39, attackMinusBodyOffset: 31 },
    note: 'Preserves existing 12 shade2_w_* names and idle sequences. Adds 16 shade2_a_* poses through optional CharDef.attack; existing shade2 had no attack frames. Uses two new sheet keys and does not replace shared mon1, other shades, reavers, hero or Core definitions.',
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
  const dims = sheet === 'shade2' ? [72, 128] : [128, 160]
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
  source: { path: 'tools/art/draw-shade2.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses: poseHashes,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 12 walk/idle + 16 attack; 28 distinct poses; no game manifest changed.`)
