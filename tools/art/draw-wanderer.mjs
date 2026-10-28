/**
 * ASHVEIL original pixel art — ash-frontier wanderer.
 * Every silhouette, material cluster and animation pose below is authored here.
 * No existing sprite or generated portrait is sampled, transformed or recoloured.
 * Run: node tools/art/draw-wanderer.mjs --install
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('../../', import.meta.url))
const out = join(root, 'public/sprites/original')
mkdirSync(out, { recursive: true })

// Deliberate material ramps, with parchment and copper providing small focal points.
const palette = {
  o: '#172429', k: '#28292c', d: '#293f48', t: '#3e5d67', m: '#608183', l: '#91aaa0',
  c: '#817f72', p: '#b8b39f', h: '#e0d8bf', s: '#9b7359', f: '#c69b75', e: '#dfd7bc',
  b: '#3d3331', r: '#6c5141', n: '#987354', a: '#b78047', g: '#e5bd74',
  u: '#353d40', v: '#626e6c', w: '#8b9387',
}

function canvas(w, h) {
  const pixels = Array.from({ length: h }, () => Array(w).fill('.'))
  function point(x, y, color) {
    if (x >= 0 && y >= 0 && x < w && y < h) pixels[y][x] = color
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
    for (let y = Math.min(...ys); y <= Math.max(...ys); y++) {
      for (let x = Math.min(...xs); x <= Math.max(...xs); x++) {
        let inside = false
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const [xi, yi] = vertices[i], [xj, yj] = vertices[j]
          if ((yi > y + .5) !== (yj > y + .5) && x + .5 < (xj - xi) * (y + .5 - yi) / (yj - yi) + xi) inside = !inside
        }
        if (inside) point(x, y, color)
      }
    }
  }
  function row(x, y, colors) { for (let i = 0; i < colors.length; i++) if (colors[i] !== '.') point(x + i, y, colors[i]) }
  return { w, h, pixels, point, rect, line, polygon, row }
}

function boots(c, side, step) {
  // Fixed floor line at y=31. A lifted boot changes pose, never the root/ground anchor.
  const left = step === 0 ? 0 : step < 0 ? -1 : 1
  const right = -left
  if (side) {
    c.rect(10 + left, 23, 3, 6, 'o'); c.rect(11 + left, 24, 1, 4, 'v')
    c.rect(8 + right, 23, 3, 7, 'o'); c.rect(9 + right, 24, 1, 4, 'u')
    c.rect(7 + right, 28, 4, 3, 'b'); c.row(7 + right, 28, 'nrrb'); c.row(6 + right, 30, 'ouuoo')
    c.rect(9 + left, 27, 4, 3, 'b'); c.row(9 + left, 27, 'nrrb'); c.row(8 + left, 29, 'ouuoo')
  } else {
    c.rect(8 + left, 23, 3, 6, 'o'); c.rect(9 + left, 24, 1, 4, 'v')
    c.rect(13 + right, 23, 3, 6, 'o'); c.rect(14 + right, 24, 1, 4, 'u')
    c.rect(7 + left, 28, 4, 3, 'b'); c.row(7 + left, 28, 'nrrb'); c.row(7 + left, 30, 'owuo')
    c.rect(13 + right, 28, 4, 3, 'b'); c.row(13 + right, 28, 'nrrb'); c.row(13 + right, 30, 'ouuo')
  }
}

function front(step, attacking = false) {
  const c = canvas(24, 32)
  boots(c, false, step)
  c.polygon([[8, 11], [16, 11], [20, 15], [21, 23], [18, 27], [15, 25], [13, 27], [11, 25], [7, 27], [3, 24], [4, 16]], 'o')
  c.polygon([[7, 13], [16, 13], [19, 16], [19, 23], [17, 25], [13, 24], [11, 26], [8, 24], [5, 25], [5, 17]], 't')
  c.polygon([[15, 13], [18, 15], [19, 24], [17, 25], [14, 23], [13, 17]], 'd')
  c.polygon([[6, 15], [8, 14], [8, 23], [5, 25], [5, 18]], 'm')
  c.line(5, 18, 5, 22, 'l'); c.line(9, 18, 8, 24, 'm'); c.line(13, 21, 12, 25, 'm')
  c.point(6, 24, 'p'); c.point(9, 24, 'c'); c.point(16, 24, 'm'); c.point(18, 22, 'm')
  // Sleeves and warm hands separate from the cold cloak.
  c.rect(3, 17 + step, 3, 6, 'o'); c.rect(4, 17 + step, 2, 4, 'm'); c.row(4, 21 + step, 'cs'); c.row(4, 22 + step, 'sf')
  if (!attacking) {
    c.rect(18, 17 - step, 3, 6, 'o'); c.rect(18, 17 - step, 2, 4, 't'); c.row(18, 21 - step, 'sc'); c.row(18, 22 - step, 'fs')
  }
  // The map case and diagonal strap are the character's asymmetric signature.
  c.line(7, 13, 14, 23, 'b'); c.line(8, 13, 15, 23, 'r'); c.point(10, 16, 'n'); c.point(12, 19, 'a')
  c.rect(14, 20, 5, 5, 'b'); c.rect(15, 20, 3, 4, 'r'); c.row(15, 20, 'nna'); c.point(17, 22, 'a'); c.row(15, 24, 'ooo')
  c.rect(6, 16, 2, 5, 'c'); c.rect(6, 16, 1, 4, 'p'); c.point(7, 17, 'h'); c.point(7, 20, 'a')
  // Layered hood: no giant white outline; just a lit stitched rim.
  c.polygon([[11, 1], [14, 2], [17, 5], [18, 10], [20, 14], [16, 15], [13, 13], [9, 15], [5, 14], [6, 7], [8, 3]], 'o')
  c.polygon([[11, 2], [14, 3], [16, 5], [17, 11], [18, 13], [15, 14], [12, 12], [8, 14], [6, 13], [7, 7], [9, 4]], 't')
  c.polygon([[11, 3], [13, 3], [9, 7], [8, 12], [7, 13], [7, 8], [9, 5]], 'm')
  c.line(10, 4, 8, 7, 'l'); c.point(7, 10, 'l'); c.point(7, 12, 'c')
  c.polygon([[13, 4], [16, 6], [17, 12], [15, 13], [12, 10]], 'd')
  c.row(9, 6, 'okkkko'); c.row(9, 7, 'osfssk'); c.row(9, 8, 'oeofeo')
  c.row(9, 9, 'osffso'); c.row(10, 10, 'sffso'); c.row(10, 11, 'osso')
  c.point(10, 7, 'k'); c.point(11, 8, 's'); c.point(10, 9, 'f'); c.point(14, 8, 's')
  c.row(8, 11, 'cphpppc'); c.row(7, 12, 'cphhhpppc'); c.row(8, 13, 'cpppppcc'); c.row(9, 14, 'cphppcc')
  c.row(10, 15, 'cpccc'); c.row(11, 16, 'cpcc'); c.row(12, 17, 'ccc'); c.point(12, 18, 'p')
  c.row(8, 15, 'aga'); c.row(8, 16, 'rar'); c.point(9, 15, 'g')
  return c
}

function back(step, attacking = false) {
  const c = canvas(24, 32)
  boots(c, false, step)
  c.polygon([[8, 11], [16, 11], [20, 15], [21, 24], [17, 27], [14, 25], [12, 27], [10, 25], [6, 27], [3, 24], [4, 16]], 'o')
  c.polygon([[7, 13], [16, 13], [19, 16], [19, 24], [16, 25], [14, 24], [12, 26], [10, 24], [6, 25], [5, 23], [5, 17]], 't')
  c.polygon([[13, 14], [17, 14], [19, 24], [17, 25], [13, 23]], 'd')
  c.polygon([[7, 14], [10, 14], [8, 24], [6, 25], [6, 20]], 'm')
  c.line(5, 18, 5, 23, 'l'); c.line(10, 17, 9, 24, 'm'); c.line(13, 20, 12, 25, 'm')
  c.point(6, 24, 'p'); c.point(8, 25, 'c'); c.point(16, 24, 'm'); c.point(18, 22, 'm')
  c.rect(3, 17 + step, 3, 6, 'o'); c.rect(4, 17 + step, 2, 4, 'm'); c.row(4, 21 + step, 'cs'); c.row(4, 22 + step, 'sf')
  if (!attacking) {
    c.rect(18, 17 - step, 3, 6, 'o'); c.rect(18, 17 - step, 2, 4, 't'); c.row(18, 21 - step, 'sc'); c.row(18, 22 - step, 'fs')
  }
  // Rolled bedroll, leather shoulder harness and the same side map satchel.
  c.line(17, 12, 9, 22, 'b'); c.line(16, 12, 8, 22, 'r'); c.point(13, 16, 'n')
  c.rect(7, 16, 10, 5, 'o'); c.rect(8, 16, 8, 4, 'c'); c.row(8, 16, 'ppcppcpp')
  c.row(8, 18, 'cccccccc'); c.rect(9, 16, 1, 5, 'r'); c.rect(14, 16, 1, 5, 'r'); c.point(9, 18, 'a')
  c.rect(4, 20, 5, 5, 'b'); c.rect(5, 21, 3, 3, 'r'); c.row(5, 20, 'ann'); c.point(6, 22, 'a')
  c.polygon([[11, 1], [14, 2], [17, 5], [18, 10], [17, 13], [13, 16], [8, 14], [5, 11], [6, 7], [8, 3]], 'o')
  c.polygon([[11, 2], [14, 3], [16, 5], [17, 10], [16, 12], [12, 14], [8, 13], [6, 11], [7, 7], [9, 4]], 't')
  c.polygon([[11, 3], [13, 3], [10, 8], [9, 12], [7, 11], [8, 7]], 'm')
  c.polygon([[14, 4], [16, 6], [17, 10], [16, 12], [12, 14], [13, 9]], 'd')
  c.line(11, 3, 9, 6, 'l'); c.point(8, 8, 'l'); c.point(7, 10, 'c')
  c.line(12, 5, 11, 10, 'm'); c.point(11, 11, 'c'); c.row(10, 13, 'mctd')
  return c
}

function left(step, attacking = false) {
  const c = canvas(24, 32)
  boots(c, true, step)
  c.polygon([[9, 11], [15, 11], [18, 15], [20, 24], [17, 27], [14, 25], [11, 27], [7, 25], [6, 19], [7, 14]], 'o')
  c.polygon([[9, 13], [15, 13], [17, 16], [18, 24], [16, 25], [13, 24], [11, 26], [8, 24], [7, 18]], 't')
  c.polygon([[14, 14], [16, 15], [18, 24], [16, 25], [13, 23]], 'd')
  c.polygon([[9, 14], [12, 14], [10, 22], [9, 24], [8, 23], [8, 18]], 'm')
  c.line(9, 17, 8, 21, 'l'); c.line(12, 19, 11, 25, 'm'); c.point(17, 23, 'm'); c.point(9, 24, 'p')
  if (!attacking) {
    c.rect(7 - step, 16, 4, 7, 'o'); c.rect(8 - step, 16, 2, 5, 'm'); c.row(8 - step, 21, 'cs'); c.row(8 - step, 22, 'fs')
  }
  c.line(11, 12, 13, 22, 'b'); c.line(12, 12, 14, 22, 'r'); c.point(13, 18, 'a')
  c.rect(13, 19, 5, 6, 'b'); c.rect(14, 20, 3, 4, 'r'); c.row(14, 20, 'nna'); c.point(16, 22, 'a')
  c.rect(15, 14, 3, 5, 'c'); c.rect(16, 14, 1, 4, 'p'); c.point(16, 14, 'h')
  c.polygon([[12, 1], [16, 4], [18, 8], [18, 12], [16, 15], [12, 14], [9, 13], [7, 11], [6, 7], [8, 4]], 'o')
  c.polygon([[12, 2], [15, 4], [17, 8], [17, 12], [15, 14], [12, 13], [9, 12], [7, 10], [7, 7], [9, 4]], 't')
  c.polygon([[12, 3], [13, 4], [9, 7], [8, 10], [8, 7], [10, 4]], 'm')
  c.polygon([[14, 4], [16, 7], [17, 12], [15, 14], [13, 12]], 'd')
  c.point(11, 4, 'l'); c.point(9, 5, 'l'); c.point(8, 6, 'c')
  c.row(6, 7, 'oksskk'); c.row(5, 8, 'osfeko'); c.row(5, 9, 'sffsko'); c.row(6, 10, 'sfssko')
  c.row(6, 11, 'ocphcc'); c.row(7, 12, 'chhppc'); c.row(8, 13, 'chppcc'); c.row(8, 14, 'cppcc')
  c.row(9, 15, 'cpc'); c.row(9, 16, 'cc'); c.point(10, 17, 'p'); c.row(7, 14, 'ga'); c.point(7, 15, 'r')
  return c
}

function mirror(c) {
  const d = canvas(c.w, c.h)
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) d.point(c.w - x - 1, y, c.pixels[y][x])
  return d
}

function sprite(direction, step, attacking = false) {
  if (direction === 'down') return front(step, attacking)
  if (direction === 'up') return back(step, attacking)
  if (direction === 'left') return left(step, attacking)
  const c = mirror(left(-step, attacking))
  // The case stays on the anatomical left hip. From the opposite side only its
  // outer edge is visible; the exposed cloak has its own illuminated folds.
  c.rect(6, 19, 5, 6, 't'); c.rect(6, 22, 2, 3, 'd')
  c.line(10, 19, 11, 24, 'm'); c.point(7, 24, 'm'); c.rect(5, 20, 2, 4, 'b'); c.point(5, 20, 'n')
  return c
}

function paste(dst, src, x0, y0) {
  for (let y = 0; y < src.h; y++) for (let x = 0; x < src.w; x++) {
    if (src.pixels[y][x] !== '.') dst.point(x0 + x, y0 + y, src.pixels[y][x])
  }
}

function attack(direction, pose) {
  const c = canvas(32, 40)
  paste(c, sprite(direction, 0, true), 4, 8)
  // Generic shoulder/arm motion: attacks use the actual weapon/projectile FX;
  // a permanently painted sword would falsely depict unarmed/ranged loadouts.
  const reach = [0, 2, 5, 2][pose]
  if (direction === 'left' || direction === 'right') {
    const arm = canvas(32, 40)
    const points = [[11, 26], [10 - reach, 23 - (pose === 1 ? 2 : 0)], [8 - reach, 24], [9 - reach, 27], [12, 29]]
    arm.polygon(points, 'o'); arm.line(11, 26, 9 - reach, 25, 'm'); arm.line(11, 27, 9 - reach, 26, 't')
    arm.row(7 - reach, 24, 'ss'); arm.row(7 - reach, 25, 'ff'); arm.point(8 - reach, 26, 's')
    paste(c, direction === 'right' ? mirror(arm) : arm, 0, 0)
    return c
  }
  if (direction === 'down') {
    c.polygon([[22, 24], [24 + Math.min(reach, 2), 23], [26 + Math.min(reach, 2), 26 + reach], [23, 29 + reach], [20, 27]], 'o')
    c.line(22, 25, 24, 27 + reach, 't'); c.line(23, 25, 25, 27 + reach, 'm')
    c.row(23, 28 + reach, 'sfs'); c.row(23, 29 + reach, 'ss')
    if (pose === 2) { c.point(14, 27, 'p'); c.point(15, 28, 'c') }
  } else {
    c.polygon([[21, 25], [23, 21], [24, 20 - reach], [27, 20 - reach], [26, 24], [23, 28]], 'o')
    c.line(22, 25, 25, 21 - reach, 'm'); c.line(23, 25, 26, 21 - reach, 't')
    c.row(24, 19 - reach, 'sfs'); c.row(24, 20 - reach, 'ss')
  }
  return c
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
  const hdr = Buffer.alloc(13); hdr.writeUInt32BE(w); hdr.writeUInt32BE(h, 4); hdr[8] = 8; hdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
function svg(c) {
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${c.w}" height="${c.h}" viewBox="0 0 ${c.w} ${c.h}" shape-rendering="crispEdges"><title>ASHVEIL original ash-frontier wanderer</title>`]
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w;) {
    const color = c.pixels[y][x], start = x
    while (x < c.w && c.pixels[y][x] === color) x++
    if (color !== '.') parts.push(`<path fill="${palette[color]}" d="M${start} ${y}h${x - start}v1H${start}z"/>`)
  }
  parts.push('</svg>\n')
  return parts.join('')
}

const dirs = ['down', 'left', 'right', 'up']
const walk = canvas(72, 128), strike = canvas(128, 160)
const contact = canvas(144, 296)
for (let row = 0; row < dirs.length; row++) {
  for (let col = 0; col < 3; col++) {
    const s = sprite(dirs[row], col - 1)
    paste(walk, s, col * 24, row * 32)
    paste(contact, s, col * 36 + 6, row * 36 + 2)
  }
  for (let col = 0; col < 4; col++) {
    const s = attack(dirs[row], col)
    paste(strike, s, col * 32, row * 40)
    paste(contact, s, col * 36 + 2, 136 + row * 40)
  }
}
writeFileSync(join(out, 'ashveil-wanderer-walk.png'), png(walk))
writeFileSync(join(out, 'ashveil-wanderer-attack.png'), png(strike))
writeFileSync(join(out, 'ashveil-wanderer-walk.svg'), svg(walk))
writeFileSync(join(out, 'ashveil-wanderer-attack.svg'), svg(strike))
writeFileSync(join(out, 'ashveil-wanderer-contact.png'), png(contact, 4))
writeFileSync(join(out, 'ashveil-wanderer-palette.json'), JSON.stringify(palette, null, 2) + '\n')
if (process.argv.includes('--install')) {
  const manifestPath = join(root, 'src/client/sprites.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.sheets.hero = 'sprites/original/ashveil-wanderer-walk.png'
  manifest.sheets.hero_atk = 'sprites/original/ashveil-wanderer-attack.png'
  for (const [row, dir] of dirs.entries()) {
    for (let col = 0; col < 3; col++) manifest.frames[`hero_w_${dir}${col}`] = ['hero', col * 24, row * 32, 24, 32]
    for (let col = 0; col < 4; col++) manifest.frames[`hero_a_${dir}${col}`] = ['hero_atk', col * 32, row * 40, 32, 40]
  }
  Object.assign(manifest.chars.hero, { anchor: [.5, 31 / 32], attackAnchor: [.5, 39 / 40], renderScale: 1, headOffset: 30 })
  // Before metadata was read, these legacy attacks used the hardcoded .78.
  // Migrate only the two original entries, preserving their runtime positions.
  for (const name of ['reaver0', 'reaver1']) {
    const ch = manifest.chars[name]
    if (ch?.attackAnchor?.[1] === .72) ch.attackAnchor = [.5, .78]
  }
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + '\n')
}
console.log('Original wanderer art: 12 walk/idle poses, 16 attack poses; native PNG + editable SVG + 4× contact sheet.')
