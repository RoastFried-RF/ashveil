import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { partEff, partHealth } from '../src/core/body'
import { diseaseTick } from '../src/core/conditions'
import { player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { nourish } from '../src/core/nutrition'
import { recoveryLines } from '../src/core/recovery'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { hasEffect } from '../src/core/traits'
import { drinkContaminants, nearbyWater, startWaterTreatment, waterDaily, waterTick } from '../src/core/water'
import { calorieAbsorption, treatedWater, waterLines, waterQuality, waterSafetyDef } from '../src/core/water-state'
import { makeWorld } from './helpers'

function setup() {
  const w = makeWorld('water-safety', 'Bg.Excommunicate'), p = player(w)
  p.traits = []; p.equip = {}; p.bag = []; p.effects = []; p.thoughts = []; p.body.wounds = []; p.background = undefined; p.age = undefined; p.pos = { x: 20, y: 20 }; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.skills = {}; p.hp = 90; p.body.blood = p.body.bloodMax
  Object.assign(p.needs, { kcal: 0, waterDeficit: 0, fatigue: 20, bodyTemp: 37, vitamin: 100, protein: 100, hygiene: 100 })
  w.s.creatures = [p]; w.s.time = 14400 * 100; p.nextAct = w.s.time; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.noiseEvents = []
  w.s.map = { ...w.s.map, lights: [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }] }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  invalidateLights(w)
  return { w, p }
}
function add(w: World, id: string, count = 1) { const it = makeItem(w, id, count); expect(addToBag(w, player(w), it)).toBe(0); return it }
function finish(w: World) { const p = player(w); for (let i = 0; p.activity && i < 2000; i++) activityStep(w, p); expect(p.activity).toBeUndefined() }

describe('병원체와 재가 분리된 물', () => {
  it('개울물1L 재+1.5, 끓인 물+1.65, 산성도3재비물+6.4를 검산한다', () => {
    const { w, p } = setup(), d = waterSafetyDef(w)
    drinkContaminants(w, p, d.sources.stream, 1000); expect(p.needs.ash).toBe(1.5)
    p.needs.ash = 0; const boiled = treatedWater(w, d.sources.stream, 'boil'); expect(boiled.pathogen).toBe(0); expect(boiled.ash).toBe(16.5)
    drinkContaminants(w, p, boiled, 1000); expect(p.needs.ash).toBe(1.65)
    p.needs.ash = 0; drinkContaminants(w, p, { ...d.sources.rain, ash: 64 }, 1000); expect(p.needs.ash).toBe(6.4)
  })
  it('1L 한 번과200ml 다섯 번의500ml 감염 판정·난수·재가 일치한다', () => {
    const { w, p } = setup(), copy: World = { db: w.db, s: deserialize(serialize(w.s)) }, q = waterSafetyDef(w).sources.stream
    drinkContaminants(w, p, q, 1000)
    for (let i = 0; i < 5; i++) drinkContaminants(copy, player(copy), q, 200)
    expect(stateHash(w.s)).toBe(stateHash(copy.s)); expect(p.needs.waterExposure!.ml).toBe(0)
  })
  it('물200ml의 노출 잔여와 다른 수질 혼합도 중간 저장으로 보존한다', () => {
    const { w, p } = setup(), q = waterSafetyDef(w).sources.stream
    drinkContaminants(w, p, q, 200); expect(p.needs.waterExposure).toEqual({ ml: 200, pathogenMl: 7000 })
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const state of [w, copy]) drinkContaminants(state, player(state), { pathogen: 0, ash: 0 }, 300)
    expect(stateHash(w.s)).toBe(stateHash(copy.s)); expect(p.needs.waterExposure).toEqual({ ml: 0, pathogenMl: 0 })
  })
  it('병원체0의 물은 새 감염 난수를 소비하지 않고 재는 남는다', () => {
    const { w, p } = setup(), before = structuredClone(w.s.rng.body)
    drinkContaminants(w, p, { pathogen: 0, ash: 16.5 }, 1000); expect(w.s.rng.body).toEqual(before); expect(p.diseases).toBeUndefined(); expect(p.needs.ash).toBe(1.65)
  })
  it('천/숯/침전/정수정은 서로 다른 오염 배율을 적용한다', () => {
    const { w } = setup(), q = { pathogen: 70, ash: 20 }
    expect(treatedWater(w, q, 'cloth')).toMatchObject({ pathogen: 56, ash: 14 })
    expect(treatedWater(w, q, 'charcoal')).toMatchObject({ pathogen: 49, ash: 8 })
    expect(treatedWater(w, q, 'settle')).toMatchObject({ pathogen: 70, ash: 12 })
    expect(treatedWater(w, q, 'pill')).toMatchObject({ pathogen: 0, ash: 20 })
  })
  it('초기 구형 물병은 안전/더러움 기본값을 읽고 생존 숙달은 단계만 보여준다', () => {
    const { w, p } = setup(), clean = makeItem(w, 'Item.WaterBottle'), dirty = makeItem(w, 'Item.DirtyWaterBottle')
    expect(waterQuality(w, clean)).toMatchObject({ pathogen: 0, ash: 0 }); expect(waterQuality(w, dirty)).toMatchObject({ pathogen: 70, ash: 20 })
    expect(waterLines(w, p, dirty)[0]).toContain('탁함'); p.skills.survival = 5
    expect(waterLines(w, p, dirty)[0]).toContain('병원체 매우 높음 / 재 보통'); expect(waterLines(w, p, dirty)[0]).not.toMatch(/70|20/)
  })
  it('물가 채우기는 오염을 담고 인접 시체는 병원체30을 더한다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.WaterBottle'); tileAt(w, { x: 21, y: 20 }).t = 'Terrain.ShallowWater'
    const dead = structuredClone(p); dead.id = 999; dead.alive = false; dead.pos = { x: 22, y: 20 }; w.s.creatures.push(dead)
    expect(nearbyWater(w, p)!.quality).toMatchObject({ pathogen: 100, ash: 20 }); expect(perform(w, p, { type: 'fillBottle', uid: bottle.uid }).ok).toBe(true)
    expect(bottle.uses).toBe(5); expect(bottle.water).toMatchObject({ pathogen: 100, ash: 20 })
  })
  it('지붕 없는 재비에서는 산성도 기본값을 적용하고 지붕 아래서는 받지 못한다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.WaterBottle'); w.s.weather = 'ashrain'
    expect(perform(w, p, { type: 'collectRain', uid: bottle.uid }).ok).toBe(false)
    tileAt(w, p.pos).roof = false; expect(perform(w, p, { type: 'collectRain', uid: bottle.uid }).ok).toBe(true)
    expect(bottle.water).toMatchObject({ pathogen: 5, ash: 64 })
  })
})

describe('정수 행동·자원·침전', () => {
  it('끓이기200턴의 마지막TU까지 진행하며 물 양·재를 보존하고 연료1을 쓴다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'), fuel = add(w, 'Item.Wood', 2), before = w.s.time
    bottle.uses = 2; bottle.water = { pathogen: 35, ash: 15, source: '개울물' }
    expect(playerAct(w, { type: 'waterTreatment', uid: bottle.uid, method: 'boil' })).toBeNull()
    expect(w.s.time - before).toBe(20000); expect(fuel.count).toBe(1); expect(bottle.uses).toBe(2); expect(bottle.def).toBe('Item.WaterBottle'); expect(bottle.water).toMatchObject({ pathogen: 0, ash: 16.5 }); expect(p.skills.survival).toBe(1)
  })
  it('숙달3은200턴을170턴으로 줄이고 중단은 연료를 쓰지 않는다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'), fuel = add(w, 'Item.Wood'); p.skills.survival = 30
    expect(startWaterTreatment(w, p, bottle.uid, 'boil', 1)).toBeNull(); expect(p.activity!.total).toBe(170)
    for (let i = 0; i < 17; i++) activityStep(w, p)
    p.activity = undefined; expect(fuel.count).toBe(1); expect(bottle.def).toBe('Item.DirtyWaterBottle')
  })
  it('불이 꺼지거나 정확히 쓰던 필터가 바뀌면 다른 자원을 쓰지 않는다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'), fuel = add(w, 'Item.Wood')
    expect(startWaterTreatment(w, p, bottle.uid, 'boil', 1)).toBeNull(); w.s.map.lights[0].off = true; finish(w); expect(fuel.count).toBe(1)
    const filter = add(w, 'Item.ClothFilter'); expect(startWaterTreatment(w, p, bottle.uid, 'cloth', 1)).toBeNull(); p.bag = p.bag.filter((i) => i.uid !== filter.uid); const replacement = add(w, 'Item.ClothFilter'); finish(w); expect(replacement.uses).toBe(10); expect(bottle.def).toBe('Item.DirtyWaterBottle')
  })
  it('같은 UID 병을 몰래 다시 채웠을 때 완료 조건을 다시 검사한다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'), filter = add(w, 'Item.ClothFilter')
    expect(startWaterTreatment(w, p, bottle.uid, 'cloth', 1)).toBeNull(); bottle.water = { pathogen: 10, ash: 10 }; finish(w)
    expect(filter.uses).toBe(10); expect(bottle.water).toEqual({ pathogen: 10, ash: 10 })
  })
  it('열 번 쓰는 천 여과포와1개 정수정을 완료 때만 소비한다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'), filter = add(w, 'Item.ClothFilter'); filter.uses = 1
    expect(startWaterTreatment(w, p, bottle.uid, 'cloth', 1)).toBeNull(); finish(w); expect(p.bag.some((i) => i.uid === filter.uid)).toBe(false); expect(bottle.water).toMatchObject({ pathogen: 56, ash: 14 })
    const pills = add(w, 'Item.WaterPill', 2); expect(startWaterTreatment(w, p, bottle.uid, 'pill', 1)).toBeNull(); finish(w); expect(pills.count).toBe(1); expect(bottle.water).toMatchObject({ pathogen: 0, ash: 14 })
  })
  it('중간 저장한 정수 활동이 물/필터/난수/시간을 같은 상태로 마친다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'); add(w, 'Item.CharcoalFilter'); startWaterTreatment(w, p, bottle.uid, 'charcoal', 1)
    for (let i = 0; i < 7; i++) activityStep(w, p)
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }; finish(w); finish(copy); expect(stateHash(w.s)).toBe(stateHash(copy.s))
  })
  it('침전은 바닥6시간·미활성 지도에서도 진행하고 두 번 처리하지 않는다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'); expect(startWaterTreatment(w, p, bottle.uid, 'settle', 1)).toBeNull()
    expect(p.bag.some((i) => i.uid === bottle.uid)).toBe(false); expect(tileAt(w, p.pos).items[0]).toBe(bottle)
    const at = bottle.waterSettlesAt!; w.s.time = (at - 1200) * 100; waterTick(w); expect(bottle.water).toBeUndefined()
    const map = structuredClone(w.s.map); map.id = 'inactive'; w.s.maps.inactive = map; w.s.map.tiles.forEach((t) => { t.items = [] })
    w.s.time = at * 100; waterTick(w); const remote = w.s.maps.inactive.tiles[p.pos.y * map.w + p.pos.x].items[0]
    expect(remote.water).toMatchObject({ pathogen: 70, ash: 12 }); waterTick(w); expect(remote.water!.ash).toBe(12)
  })
  it('침전 중 물병을 집으면 흔들려 침전 타이머를 취소한다', () => {
    const { w, p } = setup(), bottle = add(w, 'Item.DirtyWaterBottle'); startWaterTreatment(w, p, bottle.uid, 'settle', 1)
    expect(perform(w, p, { type: 'pickup', uid: bottle.uid }).ok).toBe(true); expect(p.bag.find((i) => i.uid === bottle.uid)!.waterSettlesAt).toBeUndefined()
    w.s.time += 6 * TURNS_PER_HOUR * 100; waterTick(w); expect(p.bag.find((i) => i.uid === bottle.uid)!.water).toBeUndefined()
  })
})

describe('재 축적·장기 손상·이질', () => {
  it('재30의 열량 흡수.9와60의 일일 신장HP1 손상이 감쇠 후에도 남는다', () => {
    const { w, p } = setup(); p.needs.ash = 30; expect(calorieAbsorption(w, p)).toBe(.9); nourish(w, p, 100); expect(p.needs.kcal).toBe(90)
    p.needs.ash = 60; expect(partEff(w, p, 'LeftKidney')).toBe(1); waterDaily(w, p)
    expect(p.needs.ash).toBe(59); expect(p.body.organDamage).toEqual({ LeftKidney: 1, RightKidney: 1 }); expect(partEff(w, p, 'LeftKidney')).toBeCloseTo(11 / 12); expect(partHealth(w, p, 'RightKidney')).toBeCloseTo(11 / 12)
    waterDaily(w, p); expect(p.body.organDamage!.LeftKidney).toBe(1); expect(recoveryLines(w, p).join(' ')).toContain('영구 손상')
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }; expect(partEff(copy, player(copy), 'LeftKidney')).toBeCloseTo(11 / 12)
  })
  it('이질은 잠복 중 흡수 정상·발병 후.5·추가 발열 없음·완치 후 재감염 가능하다', () => {
    const { w, p } = setup(), now = turnOf(w); p.diseases = [{ def: 'Disease.Dysentery', incubatesUntil: now + TURNS_PER_DAY, progress: 0, immunity: 0 }]
    diseaseTick(w, p, false); expect(calorieAbsorption(w, p)).toBe(1)
    w.s.time += TURNS_PER_DAY * 100; diseaseTick(w, p, false); expect(hasEffect(p, 'dysentery', turnOf(w))).toBe(true); expect(hasEffect(p, 'fever', turnOf(w))).toBe(false); expect(p.needs.bodyTemp).toBe(37); expect(calorieAbsorption(w, p)).toBe(.5)
    p.diseases[0].immunity = 99.9; w.s.time += TURNS_PER_HOUR * 100; diseaseTick(w, p, false); expect(p.diseases).toEqual([]); expect(p.immuneDiseases?.includes('Disease.Dysentery') ?? false).toBe(false); expect(calorieAbsorption(w, p)).toBe(1)
  })
})
