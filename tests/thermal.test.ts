import { describe, expect, it } from 'vitest'
import { deathCause } from '../src/core/body'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf } from '../src/core/ctx'
import { ambientTemp } from '../src/core/environment'
import { loadMods } from '../src/core/defs'
import { changeMap } from '../src/core/game'
import { addToBag, equip, makeItem, unequip } from '../src/core/items'
import { needsTick } from '../src/core/needs'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { comfortMin, insulation, temperatureDelta, temperatureTick, thermalState, THERMAL_TURNS, wetnessTick } from '../src/core/thermal'
import type { ItemInst, TerrainDef } from '../src/core/types'
import { readPackages } from '../tools/loadContent'
import { db, makeWorld } from './helpers'

function setup(coat = 'Item.LeatherCoat', cloak = false) {
  const w = makeWorld('thermal', 'Bg.Hunter')
  const pl = player(w)
  w.s.creatures = [pl]
  w.s.map.lights = []
  w.s.wind = { x: 2, y: 0 }
  w.s.weather = 'clear'
  pl.traits = []
  pl.bag = []
  pl.equip = {}
  for (let y = pl.pos.y - 6; y <= pl.pos.y + 6; y++) for (let x = pl.pos.x - 6; x <= pl.pos.x + 6; x++) {
    const t = tileAt(w, { x, y })
    if (t) { t.t = 'Terrain.Earth'; t.roof = false }
  }
  for (const id of [coat, 'Item.Hood', 'Item.Gloves', 'Item.Boots', ...(cloak ? ['Item.OilclothCloak'] : [])]) {
    if (!id) continue
    const it = makeItem(w, id)
    addToBag(w, pl, it)
    expect(equip(w, pl, it.uid)).toBeNull()
  }
  return { w, pl }
}

describe('영역별 체온 (03 §7 · 13 §6)', () => {
  it('재킷 세트 I 2.925 · 휴식 쾌적 하한 10.6875°C: 다리에는 바지 1만', () => {
    const { w, pl } = setup('Item.PaddedJacket')
    expect(insulation(w, pl)).toBeCloseTo(2.925, 8)
    expect(comfortMin(w, pl)).toBeCloseTo(10.6875, 8)
    pl.equip = {}
    expect(insulation(w, pl)).toBeCloseTo(0.25, 8)
    expect(comfortMin(w, pl)).toBeCloseTo(17.375, 8)
  })

  it('코트 세트 마름 I 3.075, 품질·반쯤 입은 상태는 해당 옷에만 곱한다', () => {
    const { w, pl } = setup()
    expect(insulation(w, pl)).toBeCloseTo(3.075, 8)
    pl.equip.chest!.quality = 2
    expect(insulation(w, pl)).toBeCloseTo(3.075 + 0.85 * 3 * 0.05, 8)
    pl.equip.chest!.half = true
    expect(insulation(w, pl)).toBeCloseTo(3.075 - 0.85 * 3 + 0.85 * 3 * 1.05 * 0.5, 8)
  })

  it('재비 30분: 망토 100%, 코트 30%, 바지 24% — 머리·손·발은 보호하지 않는다', () => {
    const { w, pl } = setup('Item.LeatherCoat', true)
    w.s.weather = 'ashrain'
    for (let i = 0; i < 600; i++) wetnessTick(w, pl)
    expect(pl.equip.back!.wetness?.torso).toBe(100)
    expect(pl.equip.chest!.wetness?.torso).toBeCloseTo(30, 8)
    expect(pl.needs.skinWetness?.legs).toBeCloseTo(24, 8)
    expect(pl.equip.head!.wetness?.head).toBe(100)
    expect(pl.equip.hands!.wetness?.hands).toBe(100)
    expect(pl.equip.feet!.wetness?.feet).toBe(100)
    expect(insulation(w, pl)).toBeCloseTo(3.195, 8)
    const s = thermalState(w, pl)
    expect(s.windChill).toBeCloseTo(1, 8)
    expect(s.evaporation).toBe(0)
  })

  it('망토 없이 흠뻑 젖으면 I 0.9625, 풍속 2의 손실 2°C와 증발 냉각 3°C', () => {
    const { w, pl } = setup()
    w.s.weather = 'ashrain'
    for (let i = 0; i < 600; i++) wetnessTick(w, pl)
    expect(insulation(w, pl)).toBeCloseTo(0.9625, 8)
    const s = thermalState(w, pl)
    expect(s.windChill).toBeCloseTo(2, 8)
    expect(s.evaporation).toBe(3)
    expect(s.feels).toBeCloseTo(ambientTemp(w) - 5, 8)
  })

  it('얕은 물은 하체만, 깊은 물은 망토 안까지 모두 적신다', () => {
    const { w, pl } = setup('Item.LeatherCoat', true)
    tileAt(w, pl.pos).t = 'Terrain.ShallowWater'
    wetnessTick(w, pl)
    expect(pl.equip.chest!.wetness?.legs).toBe(100)
    expect(pl.equip.chest!.wetness?.torso).toBe(0)
    expect(pl.equip.head!.wetness?.head).toBe(0)
    expect(pl.needs.skinWetness?.legs).toBe(100)
    // 기본 콘텐츠에는 깊은 물이 없지만 모드가 정의할 수 있다.
    const pkgs = readPackages()
    const deep: TerrainDef = { ...db.terrain('Terrain.ShallowWater'), id: 'Terrain.TestDeepWater', water: 'deep' }
    pkgs.find((p) => p.manifest.id === 'core')!.defs.push(deep)
    w.db = loadMods(pkgs, []).db
    tileAt(w, pl.pos).t = 'Terrain.TestDeepWater'
    wetnessTick(w, pl)
    expect(pl.equip.chest!.wetness?.torso).toBe(100)
    expect(pl.equip.head!.wetness?.head).toBe(100)
  })

  it('젖은 코트를 벗어도 젖음이 남고 새 옷은 마른 상태로 시작한다', () => {
    const { w, pl } = setup()
    const old = pl.equip.chest!
    old.wetness = { torso: 80, arms: 80, legs: 80 }
    expect(unequip(w, pl, 'chest')).toBeNull()
    const fresh = makeItem(w, 'Item.PaddedJacket')
    addToBag(w, pl, fresh)
    expect(equip(w, pl, fresh.uid)).toBeNull()
    expect(old.wetness.torso).toBe(80)
    expect(fresh.wetness).toEqual({})
    wetnessTick(w, pl)
    expect(fresh.wetness?.torso).toBe(0)
    expect(old.wetness.torso).toBe(80)
  })

  it('불의 거리별 열 15/8/3, 꺼진 불·벽 너머 불은 제외, 지붕 아래 바람 0', () => {
    const { w, pl } = setup()
    for (const [d, expected] of [[2, 15], [4, 8], [6, 3]]) {
      w.s.map.lights = [{ pos: { x: pl.pos.x + d, y: pl.pos.y }, radius: 6, kind: 'campfire' }]
      expect(thermalState(w, pl).heat).toBe(expected)
    }
    w.s.map.lights[0].off = true
    expect(thermalState(w, pl).heat).toBe(0)
    w.s.map.lights[0].off = false
    tileAt(w, { x: pl.pos.x + 1, y: pl.pos.y }).t = 'Terrain.KtWall'
    expect(thermalState(w, pl).heat).toBe(0)
    tileAt(w, pl.pos).roof = true
    expect(thermalState(w, pl).windChill).toBe(0)
    expect(thermalState(w, pl).shelter).toBe(3)
  })

  it('200턴 건조: 기본 2% + 풍속 2, 가까운 불은 10% + 풍속 2', () => {
    const { w, pl } = setup()
    pl.equip.chest!.wetness = { torso: 100 }
    for (let i = 0; i < 200; i++) wetnessTick(w, pl)
    expect(pl.equip.chest!.wetness?.torso).toBeCloseTo(96, 8)
    w.s.map.lights = [{ pos: { ...pl.pos }, radius: 6, kind: 'campfire' }]
    for (let i = 0; i < 200; i++) wetnessTick(w, pl)
    expect(pl.equip.chest!.wetness?.torso).toBeCloseTo(84, 8)
    w.s.weather = 'ashrain'
    for (let i = 0; i < 200; i++) wetnessTick(w, pl)
    expect(pl.equip.chest!.wetness?.torso).toBe(100) // 비 노출 중에는 불 곁이어도 마르지 않는다
  })

  it('활동: 걷기 L−5·U−3, 전투 L−12·U−8, 수면 L+3', () => {
    const { w, pl } = setup()
    const rest = thermalState(w, pl)
    pl.movedTurn = turnOf(w)
    expect(thermalState(w, pl).low).toBe(rest.low - 5)
    expect(thermalState(w, pl).high).toBe(rest.high - 3)
    pl.exerted = true
    expect(thermalState(w, pl).low).toBe(rest.low - 12)
    expect(thermalState(w, pl).high).toBe(rest.high - 8)
    expect(thermalState(w, pl, true).low).toBe(rest.low + 3)
    expect(comfortMin(w, pl, true)).toBe(rest.low + 3)
  })

  it('검산 5: 젖은 코트 야간 보초는 50분, 망토를 더하면 110분에 경도 저체온', () => {
    const run = (cloak: boolean) => {
      const { w, pl } = setup('Item.LeatherCoat', cloak)
      w.s.weather = 'ashrain'
      for (let i = 0; i < 600; i++) wetnessTick(w, pl)
      const s = thermalState(w, pl)
      s.feels = -2 - s.windChill - s.evaporation // 문서의 기온 −2°C 고정
      for (let minutes = 10; minutes <= 300; minutes += 10) {
        pl.needs.bodyTemp += temperatureDelta(pl, s)
        if (pl.needs.bodyTemp < 35) return minutes
      }
    }
    expect(run(false)).toBe(50)
    expect(run(true)).toBe(110)
  })

  it('떨림은 열손실 Δ에서 4를 빼며, 32°C 미만·굶주림 2에서는 멈춘다', () => {
    const { w, pl } = setup()
    const s = { ...thermalState(w, pl), low: 10, feels: 0 }
    expect(temperatureDelta(pl, s)).toBeCloseTo(-0.2)
    pl.needs.bodyTemp = 36.5
    expect(temperatureDelta(pl, s)).toBeCloseTo(-0.12)
    pl.needs.bodyTemp = 31.9
    expect(temperatureDelta(pl, s)).toBeCloseTo(-0.2)
    pl.needs.bodyTemp = 35
    pl.needs.kcal = -6000
    expect(temperatureDelta(pl, s)).toBeCloseTo(-0.2)
  })

  it('10분 동안 매 턴 노출을 적산: 마지막 한 턴만 걸어도 전체 10분이 걷기로 바뀌지 않는다', () => {
    const { w, pl } = setup()
    const s = { ...thermalState(w, pl), low: 10, feels: 0 }
    for (let i = 0; i < THERMAL_TURNS - 1; i++) temperatureTick(w, pl, s)
    expect(pl.needs.bodyTemp).toBe(37)
    temperatureTick(w, pl, { ...s, low: 5 })
    expect(pl.needs.bodyTemp).toBeCloseTo(37 - (199 * 0.2 + 0.1) / 200, 8)
    expect(pl.needs.thermal?.turns).toBe(0)
  })

  it('쾌적 시 37°C로 0.1씩 회복하고 고체온은 42.5°C 초과 시 사망한다', () => {
    const { w, pl } = setup()
    pl.needs.bodyTemp = 36.95
    const s = { ...thermalState(w, pl), feels: 20 }
    expect(temperatureDelta(pl, s)).toBeCloseTo(0.05)
    expect(temperatureDelta(pl, { ...s, feels: 40, high: 25 })).toBeCloseTo(0.3)
    pl.needs.bodyTemp = 42.5
    expect(deathCause(w, pl)).toBeNull()
    pl.needs.bodyTemp = 42.51
    expect(deathCause(w, pl)).toBe('고체온')
  })

  it('NPC도 같은 단열 계산, 지하 1·2층은 6°C·3층 12°C이고 바람은 없다', () => {
    const { w, pl } = setup()
    const npc = createCreature(w, 'Creature.Reaver', { ...pl.pos })
    npc.equip = structuredClone(pl.equip)
    npc.traits = []
    expect(insulation(w, npc)).toBe(insulation(w, pl))
    for (let d = 1; d <= 3; d++) {
      changeMap(w, `crypt${d}`)
      expect(ambientTemp(w)).toBe(d === 3 ? 12 : 6)
      expect(thermalState(w, pl).windChill).toBe(0)
    }
  })

  it('10분 도중 저장·불러오기: 젖음·누적 체온과 이어진 결과가 같다', () => {
    const { w, pl } = setup('Item.LeatherCoat', true)
    w.s.weather = 'ashrain'
    for (let i = 0; i < 123; i++) { w.s.time += 100; needsTick(w, pl, false) }
    const restored = { db, s: deserialize(serialize(w.s)) }
    for (let i = 0; i < 300; i++) {
      w.s.time += 100
      restored.s.time += 100
      needsTick(w, pl, false)
      needsTick(restored, player(restored), false)
    }
    expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })

  it('기존 v2 세이브의 단일 젖음은 영역별 값으로 한 번만 옮긴다', () => {
    const { w, pl } = setup()
    pl.needs.wetness = 80
    delete pl.needs.skinWetness
    for (const it of Object.values(pl.equip) as ItemInst[]) delete it.wetness
    wetnessTick(w, pl)
    expect(player(w).needs.skinWetness?.legs).toBeCloseTo(79.98)
    expect(pl.equip.chest!.wetness?.torso).toBeCloseTo(79.98)
    expect(pl.needs.wetness).toBeCloseTo(79.98)
    expect(pl.needs.thermal).toBeUndefined()
  })
})
