import { describe, expect, it } from 'vitest'
import { newGame } from '../src/core/game'
import { player, rng } from '../src/core/ctx'
import { climateMean, drainage, enableOverworld, generateOverworld, routeHours, veilAt, worldIndex, worldRoute } from '../src/core/overworld'
import { deserialize, serialize, stateHash } from '../src/core/save'
import type { World } from '../src/core/ctx'
import type { BiomeDef } from '../src/core/types'
import { db, makeWorld } from './helpers'
const world = (seed = 'world-foundation'): World => ({ db, s: newGame(db, { seed, background: 'Bg.Deserter', overworld: true }) })

describe('월드 지형·고정 지명·도로', () => {
  it('기후·탑 농도 공식을 독립 검산값에 맞춘다', () => {
    expect(climateMean(70, 96, 600, 60)).toBe(-4.4)
    const t = { id: 'tower', cell: { x: 0, y: 0 }, output: 80, radius: 20 }
    expect(veilAt([t], { x: 6, y: 0 })).toBe(56)
    expect(veilAt([t], { x: 15, y: 0 })).toBe(20)
    expect(veilAt([t, { ...t, output: 60, radius: 10, cell: { x: 9, y: 0 } }], { x: 6, y: 0 })).toBe(98)
    expect(veilAt([t], { x: 30, y: 0 })).toBe(0)
  })
  it('우선순위 배수는 분지를 채우고 순환 없이 경계까지 빠져나간다', () => {
    const a = [4,4,4,4,4, 4,1,1,1,4, 4,1,0,1,4, 4,1,1,1,4, 4,4,2,4,4], d = drainage(5, 5, a)
    expect(d.filled[12]).toBe(2)
    for (let i = 0; i < a.length; i++) { const seen = new Set<number>(); for (let j = i; j >= 0; j = d.parent[j]) { expect(seen.has(j)).toBe(false); seen.add(j); expect(seen.size).toBeLessThanOrEqual(a.length) } }
  })
  it('128×96·2km 세계에10고정지명과8~12탑, 유한 강·도로를 생성한다', () => {
    const w = world(), m = w.s.overworld!
    expect([m.w, m.h, m.cells.length]).toEqual([128, 96, 12288]); expect(m.towers.length).toBeGreaterThanOrEqual(8); expect(m.towers.length).toBeLessThanOrEqual(12)
    expect(new Set(m.sites.map((s) => `${s.cell.x},${s.cell.y}`)).size).toBe(m.sites.length)
    expect(m.sites.slice(0, 10).map((s) => s.label)).toContain('잿빛 수도원'); expect(m.cells.some((c) => c.river)).toBe(true); expect(m.cells.some((c) => c.lake)).toBe(true)
    expect(m.cells[worldIndex(m, m.position)].veil).toBe(40)
    const tower = m.sites.find((s) => s.id === 'Region.ChimneySeven')!
    expect(m.position.y - tower.cell.y).toBe(7); expect(m.position.x).toBe(tower.cell.x)
    const dale = m.sites.find((s) => s.id === 'Region.ShepherdDale')!
    expect(m.cells[worldIndex(m, dale.cell)].biome).toBe('Biome.Farmland')
    for (const c of m.cells) { expect(c.altitude).toBeGreaterThanOrEqual(0); expect(c.altitude).toBeLessThanOrEqual(2000); expect(c.veil).toBeGreaterThanOrEqual(0); expect(c.veil).toBeLessThanOrEqual(100) }
  })
  it('작은 변경용 난수 스트림은 캐릭터와 기존 전투/전리품 난수를 밀지 않는다', () => {
    const legacy = makeWorld('world-foundation', 'Bg.Deserter'), before = structuredClone(legacy.s.rng), original = structuredClone(player(legacy))
    generateOverworld(legacy)
    for (const name of ['world', 'combat', 'loot', 'story', 'ai', 'body']) expect(legacy.s.rng[name]).toEqual(before[name])
    expect(player(legacy)).toEqual(original)
    const other = makeWorld('world-foundation', 'Bg.Deserter'); rng(other, 'combat').int(0, 100); rng(other, 'world.unrelated').int(0, 100); generateOverworld(other)
    expect(other.s.overworld).toEqual(legacy.s.overworld)
  })
  it('구형 각인을 두 번 연결해도 층·NPC·배낭을 보존하고 월드를 다시 뽑지 않는다', () => {
    const w = makeWorld('old-imprint-world', 'Bg.Deserter'), map = w.s.map, creatures = w.s.creatures, original = structuredClone(player(w))
    const m = enableOverworld(w), hash = stateHash(w.s)
    expect(w.s.map).toBe(map); expect(w.s.creatures).toBe(creatures); expect(player(w)).toEqual(original)
    expect(enableOverworld(w)).toBe(m); expect(stateHash(w.s)).toBe(hash)
  })
  it('같은 시드·저장 복원은 전체 월드를 재현하며 다른 시드는 지형이 다르다', () => {
    const a = world(), b = world(), c = world('world-other')
    expect(stateHash(a.s)).toBe(stateHash(b.s)); expect(stateHash(deserialize(serialize(a.s)))).toBe(stateHash(a.s)); expect(c.s.overworld!.cells.map((c) => c.altitude)).not.toEqual(a.s.overworld!.cells.map((c) => c.altitude))
  })
  it('A*는 실제 인접칸을 잇고 도로1h/비도로2h×바이옴을 쓴다', () => {
    const w = world(), m = w.s.overworld!, target = m.sites.find((s) => s.id === 'Region.ChimneySeven')!, r = worldRoute(w, m.position, target.cell)!
    expect(r.hours).toBe(7); expect(r.cells).toHaveLength(7)
    let p = m.position
    for (const q of r.cells) { expect(Math.abs(q.x - p.x) + Math.abs(q.y - p.y)).toBe(1); expect(routeHours(w, p, q)).toBe(1); p = q }
    const q = r.cells[0], cell = m.cells[worldIndex(m, q)]; cell.road = false
    expect(routeHours(w, m.position, q)).toBe(2 * db.get<BiomeDef>(cell.biome).worldTravelMult)
    expect(worldRoute(w, m.position, { x: -1, y: 0 })).toBeNull(); expect(worldRoute(w, m.position, { x: 0, y: 0 })).toBeNull()
  })
  it('고철은 개척시설4칸 안에만 있고 기본 생성 정착지는6칸 간격을 지킨다', () => {
    const w = world(), m = w.s.overworld!, facilities = m.sites.filter((s) => s.facilities)
    m.cells.forEach((c, i) => { if (!c.resources.scrap) return; const x = i % m.w, y = Math.floor(i / m.w); expect(facilities.some((s) => (s.cell.x - x) ** 2 + (s.cell.y - y) ** 2 <= 16)).toBe(true) })
    const baseSites=m.sites.filter(s=>!db.tryGet<import('../src/core/types').RegionSiteDef>(s.id)?.extension)
    for (const site of baseSites.slice(10)) for (const other of baseSites.filter((s) => s.id !== site.id)) expect((site.cell.x - other.cell.x) ** 2 + (site.cell.y - other.cell.y) ** 2).toBeGreaterThanOrEqual(36)
  })
})
