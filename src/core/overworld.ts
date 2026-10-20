// 월드 지형과 경로. 지역 내부 한 턴의 길이에는 영향을 주지 않는다.
import { clamp, rng, turnOf, type World } from './ctx'
import type { Pos } from './geom'
import type { BiomeDef, OverworldState, RegionSiteDef, WorldCell, WorldGenDef, WorldSite, WorldTower, WorldObservation } from './types'

const CARDINAL = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const
class Heap {
  private entries: { id: number; score: number; cost: number }[] = []
  get size() { return this.entries.length }
  push(id: number, score: number, cost = score) {
    const a = this.entries, entry = { id, score, cost }; let i = a.length; a.push(entry)
    while (i > 0) { const p = (i - 1) >> 1; if (!this.less(entry, a[p])) break; a[i] = a[p]; i = p }
    a[i] = entry
  }
  pop() {
    const a = this.entries, out = a[0], last = a.pop()!
    if (a.length) {
      let i = 0
      while (i * 2 + 1 < a.length) {
        let j = i * 2 + 1
        if (j + 1 < a.length && this.less(a[j + 1], a[j])) j++
        if (!this.less(a[j], last)) break
        a[i] = a[j]; i = j
      }
      a[i] = last
    }
    return out
  }
  private less(a: { id: number; score: number }, b: { id: number; score: number }) { return a.score < b.score || a.score === b.score && a.id < b.id }
}
export const worldGenDef = (w: World) => w.db.get<WorldGenDef>('WorldGen.Hearth')
export function worldIndex(m: OverworldState, p: Pos): number { return p.y * m.w + p.x }
export function worldPos(m: OverworldState, i: number): Pos { return { x: i % m.w, y: Math.floor(i / m.w) } }
function neighbors(width: number, height: number, id: number): number[] {
  const x = id % width, y = Math.floor(id / width)
  return CARDINAL.map(([dx, dy]) => [x + dx, y + dy]).filter(([xx, yy]) => xx >= 0 && yy >= 0 && xx < width && yy < height).map(([xx, yy]) => yy * width + xx)
}

function heights(w: World, d: WorldGenDef): number[] {
  const r = rng(w, 'world.height')
  let side = 1; while (side < Math.max(d.width, d.height)) side *= 2
  const stride = side + 1, a = new Array<number>(stride * stride).fill(0)
  for (const [x, y] of [[0, 0], [side, 0], [0, side], [side, side]]) a[y * stride + x] = r.int(0, d.heightMax)
  let amplitude = Math.floor(d.heightMax / 2)
  for (let step = side; step > 1; step >>= 1) {
    const half = step >> 1
    for (let y = half; y < side; y += step) for (let x = half; x < side; x += step) a[y * stride + x] = Math.floor((a[(y - half) * stride + x - half] + a[(y - half) * stride + x + half] + a[(y + half) * stride + x - half] + a[(y + half) * stride + x + half]) / 4) + r.int(-amplitude, amplitude)
    for (let y = 0; y <= side; y += half) for (let x = (y / half) % 2 ? 0 : half; x <= side; x += step) {
      let total = 0, count = 0
      for (const [dx, dy] of [[-half, 0], [half, 0], [0, -half], [0, half]]) if (x + dx >= 0 && x + dx <= side && y + dy >= 0 && y + dy <= side) { total += a[(y + dy) * stride + x + dx]; count++ }
      a[y * stride + x] = Math.floor(total / count) + r.int(-amplitude, amplitude)
    }
    amplitude = Math.max(1, Math.floor(amplitude / 2))
  }
  let out = Array.from({ length: d.width * d.height }, (_, i) => a[Math.floor(i / d.width) * stride + i % d.width])
  const lo = Math.min(...out), hi = Math.max(...out)
  out = out.map((v) => Math.floor((v - lo) * d.heightMax / Math.max(1, hi - lo)))
  for (let pass = 0; pass < d.smoothPasses; pass++) out = out.map((v, i) => { const ns = neighbors(d.width, d.height, i); return Math.floor((v + ns.reduce((n, j) => n + out[j], 0)) / (ns.length + 1)) })
  // 서쪽·남쪽 해안. 고정 고원 앵커 주변 고도는 데이터에서 제약한다.
  out = out.map((v, i) => Math.floor(v * Math.min(1, (i % d.width) / 8, Math.floor(i / d.width) / 6)))
  for (const site of w.db.all<RegionSiteDef>('RegionSite')) if (site.altitude !== undefined) {
    const [sx, sy] = site.cell
    for (let y = Math.max(0, sy - 3); y <= Math.min(d.height - 1, sy + 3); y++) for (let x = Math.max(0, sx - 3); x <= Math.min(d.width - 1, sx + 3); x++) {
      const weight = Math.max(0, 1 - Math.max(Math.abs(x - sx), Math.abs(y - sy)) / 4)
      const i = y * d.width + x; out[i] = Math.round(out[i] * (1 - weight) + site.altitude * weight)
    }
  }
  return out
}

/** 우선순위 채움. 같은 높이에서도 부모는 앞서 처리된 칸이라 배수 순환이 없다. */
export function drainage(width: number, height: number, altitude: number[]) {
  const filled = altitude.slice(), parent = new Array<number>(altitude.length).fill(-1), order = new Array<number>(altitude.length).fill(-1)
  const seen = new Uint8Array(altitude.length), heap = new Heap()
  for (let i = 0; i < altitude.length; i++) if (i < width || i >= width * (height - 1) || i % width === 0 || i % width === width - 1) { seen[i] = 1; heap.push(i, filled[i]) }
  let sequence = 0
  while (heap.size) {
    const { id } = heap.pop(); order[id] = sequence++
    for (const j of neighbors(width, height, id)) if (!seen[j]) { seen[j] = 1; filled[j] = Math.max(altitude[j], filled[id]); parent[j] = id; heap.push(j, filled[j]) }
  }
  for (let i = 0; i < altitude.length; i++) {
    const downhill = neighbors(width, height, i).filter((j) => filled[j] < filled[i] || filled[j] === filled[i] && order[j] < order[i])
    downhill.sort((a, b) => filled[a] - filled[b] || altitude[a] - altitude[b] || order[a] - order[b])
    if (downhill.length) parent[i] = downhill[0]
  }
  return { filled, parent }
}

export function veilAt(towers: WorldTower[], p: Pos): number {
  let sum = 0
  for (const t of towers) { const dx = p.x - t.cell.x, dy = p.y - t.cell.y; sum += t.output * Math.max(0, t.radius - Math.sqrt(dx * dx + dy * dy)) / t.radius }
  return Math.round(clamp(sum, 0, 100) * 10) / 10
}
export function climateMean(row: number, rows: number, altitude: number, veil: number): number { return Math.round((14 - 16 * row / (rows - 1) - 6 * altitude / 1000 - veil * .05) * 10) / 10 }

export function routeHours(w: World, from: Pos, to: Pos): number {
  const m = w.s.overworld!, d = worldGenDef(w), a = m.cells[worldIndex(m, from)], b = m.cells[worldIndex(m, to)]
  if (!a || !b || b.sea || Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1) return Infinity
  return a.road && b.road ? d.roadHours : d.offRoadHours * w.db.get<BiomeDef>(b.biome).worldTravelMult
}
export function worldRoute(w: World, from: Pos, to: Pos, buildingRoad = false): { cells: Pos[]; hours: number } | null {
  const m = w.s.overworld!
  if ([from, to].some((p) => !Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= m.w || p.y >= m.h)) return null
  const start = worldIndex(m, from), goal = worldIndex(m, to)
  const d = worldGenDef(w), minimumBiome = Math.min(...w.db.all<BiomeDef>('Biome').map((b) => b.worldTravelMult))
  const minimumStep = buildingRoad ? minimumBiome * .5 : Math.min(d.roadHours, d.offRoadHours * minimumBiome)
  if (m.cells[start].sea || m.cells[goal].sea) return null
  const costs = new Array<number>(m.cells.length).fill(Infinity), parents = new Int32Array(m.cells.length).fill(-1), heap = new Heap()
  costs[start] = 0; heap.push(start, 0, 0)
  while (heap.size) {
    const { id, cost } = heap.pop()
    if (cost !== costs[id]) continue
    if (id === goal) {
      const cells: Pos[] = []
      for (let j = goal; j !== start; j = parents[j]) cells.push(worldPos(m, j))
      return { cells: cells.reverse(), hours: Math.round(cost * 1000) / 1000 }
    }
    for (const j of neighbors(m.w, m.h, id)) {
      const a = m.cells[id], b = m.cells[j]
      if (b.sea) continue
      const q = worldPos(m, j)
      const step = buildingRoad ? w.db.get<BiomeDef>(b.biome).worldTravelMult * (1 + Math.abs(a.altitude - b.altitude) / 400) * (b.oldRoad ? .5 : 1) : routeHours(w, worldPos(m, id), q)
      const g = cost + step
      if (g >= costs[j]) continue
      costs[j] = g; parents[j] = id
      const h = (Math.abs(q.x - to.x) + Math.abs(q.y - to.y)) * minimumStep
      heap.push(j, g + h, g)
    }
  }
  return null
}

export function generateOverworld(w: World): OverworldState {
  const d = worldGenDef(w), altitude = heights(w, d), sites: WorldSite[] = w.db.all<RegionSiteDef>('RegionSite').filter(s=>!s.extension).map((s) => ({ id: s.id, label: s.label, description: s.description, cell: { x: s.cell[0], y: s.cell[1] }, kind: s.kind, faction: s.faction, facilities: s.facilities }))
  const towers: WorldTower[] = w.db.all<RegionSiteDef>('RegionSite').filter((s) => s.tower).map((s) => ({ id: s.id, cell: { x: s.cell[0], y: s.cell[1] }, ...s.tower! }))
  const tr = rng(w, 'world.towers'), count = tr.int(...d.towers)
  for (let attempts = 0; towers.length < count && attempts < 5000; attempts++) {
    const p = { x: tr.int(5, d.width - 6), y: tr.int(5, d.height - 6) }
    if (altitude[p.y * d.width + p.x] <= d.seaLevel || sites.some((s) => Math.abs(p.x - s.cell.x) + Math.abs(p.y - s.cell.y) < 35) || towers.some((t) => Math.abs(p.x - t.cell.x) + Math.abs(p.y - t.cell.y) < 12)) continue
    towers.push({ id: `Tower.${towers.length}`, cell: p, output: tr.chance(d.towerDormancy) ? 0 : tr.int(...d.towerOutput), radius: tr.int(...d.towerRadius) })
  }
  const cells: WorldCell[] = altitude.map((v, i) => { const p = { x: i % d.width, y: Math.floor(i / d.width) }, veil = veilAt(towers, p); return { altitude: v, rain: 0, temperature: climateMean(p.y, d.height, v, veil), veil, biome: 'Biome.Greymoor', sea: v <= d.seaLevel, resources: { wood: 0, herbs: 0, ore: 0, game: 0, scrap: 0 } } })
  for (let y = 0; y < d.height; y++) {
    let moisture = 100
    for (let x = 0; x < d.width; x++) {
      const i = y * d.width + x, c = cells[i]
      if (c.sea) moisture = 100
      const rain = Math.min(moisture, moisture * .1 + Math.max(0, c.altitude - (x ? cells[i - 1].altitude : 0)) * .05)
      c.rain = Math.round(clamp(rain * d.rainScale, 0, 100)); moisture = Math.max(0, moisture - rain)
    }
  }
  const drain = drainage(d.width, d.height, altitude)
  for (let i = 0; i < cells.length; i++) if (!cells[i].sea && drain.filled[i] > altitude[i] + 5) cells[i].lake = true
  for (let i = 0; i < cells.length; i++) if (!cells[i].sea && cells[i].rain >= 60 && altitude[i] >= 400) {
    for (let j = i; j >= 0 && !cells[j].sea && !cells[j].river; j = drain.parent[j]) cells[j].river = true
  }
  for (const site of w.db.all<RegionSiteDef>('RegionSite')) if (site.river) for (let j = site.cell[1] * d.width + site.cell[0]; j >= 0 && !cells[j].sea && !cells[j].river; j = drain.parent[j]) cells[j].river = true
  const biomes = w.db.all<BiomeDef>('Biome').slice().sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1))
  const inRange = (n: number, range?: [number, number]) => !range || n >= range[0] && n <= range[1]
  const rr = rng(w, 'world.resources')
  const facilities = sites.filter((s) => s.facilities)
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i], p = { x: i % d.width, y: Math.floor(i / d.width) }
    const biome = biomes.find((b) => {
      const q = b.conditions
      if (!inRange(c.altitude, q.altitude) || !inRange(c.temperature, q.temperature) || !inRange(c.rain, q.rain) || !inRange(c.veil, q.veil)) return false
      if (q.river && ![i, ...neighbors(d.width, d.height, i)].some((j) => cells[j].river)) return false
      if (q.coast !== undefined) {
        let coastal = false
        for (let dy = -q.coast; dy <= q.coast; dy++) for (let dx = -q.coast; dx <= q.coast; dx++) if (p.x + dx >= 0 && p.y + dy >= 0 && p.x + dx < d.width && p.y + dy < d.height && cells[(p.y + dy) * d.width + p.x + dx].sea) coastal = true
        if (!coastal) return false
      }
      return true
    })!
    c.biome = biome.id
    if (c.sea) continue
    for (const key of ['wood', 'herbs', 'ore', 'game'] as const) c.resources[key] = clamp(biome.resources[key] + rr.int(-20, 20), 0, 100)
    if (facilities.some((s) => (s.cell.x - p.x) ** 2 + (s.cell.y - p.y) ** 2 <= 16)) c.resources.scrap = rr.int(15, 85)
  }
  const sr = rng(w, 'world.settlements')
  const candidates = cells.map((c, i) => {
    const p = { x: i % d.width, y: Math.floor(i / d.width) }, water = [i, ...neighbors(d.width, d.height, i)].some((j) => cells[j].river || cells[j].lake)
    const score = (water ? 30 : 0) + (c.biome === 'Biome.Farmland' ? 25 : 0) + (neighbors(d.width, d.height, i).some((j) => cells[j].altitude < c.altitude - 30) ? 15 : 0) - c.veil / 2 - (towers.some((t) => (t.cell.x - p.x) ** 2 + (t.cell.y - p.y) ** 2 < 36) ? 40 : 0)
    return { i, p, score: c.sea || c.lake ? -Infinity : score, tie: sr.next() }
  }).sort((a, b) => b.score - a.score || a.tie - b.tie || a.i - b.i)
  for (const q of candidates) {
    if (sites.filter((s) => s.kind === 'settlement').length >= d.settlementCount) break
    if (!Number.isFinite(q.score) || sites.some((s) => (s.cell.x - q.p.x) ** 2 + (s.cell.y - q.p.y) ** 2 < d.settlementSpacing ** 2)) continue
    sites.push({ id: `Region.Settlement${sites.length}`, label: `고원 촌락 ${sites.length - 9}`, description: '물길과 농지를 따라 자리 잡은 작은 정착지.', cell: q.p, kind: 'settlement', faction: 'coalition', population: sr.int(41, 250) })
  }
  const start = sites.find((s) => s.id === d.startRegion)!
  const m: OverworldState = { def: d.id, w: d.width, h: d.height, cells, towers, sites, position: { ...start.cell }, currentRegion: start.id, visited: [start.id], seen: [], scenes: {} }
  w.s.overworld = m
  // 옛 수레길은 연결 비용을 낮춘다. 실제 통행 가능한 도로는 A*로 잇는다.
  const fork = sites.find((s) => s.id === 'Region.ForkwayLedgerhouse')
  if (fork) for (const target of sites.filter((s) => ['cloister', 'tower', 'pass'].includes(s.kind))) {
    let x = fork.cell.x, y = fork.cell.y
    while (x !== target.cell.x || y !== target.cell.y) { cells[y * m.w + x].oldRoad = true; if (x !== target.cell.x) x += Math.sign(target.cell.x - x); else y += Math.sign(target.cell.y - y) }
  }
  const connected = new Set([start.id])
  while (connected.size < sites.length) {
    const pairs = sites.filter((s) => !connected.has(s.id)).flatMap((to) => sites.filter((s) => connected.has(s.id)).map((from) => ({ from, to, dist: (from.cell.x - to.cell.x) ** 2 + (from.cell.y - to.cell.y) ** 2 }))).sort((a, b) => a.dist - b.dist || (a.to.id < b.to.id ? -1 : 1))
    let linked = false
    for (const pair of pairs) {
      const route = worldRoute(w, pair.from.cell, pair.to.cell, true)
      if (!route) continue
      for (const p of [pair.from.cell, ...route.cells]) cells[worldIndex(m, p)].road = true
      connected.add(pair.to.id); linked = true; break
    }
    if (!linked) break // 바다로 분리된 섬의 배편은 별도 이동 시스템에서 연결한다.
  }
  appendExpansionSites(w,m)
  revealWorld(m,turnOf(w),'initial')
  return m
}

/** 후속 지역은 기존 지형·정착지·도로 추첨을 마친 뒤, 실제로 닿는 육지에 둔다. */
export function appendExpansionSites(w:World,m:OverworldState){
  const defs=w.db.all<RegionSiteDef>('RegionSite').filter(d=>d.extension&&!m.sites.some(s=>s.id===d.id)).sort((a,b)=>(a.extension!.generation??0)-(b.extension!.generation??0))
  if(!defs.length)return
  const reachable=new Set<number>(),queue=[worldIndex(m,m.position)]
  for(let k=0;k<queue.length;k++){
    const i=queue[k];if(reachable.has(i)||m.cells[i].sea)continue
    reachable.add(i)
    const x=i%m.w,y=Math.floor(i/m.w)
    for(const p of [{x:x-1,y},{x:x+1,y},{x,y:y-1},{x,y:y+1}])if(p.x>=0&&p.y>=0&&p.x<m.w&&p.y<m.h){const j=worldIndex(m,p);if(!reachable.has(j)&&!m.cells[j].sea)queue.push(j)}
  }
  for(const d of defs){
    const near=d.extension!.near,anchor=near?m.sites.find(s=>s.id===near.site)?.cell:undefined,ax=anchor?.x??d.cell[0],ay=anchor?.y??d.cell[1]
    const options=m.cells.map((c,i)=>({c,i,x:i%m.w,y:Math.floor(i/m.w)})).filter(p=>!p.c.sea&&!p.c.lake&&(!near||anchor&&Math.abs(p.x-anchor.x)+Math.abs(p.y-anchor.y)<=near.maxCells)&&(!d.extension!.altitude||p.c.altitude>=d.extension!.altitude[0]&&p.c.altitude<=d.extension!.altitude[1])&&(!d.extension!.coast||[{x:p.x-1,y:p.y},{x:p.x+1,y:p.y},{x:p.x,y:p.y-1},{x:p.x,y:p.y+1}].some(q=>q.x>=0&&q.y>=0&&q.x<m.w&&q.y<m.h&&m.cells[worldIndex(m,q)].sea))&&(!d.extension!.footAccess||reachable.has(p.i))&&!m.sites.some(s=>s.cell.x===p.x&&s.cell.y===p.y)).sort((a,b)=>(a.x-ax)**2+(a.y-ay)**2-((b.x-ax)**2+(b.y-ay)**2)||a.i-b.i)
    const at=options[0]
    if(!at)continue
    m.sites.push({id:d.id,label:d.label,description:d.description,cell:{x:at.x,y:at.y},kind:d.kind,faction:d.faction,facilities:d.facilities,population:d.extension!.population})
    at.c.biome=d.extension!.biome
    const biome=w.db.get<BiomeDef>(d.extension!.biome)
    for(const key of ['wood','herbs','ore','game']as const)at.c.resources[key]=biome.resources[key]
  }
}

export function revealWorld(m: OverworldState,at?:number,source:WorldObservation['source']='arrival') {
  const seen = new Set(m.seen)
  for (let y = Math.max(0, m.position.y - 3); y <= Math.min(m.h - 1, m.position.y + 3); y++) for (let x = Math.max(0, m.position.x - 3); x <= Math.min(m.w - 1, m.position.x + 3); x++) {
    const i=y*m.w+x;seen.add(i)
    if(at!==undefined&&Number.isFinite(at)&&at>=0){const c=m.cells[i]!;(m.worldObservations??={})[i]={at,source,cell:{altitude:c.altitude,temperature:c.temperature,veil:c.veil,biome:c.biome,sea:c.sea,...(c.road?{road:true}:{}),...(c.oldRoad?{oldRoad:true}:{}),...(c.river?{river:true}:{}),...(c.lake?{lake:true}:{})}}}
  }
  m.seen = [...seen].sort((a, b) => a - b)
}

/** 구형 각인도 현재 층·NPC·캐릭터를 유지한 채 월드에 연결한다. */
export function enableOverworld(w: World): OverworldState {
  if (w.s.overworld) {appendExpansionSites(w,w.s.overworld);return w.s.overworld}
  const m = generateOverworld(w)
  for (const map of [w.s.map, ...Object.values(w.s.maps)]) map.worldCell = { ...m.position }
  for (const rumor of w.s.knowledge.rumors ?? []) rumor.regionId ??= m.currentRegion
  return m
}
