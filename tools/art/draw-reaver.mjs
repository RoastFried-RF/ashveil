/**
 * ASHVEIL original ash reaver — authored pixel geometry, not an image transform.
 * Reuses the project's small canvas / PNG / SVG approach, not any sprite pixels.
 * node tools/art/draw-reaver.mjs          write this isolated art package
 * node tools/art/draw-reaver.mjs --check  compare every output without writing
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
const stem = 'ashveil-reaver'
const dirs = ['down', 'left', 'right', 'up']
const args = new Set(process.argv.slice(2))
for (const arg of args) assert.equal(arg, '--check', `Unsupported argument: ${arg}`)
const check = args.has('--check')

// Authored material ramps: iron, ash cloth, tanned hide, skin and worn rope.
// The cool teal hood / parchment scarf / copper clasp of the wanderer are absent.
const palette = {
  o: '#191c1d', k: '#2b2b29',
  i: '#3d4547', j: '#657170', I: '#9ca8a1', H: '#c2c7b7',
  d: '#414341', c: '#65665e', C: '#909185', P: '#bab6a1',
  b: '#3b2c27', r: '#634336', n: '#916449', L: '#b5845c',
  s: '#815b4c', f: '#b18465', F: '#d3ac83', a: '#a29d8d',
  e: '#d2ceae', R: '#9e8b67', E: '#c9b58b',
  u: '#323735', v: '#545c55', w: '#7c8071',
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
  // One boot always touches the same y=31 exclusive floor edge.
  if (!side) {
    const lx = 7 + (step === 1 ? 1 : 0), rx = 14 - (step === -1 ? 1 : 0)
    const ly = step === 1 ? 28 : 30, ry = step === -1 ? 28 : 30
    c.polygon([[8, 22], [12, 22], [11, ly - 2], [lx + 3, ly], [lx, ly], [lx, 26]], 'o')
    c.polygon([[13, 22], [17, 22], [rx + 3, 26], [rx + 3, ry], [rx, ry], [12, 26]], 'o')
    c.line(9, 23, lx + 1, ly - 3, 'v'); c.point(10, 24, 'w')
    c.line(14, 23, rx + 1, ry - 3, 'u'); c.point(15, 24, 'v')
    c.rect(lx, ly - 2, 4, 3, 'b'); c.row(lx, ly - 2, 'nnrb'); c.row(lx - 1, ly, 'oikoo')
    c.rect(rx - 1, ry - 2, 4, 3, 'b'); c.row(rx - 1, ry - 2, 'rnbb'); c.row(rx - 1, ry, 'ookio')
  } else {
    const far = step === -1 ? 2 : step === 1 ? -2 : 0
    const near = -far
    const fy = step === -1 ? 28 : 29, ny = step === 1 ? 28 : 30
    c.rect(10 + far, 23, 3, fy - 22, 'o'); c.line(11 + far, 24, 11 + far, fy - 2, 'u')
    c.rect(9 + far, fy - 2, 5, 3, 'b'); c.row(8 + far, fy, 'ookioo'); c.row(9 + far, fy - 2, 'nrbbb')
    c.polygon([[10, 22], [14, 22], [13 + near, 26], [12 + near, ny], [8 + near, ny], [9 + near, 26]], 'o')
    c.line(11, 23, 10 + near, ny - 3, 'v'); c.point(11, 24, 'w')
    c.rect(8 + near, ny - 2, 5, 3, 'b'); c.row(8 + near, ny - 2, 'Lnrbb'); c.row(7 + near, ny, 'oikooo')
    if (fy < 30 && ny < 30) c.row(8 + far, 30, 'ookoo')
  }
}

function ropeFront(c) {
  // Anatomical right hip = viewer left. The knot is not mirrored between views.
  c.row(6, 21, 'oREEERRREERo'); c.row(6, 22, 'oRRRRRRRRRRo')
  c.row(6, 21, 'ERE'); c.row(5, 22, 'RER'); c.row(6, 23, 'ER')
  c.line(6, 23, 5, 26, 'R'); c.point(5, 27, 'E'); c.line(7, 23, 8, 25, 'E'); c.point(8, 26, 'R')
}

function armsFront(c, step, attacking, back) {
  // Right hand (viewer left) is the active attacking arm, omitted when replaced.
  if (!attacking) {
    const y = 15 + step
    c.polygon([[4, y], [7, y], [7, y + 7], [3, y + 8], [2, y + 4]], 'o')
    c.rect(3, y + 1, 3, 4, back ? 'c' : 'C'); c.row(3, y + 4, 'dcC')
    c.row(3, y + 5, 'rnn'); c.row(3, y + 6, 'sFf'); c.row(3, y + 7, 'fs')
  }
  const y = 15 - step
  c.polygon([[18, y], [21, y + 1], [22, y + 5], [20, y + 8], [17, y + 6]], 'o')
  c.rect(18, y + 1, 3, 4, 'c'); c.row(18, y + 4, 'Ccd')
  c.row(18, y + 5, 'nrr'); c.row(18, y + 6, 'fFs'); c.row(19, y + 7, 'sf')
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, step)
  // Short torn tunic leaves both legs visible; no wanderer cape or satchel.
  c.polygon([[7, 11], [17, 11], [21, 15], [19, 22], [19, 25], [16, 25], [15, 24], [13, 26], [11, 24], [7, 26], [5, 23], [4, 15]], 'o')
  c.polygon([[7, 13], [17, 13], [19, 16], [17, 22], [18, 24], [15, 23], [13, 25], [11, 23], [7, 24], [6, 21], [5, 15]], 'c')
  c.line(7, 22, 7, 24, 'C'); c.point(12, 24, 'd'); c.point(17, 24, 'P')
  armsFront(c, step, attacking, false)
  // Broad asymmetrical shoulder cloth above a scuffed, laced hide vest.
  c.polygon([[6, 11], [11, 12], [13, 13], [17, 11], [20, 14], [18, 17], [14, 15], [11, 16], [7, 15], [4, 16], [4, 13]], 'd')
  c.polygon([[6, 12], [10, 13], [11, 14], [8, 14], [5, 15], [5, 13]], 'C')
  c.row(6, 12, 'PCC'); c.point(4, 14, 'C'); c.line(16, 12, 18, 14, 'c')
  c.polygon([[8, 14], [16, 14], [18, 17], [17, 21], [7, 21], [6, 17]], 'b')
  c.polygon([[8, 15], [11, 15], [11, 21], [7, 20], [7, 17]], 'n')
  c.polygon([[13, 15], [16, 15], [17, 18], [16, 21], [12, 21]], 'r')
  c.line(8, 15, 10, 15, 'L'); c.line(7, 17, 7, 19, 'L'); c.point(10, 19, 'r')
  c.row(11, 15, 'rEn'); c.row(11, 17, 'nEr'); c.row(11, 19, 'rRn')
  c.row(14, 18, 'Ln'); c.point(15, 19, 'L'); c.point(15, 20, 'b')
  ropeFront(c)
  // Neck and exposed human face with cheek ash, stubble and a strong brow.
  c.row(9, 11, 'osffso'); c.row(9, 12, 'oaffao'); c.row(10, 13, 'CcCd')
  c.rect(8, 6, 9, 6, 'o'); c.rect(9, 7, 7, 4, 's')
  c.row(8, 8, 'sfFffsfFs'); c.row(9, 9, 'aokFkoa'); c.row(9, 10, 'afFFfsa')
  c.row(9, 11, 'skffkss'); c.row(10, 12, 'okssko'); c.point(12, 10, 'F')
  c.point(9, 8, 'k'); c.point(14, 8, 'k'); c.point(10, 9, 'e'); c.point(14, 9, 'e')
  // Low hammered iron cap, rounded crown and visibly worn edge, never a hood.
  c.polygon([[9, 2], [15, 2], [18, 5], [18, 7], [19, 8], [16, 9], [8, 9], [5, 8], [6, 5]], 'o')
  c.polygon([[9, 3], [14, 3], [17, 5], [17, 7], [7, 7], [7, 5]], 'j')
  c.polygon([[14, 3], [17, 5], [17, 7], [13, 7], [13, 4]], 'i')
  c.row(9, 3, 'IIj'); c.row(8, 4, 'Ij'); c.point(7, 5, 'I'); c.point(12, 4, 'H')
  c.row(6, 7, 'oIjjjjjjiio'); c.row(7, 8, 'Ijijjjijio'); c.point(16, 7, 'n'); c.point(8, 7, 'H')
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  legs(c, false, -step)
  c.polygon([[7, 11], [17, 11], [21, 15], [19, 22], [19, 25], [16, 25], [15, 24], [13, 26], [11, 24], [7, 26], [5, 23], [4, 15]], 'o')
  c.polygon([[7, 13], [17, 13], [19, 16], [17, 22], [18, 24], [15, 23], [13, 25], [11, 23], [7, 24], [6, 21], [5, 15]], 'c')
  c.line(7, 22, 7, 24, 'C'); c.point(12, 24, 'd'); c.point(17, 24, 'P')
  // From behind anatomical right is on screen right, so draw the arms reversed.
  const armLayer = canvas(24, 32)
  armsFront(armLayer, -step, attacking, true)
  paste(c, mirror(armLayer), 0, 0)
  c.polygon([[6, 11], [17, 11], [20, 14], [17, 17], [12, 18], [8, 16], [4, 16], [4, 13]], 'd')
  c.polygon([[6, 12], [16, 12], [18, 14], [15, 16], [12, 16], [8, 15], [5, 15]], 'C')
  c.row(7, 12, 'PPCCcC'); c.line(6, 13, 7, 14, 'P'); c.point(17, 14, 'c')
  c.polygon([[7, 16], [11, 17], [16, 16], [18, 18], [17, 21], [7, 21], [6, 18]], 'b')
  c.polygon([[8, 16], [12, 18], [16, 17], [16, 21], [7, 20], [7, 18]], 'r')
  c.line(8, 17, 8, 19, 'n'); c.line(12, 18, 12, 20, 'b'); c.row(14, 18, 'nL'); c.point(14, 20, 'n')
  c.row(6, 21, 'oRREEERRREER'); c.row(6, 22, 'oRRRRRRRRRRo')
  c.row(16, 21, 'ERE'); c.row(17, 22, 'RER'); c.line(17, 23, 18, 26, 'R'); c.point(18, 27, 'E')
  c.line(16, 23, 15, 25, 'E'); c.point(15, 26, 'R')
  // Exposed short hair at the nape, with cap seam and one battered rivet.
  c.row(8, 8, 'okkkkkko'); c.row(9, 9, 'kssssk'); c.row(9, 10, 'ssfass'); c.row(10, 11, 'fsso')
  c.polygon([[9, 2], [15, 2], [18, 5], [18, 7], [19, 8], [16, 10], [8, 10], [5, 8], [6, 5]], 'o')
  c.polygon([[9, 3], [14, 3], [17, 5], [17, 7], [15, 9], [9, 9], [7, 7], [7, 5]], 'j')
  c.polygon([[14, 3], [17, 5], [17, 7], [15, 9], [13, 9], [13, 4]], 'i')
  c.row(9, 3, 'IIj'); c.point(8, 4, 'I'); c.point(7, 6, 'I'); c.point(12, 4, 'H')
  c.line(12, 4, 12, 8, 'i'); c.point(12, 7, 'I'); c.row(7, 8, 'jIjijiijii'); c.point(16, 7, 'n')
  return c
}

function left(step, attacking = false, visibleKnot = false) {
  const c = canvas(24, 32)
  legs(c, true, step)
  c.polygon([[9, 11], [15, 11], [19, 15], [19, 21], [17, 25], [14, 24], [12, 26], [9, 24], [7, 25], [6, 20], [6, 15]], 'o')
  c.polygon([[9, 13], [15, 13], [17, 16], [17, 21], [16, 24], [13, 23], [12, 25], [9, 23], [8, 24], [7, 20], [7, 16]], 'c')
  c.line(8, 21, 8, 23, 'C'); c.point(12, 24, 'P')
  // Far arm stays behind the trunk, near arm is replaced during attacks.
  c.polygon([[15, 16], [17, 16], [18 + step, 20], [17 + step, 23], [15 + step, 22], [15, 19]], 'o')
  c.line(16, 17, 16 + step, 20, 'c'); c.point(17 + step, 20, 'd')
  c.row(15 + step, 21, 'rs'); c.row(15 + step, 22, 'sf')
  c.polygon([[9, 12], [15, 11], [18, 14], [16, 17], [12, 16], [7, 16], [6, 14]], 'd')
  c.polygon([[9, 12], [14, 12], [16, 14], [13, 15], [8, 15], [7, 14]], 'C')
  c.row(9, 12, 'PPCc'); c.point(7, 14, 'P')
  c.polygon([[9, 16], [15, 16], [17, 18], [16, 21], [8, 21], [7, 18]], 'b')
  c.polygon([[9, 16], [14, 17], [15, 20], [9, 20], [8, 18]], 'r')
  c.line(9, 16, 9, 19, 'n'); c.point(10, 17, 'L'); c.row(14, 19, 'nL')
  c.row(8, 21, 'oREEERRRo'); c.row(8, 22, 'oRRRRRRRo')
  if (visibleKnot) {
    c.row(9, 21, 'ERE'); c.row(8, 22, 'RER'); c.line(9, 23, 8, 26, 'R'); c.point(8, 27, 'E'); c.line(10, 23, 11, 25, 'E')
  } else c.point(16, 22, 'E')
  if (!attacking) {
    const ax = 8 - step
    c.polygon([[ax, 15], [ax + 3, 16], [ax + 3, 22], [ax, 24], [ax - 1, 21]], 'o')
    c.rect(ax, 16, 2, 4, 'C'); c.row(ax, 19, 'cd'); c.row(ax, 20, 'nr'); c.row(ax, 21, 'Ff'); c.row(ax, 22, 'fs')
  }
  c.row(9, 10, 'sfs'); c.row(9, 11, 'fa'); c.row(9, 12, 'dc')
  // Profile has a human nose, an ash-streaked cheek and exposed ear.
  c.polygon([[8, 6], [15, 6], [15, 10], [13, 12], [8, 12], [6, 10], [5, 9], [7, 8]], 'o')
  c.row(7, 8, 'sFFfsk'); c.row(6, 9, 'fFefsa'); c.row(5, 10, 'Ffsffsa'); c.row(7, 11, 'afssk'); c.row(8, 12, 'kssk')
  c.point(8, 9, 'o'); c.point(9, 9, 'e'); c.point(13, 9, 'F'); c.point(8, 10, 'F')
  c.polygon([[10, 2], [15, 2], [18, 5], [18, 8], [16, 9], [7, 9], [5, 8], [6, 5], [8, 3]], 'o')
  c.polygon([[10, 3], [14, 3], [17, 5], [17, 7], [7, 7], [7, 5]], 'j')
  c.polygon([[14, 3], [17, 5], [17, 7], [13, 7], [13, 4]], 'i')
  c.row(10, 3, 'IIj'); c.point(8, 4, 'I'); c.point(7, 5, 'I'); c.point(12, 4, 'H')
  c.row(6, 7, 'oIjjjjjjiio'); c.row(6, 8, 'jIjiijjiiio'); c.point(16, 7, 'n')
  return c
}

function sprite(direction, step, attacking = false) {
  if (direction === 'down') return front(step, attacking)
  if (direction === 'up') return back(step, attacking)
  if (direction === 'left') return left(step, attacking, false)
  // Only the right-hand side exposes the anatomical right rope knot.
  return mirror(left(-step, attacking, true))
}

function attackArm(direction, pose) {
  const c = canvas(32, 40)
  // Explicit elbow / wrist paths, not stretched images; active hand has one palm.
  const paths = {
    left: [ [[13, 23], [11, 27], [9, 25]], [[13, 23], [15, 19], [12, 16]], [[13, 23], [7, 23], [3, 24]], [[13, 23], [9, 27], [7, 26]] ],
    down: [ [[10, 23], [8, 27], [10, 28]], [[10, 23], [6, 21], [7, 18]], [[10, 23], [8, 29], [12, 33]], [[10, 23], [7, 28], [9, 30]] ],
    up: [ [[21, 23], [23, 26], [25, 23]], [[21, 23], [25, 21], [25, 17]], [[21, 23], [23, 15], [19, 7]], [[21, 23], [24, 23], [24, 20]] ],
  }
  const path = paths[direction === 'right' ? 'left' : direction][pose]
  const [[sx, sy], [ex, ey], [wx, wy]] = path
  const segment = (x0, y0, x1, y1, outer, inner) => {
    for (const offset of [-1, 0, 1]) c.line(x0 + offset, y0, x1 + offset, y1, outer)
    c.line(x0, y0, x1, y1, inner)
  }
  segment(sx, sy, ex, ey, 'o', 'c')
  c.line(sx - 1, sy, ex - 1, ey, 'C')
  segment(ex, ey, wx, wy, 'o', 'r')
  c.line(ex, ey, wx, wy, 'n')
  c.rect(wx - 1, wy - 1, 3, 3, 's'); c.row(wx - 1, wy - 1, 'fFf'); c.point(wx, wy, 'F')
  c.point(ex, ey, 'L')
  return direction === 'right' ? mirror(c) : c
}

function attack(direction, pose) {
  const c = canvas(32, 40)
  const body = sprite(direction, 0, true)
  const arm = attackArm(direction, pose)
  // Upward high strike goes behind the head, then torso occludes its shoulder.
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
text(contact, 'ASHVEIL / ASH REAVER', 6, 6)
text(contact, 'ORIGINAL PIXEL ART', 6, 14, 'C')
text(contact, 'WALK 0    IDLE 1    WALK 2', 43, 26, 'P')
const frames = {}, charWalk = {}, charIdle = {}, charAttack = {}
const poseHashes = []
for (const [row, dir] of dirs.entries()) {
  const cy = 35 + row * 39
  text(contact, dir.toUpperCase(), 4, cy + 14, 'C')
  charWalk[dir] = []; charIdle[dir] = [`reaver0_w_${dir}1`]; charAttack[dir] = []
  for (let col = 0; col < 3; col++) {
    const s = sprite(dir, col - 1), name = `reaver0_w_${dir}${col}`
    paste(walk, s, col * 24, row * 32)
    contact.rect(37 + col * 48, cy - 1, 44, 36, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 48, cy + 31, 80 + col * 48, cy + 31, 'i')
    paste(contact, s, 47 + col * 48, cy)
    frames[name] = ['reaver0', col * 24, row * 32, 24, 32]
    charWalk[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[31].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[30].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'READY 0 LIFT 1 STRIKE 2 RESET 3', 43, 198, 'P')
for (const [row, dir] of dirs.entries()) {
  const cy = 208 + row * 45
  text(contact, dir.toUpperCase(), 4, cy + 19, 'C')
  for (let col = 0; col < 4; col++) {
    const s = attack(dir, col), name = `reaver0_a_${dir}${col}`
    paste(strike, s, col * 32, row * 40)
    contact.rect(37 + col * 38, cy - 1, 36, 43, row % 2 ? 'D' : 'o')
    contact.line(37 + col * 38, cy + 39, 72 + col * 38, cy + 39, 'i')
    paste(contact, s, 39 + col * 38, cy)
    frames[name] = ['reaver0_atk', col * 32, row * 40, 32, 40]
    charAttack[dir].push(name)
    poseHashes.push({ name, sha256: hash(png(s)) })
    assert.equal(s.pixels[39].every(p => p === '.'), true, `${name} floor margin`)
    assert(s.pixels[38].some(p => p !== '.'), `${name} boot touches fixed floor`)
  }
}
text(contact, 'IRON  CLOTH  HIDE  SKIN  ROPE', 6, 390, 'C')

const mapping = {
  format: 'ashveil-atlas-fragment-v1',
  status: 'prepared-not-installed',
  character: 'reaver0',
  provenance: 'Original pixel geometry authored in tools/art/draw-reaver.mjs. No external sprite pixels are read.',
  sheets: { reaver0: `sprites/original/${stem}-walk.png`, reaver0_atk: `sprites/original/${stem}-attack.png` },
  frames,
  chars: { reaver0: {
    walk: charWalk, idle: charIdle, attack: charAttack,
    anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 29,
  } },
  layout: {
    rowOrder: dirs, walkCell: [24, 32], walkSheet: [72, 128], walkPoses: ['left-step', 'idle', 'right-step'],
    attackCell: [32, 40], attackSheet: [128, 160], attackPoses: ['ready', 'lift', 'strike', 'reset'],
    attackBodyOffset: [4, 8], floor: { walk: 31, attack: 39, attackMinusBodyOffset: 31 },
    note: 'Replaces all 28 reaver0_* frame rectangles and the reaver0 CharDef together; the old attack cells are 47×63. reaver1 and hero are outside this fragment.',
  },
}

const outputs = new Map([
  [`${output}/${stem}-walk.png`, png(walk)],
  [`${output}/${stem}-attack.png`, png(strike)],
  [`${output}/${stem}-walk.svg`, Buffer.from(svg(walk, 'ASHVEIL original ash reaver — 12 walk and idle poses'))],
  [`${output}/${stem}-attack.svg`, Buffer.from(svg(strike, 'ASHVEIL original ash reaver — 16 attack poses'))],
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
  const dims = sheet === 'reaver0' ? [72, 128] : [128, 160]
  assert(x >= 0 && y >= 0 && x + w <= dims[0] && y + h <= dims[1], `${name} atlas bounds`)
}
for (const dir of dirs) {
  assert.equal(charWalk[dir].length, 3); assert.equal(charAttack[dir].length, 4)
  assert.equal(charIdle[dir][0], charWalk[dir][1])
}
const report = {
  format: 'ashveil-original-art-integrity-v1',
  character: 'ash reaver', frameCount: 28, distinctPoseCount: 28, png: pngInfo,
  checks: ['all frame rectangles in bounds', '28 distinct poses', 'palette-only RGBA', 'binary transparency', 'fixed boot floor in all poses', 'walk/attack floor anchor equality', 'PNG CRC and scanline decoding', 'byte-for-byte deterministic output'],
  files: Object.fromEntries([...outputs].map(([name, bytes]) => [name, { bytes: bytes.length, sha256: hash(bytes) }])),
  source: { path: 'tools/art/draw-reaver.mjs', sha256: hash(readFileSync(fileURLToPath(import.meta.url))) },
  poses: poseHashes,
}
outputs.set(`${output}/${stem}-integrity.json`, Buffer.from(json(report)))
for (const [name, bytes] of outputs) {
  const target = join(root, name)
  if (check) assert.deepEqual(readFileSync(target), bytes, `Generated file differs: ${name}`)
  else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes) }
}
console.log(`${check ? 'CHECK PASS' : 'WROTE'}: ${outputs.size} art outputs; 12 walk/idle + 16 attack; 28 distinct poses; no game manifest changed.`)
