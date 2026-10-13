// 지도 생성: 지상(수도원 앞뜰) + 지하 납골당 3층. 적은 정해진 장소(방·야영지)에 배치된다.

import { type World } from './ctx'
import type { Pos } from './geom'
import { Rng, seedState } from './rng'
import type { MapLight, MapProp, MapRoom, MapState, Tile } from './types'

export interface Spawn { def: string; pos: Pos; asleep?: boolean; home?: Pos; room?: number }
export interface GenResult { map: MapState; start: Pos; spawns: Spawn[] }

export const DUNGEON_DEPTH = 3

function blank(id: string, name: string, kind: MapState['kind'], depth: number, w: number, h: number, fill: string, ambient: number): MapState {
  const tiles: Tile[] = []
  for (let i = 0; i < w * h; i++) tiles.push({ t: fill, v: 0, roof: false, blood: 0, items: [] })
  return { id, name, kind, depth, ambient, w, h, tiles, exits: [], links: [], rooms: [], props: [], lights: [] }
}

class Builder {
  constructor(public m: MapState, public r: Rng) {}
  in(x: number, y: number) { return x >= 0 && y >= 0 && x < this.m.w && y < this.m.h }
  at(x: number, y: number) { return this.m.tiles[y * this.m.w + x] }
  set(x: number, y: number, t: string) { if (this.in(x, y)) { const tl = this.at(x, y); tl.t = t; tl.v = this.r.int(0, 15) } }
  get(x: number, y: number) { return this.in(x, y) ? this.at(x, y).t : '' }
  prop(p: MapProp) { this.m.props.push(p) }
  light(x: number, y: number, radius: number, kind: string) { this.m.lights.push({ pos: { x, y }, radius, kind } as MapLight) }
}

// ── 지상: 무너진 수도원 앞뜰 ─────────────────────────────

export function generateSurface(w: World): GenResult {
  const r = new Rng(seedState(w.s.seed, 'map:surface'))
  const W = 46, H = 36
  const m = blank('surface', '잿빛 수도원 앞뜰', 'surface', 0, W, H, 'Terrain.Earth', 0)
  const b = new Builder(m, r)
  const spawns: Spawn[] = []

  // 이끼·잔해 장식
  for (const t of m.tiles) if (r.chance(0.18)) t.deco = `moss_s${r.int(0, 11)}`

  // 수도원 폐허 (북쪽)
  const mx = 13, my = 2, mw = 20, mh = 10
  for (let y = my; y < my + mh; y++) for (let x = mx; x < mx + mw; x++) {
    const edge = x === mx || x === mx + mw - 1 || y === my || y === my + mh - 1
    const thick = y === my || y === my + 1
    if (edge || thick) b.set(x, y, r.chance(0.12) && !thick ? 'Terrain.Rubble' : 'Terrain.KtWall')
    else { b.set(x, y, 'Terrain.KtFloor'); b.at(x, y).roof = r.chance(0.5) }
  }
  const doorX = mx + Math.floor(mw / 2)
  b.set(doorX, my + mh - 1, 'Terrain.KtFloor'); b.set(doorX - 1, my + mh - 1, 'Terrain.KtFloor')
  const stairs = { x: doorX, y: my + 4 }
  b.set(stairs.x, stairs.y, 'Terrain.StairsDown')
  m.links.push({ pos: stairs, to: 'crypt1', toPos: { x: 0, y: 0 }, label: '납골당 1층' })
  // 석상과 화로
  b.prop({ kind: 'statue', x: mx + 2, y: my + 3, w: 3, h: 2, blocks: true })
  b.prop({ kind: 'statue', x: mx + mw - 5, y: my + 3, w: 3, h: 2, blocks: true })
  for (const [x, y] of [[mx + 2, my + 3], [mx + 3, my + 3], [mx + 4, my + 3], [mx + mw - 5, my + 3], [mx + mw - 4, my + 3], [mx + mw - 3, my + 3]]) b.set(x, y, 'Terrain.Statue')
  b.set(doorX - 3, my + 5, 'Terrain.Brazier'); b.light(doorX - 3, my + 5, 5, 'brazier')
  b.set(doorX + 3, my + 5, 'Terrain.Brazier'); b.light(doorX + 3, my + 5, 5, 'brazier')
  b.set(mx + 2, my + mh - 2, 'Terrain.Pot'); b.set(mx + mw - 3, my + mh - 2, 'Terrain.Pot')

  // 야영지 (남서) — 시작 지점
  const camp = { x: 9, y: 27 }
  b.set(camp.x, camp.y, 'Terrain.Campfire'); b.light(camp.x, camp.y, 6, 'campfire')
  b.set(camp.x - 2, camp.y + 2, 'Terrain.Crate')
  const start = { x: camp.x + 1, y: camp.y + 1 }

  // 웅덩이 (야영지 동쪽)
  for (let y = 29; y <= 31; y++) for (let x = 15; x <= 18; x++) if (r.chance(0.85)) b.set(x, y, 'Terrain.ShallowWater')

  // 약탈자 야영지 (동쪽)
  const bx = 33, by = 19
  for (let x = bx - 1; x <= bx + 9; x++) { if (r.chance(0.75)) b.set(x, by - 1, 'Terrain.RuinWall'); if (r.chance(0.75)) b.set(x, by + 8, 'Terrain.RuinWall') }
  for (let y = by - 1; y <= by + 8; y++) if (r.chance(0.7) && y !== by + 4 && y !== by + 3) b.set(bx + 9, y, 'Terrain.RuinWall')
  b.set(bx + 4, by + 3, 'Terrain.Campfire'); b.light(bx + 4, by + 3, 6, 'campfire')
  b.set(bx + 7, by + 1, 'Terrain.RedChest'); b.set(bx + 7, by + 6, 'Terrain.Crate'); b.set(bx + 1, by + 6, 'Terrain.Crate')
  const home = { x: bx + 4, y: by + 4 }
  m.rooms.push({ x: bx - 1, y: by - 1, w: 11, h: 10, type: 'camp', discovered: false, name: '약탈자 야영지' })
  m.rooms.push({ x: mx, y: my, w: mw, h: mh, type: 'ruin', discovered: false, name: '무너진 수도원' })
  const nearCamp = (x: number, y: number) => x >= bx - 4 && x <= bx + 12 && y >= by - 4 && y <= by + 11
  spawns.push({ def: 'Creature.ReaverChief', pos: { x: bx + 6, y: by + 2 }, home })
  spawns.push({ def: 'Creature.Reaver', pos: { x: bx + 3, y: by + 5 }, home, asleep: r.chance(0.5) })
  spawns.push({ def: 'Creature.Reaver', pos: { x: bx + 5, y: by + 5 }, home })
  spawns.push({ def: 'Creature.Reaver', pos: { x: bx + 2, y: by + 2 }, home, asleep: r.chance(0.5) })

  // 길: 야영지 → 수도원 입구, 갈래 → 약탈자 야영지, 남쪽 출구
  const path = (a: Pos, z: Pos) => {
    let x = a.x, y = a.y
    while (x !== z.x || y !== z.y) {
      if (b.get(x, y) === 'Terrain.Earth') b.set(x, y, 'Terrain.Path')
      if (x !== z.x && (y === z.y || r.chance(0.5))) x += Math.sign(z.x - x)
      else y += Math.sign(z.y - y)
    }
  }
  path({ x: camp.x + 1, y: camp.y - 1 }, { x: doorX, y: my + mh })
  path({ x: 20, y: 22 }, { x: bx - 2, y: by + 3 })
  path({ x: camp.x + 2, y: camp.y + 2 }, { x: 22, y: H - 1 })
  for (let x = 20; x <= 24; x++) if (b.get(x, H - 1) !== 'Terrain.Tree') { b.set(x, H - 1, 'Terrain.Path'); m.exits.push({ x, y: H - 1 }) }

  // 숲: 가장자리 + 군락
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y)
    if (b.get(x, y) !== 'Terrain.Earth') continue
    if (edge === 0 && r.chance(0.8)) b.set(x, y, 'Terrain.Tree')
    else if (edge === 1 && r.chance(0.35)) b.set(x, y, 'Terrain.Tree')
  }
  for (let k = 0; k < 9; k++) {
    let x = r.int(3, W - 4), y = r.int(12, H - 4)
    for (let i = 0; i < r.int(3, 7); i++) {
      if (b.get(x, y) === 'Terrain.Earth' && Math.abs(x - start.x) + Math.abs(y - start.y) > 4) b.set(x, y, r.chance(0.8) ? 'Terrain.Tree' : 'Terrain.Rock')
      x += r.int(-1, 1); y += r.int(-1, 1)
    }
  }
  for (let k = 0; k < 6; k++) {
    const x = r.int(2, W - 3), y = r.int(12, H - 3)
    if (b.get(x, y) === 'Terrain.Earth' && !nearCamp(x, y)) b.set(x, y, 'Terrain.Fungus')
  }
  for (let k = 0; k < 3; k++) {
    const x = r.int(4, W - 5), y = r.int(13, H - 5)
    if (b.get(x, y) === 'Terrain.Earth' && !nearCamp(x, y)) b.set(x, y, 'Terrain.Remains')
  }
  m.rooms.forEach((R, i) => { for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (b.in(x, y)) b.at(x, y).room = i })
  return { map: m, start, spawns }
}

/** 문·복도 입구에 붙은 막는 물체(상자·화로 등)를 치운다. 진행 불가 맵 방지 */
export function unblockDoorways(w: World, b: Builder) {
  const m = b.m
  const isDoorway = (x: number, y: number) => {
    if (!b.in(x, y)) return false
    const t = w.db.terrain(b.get(x, y))
    return !!t.door || (t.passable !== false && b.at(x, y).room === undefined && !t.wall)
  }
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    const tl = b.at(x, y)
    if (tl.room === undefined) continue
    const t = w.db.terrain(tl.t)
    if (t.passable !== false || t.wall || t.door || t.id === 'Terrain.Statue' || t.id === 'Terrain.SarcoBlock') continue
    if (![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isDoorway(x + dx, y + dy))) continue
    b.set(x, y, tl.taint ? 'Terrain.CdFloor' : 'Terrain.KtFloor')
    m.lights = m.lights.filter((L) => L.pos.x !== x || L.pos.y !== y)
  }
}

// ── 지하: BSP 방 + 복도 ─────────────────────────────────

const ROOM_NAMES: Record<string, string> = {
  entry: '내려온 계단참', guard: '경비실', storage: '저장고', cell: '감방', library: '서고', shrine: '성소', ossuary: '납골실',
  tainted: '오염된 방', boss: '맥동하는 성소', treasure: '봉인된 보물실',
}

interface Leaf { x: number; y: number; w: number; h: number; a?: Leaf; b?: Leaf; room?: MapRoom }

export function generateDungeon(w: World, depth: number): GenResult {
  const id = `crypt${depth}`
  const r = new Rng(seedState(w.s.seed, 'map:' + id))
  const W = 48, H = 38
  const names = ['납골당 1층 — 회랑', '납골당 2층 — 뼈의 방', '납골당 3층 — 오염된 성소']
  const m = blank(id, names[depth - 1] ?? `납골당 ${depth}층`, 'dungeon', depth, W, H, 'Terrain.KtWall', 0.04)
  const b = new Builder(m, r)
  const spawns: Spawn[] = []

  // BSP
  const root: Leaf = { x: 1, y: 2, w: W - 2, h: H - 3 }
  const split = (L: Leaf, d: number) => {
    if (d > 4 || (L.w < 16 && L.h < 14)) return
    const vertical = L.w > L.h * 1.2 ? true : L.h > L.w * 1.2 ? false : r.chance(0.5)
    if (vertical && L.w >= 16) {
      const cut = r.int(8, L.w - 8)
      L.a = { x: L.x, y: L.y, w: cut, h: L.h }; L.b = { x: L.x + cut, y: L.y, w: L.w - cut, h: L.h }
    } else if (!vertical && L.h >= 14) {
      const cut = r.int(7, L.h - 7)
      L.a = { x: L.x, y: L.y, w: L.w, h: cut }; L.b = { x: L.x, y: L.y + cut, w: L.w, h: L.h - cut }
    } else return
    split(L.a, d + 1); split(L.b, d + 1)
  }
  split(root, 0)
  const leaves: Leaf[] = []
  const collect = (L: Leaf) => { if (L.a && L.b) { collect(L.a); collect(L.b) } else leaves.push(L) }
  collect(root)
  for (const L of leaves) {
    const rw = r.int(5, Math.min(12, L.w - 3)), rh = r.int(4, Math.min(8, L.h - 4))
    const rx = L.x + r.int(1, Math.max(1, L.w - rw - 2)), ry = L.y + r.int(2, Math.max(2, L.h - rh - 1))
    L.room = { x: rx, y: ry, w: rw, h: rh, type: 'guard', discovered: false, name: '' }
    for (let y = ry; y < ry + rh; y++) for (let x = rx; x < rx + rw; x++) b.set(x, y, 'Terrain.KtFloor')
  }
  const rooms = leaves.map((L) => L.room!)
  const center = (R: MapRoom) => ({ x: R.x + Math.floor(R.w / 2), y: R.y + Math.floor(R.h / 2) })
  const roomOf = (L: Leaf): MapRoom => L.room ?? roomOf(r.chance(0.5) ? L.a! : L.b!)
  const carve = (a: Pos, z: Pos) => {
    let x = a.x, y = a.y
    const horizFirst = r.chance(0.5)
    const step = (tx: number, ty: number) => {
      while (x !== tx) { x += Math.sign(tx - x); if (b.get(x, y) === 'Terrain.KtWall') b.set(x, y, 'Terrain.KtFloor') }
      while (y !== ty) { y += Math.sign(ty - y); if (b.get(x, y) === 'Terrain.KtWall') b.set(x, y, 'Terrain.KtFloor') }
    }
    if (horizFirst) { step(z.x, y); step(z.x, z.y) } else { step(x, z.y); step(z.x, z.y) }
  }
  const connect = (L: Leaf) => {
    if (!L.a || !L.b) return
    connect(L.a); connect(L.b)
    carve(center(roomOf(L.a)), center(roomOf(L.b)))
  }
  connect(root)
  // 고리 하나 추가 (막다른 길만 있지 않게)
  if (rooms.length > 4) carve(center(rooms[0]), center(rooms[rooms.length - 1 - r.int(0, 1)]))

  // 문: 방 경계에서 복도가 들어오는 자리
  rooms.forEach((R, ri) => {
    for (let x = R.x - 1; x <= R.x + R.w; x++) for (const y of [R.y - 1, R.y + R.h]) {
      if (b.get(x, y) !== 'Terrain.KtFloor') continue
      const walls = (b.get(x - 1, y) === 'Terrain.KtWall' ? 1 : 0) + (b.get(x + 1, y) === 'Terrain.KtWall' ? 1 : 0)
      if (walls === 2 && r.chance(0.55)) b.set(x, y, 'Terrain.DoorClosed')
    }
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) b.at(x, y).room = ri
  })

  // 방 유형: 첫 방 = 입구, 가장 먼 방 = 계단/보스
  const first = rooms[0]
  const c0 = center(first)
  let far = rooms[0], fd = -1
  for (const R of rooms) { const c = center(R); const d = Math.abs(c.x - c0.x) + Math.abs(c.y - c0.y); if (d > fd) { fd = d; far = R } }
  const pool = depth === 1 ? ['guard', 'storage', 'cell', 'library', 'shrine', 'ossuary', 'storage']
    : depth === 2 ? ['ossuary', 'ossuary', 'cell', 'library', 'shrine', 'guard', 'storage']
      : ['tainted', 'ossuary', 'tainted', 'shrine', 'cell', 'library']
  for (const R of rooms) R.type = r.pick(pool)
  first.type = 'entry'
  far.type = depth === DUNGEON_DEPTH ? 'boss' : 'guard'
  const others = rooms.filter((R) => R !== first && R !== far)
  if (others.length) r.pick(others).type = 'treasure'
  for (const R of rooms) R.name = ROOM_NAMES[R.type] ?? R.type
  m.rooms = rooms

  // 계단
  const up = { x: first.x + 1, y: first.y + 1 }
  b.set(up.x, up.y, 'Terrain.StairsUp')
  m.links.push({ pos: up, to: depth === 1 ? 'surface' : `crypt${depth - 1}`, toPos: { x: 0, y: 0 }, label: depth === 1 ? '지상' : `납골당 ${depth - 1}층` })
  if (depth < DUNGEON_DEPTH) {
    const dn = { x: far.x + far.w - 2, y: far.y + far.h - 2 }
    b.set(dn.x, dn.y, 'Terrain.StairsDown')
    m.links.push({ pos: dn, to: `crypt${depth + 1}`, toPos: { x: 0, y: 0 }, label: `납골당 ${depth + 1}층` })
  }

  // 방 꾸미기 + 적 배치
  const freeTiles = (R: MapRoom) => {
    const out: Pos[] = []
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (b.get(x, y) === 'Terrain.KtFloor' || b.get(x, y) === 'Terrain.CdFloor') out.push({ x, y })
    return out
  }
  const wallSide = (R: MapRoom) => {
    const out: Pos[] = []
    for (let x = R.x; x < R.x + R.w; x++) { out.push({ x, y: R.y }); out.push({ x, y: R.y + R.h - 1 }) }
    return out.filter((p) => b.get(p.x, p.y) === 'Terrain.KtFloor')
  }
  const place = (R: MapRoom, def: string, asleepBias = 0) => {
    const free = freeTiles(R).filter((p) => !spawns.some((s) => s.pos.x === p.x && s.pos.y === p.y))
    if (!free.length) return
    const cdef = w.db.creature(def)
    spawns.push({ def, pos: r.pick(free), asleep: r.chance(Math.min(1, (cdef.sleepChance ?? 0) + asleepBias)), home: center(R), room: rooms.indexOf(R) })
  }

  for (const R of rooms) {
    const area = R.w * R.h
    switch (R.type) {
      case 'entry':
        if (depth === 1) b.set(R.x + R.w - 2, R.y + 1, 'Terrain.Pot')
        break
      case 'guard':
        b.set(R.x, R.y, 'Terrain.Brazier'); b.light(R.x, R.y, 4, 'torch')
        break
      case 'storage':
        for (const p of r.shuffle(wallSide(R)).slice(0, r.int(2, 4))) b.set(p.x, p.y, r.chance(0.6) ? 'Terrain.Crate' : 'Terrain.Pot')
        break
      case 'cell':
        for (let x = R.x + 1; x < R.x + R.w - 1; x += 3) b.prop({ kind: 'chain0', x, y: R.y - 1, w: 1, h: 1 })
        b.set(R.x + 1, R.y + R.h - 1, 'Terrain.Remains')
        break
      case 'library':
        for (let x = R.x; x < R.x + R.w; x++) if (b.get(x, R.y - 1) === 'Terrain.KtWall') b.set(x, R.y - 1, 'Terrain.Shelf')
        for (const p of r.shuffle(freeTiles(R)).slice(0, 2)) b.at(p.x, p.y).deco = r.chance(0.5) ? 'books0' : 'books1'
        break
      case 'shrine': {
        const sx = R.x + Math.floor(R.w / 2) - 1
        // 석상 자리 둘레가 문·복도에 닿으면 놓지 않는다 (진행 막힘 방지)
        const doorway = (x: number, y: number) => {
          const t = b.get(x, y)
          return t === 'Terrain.DoorClosed' || (t === 'Terrain.KtFloor' && b.at(x, y).room === undefined)
        }
        let clear = true
        for (let x = sx - 1; x <= sx + 3; x++) for (let y = R.y - 1; y <= R.y + 2; y++) if (b.in(x, y) && doorway(x, y)) clear = false
        if (R.w >= 5 && R.h >= 4 && clear) {
          b.prop({ kind: 'statue', x: sx, y: R.y, w: 3, h: 2, blocks: true })
          for (let x = sx; x < sx + 3; x++) for (let y = R.y; y < R.y + 2; y++) b.set(x, y, 'Terrain.Statue')
        }
        b.set(R.x, R.y + R.h - 1, 'Terrain.Brazier'); b.light(R.x, R.y + R.h - 1, 5, 'brazier')
        b.set(R.x + R.w - 1, R.y + R.h - 1, 'Terrain.Brazier'); b.light(R.x + R.w - 1, R.y + R.h - 1, 5, 'brazier')
        break
      }
      case 'ossuary':
        for (const p of r.shuffle(wallSide(R)).slice(0, r.int(3, 6))) b.set(p.x, p.y, 'Terrain.Pot')
        if (R.w >= 7 && R.h >= 6) {
          // 석관: 5×3 칸을 차지하고 앞면 가운데에서 연다
          const x0 = R.x + Math.floor(R.w / 2) - 2, y0 = R.y + Math.floor(R.h / 2) - 1
          for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 5; x++) b.set(x, y, 'Terrain.SarcoBlock')
          b.set(x0 + 2, y0 + 2, 'Terrain.Sarcophagus')
          b.prop({ kind: 'sarcophagus', x: x0, y: y0, w: 5, h: 3, blocks: true })
        }
        for (const p of r.shuffle(freeTiles(R)).slice(0, 2)) b.set(p.x, p.y, 'Terrain.Remains')
        break
      case 'treasure':
        b.set(R.x + Math.floor(R.w / 2), R.y, 'Terrain.RedChest')
        b.set(R.x, R.y, 'Terrain.Brazier'); b.light(R.x, R.y, 3, 'torch')
        break
      case 'tainted':
      case 'boss':
        for (let y = R.y - 1; y <= R.y + R.h; y++) for (let x = R.x - 1; x <= R.x + R.w; x++) {
          if (b.get(x, y) === 'Terrain.KtFloor') { b.set(x, y, 'Terrain.CdFloor'); b.at(x, y).taint = 1 }
        }
        for (let k = 0; k < Math.max(1, Math.floor(area / 18)); k++) {
          const p = r.pick(wallSide(R).length ? wallSide(R) : freeTiles(R))
          if (p) b.prop({ kind: r.chance(0.5) ? 'cd_veina1' : 'cd_littleeyes', x: p.x, y: p.y, w: 1, h: 1, anim: 'y' })
        }
        if (R.type === 'boss') { b.light(R.x + Math.floor(R.w / 2), R.y + 1, 5, 'taint') }
        break
    }
    // 적
    if (R.type === 'entry') continue
    // 방의 약 40%는 비어 있다. 나머지는 1~3, 보물실 +1 (층당 대략 10~16)
    const empty = R.type !== 'treasure' && R.type !== 'guard' && r.chance(0.4)
    const n = R.type === 'boss' || empty ? 0 : Math.min(3, 1 + Math.floor(area / 36) + (depth >= 3 ? 1 : 0)) + (R.type === 'treasure' ? 1 : 0)
    for (let i = 0; i < n; i++) {
      const roll = r.float()
      let def: string
      if (depth === 1) def = roll < 0.6 ? 'Creature.Shade' : roll < 0.8 ? 'Creature.SporeMan' : 'Creature.Withered'
      else if (depth === 2) def = roll < 0.35 ? 'Creature.Shade' : roll < 0.75 ? 'Creature.Withered' : roll < 0.9 ? 'Creature.SporeMan' : 'Creature.WitheredPriest'
      else def = roll < 0.45 ? 'Creature.Withered' : roll < 0.75 ? 'Creature.SporeMan' : roll < 0.9 ? 'Creature.WitheredPriest' : 'Creature.ShadeChief'
      if (R.type === 'ossuary' && r.chance(0.5)) def = 'Creature.Withered'
      if (R.type === 'treasure' && i === 0) def = depth === 1 ? 'Creature.ShadeChief' : 'Creature.WitheredPriest'
      place(R, def, R.type === 'ossuary' ? 0.2 : 0)
    }
    if (R.type === 'boss') {
      const c = center(R)
      spawns.push({ def: 'Creature.Amalgam', pos: c, asleep: true, home: c, room: rooms.indexOf(R) })
    }
  }
  // 복도의 해골 장식 (통로를 막지 않게 바닥 장식만)
  for (let k = 0; k < 8; k++) {
    const x = r.int(1, W - 2), y = r.int(1, H - 2)
    if (b.get(x, y) === 'Terrain.KtFloor' && b.at(x, y).room === undefined) b.at(x, y).deco = 'skull'
  }
  unblockDoorways(w, b)
  // 바닥 이끼
  for (const t of m.tiles) if (t.t === 'Terrain.KtFloor' && r.chance(0.12)) t.deco = `moss_s${r.int(0, 11)}`
  return { map: m, start: { x: up.x + 1, y: up.y }, spawns }
}
