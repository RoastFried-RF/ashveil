import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { aiDecide } from '../src/core/ai'
import { botDecide } from '../src/core/bot'
import { addWound } from '../src/core/body'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR } from '../src/core/ctx'
import { foodPoisonRisk } from '../src/core/food-state'
import { finishWash } from '../src/core/food-safety'
import { invalidateLights } from '../src/core/fov'
import { playerAct } from '../src/core/game'
import { dirtyHands, finishHandWash, handQuality, handState, washHandsError } from '../src/core/hand-hygiene'
import { addToBag, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { startTreatment, treatQuality } from '../src/core/treatment'
import { drinkVolume, spendWashWater, washWaterSupply } from '../src/core/wash-water'
import { makeWorld } from './helpers'
function setup() {
  const w = makeWorld('hands', 'Bg.Excommunicate'), p = player(w)
  w.s.creatures = [p]; p.pos = { x: 20, y: 20 }; w.s.time = 12 * TURNS_PER_HOUR * 100; p.nextAct = w.s.time; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }
  p.hp = 95; p.age = undefined; p.background = undefined; p.traits = []; p.effects = []; p.traumas = []; p.thoughts = []; p.bag = []; p.equip = {}; p.body.wounds = []; p.body.missing = []; p.body.blood = p.body.bloodMax; p.stats = { str: 10, agi: 10, per: 13, vit: 10, wil: 10 }; p.skills = { medicine: 50 }
  Object.assign(p.needs, { kcal: 1000, waterDeficit: 600, fatigue: 10, bodyTemp: 37, wetness: 0, protein: 100, vitamin: 100, hygiene: 100, stress: 0 })
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  w.s.map.lights = [{ pos: { ...p.pos }, radius: 8, kind: 'campfire' }]; invalidateLights(w)
  const add = (def: string, count = 1) => { const it = makeItem(w, def, count); expect(addToBag(w, p, it)).toBe(0); return it }
  const finish = () => { for (let i = 0; p.activity && i < 1000; i++) activityStep(w, p); expect(p.activity).toBeUndefined() }
  return { w, p, add, finish }
}
describe('손 위생·실제 물 정산', () => {
  it('200ml/3턴만 쓰고 전신 위생·갈증·물병 UID를 바꾸지 않는다', () => {
    const { w, p, add } = setup(), water = add('Item.WaterBottle'), now = w.s.time, hygiene = p.needs.hygiene
    dirtyHands(w, p); expect(playerAct(w, { type: 'washHands' })).toBeNull()
    expect(w.s.time).toBe(now + 300); expect(drinkVolume(w, water)).toBe(800); expect(water.uses).toBe(4); expect(p.bag[0].uid).toBe(water.uid); expect(p.needs.hygiene).toBe(hygiene); expect(p.needs.waterDeficit).toBeGreaterThanOrEqual(600); expect(handState(w, p)).toBe('washed')
  })
  it('검산B의 씻은 손5로Q87·보통82·더러운 손72이고 조회는 읽기 전용이다', () => {
    const { w, p, add } = setup(), patient = createCreature(w, 'Creature.SettlementDoctor', { x: 21, y: 20 }); w.s.creatures.push(patient)
    const quality = () => treatQuality(w, p, 15, undefined, { patient }).q
    expect(quality()).toBe(82); add('Item.WaterBottle'); expect(finishHandWash(w, p)).toBe(true); const before = stateHash(w.s)
    expect(quality()).toBe(87); expect(handQuality(w, p)).toBe(5); expect(stateHash(w.s)).toBe(before)
    dirtyHands(w, p); expect(quality()).toBe(72)
    p.traits = ['Trait.Neat']; expect(quality()).toBe(77)
  })
  it('씻은 손은1시간 뒤 보통으로 돌아가고 피·흙 오염은 저절로 사라지지 않는다', () => {
    const { w, p, add } = setup(); add('Item.WaterBottle'); finishHandWash(w, p); w.s.time += TURNS_PER_HOUR * 100; expect(handState(w, p)).toBe('normal')
    dirtyHands(w, p); w.s.time += TURNS_PER_HOUR * 100; expect(handState(w, p)).toBe('dirty')
  })
  it('찬 술·얼어붙은 물·200ml 미만은 손 씻기에 쓰지 않으며 실패는 무변경이다', () => {
    const { w, p, add } = setup(); add('Item.Moonshine'); const water = add('Item.WaterBottle'); water.uses = .5; const snapshot = structuredClone(w.s)
    expect(finishHandWash(w, p)).toBe(false); snapshot.log = structuredClone(w.s.log); expect(w.s).toEqual(snapshot)
    water.uses = 5; water.waterFrozen = true; const before = stateHash(w.s); expect(perform(w, p, { type: 'washHands' }).ok).toBe(false); expect(stateHash(w.s)).toBe(before)
  })
  it('여러 병의 잔량을 합산하고50ml+150ml를 정확히 사용한다', () => {
    const { w, p, add } = setup(), a = add('Item.WaterBottle'), b = add('Item.WaterBottle'); a.uses = .25; b.uses = .75
    expect(washWaterSupply(w, p, 200).water).toBe(200); expect(finishHandWash(w, p)).toBe(true); expect([a.uses, b.uses]).toEqual([0, 0]); expect(p.bag.map((i) => i.uid)).toEqual([a.uid, b.uid]); expect(p.bag.every((i) => !i.water)).toBe(true)
  })
  it('음수·NaN·소수 ml 요청으로 물을 늘리거나 잔량을 바꾸지 못한다', () => {
    const { w, p, add } = setup(); add('Item.WaterBottle'); const before = stateHash(w.s)
    for (const ml of [-200, NaN, .5]) expect(spendWashWater(w, p, ml)).toBe(false)
    expect(stateHash(w.s)).toBe(before)
  })
  it('일부 물을 쓴 뒤 마지막100ml만 마시며200ml를 복제하지 않는다', () => {
    const { w, p, add } = setup(), water = add('Item.WaterBottle'); expect(spendWashWater(w, p, 900)).toBe(true); expect(water.uses).toBe(.5)
    const deficit = p.needs.waterDeficit; expect(perform(w, p, { type: 'consume', uid: water.uid }).ok).toBe(true); expect(p.needs.waterDeficit).toBe(deficit - 100); expect(water.uses).toBe(0)
  })
  it('손 씻기 도중 중단/물 소실은 물 소비나 청결 효과를 만들지 않는다', () => {
    const { w, p, add, finish } = setup(), water = add('Item.WaterBottle'); dirtyHands(w, p)
    perform(w, p, { type: 'washHands' }); activityStep(w, p); expect(water.uses).toBe(5); p.activity = undefined; expect(handState(w, p)).toBe('dirty')
    perform(w, p, { type: 'washHands' }); p.bag = []; finish(); expect(handState(w, p)).toBe('dirty'); expect(p.bag).toEqual([])
  })
  it('물가에서는 병을 쓰지 않고 얼음이 닫히면 실제 물을 확인한다', () => {
    const { w, p, add } = setup(), water = add('Item.WaterBottle'), tile = tileAt(w, p.pos); tile.t = 'Terrain.ShallowWater'
    expect(finishHandWash(w, p)).toBe(true); expect(water.uses).toBe(5); tile.icy = true; water.uses = 0; expect(washHandsError(w, p)).toContain('200ml')
    tile.iceHoleUntil = turnOf(w) + 10; expect(washHandsError(w, p)).toBeNull()
  })
  it('손 없는 개체는 물을 쓰지 못하고 전신 목욕은 손도 씻는다', () => {
    const { w, p, add } = setup(); add('Item.WaterBottle'); add('Item.WaterBottle'); dirtyHands(w, p)
    expect(finishWash(w, p)).toBe(true); expect(handState(w, p)).toBe('washed'); p.body.missing = ['LeftUpperArm','RightUpperArm']; const before = stateHash(w.s); expect(perform(w, p, { type: 'washHands' }).ok).toBe(false); expect(stateHash(w.s)).toBe(before)
  })
  it('붕대는 시작 손 상태로Q를 계산한 뒤 손에 피가 묻고 다음 처치의 오염이5 증가한다', () => {
    const { w, p, add, finish } = setup(), water = add('Item.WaterBottle'); finishHandWash(w, p); const bandage = add('Item.MedicalBag')
    const wound = () => addWound(w, p, { def: 'Wound.Cut', part: 'LeftShin', severity: 2, contam: 10, source: '손 위생 검증' }).wound
    const a = wound(), expected = treatQuality(w, p, 15, a).q, before = a.contam; expect(startTreatment(w, p, bandage.uid, a.id).ok).toBe(true); finish(); expect(a.bandage!.quality).toBe(expected); expect(a.contam).toBe(before); expect(handState(w, p)).toBe('dirty')
    const b = wound(), beforeDirty = b.contam; expect(startTreatment(w, p, bandage.uid, b.id).ok).toBe(true); finish(); expect(b.contam).toBe(beforeDirty + 5); expect(b.bandage!.quality).toBeLessThan(expected); expect(water.uses).toBe(4)
  })
  it('의사는 위협/갈증 뒤 자신의 실제 물로 더러운 손을 씻는 행동을 선택한다', () => {
    const { w, p, add } = setup(), doctor = createCreature(w, 'Creature.SettlementDoctor', { x: 21, y: 20 }); w.s.creatures.push(doctor); doctor.bag = [add('Item.WaterBottle')]; p.bag = []; doctor.needs.kcal = 1000; doctor.needs.waterDeficit = 0
    doctor.faction = p.faction; dirtyHands(w, doctor); expect(aiDecide(w, doctor)).toEqual({ type: 'washHands' }); doctor.bag = []; expect(aiDecide(w, doctor)).not.toEqual({ type: 'washHands' })
  })
  it('손의 실제 오염은 멀쩡한 전신 위생과 별개로 음식 위험에 반영된다', () => {
    const { w, p, add } = setup(), food = add('Item.Jerky'), clean = foodPoisonRisk(w, p, food); dirtyHands(w, p); expect(foodPoisonRisk(w, p, food)).toBeGreaterThan(clean)
  })
  it('채집은 첫 실제 작업 턴에 손을 더럽히며 중단하면 재료를 만들지 않는다', () => {
    const { w, p, add } = setup(); add('Item.WaterBottle'); finishHandWash(w, p); const pos = { x: 21, y: 20 }; tileAt(w, pos).t = 'Terrain.Tree'
    const bag = structuredClone(p.bag); expect(perform(w, p, { type: 'gather', pos }).ok).toBe(true); activityStep(w, p); expect(handState(w, p)).toBe('dirty'); p.activity = undefined; expect(p.bag).toEqual(bag)
  })
  it('손 씻기 도중 저장한 잔량/손/활동은 동일하게 완료된다', () => {
    const { w, p, add } = setup(); add('Item.WaterBottle'); dirtyHands(w, p); perform(w, p, { type: 'washHands' }); activityStep(w, p)
    const copy = { db: w.db, s: deserialize(serialize(w.s)) }; for (const env of [w, copy]) { const actor = player(env); while (actor.activity) activityStep(env, actor) }
    expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
  it('생존 봇은 안전한 식사 전에 실제 손을 씻고 물이 없으면 식사를 무한히 미루지 않는다', () => {
    const { w, p, add, finish } = setup(); p.needs.kcal = -600; p.needs.waterDeficit = 0; p.statPoints = 0; p.abilityPoints = 0; p.abilities = []; p.equip.main = makeItem(w, 'Item.RustyKnife'); const water = add('Item.WaterBottle'), food = add('Item.Hardtack'); dirtyHands(w, p)
    expect(botDecide(w)).toEqual({ type: 'washHands' }); expect(perform(w, p, { type: 'washHands' }).ok).toBe(true); finish(); expect(water.uses).toBe(4); expect(botDecide(w)).toEqual({ type: 'consume', uid: food.uid })
    dirtyHands(w, p); water.uses = 0; expect(botDecide(w)).toEqual({ type: 'consume', uid: food.uid })
  })
})
