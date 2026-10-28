import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { addWound, painTotal } from '../src/core/body'
import { startCraft } from '../src/core/crafting'
import { invalidateLights } from '../src/core/fov'
import { sleepQuality } from '../src/core/conditions'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { loadMods } from '../src/core/defs'
import { ageFood, finishWash, foodPoison, foodTick, hygieneDaily, poisoningTick, vomit, washSupply } from '../src/core/food-safety'
import { foodFreshness, foodPoisonRisk, freshnessBand, rotTemperature } from '../src/core/food-state'
import { addToBag, canStack, makeItem, splitInBag } from '../src/core/items'
import { nourish } from '../src/core/nutrition'
import { scentTick } from '../src/core/perception'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { activeThoughts } from '../src/core/thoughts'
import { hasEffect } from '../src/core/traits'
import { readPackages } from '../tools/loadContent'
import { makeWorld } from './helpers'

function setup(poison = false) {
  const w = makeWorld('food-safety', 'Bg.Excommunicate'), p = player(w)
  if (poison) w.db = loadMods([...readPackages(), { manifest: { id: 'poison', name: 'test', version: '1' }, defs: [], patches: [{ op: 'replace', target: 'Item.RawMeat', path: '/food/poison', value: 100 }] }]).db
  p.traits = []; p.equip = {}; p.bag = []; p.effects = []; p.thoughts = []; p.body.wounds = []; p.skills = {}; p.background = undefined; p.age = undefined; p.pos = { x: 20, y: 20 }; p.needs.hygiene = 100; p.needs.waterDeficit = 0; p.needs.kcal = -2000
  w.s.creatures = [p]; w.s.weather = 'clear'; w.s.time = 14400 * 100; p.nextAct = w.s.time
  Object.assign(tileAt(w, p.pos), { t: 'Terrain.Earth', roof: true, items: [], cont: undefined })
  return { w, p }
}
function advance(w: World, turns: number) { w.s.time += turns * 100 }

describe('음식 부패와 식중독', () => {
  it('온도 경계와72시간/15도 부패, 영하 보존을 따른다', () => {
    const { w } = setup(), meat = makeItem(w, 'Item.RoastedMeat')
    expect([-1, 0, 1, 5, 6, 10, 15, 20, 21, 30, 31].map((t) => rotTemperature(w, t))).toEqual([0, 0, .3, .3, .6, .6, 1, 1, 2, 2, 3])
    ageFood(w, meat, 15, 72 * TURNS_PER_HOUR); expect(foodFreshness(meat)).toBe(0); expect(freshnessBand(w, meat)).toBe('rotten')
    const frozen = makeItem(w, 'Item.RawMeat'); ageFood(w, frozen, -3, 200 * TURNS_PER_HOUR); expect(foodFreshness(frozen)).toBe(100)
  })
  it('구간60/30/0을 구분하고 밀폐·젖음·먹다 남음·해동 배율을 곱한다', () => {
    const { w } = setup(), meat = makeItem(w, 'Item.RoastedMeat')
    for (const [f, band] of [[60.01, 'fresh'], [60, 'stale'], [30, 'spoiled'], [0, 'rotten']] as const) { meat.freshness = f; expect(freshnessBand(w, meat)).toBe(band) }
    meat.freshness = 100; meat.foodWet = true; meat.foodLeftover = true; meat.foodSealed = true
    ageFood(w, meat, -1, TURNS_PER_HOUR); ageFood(w, meat, 15, TURNS_PER_HOUR)
    expect(meat.foodThawed).toBe(true); expect(foodFreshness(meat)).toBeCloseTo(100 - 100 / 72 * .8 * 1.5 ** 3)
    ageFood(w, meat, -1, TURNS_PER_HOUR); ageFood(w, meat, 15, TURNS_PER_HOUR)
    expect(foodFreshness(meat)).toBeCloseTo(100 - 2 * 100 / 72 * .8 * 1.5 ** 3)
  })
  it('배낭·바닥·밀폐 용기·시체·미활성 지도 음식 모두 같은 시간에 한 번만 부패한다', () => {
    const { w, p } = setup(); w.s.map.kind = 'dungeon'; w.s.map.depth = 1
    const bag = makeItem(w, 'Item.RoastedMeat'), floor = makeItem(w, 'Item.RoastedMeat'), sealed = makeItem(w, 'Item.RoastedMeat')
    p.bag.push(bag); tileAt(w, p.pos).items.push(floor); tileAt(w, p.pos).cont = { items: [sealed], opened: false, kind: '검증' }
    const off = structuredClone(w.s.map); off.id = 'old'; off.tiles.forEach((t) => { t.items = []; t.cont = undefined }); const remote = makeItem(w, 'Item.RoastedMeat'); off.tiles[0].items = [remote]; w.s.maps.old = off
    const dead = structuredClone(p); dead.id = 999; dead.alive = false; dead.bag = [makeItem(w, 'Item.RoastedMeat')]; w.s.offCreatures.old = [dead]
    advance(w, TURNS_PER_HOUR); foodTick(w)
    const expected = 100 - 100 / 72 * .6
    for (const it of [bag, floor, remote, dead.bag[0]]) expect(foodFreshness(it)).toBeCloseTo(expected)
    expect(foodFreshness(sealed)).toBeCloseTo(100 - 100 / 72 * .6 * .8)
    foodTick(w); expect(foodFreshness(bag)).toBeCloseTo(expected)
  })
  it('생성 직후 남은 시간만 차감하고 밀봉 통조림은 무기한 보존한다', () => {
    const { w, p } = setup(); w.s.map.kind = 'dungeon'; w.s.map.depth = 1
    advance(w, 600); const food = makeItem(w, 'Item.RawMeat'), can = makeItem(w, 'Item.CannedMeat'); p.bag.push(food, can)
    advance(w, 600); foodTick(w)
    expect(foodFreshness(food)).toBeCloseTo(100 - 100 / 48 * .6 / 2); expect(foodFreshness(can)).toBe(100)
  })
  it('신선도·젖음·해동·보관 시간이 다른 더미를 합치지 않고 나눔은 보존한다', () => {
    const { w, p } = setup(), food = makeItem(w, 'Item.Jerky', 4); addToBag(w, p, food)
    const piece = splitInBag(w, p, food.uid, 2, 2, 0)!
    expect(canStack(food, piece)).toBe(true); expect(piece.freshness).toBe(food.freshness)
    piece.freshness = 30; expect(canStack(food, piece)).toBe(false)
    piece.freshness = food.freshness; piece.foodThawed = true; expect(canStack(food, piece)).toBe(false)
  })
  it('상한 날고기/더러운 손43%, 조리/생존2단계26%, 철위장×0.3을 적용한다', () => {
    const { w, p } = setup(), raw = makeItem(w, 'Item.RawMeat'), cooked = makeItem(w, 'Item.RoastedMeat')
    raw.freshness = 20; cooked.freshness = 20; p.needs.hygiene = 30; p.skills.survival = 15
    expect(foodPoisonRisk(w, p, raw)).toBeCloseTo(.43); expect(foodPoisonRisk(w, p, cooked)).toBeCloseTo(.26)
    p.traits = ['Trait.IronStomach']; expect(foodPoisonRisk(w, p, raw)).toBeCloseTo(.129)
  })
  it('철위장은 날것/상한 맛 기분을 무시하지만 식중독 위험은 남는다', () => {
    const { w, p } = setup(), food = makeItem(w, 'Item.RawMeat'); p.traits = ['Trait.IronStomach']; food.freshness = 20; p.bag.push(food)
    expect(foodPoisonRisk(w, p, food)).toBeGreaterThan(0); expect(perform(w, p, { type: 'consume', uid: food.uid }).ok).toBe(true)
    expect(p.thoughts.some((t) => t.def === 'Thought.AteRaw' || t.def === 'Thought.StaleFood')).toBe(false)
  })
  it('위험0 음식을 먹으면 식중독 난수를 쓰지 않는다', () => {
    const { w, p } = setup(), jerky = makeItem(w, 'Item.Jerky'), before = structuredClone(w.s.rng.body)
    p.bag.push(jerky); expect(perform(w, p, { type: 'consume', uid: jerky.uid }).ok).toBe(true)
    expect(w.s.rng.body).toEqual(before); expect(p.needs.kcal).toBe(-1902)
  })
  it('먹기 행동에서12~36시간 식중독/1~3구토를 만들고 직전 열량과800ml를 잃는다', () => {
    const { w, p } = setup(true), raw = makeItem(w, 'Item.RawMeat'); p.bag.push(raw)
    expect(perform(w, p, { type: 'consume', uid: raw.uid }).ok).toBe(true)
    expect(p.needs.kcal).toBe(-2000); expect(p.needs.waterDeficit).toBe(800)
    expect(p.needs.poisoning!.until - turnOf(w)).toBeGreaterThanOrEqual(12 * TURNS_PER_HOUR)
    expect(p.needs.poisoning!.until - turnOf(w)).toBeLessThanOrEqual(36 * TURNS_PER_HOUR)
    expect(p.needs.poisoning!.vomitAt.length).toBeLessThanOrEqual(2); expect(hasEffect(p, 'foodPoisoning', turnOf(w))).toBe(true)
    expect(activeThoughts(w, p).find((t) => t.def === 'Thought.FoodPoisoning')!.mood).toBe(-10); expect(painTotal(w, p)).toBe(10)
  })
  it('중간 저장 후 예약 구토·새 식사 상실·회복이 일치하고 두 번 처리하지 않는다', () => {
    const { w, p } = setup(true), raw = makeItem(w, 'Item.RawMeat'); nourish(w, p, 300); expect(foodPoison(w, p, raw)).toBe(true)
    p.needs.poisoning!.vomitAt = [turnOf(w) + 100, turnOf(w) + 200]
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const state of [w, copy]) {
      const c = player(state); nourish(state, c, 70); advance(state, 100); poisoningTick(state, c); expect(c.needs.kcal).toBe(-2000)
      const water = c.needs.waterDeficit; poisoningTick(state, c); expect(c.needs.waterDeficit).toBe(water)
      advance(state, 100); poisoningTick(state, c); expect(c.needs.waterDeficit).toBe(2400)
      state.s.time = c.needs.poisoning!.until * 100; poisoningTick(state, c); expect(c.needs.poisoning).toBeUndefined(); expect(hasEffect(c, 'foodPoisoning', turnOf(state))).toBe(false)
    }
    expect(stateHash(w.s)).toBe(stateHash(copy.s))
  })
  it('과식 상한을 넘은 열량과 물만 마신 것은 직전 식사에 포함하지 않는다', () => {
    const { w, p } = setup(); p.needs.kcal = 2950; nourish(w, p, 300); expect(p.needs.lastMealKcal).toBe(50)
    nourish(w, p, 0); vomit(w, p); expect(p.needs.kcal).toBe(2950); vomit(w, p); expect(p.needs.kcal).toBe(2950)
  })
  it('직접 굽기와 제작 창 조리 모두 상한 재료의 신선도를 보존한다', () => {
    for (const direct of [true, false]) {
      const { w, p } = setup(), raw = makeItem(w, 'Item.RawMeat'); raw.freshness = 20; raw.foodThawed = true; p.bag.push(raw)
      w.s.map.lights = [{ pos: { ...p.pos }, radius: 6, kind: 'campfire' }]; invalidateLights(w)
      if (direct) expect(perform(w, p, { type: 'cook', uid: raw.uid }).ok).toBe(true)
      else expect(startCraft(w, p, 'Recipe.RoastMeat', 1)).toBeNull()
      for (let i = 0; p.activity && i < 1000; i++) activityStep(w, p)
      const out = p.bag.find((i) => i.def === 'Item.RoastedMeat')!; expect(out).toBeDefined(); expect(out.freshness).toBe(20); expect(out.foodThawed).toBe(true)
    }
  })
  it('부패 틱 전후 중간 저장은 배낭·미활성 음식의 시간/신선도와 해시가 일치한다', () => {
    const { w, p } = setup(); p.bag.push(makeItem(w, 'Item.RawMeat')); advance(w, 600)
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }
    for (const state of [w, copy]) { advance(state, 600); foodTick(state); advance(state, 1200); foodTick(state) }
    expect(stateHash(w.s)).toBe(stateHash(copy.s))
  })
  it('썩은 음식은 시체와 같은 냄새를 내고 정상 날고기는 기존 냄새다', () => {
    const { w, p } = setup(), raw = makeItem(w, 'Item.RawMeat'); advance(w, 1); p.bag.push(raw); scentTick(w, p, 0); expect(p.scent).toBe(1)
    raw.freshness = 0; scentTick(w, p, 0); expect(p.scent).toBe(3)
  })
})

describe('위생과 씻기', () => {
  it('손 위생40미만은 새 외부 상처+5,20미만+10, 내부 장기는 제외한다', () => {
    const { w, p } = setup(); const wound = () => addWound(w, p, { def: 'Wound.Cut', part: 'LeftHand', severity: 2, source: '검증' }).wound.contam
    const base = wound(); p.body.wounds = []; p.needs.hygiene = 39; expect(wound()).toBe(base + 5)
    p.body.wounds = []; p.needs.hygiene = 19; expect(wound()).toBe(base + 10)
    p.body.wounds = []; const internal = addWound(w, p, { def: 'Wound.Cut', part: 'Stomach', severity: 2, source: '검증', internal: true }).wound.contam
    p.body.wounds = []; p.needs.hygiene = 100; expect(addWound(w, p, { def: 'Wound.Cut', part: 'Stomach', severity: 2, source: '검증', internal: true }).wound.contam).toBe(internal)
  })
  it('씻기 시작/중단에는 물을 쓰지 않고 완료 때 여러 병의2L를 소비한다', () => {
    const { w, p } = setup(); p.needs.hygiene = 20; const a = makeItem(w, 'Item.WaterBottle'), b = makeItem(w, 'Item.WaterBottle'); p.bag.push(a, b)
    expect(washSupply(w, p).available).toBe(true); expect(perform(w, p, { type: 'wash' }).ok).toBe(true); expect(a.uses).toBe(5)
    activityStep(w, p); p.activity = undefined; expect(a.uses).toBe(5); expect(p.needs.hygiene).toBe(20)
    expect(finishWash(w, p)).toBe(true); expect(p.needs.hygiene).toBe(80); expect(a.uses).toBe(0); expect(b.uses).toBe(0)
    expect(finishWash(w, p)).toBe(false); expect(p.needs.hygiene).toBe(80)
  })
  it('완료 전에 물을 잃으면 다른 자원을 일부 소비하지 않는다', () => {
    const { w, p } = setup(), a = makeItem(w, 'Item.WaterBottle'), b = makeItem(w, 'Item.WaterBottle'); p.bag.push(a, b)
    expect(perform(w, p, { type: 'wash' }).ok).toBe(true); p.bag.pop(); expect(finishWash(w, p)).toBe(false); expect(a.uses).toBe(5)
  })
  it('찬물 목욕은 위생+60·젖음100·체온−0.3이고 이를 제거한다', () => {
    const { w, p } = setup(); tileAt(w, p.pos).t = 'Terrain.ShallowWater'; p.needs.hygiene = 5; p.effects = [{ kind: 'lice', untilTurn: Number.MAX_SAFE_INTEGER }]
    const plain = sleepQuality(w, { ...p, effects: [] }); expect(sleepQuality(w, p)).toBeCloseTo(plain * .9)
    expect(activeThoughts(w, p).find((t) => t.def === 'Thought.Lice')!.mood).toBe(-3)
    expect(finishWash(w, p)).toBe(true); expect(p.needs.hygiene).toBe(65); expect(p.needs.bodyTemp).toBeCloseTo(36.7); expect(p.needs.wetness).toBe(100); expect(hasEffect(p, 'lice', turnOf(w))).toBe(false)
  })
  it('위생을 끄면 모든 인물H70·이 제거·일일 이 난수 없음과 저장 복원을 유지한다', () => {
    const { w, p } = setup(); p.needs.hygiene = 2; p.effects = [{ kind: 'lice', untilTurn: Number.MAX_SAFE_INTEGER }]
    const before = structuredClone(w.s.rng.body); expect(perform(w, p, { type: 'hygiene', enabled: false }).ok).toBe(true)
    expect(p.needs.hygiene).toBe(70); expect(p.effects).toEqual([]); hygieneDaily(w, p); expect(w.s.rng.body).toEqual(before)
    const restored = deserialize(serialize(w.s)); expect(restored.hygieneEnabled).toBe(false); expect(player({ db: w.db, s: restored }).needs.hygiene).toBe(70)
  })
})
