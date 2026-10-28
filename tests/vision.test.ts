import { describe, expect, it } from 'vitest'
import { createCreature } from '../src/core/creatures'
import { idx, player, tileAt } from '../src/core/ctx'
import { canSee, computeFov, darkSightRange, invalidateLights, sightRange, updatePlayerVision } from '../src/core/fov'
import { deserialize, serialize } from '../src/core/save'
import { loadMods, type ModPackage } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import { makeItem } from '../src/core/items'
import { makeWorld } from './helpers'

function scene(ambient = 1) {
  const w = makeWorld('vision-boundaries', 'Bg.Deserter'), p = player(w)
  p.pos = { x: 20, y: 20 }; p.stats.per = 10; p.traits = []; p.age = undefined
  p.equip = {}; p.body.wounds = []; p.effects = []; p.cond = {}; p.traumas = []
  p.unconscious = false; p.asleep = false; p.breakdown = undefined
  w.s.creatures = [p]; w.s.weather = 'clear'
  w.s.map = { ...w.s.map, kind: 'dungeon', ambient, lights: [], fog: undefined }
  for (const tile of w.s.map.tiles) Object.assign(tile, { t: 'Terrain.KtFloor', roof: false, seen: false, observed: undefined, device: undefined, cont: undefined, items: [] })
  invalidateLights(w)
  return { w, p }
}

describe('인간의 원형 시야와 어둠', () => {
  it('기본12칸, 지각15부터5점 구간당5%, 최대15칸이며 기후는 상한 이후 적용한다', () => {
    const { w, p } = scene()
    for (const [per, range] of [[5, 12], [10, 12], [14, 12], [15, 13], [19, 13], [20, 13], [25, 13], [100, 13]]) {
      p.stats.per = per; expect(sightRange(w, p), String(per)).toBe(range)
    }
    p.traits = ['Trait.KeenEyed']; expect(sightRange(w, p)).toBe(15)
    w.s.map.kind = 'surface'; w.s.overworld = makeWorld('vision-weather', undefined, true).s.overworld
    w.s.weather = 'frostfog'; expect(sightRange(w, p)).toBeLessThan(15)
  })
  it('12칸 경계와 대각선에서 직접 판정과 그림자 투사의 거리가 일치한다', () => {
    const { w, p } = scene(), fov = computeFov(w, p.pos, sightRange(w, p))
    for (const [pos, visible] of [[{ x: 32, y: 20 }, true], [{ x: 33, y: 20 }, false], [{ x: 28, y: 28 }, true], [{ x: 29, y: 29 }, false]] as const) {
      expect(canSee(w, p, pos), JSON.stringify(pos)).toBe(visible)
      expect(canSee(w, p, pos, fov)).toBe(visible)
    }
  })
  it('칠흑에서는 고정6칸 감소하고 지각 보너스에도 같은6칸을 뺀다', () => {
    const { w, p } = scene(0)
    expect(darkSightRange(w, p)).toBe(6)
    expect(canSee(w, p, { x: 26, y: 20 })).toBe(true)
    expect(canSee(w, p, { x: 27, y: 20 })).toBe(false)
    expect(canSee(w, p, { x: 25, y: 25 })).toBe(false)
    p.stats.per = 15; expect(darkSightRange(w, p)).toBe(7)
    expect(canSee(w, p, { x: 27, y: 20 })).toBe(true)
    expect(canSee(w, p, { x: 28, y: 20 })).toBe(false)
  })
  it('조도표의 어둠/어스름 경계에서도6칸 감소하며 야간 시각 특성을 반영한다', () => {
    const { w, p } = scene(.25), far = { x: 32, y: 20 }
    for (const light of [.1, .25, .49]) { w.s.map.ambient = light; expect(canSee(w, p, far), String(light)).toBe(false) }
    w.s.map.ambient = .5; expect(canSee(w, p, far)).toBe(true)
    w.s.map.ambient = .25; p.traits = ['Trait.NightOwl']; expect(canSee(w, p, far)).toBe(true)
  })
  it('멀리 조명된 타일은 전체 범위에서 보이고 광원 뒤의 어둠은 노출하지 않는다', () => {
    const { w, p } = scene(0)
    w.s.map.lights.push({ pos: { x: 31, y: 20 }, radius: 1, kind: 'brazier' }); invalidateLights(w)
    expect(canSee(w, p, { x: 31, y: 20 })).toBe(true)
    expect(canSee(w, p, { x: 32, y: 20 })).toBe(true)
    expect(canSee(w, p, { x: 33, y: 20 })).toBe(false)
    expect(canSee(w, p, { x: 28, y: 20 })).toBe(false)
    updatePlayerVision(w, p)
    expect(w.s.visible).toContain(idx(w, { x: 31, y: 20 }))
    expect(tileAt(w, { x: 28, y: 20 }).seen).toBe(false)
  })
  it('벽 뒤의 생물·지형과 열지 않은 용기의 내용은 새 시야로도 드러나지 않는다', () => {
    const { w, p } = scene()
    tileAt(w, { x: 23, y: 20 }).t = 'Terrain.KtWall'
    Object.assign(tileAt(w, { x: 22, y: 20 }), { t: 'Terrain.Chest', cont: { kind: 'Loot.Chest', opened: false, items: [makeItem(w, 'Item.Wood')] } })
    const hidden = { x: 24, y: 20 }
    expect(canSee(w, p, hidden)).toBe(false)
    updatePlayerVision(w, p)
    expect(w.s.visible).not.toContain(idx(w, hidden)); expect(tileAt(w, hidden).observed).toBeUndefined()
    expect(tileAt(w, { x: 22, y: 20 }).observed?.contents).toBeUndefined()
  })
  it('양쪽 눈을 잃으면 새 반경과 인접 타일도 관찰할 수 없다', () => {
    const { w, p } = scene(); p.body.missing = ['LeftEye', 'RightEye']
    expect(canSee(w, p, { x: 21, y: 20 })).toBe(false)
    updatePlayerVision(w, p); expect(w.s.visible).toEqual([])
    expect(tileAt(w, { x: 21, y: 20 }).observed).toBeUndefined()
  })
  it('인간 NPC도 같은 거리/어둠/벽 판정을 사용하며 야행성 생물은 기존 정의를 따른다', () => {
    const { w, p } = scene(0), npc = createCreature(w, 'Creature.Reaver', { ...p.pos })
    npc.stats.per = 10; npc.traits = []; npc.age = undefined
    expect(sightRange(w, npc)).toBe(12); expect(darkSightRange(w, npc)).toBe(6)
    for (const x of [26, 27, 32, 33]) expect(canSee(w, npc, { x, y: 20 })).toBe(canSee(w, p, { x, y: 20 }))
    const shade = createCreature(w, 'Creature.Shade', { ...p.pos })
    expect(w.db.creature(shade.def).vision).toBeUndefined()
    expect(canSee(w, shade, { x: 23, y: 20 })).toBe(false)
    w.s.map.ambient = .1; expect(canSee(w, shade, { x: 23, y: 20 })).toBe(true)
  })
  it('수면·의식불명은 인접 관찰까지 막고 저장 복원은 관찰·가시 타일 전체를 보존한다', () => {
    const { w, p } = scene(0)
    for (const key of ['asleep', 'unconscious'] as const) {
      p[key] = true; expect(canSee(w, p, { x: 21, y: 20 })).toBe(false); p[key] = false
    }
    updatePlayerVision(w, p)
    const restored = { db: w.db, s: deserialize(serialize(w.s)) }
    expect(restored.s).toEqual(w.s)
    updatePlayerVision(restored, player(restored)); expect(restored.s).toEqual(w.s)
  })
})

describe('시야 정책 정의 검증', () => {
  it.each([null, [], {}, { maxRange: 0, perceptionStep: 5, perceptionBonus: .05, darkPenalty: 6 }, { maxRange: 15, perceptionStep: 0, perceptionBonus: .05, darkPenalty: 6 }, { maxRange: 15, perceptionStep: 5, perceptionBonus: -1, darkPenalty: 6 }, { maxRange: 15, perceptionStep: 5, perceptionBonus: .05, darkPenalty: 16 }])('잘못된 정책을 로드 오류로 보고한다: %j', (value) => {
    const mod = { manifest: { id: 'bad.vision', name: '시야 검증', version: '1' }, defs: [], patches: [{ op: 'replace', target: 'Creature.Human', path: '/vision', value }] } as unknown as ModPackage
    const { report } = loadMods([...readPackages(), mod])
    expect(report.errors.some(e => e.includes('vision'))).toBe(true)
  })
})
