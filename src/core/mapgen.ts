import {plantPines} from './pines'
import {applyScriptMapGen,type ScriptMapGenOptions} from './script-mapgen'
// 지도 생성 (14 §2~§7): 지상(수도원 앞뜰 64×48, 구역 4) + 지하 3층(회랑·납골당·오염된 성소).
// 적은 정해진 장소(방·야영지)에만 배치된다. 생성은 층마다 한 번이고 이후 변화는 상태로 저장된다.

import { clock, turnOf, type World } from './ctx'
import type { Pos } from './geom'
import { Rng, seedState } from './rng'
import type { MapLight, MapProp, MapRoom, MapState, Tile, WorldGenDef } from './types'

export interface Spawn { settlementResident?:boolean; def: string; pos: Pos; asleep?: boolean; deep?: boolean; home?: Pos; room?: number }
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
  rect(x0: number, y0: number, w: number, h: number, t: string) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, t) }
  /** a→z 를 가로·세로로 꺾어 잇는다. 지정한 지형만 덮어쓴다 */
  path(a: Pos, z: Pos, t: string, over: string[]) {
    let x = a.x, y = a.y
    while (x !== z.x || y !== z.y) {
      if (over.includes(this.get(x, y))) this.set(x, y, t)
      if (x !== z.x && (y === z.y || this.r.chance(0.5))) x += Math.sign(z.x - x)
      else y += Math.sign(z.y - y)
    }
    if (over.includes(this.get(x, y))) this.set(x, y, t)
  }
}

// ── 지상: 잿빛 수도원 앞뜰 (14 §3.2) ─────────────────────

export function generateSurface(w:World,options:ScriptMapGenOptions={}):GenResult{
  const target=options.scriptPreview?{db:w.db,s:{...w.s,rng:structuredClone(w.s.rng)}}:w
  const gen=generateSurfaceCore(target),config=w.db.all<WorldGenDef>('WorldGen')[0]
  return config?applyScriptMapGen(target,{id:config.id+'.surface',genWorker:config.mapWorkers?.surface},gen,options):gen
}
function generateSurfaceCore(w: World): GenResult {
  const r = new Rng(seedState(w.s.seed, 'map:surface'))
  const W = 64, H = 48
  const m = blank('surface', '잿빛 수도원 앞뜰', 'surface', 0, W, H, 'Terrain.Earth', 0)
  const b = new Builder(m, r)
  const spawns: Spawn[] = []
  for (const t of m.tiles) if (r.chance(0.16)) t.deco = `moss_s${r.int(0, 11)}`

  // 수도원 입구 (북쪽 중앙 16×10): 무너진 정문, 종탑 잔해, 마당, 1층 계단
  const mx = 24, my = 1, mw = 16, mh = 10
  for (let y = my; y < my + mh; y++) for (let x = mx; x < mx + mw; x++) {
    const edge = x === mx || x === mx + mw - 1 || y === my || y === my + mh - 1
    const thick = y === my || y === my + 1
    if (edge || thick) b.set(x, y, r.chance(0.14) && !thick ? 'Terrain.Rubble' : 'Terrain.KtWall')
    else { b.set(x, y, 'Terrain.KtFloor'); b.at(x, y).roof = r.chance(0.4) }
  }
  const gateX = mx + Math.floor(mw / 2)
  for (const dx of [-2, -1, 0, 1]) b.set(gateX + dx, my + mh - 1, 'Terrain.Rubble') // 무너진 정문
  const stairs = { x: gateX, y: my + 4 }
  b.set(stairs.x, stairs.y, 'Terrain.StairsDown')
  m.links.push({ pos: stairs, to: 'crypt1', toPos: { x: 0, y: 0 }, label: '회랑 (지하 1층)' })
  b.prop({ kind: 'statue', x: mx + 2, y: my + 3, w: 3, h: 2, blocks: true })
  for (const [x, y] of [[mx + 2, my + 3], [mx + 3, my + 3], [mx + 4, my + 3], [mx + 2, my + 4], [mx + 3, my + 4], [mx + 4, my + 4]]) b.set(x, y, 'Terrain.Statue')
  // 종탑 잔해 (동쪽 안쪽)
  b.set(mx + mw - 3, my + 3, 'Terrain.Column'); b.set(mx + mw - 4, my + 4, 'Terrain.Rubble'); b.set(mx + mw - 3, my + 5, 'Terrain.Rubble')
  b.set(gateX - 3, my + 6, 'Terrain.Brazier'); b.light(gateX - 3, my + 6, 5, 'brazier')
  b.set(gateX + 3, my + 6, 'Terrain.Brazier'); b.light(gateX + 3, my + 6, 5, 'brazier')
  b.set(mx + 1, my + mh - 2, 'Terrain.Pot'); b.set(mx + mw - 2, my + mh - 2, 'Terrain.Pot')
  m.rooms.push({ x: mx, y: my, w: mw, h: mh, type: 'ruin', discovered: false, name: '수도원 입구' })
  const monasteryWp = { x: gateX, y: my + mh + 1 }

  // 약탈자 야영지 (북동 14×10): 천막 3, 모닥불, 망루, 약탈물 상자 2, 약탈자 6명
  const bx = 47, by = 5, bw = 14, bh = 10
  for (let x = bx - 1; x <= bx + bw; x++) { if (r.chance(0.7)) b.set(x, by - 1, 'Terrain.RuinWall'); if (r.chance(0.7)) b.set(x, by + bh, 'Terrain.RuinWall') }
  for (let y = by - 1; y <= by + bh; y++) { if (r.chance(0.7) && Math.abs(y - (by + 5)) > 1) b.set(bx - 1, y, 'Terrain.RuinWall'); if (r.chance(0.7)) b.set(bx + bw, y, 'Terrain.RuinWall') }
  for (const [tx, ty] of [[bx + 1, by + 1], [bx + 6, by + 1], [bx + 10, by + 6]]) { b.rect(tx, ty, 3, 2, 'Terrain.RuinWall') } // 천막
  const fire = { x: bx + 6, y: by + 5 }
  b.set(fire.x, fire.y, 'Terrain.Campfire'); b.light(fire.x, fire.y, 6, 'campfire')
  b.set(bx + 12, by + 1, 'Terrain.Column') // 망루
  b.set(bx + 2, by + 7, 'Terrain.CampChest'); b.set(bx + 4, by + 8, 'Terrain.CampChest')
  // 출입구를 비워 둔 낮은 목책: 사격 전 엄폐 30.
  for (const y of [by + 3, by + 7]) b.set(bx - 1, y, 'Terrain.Barricade')
  const home = { x: fire.x, y: fire.y + 1 }
  const campRoom = m.rooms.length
  m.rooms.push({ x: bx - 1, y: by - 1, w: bw + 2, h: bh + 2, type: 'camp', discovered: false, name: '약탈자 야영지' })
  const camp = (def: string, x: number, y: number, asleep = false) => spawns.push({ def, pos: { x, y }, home, room: campRoom, asleep })
  camp('Creature.ReaverChief', fire.x + 1, fire.y - 1)
  camp('Creature.ReaverArcher', bx + 11, by + 2)
  camp('Creature.Reaver', fire.x - 2, fire.y + 1, r.chance(0.4))
  camp('Creature.Reaver', fire.x + 2, fire.y + 2)
  camp('Creature.Reaver', bx + 3, by + 4, r.chance(0.4))
  camp('Creature.Reaver', bx + 9, by + 7)
  const reaverWp = { x: bx - 2, y: by + 5 }

  // 야영지 (남서 10×8, 시작): 모닥불, 야영지 보관함 12×8
  const cx = 4, cy = 38
  const campfire = { x: cx + 4, y: cy + 3 }
  b.set(campfire.x, campfire.y, 'Terrain.Campfire'); b.light(campfire.x, campfire.y, 6, 'campfire')
  b.set(cx + 2, cy + 5, 'Terrain.Stash')
  m.rooms.push({ x: cx, y: cy, w: 10, h: 8, type: 'camp-home', discovered: true, name: '야영지' })
  const start = { x: campfire.x + 1, y: campfire.y + 1 }

  // 숲 개울 (중앙·서쪽): 북쪽에서 남쪽으로 굽이치는 얕은 물. 물 보급
  let sx = 20
  for (let y = 14; y < H - 1; y++) {
    sx = Math.max(12, Math.min(30, sx + r.int(-1, 1)))
    b.set(sx, y, 'Terrain.ShallowWater')
    if (r.chance(0.55)) b.set(sx + 1, y, 'Terrain.ShallowWater')
  }
  const streamY = 26
  let streamX = 0
  for (let x = 0; x < W; x++) if (b.get(x, streamY) === 'Terrain.ShallowWater') { streamX = x; break }
  const streamWp = { x: streamX + 3, y: streamY }

  // 길: 야영지 → 수도원 입구, 야영지 → 약탈자 야영지, 약탈자 야영지 → 개울 → 수도원 (14 §3.2 경로)
  const land = ['Terrain.Earth']
  b.path({ x: campfire.x, y: campfire.y - 1 }, monasteryWp, 'Terrain.Path', land)
  b.path({ x: campfire.x + 1, y: campfire.y }, { x: reaverWp.x, y: reaverWp.y + 1 }, 'Terrain.Path', land)
  b.path(reaverWp, streamWp, 'Terrain.Path', land)
  b.path(streamWp, monasteryWp, 'Terrain.Path', land)
  // 남쪽 옛 수레길 (지역 출입구 — 떠나기)
  b.path({ x: campfire.x + 2, y: campfire.y + 1 }, { x: 34, y: H - 1 }, 'Terrain.Path', land)
  for (let x = 32; x <= 36; x++) if (b.get(x, H - 1) === 'Terrain.Earth' || b.get(x, H - 1) === 'Terrain.Path') { b.set(x, H - 1, 'Terrain.Path'); m.exits.push({ x, y: H - 1 }) }

  // 숲: 가장자리 + 중앙·서쪽 군락 (구역 앵커 근처는 비운다)
  const nearAnchor = (x: number, y: number) =>
    (x >= bx - 4 && x <= bx + bw + 3 && y >= by - 4 && y <= by + bh + 3) || (x >= mx - 2 && x <= mx + mw + 1 && y <= my + mh + 2) ||
    (x >= cx - 2 && x <= cx + 12 && y >= cy - 2) || Math.abs(x - start.x) + Math.abs(y - start.y) < 5
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (b.get(x, y) !== 'Terrain.Earth') continue
    const edge = Math.min(x, y, W - 1 - x, H - 1 - y)
    if (edge === 0 && r.chance(0.85)) b.set(x, y, 'Terrain.Tree')
    else if (edge === 1 && r.chance(0.4)) b.set(x, y, 'Terrain.Tree')
  }
  for (let k = 0; k < 22; k++) {
    let x = r.int(3, 34), y = r.int(14, H - 6)
    for (let i = 0; i < r.int(4, 9); i++) {
      if (b.get(x, y) === 'Terrain.Earth' && !nearAnchor(x, y)) b.set(x, y, r.chance(0.82) ? 'Terrain.Tree' : 'Terrain.Rock')
      x += r.int(-1, 1); y += r.int(-1, 1)
    }
  }
  for (let k = 0; k < 6; k++) {
    let x = r.int(36, W - 4), y = r.int(20, H - 4)
    for (let i = 0; i < r.int(2, 5); i++) {
      if (b.get(x, y) === 'Terrain.Earth' && !nearAnchor(x, y)) b.set(x, y, 'Terrain.Tree')
      x += r.int(-1, 1); y += r.int(-1, 1)
    }
  }
  for (let k = 0; k < 9; k++) {
    const x = r.int(3, 40), y = r.int(14, H - 3)
    if (b.get(x, y) === 'Terrain.Earth' && !nearAnchor(x, y)) b.set(x, y, 'Terrain.Fungus')
  }
  for (let k = 0; k < 4; k++) {
    const x = r.int(4, W - 5), y = r.int(14, H - 5)
    if (b.get(x, y) === 'Terrain.Earth' && !nearAnchor(x, y)) b.set(x, y, 'Terrain.Remains')
  }
  m.waypoints = { reaverCamp: reaverWp, stream: streamWp, monastery: monasteryWp, homeFire: campfire, homeStash: { x: cx + 2, y: cy + 5 } }
  // 개울 가장자리의 진흙. 기존 길과 장소 앵커는 보존한다.
  for (let y = 14; y < H - 2; y++) for (let x = 1; x < W - 1; x++) {
    if (b.get(x, y) === 'Terrain.Earth' && !nearAnchor(x, y) && (b.get(x - 1, y) === 'Terrain.ShallowWater' || b.get(x + 1, y) === 'Terrain.ShallowWater')) b.set(x, y, 'Terrain.Mud')
  }
  m.rooms.forEach((R, i) => { for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (b.in(x, y)) b.at(x, y).room = i })
  plantPines(w,m,'world.botany.monastery')
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
    b.set(x, y, m.depth >= 3 ? 'Terrain.CdFloor' : 'Terrain.KtFloor')
    m.lights = m.lights.filter((L) => L.pos.x !== x || L.pos.y !== y)
  }
}

// ── 지하 (14 §3.3 · §4 · §5) ───────────────────────────

export type RoomType = 'guard' | 'ossuary' | 'library' | 'shrine' | 'storage' | 'cell' | 'empty' | 'boss'

const ROOM_NAMES: Record<RoomType, string> = {
  guard: '경비실', ossuary: '납골실', library: '서고', shrine: '성소', storage: '창고', cell: '감방', empty: '빈 방', boss: '대성소',
}
/** 방 크기 범위 [최소 w, 최소 h, 최대 w, 최대 h] (14 §4) */
const ROOM_SIZE: Record<RoomType, [number, number, number, number]> = {
  guard: [5, 5, 7, 6], ossuary: [6, 6, 9, 7], library: [5, 6, 8, 6], shrine: [7, 7, 11, 9], storage: [4, 4, 6, 5],
  cell: [7, 3, 11, 3], empty: [4, 4, 7, 6], boss: [13, 11, 13, 11],
}
/** 방 유형별 잠듦 확률 (14 §4) */
export const ROOM_SLEEP: Record<RoomType, number> = { guard: 0.1, ossuary: 0.5, library: 0.4, shrine: 0.2, storage: 0.3, cell: 0.6, empty: 0.3, boss: 0 }

const FLOOR_NAMES = ['회랑', '납골당', '오염된 성소']
const FLOOR_SIZE: [number, number][] = [[48, 36], [48, 36], [40, 32]]

/** 층별 방 구성 (14 §4.1) */
function floorPlan(depth: number, r: Rng): RoomType[] {
  const rep = (t: RoomType, n: number) => new Array(n).fill(t) as RoomType[]
  if (depth === 1) return [...rep('shrine', 1), ...rep('guard', 2), ...rep('library', 2), ...rep('storage', 2), ...rep('cell', r.int(1, 2)), ...rep('empty', r.int(1, 2))]
  if (depth === 2) return [...rep('ossuary', r.int(4, 5)), ...rep('shrine', 1), ...rep('guard', 1), ...rep('library', 1), ...rep('storage', 1), ...rep('cell', 1), ...rep('empty', r.int(1, 2))]
  return ['boss', ...rep('shrine', 1), ...rep('ossuary', 2), ...rep('storage', 1), ...rep('cell', 1), ...rep('empty', r.int(0, 1))]
}

/** 방별 거주 편성 (14 §4.2): [종, 최소, 최대] 목록 */
function population(depth: number, type: RoomType, r: Rng): string[] {
  const n = (min: number, max: number) => r.int(min, max)
  const many = (def: string, k: number) => new Array(k).fill(def) as string[]
  if (depth === 1) {
    if (type === 'guard') { const k = n(2, 3); return ['Creature.ShadeChief', ...many('Creature.Shade', k - 1)] }
    if (type === 'cell') return many('Creature.Shade', n(1, 2))
    if (type === 'library') return many('Creature.SporeMan', n(0, 1))
    if (type === 'shrine') return many('Creature.SporeMan', n(1, 2))
    if (type === 'storage') return many('Creature.Shade', n(0, 1))
    return []
  }
  if (depth === 2) {
    if (type === 'ossuary') return many('Creature.Withered', n(1, 2))
    if (type === 'guard') return many('Creature.Shade', n(2, 3))
    if (type === 'cell') return ['Creature.Withered', ...(r.chance(0.5) ? ['Creature.Shade'] : [])]
    if (type === 'shrine') return ['Creature.WitheredPriest', ...many('Creature.Withered', n(0, 1))]
    return []
  }
  if (type === 'ossuary') return [...many('Creature.Withered', n(1, 2)), ...many('Creature.SporeMan', n(0, 1))]
  if (type === 'shrine') return many('Creature.SporeMan', n(1, 2))
  if (type === 'boss') return ['Creature.Amalgam']
  return []
}

/** 잠듦 확률 = 방 유형 + 종 보정 + 시간대 보정 (14 §7.1) */
export function sleepChance(w: World, type: RoomType, def: string): number {
  let p = ROOM_SLEEP[type]
  if (def === 'Creature.SporeMan') p += 0.3
  if (def === 'Creature.Amalgam') return 0
  if (def === 'Creature.Shade' || def === 'Creature.ShadeChief') {
    const h = clock(turnOf(w)).hour
    if (h >= 8 && h < 18) p += 0.2
  }
  return Math.max(0, Math.min(1, p))
}

export function generateDungeon(w:World,depth:number,options:ScriptMapGenOptions={}):GenResult{
  const target=options.scriptPreview?{db:w.db,s:{...w.s,rng:structuredClone(w.s.rng)}}:w
  const gen=generateDungeonCore(target,depth),config=w.db.all<WorldGenDef>('WorldGen')[0]
  return config?applyScriptMapGen(target,{id:config.id+'.'+gen.map.id,genWorker:config.mapWorkers?.dungeon},gen,options):gen
}
function generateDungeonCore(w: World, depth: number): GenResult {
  const id = `crypt${depth}`
  const r = new Rng(seedState(w.s.seed, 'map:' + id))
  const [W, H] = FLOOR_SIZE[depth - 1] ?? FLOOR_SIZE[2]
  const m = blank(id, `${FLOOR_NAMES[depth - 1] ?? '심층'}`, 'dungeon', depth, W, H, 'Terrain.KtWall', 0.04)
  const b = new Builder(m, r)
  const spawns: Spawn[] = []
  const floorT = depth >= 3 ? 'Terrain.CdFloor' : 'Terrain.KtFloor'

  // 1. 방 배치: 큰 방부터, 방 사이 최소 2칸, 실패 200회면 그 방 제외
  const plan = floorPlan(depth, r).sort((a, z) => ROOM_SIZE[z][2] * ROOM_SIZE[z][3] - ROOM_SIZE[a][2] * ROOM_SIZE[a][3])
  const rooms: (MapRoom & { kind: RoomType })[] = []
  for (const type of plan) {
    const [w0, h0, w1, h1] = ROOM_SIZE[type]
    for (let tries = 0; tries < 200; tries++) {
      const rw = r.int(w0, w1), rh = r.int(h0, h1)
      const rx = r.int(2, W - rw - 2), ry = r.int(3, H - rh - 2)
      if (rooms.some((o) => rx < o.x + o.w + 3 && rx + rw + 3 > o.x && ry < o.y + o.h + 3 && ry + rh + 3 > o.y)) continue
      rooms.push({ x: rx, y: ry, w: rw, h: rh, type, kind: type, discovered: false, name: ROOM_NAMES[type] })
      break
    }
  }
  rooms.forEach((R) => b.rect(R.x, R.y, R.w, R.h, floorT))

  // 2. 연결: 최소 신장 트리(프림, 맨해튼 거리) + 여분 간선 20%
  const center = (R: MapRoom) => ({ x: R.x + Math.floor(R.w / 2), y: R.y + Math.floor(R.h / 2) })
  const dist = (a: MapRoom, z: MapRoom) => { const p = center(a), q = center(z); return Math.abs(p.x - q.x) + Math.abs(p.y - q.y) }
  const edges: [number, number][] = []
  const inTree = new Set<number>([0])
  while (inTree.size < rooms.length) {
    let best: [number, number] | null = null, bd = Infinity
    for (const i of inTree) for (let j = 0; j < rooms.length; j++) {
      if (inTree.has(j)) continue
      const d = dist(rooms[i], rooms[j])
      if (d < bd) { bd = d; best = [i, j] }
    }
    if (!best) break
    edges.push(best)
    inTree.add(best[1])
  }
  const extra: [number, number][] = []
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) if (!edges.some(([a, z]) => (a === i && z === j) || (a === j && z === i))) extra.push([i, j])
  extra.sort((p, q) => dist(rooms[p[0]], rooms[p[1]]) - dist(rooms[q[0]], rooms[q[1]]))
  edges.push(...extra.slice(0, Math.max(1, Math.round(rooms.length * 0.2))))
  const carve = (a: Pos, z: Pos) => {
    let x = a.x, y = a.y
    const horiz = r.chance(0.5)
    const step = (tx: number, ty: number) => {
      while (x !== tx) { x += Math.sign(tx - x); if (b.get(x, y) === 'Terrain.KtWall') b.set(x, y, 'Terrain.KtFloor') }
      while (y !== ty) { y += Math.sign(ty - y); if (b.get(x, y) === 'Terrain.KtWall') b.set(x, y, 'Terrain.KtFloor') }
    }
    if (horiz) { step(z.x, y); step(z.x, z.y) } else { step(x, z.y); step(z.x, z.y) }
  }
  for (const [i, j] of edges) carve(center(rooms[i]), center(rooms[j]))

  // 문: 방 경계로 복도가 들어오는 자리 (일부는 무너진 문틀)
  rooms.forEach((R, ri) => {
    for (let x = R.x - 1; x <= R.x + R.w; x++) for (const y of [R.y - 1, R.y + R.h]) {
      if (b.get(x, y) !== 'Terrain.KtFloor') continue
      if ((b.get(x - 1, y) === 'Terrain.KtWall' ? 1 : 0) + (b.get(x + 1, y) === 'Terrain.KtWall' ? 1 : 0) === 2 && r.chance(0.6)) b.set(x, y, 'Terrain.DoorClosed')
    }
    for (let y = R.y - 1; y <= R.y + R.h; y++) for (const x of [R.x - 1, R.x + R.w]) {
      if (b.get(x, y) !== 'Terrain.KtFloor') continue
      if ((b.get(x, y - 1) === 'Terrain.KtWall' ? 1 : 0) + (b.get(x, y + 1) === 'Terrain.KtWall' ? 1 : 0) === 2 && r.chance(0.6)) b.set(x, y, 'Terrain.DoorClosed')
    }
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) b.at(x, y).room = ri
  })

  // 3. 계단: 방 그래프 거리 (14 §5-3). 3층은 대성소에서 거리 ≥ 3인 방에 올라가는 계단
  const adj = rooms.map(() => [] as number[])
  for (const [i, j] of edges) { adj[i].push(j); adj[j].push(i) }
  const bfs = (from: number) => {
    const d = rooms.map(() => Infinity)
    d[from] = 0
    const q = [from]
    while (q.length) { const i = q.shift()!; for (const j of adj[i]) if (d[j] === Infinity) { d[j] = d[i] + 1; q.push(j) } }
    return d
  }
  let upRoom: number
  const bossIdx = rooms.findIndex((R) => R.kind === 'boss')
  if (bossIdx >= 0) {
    const d = bfs(bossIdx)
    const far = rooms.map((_, i) => i).filter((i) => i !== bossIdx && d[i] >= 3)
    upRoom = far.length ? r.pick(far) : d.indexOf(Math.max(...d.filter((x) => x < Infinity)))
  } else {
    const cand = rooms.map((R, i) => (R.kind === 'storage' || R.kind === 'empty' || R.kind === 'library' ? i : -1)).filter((i) => i >= 0)
    upRoom = cand.length ? r.pick(cand) : 0
  }
  const up = freeIn(b, rooms[upRoom], floorT, r)
  b.set(up.x, up.y, 'Terrain.StairsUp')
  m.links.push({ pos: up, to: depth === 1 ? 'surface' : `crypt${depth - 1}`, toPos: { x: 0, y: 0 }, label: depth === 1 ? '수도원 앞뜰 (지상)' : `${FLOOR_NAMES[depth - 2]} (지하 ${depth - 1}층)` })
  if (depth < DUNGEON_DEPTH) {
    const d = bfs(upRoom)
    const cand = rooms.map((_, i) => i).filter((i) => i !== upRoom && d[i] >= 4)
    const dnRoom = cand.length ? r.pick(cand) : d.indexOf(Math.max(...d.filter((x) => x < Infinity)))
    const dn = freeIn(b, rooms[dnRoom], floorT, r)
    b.set(dn.x, dn.y, 'Terrain.StairsDown')
    m.links.push({ pos: dn, to: `crypt${depth + 1}`, toPos: { x: 0, y: 0 }, label: `${FLOOR_NAMES[depth]} (지하 ${depth + 1}층)` })
  }

  // 4·6. 방 꾸미기·컨테이너 (14 §4 · §6)
  const wallTop = (R: MapRoom) => { const out: Pos[] = []; for (let x = R.x; x < R.x + R.w; x++) out.push({ x, y: R.y }); return out.filter((p) => b.get(p.x, p.y) === floorT) }
  const edgeTiles = (R: MapRoom) => {
    const out: Pos[] = []
    for (let x = R.x; x < R.x + R.w; x++) { out.push({ x, y: R.y }); out.push({ x, y: R.y + R.h - 1 }) }
    for (let y = R.y + 1; y < R.y + R.h - 1; y++) { out.push({ x: R.x, y }); out.push({ x: R.x + R.w - 1, y }) }
    return out.filter((p) => b.get(p.x, p.y) === floorT)
  }
  const isDoorway = (x: number, y: number) => b.in(x, y) && (b.get(x, y) === 'Terrain.DoorClosed' || (b.get(x, y) === 'Terrain.KtFloor' && b.at(x, y).room === undefined))
  for (const R of rooms) {
    switch (R.kind) {
      case 'guard': {
        const p = r.pick(edgeTiles(R)); if (p) b.set(p.x, p.y, 'Terrain.GuardChest')
        b.set(R.x, R.y, 'Terrain.Brazier'); b.light(R.x, R.y, 4, 'torch')
        break
      }
      case 'ossuary': {
        // 석관 2~4 (3×2 칸, 줄인 석관 그림) — 벽을 따라
        const n = r.int(2, 4)
        let placed = 0
        for (let x = R.x + 1; x + 3 <= R.x + R.w - 1 && placed < n; x += 4) {
          for (const y0 of [R.y, R.y + R.h - 2]) {
            if (placed >= n) break
            if ([0, 1, 2].some((dx) => [0, 1].some((dy) => b.get(x + dx, y0 + dy) !== floorT))) continue
            // 문·복도에 닿는 자리는 피한다 (통로 막힘 방지)
            let nearDoor = false
            for (let yy = y0 - 1; yy <= y0 + 2; yy++) for (let xx = x - 1; xx <= x + 3; xx++) if (isDoorway(xx, yy)) nearDoor = true
            if (nearDoor) continue
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 3; dx++) b.set(x + dx, y0 + dy, 'Terrain.SarcoBlock')
            b.set(x + 1, y0 === R.y ? y0 + 1 : y0, 'Terrain.Sarcophagus')
            b.prop({ kind: 'sarcophagus', x, y: y0, w: 3, h: 2, blocks: true, scale: 0.6 })
            placed++
          }
        }
        for (const p of r.shuffle(edgeTiles(R)).slice(0, r.int(1, 3))) b.set(p.x, p.y, 'Terrain.Pot')
        for (const p of r.shuffle(edgeTiles(R)).slice(0, 2)) if (b.get(p.x, p.y) === floorT) b.at(p.x, p.y).deco = 'skull'
        break
      }
      case 'library': {
        const tops: number[] = []
        for (let x = R.x; x < R.x + R.w; x++) if (b.get(x, R.y - 1) === 'Terrain.KtWall') tops.push(x)
        for (const x of r.shuffle(tops).slice(0, r.int(2, 4))) b.set(x, R.y - 1, 'Terrain.Shelf')
        for (const p of r.shuffle(edgeTiles(R)).slice(0, 2)) b.at(p.x, p.y).deco = r.chance(0.5) ? 'books0' : 'books1'
        break
      }
      case 'shrine': case 'boss': {
        const sx = R.x + Math.floor(R.w / 2) - 1
        const doorway = (x: number, y: number) => { const t = b.get(x, y); return t === 'Terrain.DoorClosed' || (t === 'Terrain.KtFloor' && b.at(x, y).room === undefined) }
        let clear = true
        for (let x = sx - 1; x <= sx + 3; x++) for (let y = R.y - 1; y <= R.y + 2; y++) if (b.in(x, y) && doorway(x, y)) clear = false
        if (clear && R.kind === 'shrine') {
          b.prop({ kind: 'statue', x: sx, y: R.y, w: 3, h: 2, blocks: true })
          for (let x = sx; x < sx + 3; x++) for (let y = R.y; y < R.y + 2; y++) b.set(x, y, 'Terrain.Statue')
        }
        if (R.kind === 'shrine') { const p = { x: sx + 1, y: R.y + 2 }; if (b.get(p.x, p.y) === floorT) b.set(p.x, p.y, 'Terrain.Altar') }
        b.set(R.x, R.y + R.h - 1, 'Terrain.Brazier'); b.light(R.x, R.y + R.h - 1, 5, R.kind === 'boss' ? 'taint' : 'brazier')
        b.set(R.x + R.w - 1, R.y + R.h - 1, 'Terrain.Brazier'); b.light(R.x + R.w - 1, R.y + R.h - 1, 5, R.kind === 'boss' ? 'taint' : 'brazier')
        if (R.kind === 'boss') for (let k = 0; k < 6; k++) { const p = r.pick(edgeTiles(R)); if (p) b.prop({ kind: r.chance(0.5) ? 'cd_veina1' : 'cd_littleeyes', x: p.x, y: p.y, w: 1, h: 1, anim: 'y' }) }
        break
      }
      case 'storage':
        for (const p of r.shuffle(edgeTiles(R)).slice(0, 2)) b.set(p.x, p.y, 'Terrain.StoreCrate')
        if (r.chance(0.5)) { const p = r.pick(edgeTiles(R)); if (p) b.set(p.x, p.y, 'Terrain.Pot') }
        break
      case 'cell':
        // 3×3 칸막이: 칸 사이 기둥(가운데 줄은 비워 통로), 칸마다 바닥 더미와 사슬
        for (let x = R.x + 3; x < R.x + R.w - 1; x += 4) { b.set(x, R.y, 'Terrain.Column'); b.set(x, R.y + R.h - 1, 'Terrain.Column') }
        for (let x = R.x + 1; x < R.x + R.w - 1; x += 4) {
          b.prop({ kind: 'chain0', x, y: R.y - 1, w: 1, h: 1 })
          if (b.get(x, R.y + R.h - 1) === floorT && r.chance(0.7)) b.set(x, R.y + R.h - 1, 'Terrain.Remains')
        }
        break
      case 'empty':
        if (r.chance(0.5)) { const p = r.pick(edgeTiles(R)); if (p) b.set(p.x, p.y, 'Terrain.Remains') }
        break
    }
    // 3층: 포자 바닥 (밟으면 포자 구름 판정, 비틀거림 +5)
    if (depth >= 3) for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) if (b.get(x, y) === floorT && r.chance(R.kind === 'boss' ? 0.5 : 0.25)) b.at(x, y).taint = 1
    if (depth >= 3 && R.kind !== 'boss') { const p = r.pick(wallTop(R)); if (p) b.prop({ kind: r.chance(0.5) ? 'cd_veina1' : 'cd_littleeyes', x: p.x, y: p.y, w: 1, h: 1, anim: 'y' }) }
  }
  for (let k = 0; k < 10; k++) {
    const x = r.int(1, W - 2), y = r.int(1, H - 2)
    if (b.get(x, y) === 'Terrain.KtFloor' && b.at(x, y).room === undefined) b.at(x, y).deco = 'skull'
  }
  unblockDoorways(w, b)
  for (const t of m.tiles) if (t.t === 'Terrain.KtFloor' && !t.deco && r.chance(0.12)) t.deco = `moss_s${r.int(0, 11)}`

  // 4·5. 거주자와 잠듦 배정 (14 §4.2 · §7.1)
  rooms.forEach((R, ri) => {
    if (ri === upRoom && depth === 1) return // 내려오자마자 붙지 않게 1층 계단참은 비운다
    const defs = population(depth, R.kind, r)
    const free: Pos[] = []
    for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
      const t = b.get(x, y)
      if ((t === floorT || t === 'Terrain.Remains') && !(x === up.x && y === up.y)) free.push({ x, y })
    }
    for (const def of defs) {
      const spots = free.filter((p) => !spawns.some((s) => s.pos.x === p.x && s.pos.y === p.y))
      if (!spots.length) break
      const pos = R.kind === 'boss' ? center(R) : r.pick(spots)
      const asleep = r.chance(sleepChance(w, R.kind, def))
      spawns.push({ def, pos, asleep, deep: asleep && r.chance(0.5), home: center(R), room: ri })
    }
  })

  m.rooms = rooms.map(({ kind: _k, ...R }) => R)
  for(const tile of m.tiles)if(w.db.terrain(tile.t).lock)tile.locked=true
  return { map: m, start: { x: up.x, y: up.y }, spawns }
}

function freeIn(b: Builder, R: MapRoom, floorT: string, r: Rng): Pos {
  const cand: Pos[] = []
  for (let y = R.y + 1; y < R.y + R.h - 1; y++) for (let x = R.x + 1; x < R.x + R.w - 1; x++) if (b.get(x, y) === floorT) cand.push({ x, y })
  return cand.length ? r.pick(cand) : { x: R.x + 1, y: R.y + 1 }
}
