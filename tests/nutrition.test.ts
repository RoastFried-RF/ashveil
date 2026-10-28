import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { autoSnap, autoStop } from '../src/core/autostop'
import { multiTurnFactor, perform, stumbleChance } from '../src/core/actions'
import { bodyTick, capacity, deathCause, effectiveBleed } from '../src/core/body'
import { evasion } from '../src/core/combat'
import { sleepQuality, sleepRecoveryPerHour } from '../src/core/conditions'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY } from '../src/core/ctx'
import { invalidateLights } from '../src/core/fov'
import { addToBag, makeItem } from '../src/core/items'
import { playerAct } from '../src/core/game'
import { needsTick } from '../src/core/needs'
import { hydrate, metabolismRate, metabolismTick, nourish } from '../src/core/nutrition'
import { hungerStage, nutritionMultiplier, thirstStage } from '../src/core/nutrition-state'
import { gainXp } from '../src/core/progression'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { thermalState } from '../src/core/thermal'
import { addThought, mood } from '../src/core/thoughts'
import { effectiveStat, hasEffect } from '../src/core/traits'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('nutrition', 'Bg.Excommunicate'), p = player(w)
  p.age = undefined; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.traits = []; p.background = undefined; p.abilities = []; p.equip = {}; p.bag = []; p.body.wounds = []; p.effects = []; p.thoughts = []; p.skills = {}; p.body.blood = p.body.bloodMax; p.hp = 90; p.needs.stress = 0; p.needs.fatigue = 20; p.needs.bodyTemp = 37; p.exerted = false; p.rested = false
  p.pos = { x: 20, y: 20 }; w.s.creatures = [p]; w.s.time = 14400 * 100; p.nextAct = w.s.time; w.s.map.lights = []; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [] })
  invalidateLights(w)
  const warm = { ...thermalState(w, p), feels: 20, low: 17, high: 26 }
  return { w, p, warm }
}
function mode(p: ReturnType<typeof player>, kind: string, turn: number) {
  p.activity = kind === 'work' ? { kind: 'craft', remaining: 1, label: '검증' } : undefined
  p.exerted = kind === 'combat'; p.rested = kind === 'rest'; p.movedTurn = kind === 'walk' ? turn : undefined
}

describe('정본 대사와 식사', () => {
  it('칼로리/수분 결손0·단백/비타민100에서 시작하고 정상 상태는 배고픔이 아니다', () => {
    const { w, p } = setup(); expect(p.needs.kcal).toBe(0); expect(p.needs.waterDeficit).toBe(0); expect(p.needs.protein).toBe(100); expect(p.needs.vitamin).toBe(100)
    expect(hungerStage(w, p)).toBe(0); expect(thirstStage(w, p)).toBe(0); expect(mood(w, p)).toBe(50)
  })
  it('수면8h·일상8h·걷기8h는2500kcal와2500ml, 원정 검산은4000/4400kcal다', () => {
    const { w, p, warm } = setup()
    let kcal = 0, water = 0
    for (const kind of ['sleep', 'idle', 'walk']) { mode(p, kind, turnOf(w)); const r = metabolismRate(w, p, warm, kind === 'sleep'); kcal += r.kcalHour * 8; water += r.waterHour * 8 }
    expect(kcal).toBeCloseTo(2500); expect(water).toBeCloseTo(2500)
    p.equip.chest = makeItem(w, 'Item.ScrapMail')
    let expedition = 0, cold = 0
    for (const [kind, hours] of [['sleep', 7], ['idle', 3], ['walk', 10], ['work', 2], ['combat', 2]] as const) {
      mode(p, kind, turnOf(w)); expedition += metabolismRate(w, p, warm, kind === 'sleep').kcalHour * hours; cold += metabolismRate(w, p, { ...warm, feels: 15 }, kind === 'sleep').kcalHour * hours
    }
    expect(expedition).toBeCloseTo(4000); expect(cold).toBeCloseTo(4400)
  })
  it('더위·땀·발열·이질·화상 수분을 각각 더하며 비축 짐은 칼로리를 늘리지 않는다', () => {
    const { w, p, warm } = setup(), base = metabolismRate(w, p, warm)
    addToBag(w, p, makeItem(w, 'Item.IronScrap', 10)); expect(metabolismRate(w, p, warm).kcalHour).toBe(base.kcalHour)
    p.needs.bodyTemp = 38.5; p.effects.push({ kind: 'dysentery', untilTurn: turnOf(w) + 1000 }); p.body.wounds.push({ id: 10000, def: 'Wound.Burn', part: 'LeftHand', severity: 3, healed: 0, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 0, source: '검증' })
    expect(metabolismRate(w, p, { ...warm, feels: 30 }).waterHour * 24).toBeCloseTo(2500 + 1000 + 3600 + 500 + 1500 + 180)
  })
  it('육포는 원래140kcal·단백22g·수분5ml이며 편식 흡수98kcal와 포만 기억에 반영된다', () => {
    const { w, p } = setup(); p.needs.protein = 20; p.needs.waterDeficit = 400
    const food = makeItem(w, 'Item.Jerky'); addToBag(w, p, food); expect(perform(w, p, { type: 'consume', uid: food.uid }).ok).toBe(true)
    expect(w.db.item(food.def).food!.kcal).toBe(140); expect(p.needs.kcal).toBe(98); expect(p.needs.protein).toBe(23.67); expect(p.needs.waterDeficit).toBe(395)
    expect(p.thoughts.some((t) => t.def === 'Thought.Fed')).toBe(true)
  })
  it('건빵은 물 없이2턴/물 있으면1턴, 수분 결손95ml를 더하고 통조림은칼로개봉2턴과식사1턴이다', () => {
    const { w, p } = setup(); const a = makeItem(w, 'Item.Hardtack', 2); addToBag(w, p, a)
    expect(perform(w, p, { type: 'consume', uid: a.uid }).tu).toBe(200); expect(p.needs.waterDeficit).toBe(95)
    addToBag(w, p, makeItem(w, 'Item.WaterBottle')); expect(perform(w, p, { type: 'consume', uid: a.uid }).tu).toBe(100); expect(p.needs.waterDeficit).toBe(190)
    const can = makeItem(w, 'Item.CannedMeat'); addToBag(w, p, can); addToBag(w, p, makeItem(w, 'Item.HuntingKnife'))
    const before=w.s.time;expect(playerAct(w,{type:'consume',uid:can.uid})).toBeNull();expect(w.s.time-before).toBe(300)
  })
  it('한 번에1000ml 초과는 초과분50%만 흡수하며 음수 결손을 남기지 않는다', () => {
    const { w, p } = setup(); p.needs.waterDeficit = 2000; hydrate(w, p, 1500); expect(p.needs.waterDeficit).toBe(750)
    hydrate(w, p, 1000); expect(p.needs.waterDeficit).toBe(0)
  })
  it('과식은3000상한·2시간 회피−1/수면0.9이며 기한 뒤 해소된다', () => {
    const { w, p } = setup(); p.needs.kcal = 2990; const evade = evasion(w, p), sleep = sleepQuality(w, p)
    nourish(w, p, 350); expect(p.needs.kcal).toBe(3000); expect(evasion(w, p)).toBe(evade - 1); expect(sleepQuality(w, p)).toBeCloseTo(sleep * .9)
    w.s.time += 2400 * 100; expect(hasEffect(p, 'overfull', turnOf(w))).toBe(false); expect(evasion(w, p)).toBe(evade)
  })
})

describe('영양의 실제 몸·전투 효과와 사망 경계', () => {
  it('굶주림 구간은500/2000/6000/20000/60000에서 올라간다', () => {
    const { w, p } = setup()
    for (const [balance, stage] of [[-499.99, 0], [-500, 1], [-2000, 2], [-6000, 3], [-20000, 4], [-60000, 5]]) { p.needs.kcal = balance; expect(hungerStage(w, p)).toBe(stage) }
  })
  it('수분 구간은500/1500/3000/5000/7500이며 탈수3의 손작업/비틀거림을 적용한다', () => {
    const { w, p } = setup(), pos = { x: 21, y: 20 }, before = multiTurnFactor(w, p)
    for (const [deficit, stage] of [[499, 0], [500, 1], [1500, 2], [3000, 3], [5000, 4], [7500, 5]]) { p.needs.waterDeficit = deficit; expect(thirstStage(w, p)).toBe(stage) }
    p.needs.waterDeficit = 5000; expect(multiTurnFactor(w, p)).toBeCloseTo(before * 1.2); expect(stumbleChance(w, p, pos)).toBe(10)
  })
  it('기아·탈수·단백 부족의 근력은 기본치를 보존하고 의식 캐시/저장에도 반영된다', () => {
    const { w, p } = setup(); expect(capacity(w, p, 'consciousness')).toBe(1)
    p.needs.kcal = -20000; p.needs.waterDeficit = 5000; p.needs.protein = 9
    expect(effectiveStat(w, p, 'str')).toBe(5); expect(p.stats.str).toBe(10); expect(capacity(w, p, 'consciousness')).toBeCloseTo(.7)
    const restored = { db, s: deserialize(serialize(w.s)) }; expect(capacity(restored, player(restored), 'consciousness')).toBeCloseTo(.7)
  })
  it('단백25+굶주림1은기력4×0.85×0.75=2.55, 단백60g은상태10을 회복한다', () => {
    const { w, p } = setup(); p.needs.kcal = -2000; p.needs.protein = 25; p.needs.energy = 0
    needsTick(w, p, false); expect(p.needs.energy).toBeCloseTo(2.55); expect(nutritionMultiplier(w, p, 'immunity')).toBeCloseTo(.8 * .85)
    nourish(w, p, 0, 60); expect(p.needs.protein).toBe(35)
  })
  it('0시 단백/비타민/위생 정산은하루한번이며7500ml탈수는즉사한다', () => {
    const { w, p, warm } = setup(); w.s.time = TURNS_PER_DAY * 100; metabolismTick(w, p, warm, false)
    expect([p.needs.protein, p.needs.vitamin, p.needs.hygiene]).toEqual([90, 98, 92]); metabolismTick(w, p, warm, false); expect(p.needs.protein).toBe(90)
    p.needs.waterDeficit = 7499; expect(deathCause(w, p)).toBeNull(); p.needs.waterDeficit = 7500; expect(deathCause(w, p)).toBe('탈수')
  })
  it('아사 위험은매일20% 판정이며60000kcal결손만으로 즉사시키지 않는다', () => {
    const survived = setup(), died = setup()
    for (const env of [survived, died]) { env.p.needs.kcal = -60000; env.w.s.time = TURNS_PER_DAY * 100; env.w.s.rng.body = [0, 0, 0, env === died ? 1 : 4294967295]; metabolismTick(env.w, env.p, env.warm, false) }
    expect(deathCause(survived.w, survived.p)).toBeNull(); expect(deathCause(died.w, died.p)).toBe('아사')
  })
  it('괴혈병40은옛흉터를열고60은치유를멈추며80은출혈을1.5배로만든다', () => {
    const { w, p, warm } = setup(); p.body.scars = [{ part: 'LeftHand', severity: 2, cap: 1, burn: false, at: 0, source: '옛 상처' }]; p.needs.scurvy = 35; p.needs.vitamin = 0; w.s.time = TURNS_PER_DAY * 100
    metabolismTick(w, p, warm, false); expect(p.needs.scurvy).toBe(40); expect(p.body.wounds).toHaveLength(1); const wd = p.body.wounds[0]; expect(wd.severity).toBe(3)
    p.needs.scurvy = 60; bodyTick(w, p, false); expect(wd.healed).toBe(0)
    p.needs.scurvy = 0; w.s.time += 100; bodyTick(w, p, false); expect(wd.healed).toBeGreaterThan(0)
    const bleed = effectiveBleed(w, p, wd); p.needs.scurvy = 80; expect(effectiveBleed(w, p, wd)).toBeCloseTo(bleed * 1.5)
  })
  it('비타민을 다시 먹으면 괴혈 진행을하루10씩낮추며50일에비타민이소진된다', () => {
    const { w, p, warm } = setup(); p.needs.vitamin = 20; p.needs.scurvy = 35
    for (let day = 1; day <= 4; day++) { w.s.time = day * TURNS_PER_DAY * 100; metabolismTick(w, p, warm, false) }
    expect(p.needs.scurvy).toBe(0); expect(p.needs.vitamin).toBe(12)
    p.needs.vitamin = 100; p.needs.nutritionDay = 4; p.needs.kcal = 0
    for (let day = 5; day <= 54; day++) { w.s.time = day * TURNS_PER_DAY * 100; metabolismTick(w, p, warm, false) }
    expect(p.needs.vitamin).toBe(0); expect(p.needs.scurvy).toBe(5)
  })
  it('0시 감염 면역은 그날 정산한 단백 상태를 사용한다', () => {
    const { w, p } = setup(); w.s.time = (TURNS_PER_DAY - 1) * 100; p.nextAct = w.s.time; p.needs.protein = 30
    p.diseases = [{ def: 'Disease.GreyFever', incubatesUntil: 0, progress: 0, immunity: 0 }]
    expect(playerAct(w, { type: 'wait' })).toBeNull(); expect(p.needs.protein).toBe(20)
    expect(p.diseases![0].immunity).toBeCloseTo(25 / 24 * .85)
  })
  it('비타민20미만의수면회복은표시와실제틱에서10%감소한다', () => {
    const { w, p } = setup(), base = sleepRecoveryPerHour(w, p); p.needs.vitamin = 19; p.needs.fatigue = 50
    expect(sleepRecoveryPerHour(w, p)).toBeCloseTo(base * .9); const fatigue = p.needs.fatigue
    needsTick(w, p, true); expect(fatigue - p.needs.fatigue).toBeCloseTo(base * .9 / 1200)
  })
  it('새굶주림/갈증단계는자동행동을중단하지만처치의신체변화예외는유지한다', () => {
    const { w, p } = setup(), snap = autoSnap(w); p.needs.kcal = -500
    expect(autoStop(w, snap)).toContain('굶주림'); expect(autoStop(w, snap, { skipBody: true })).toBeNull()
    p.needs.kcal = 0; p.needs.waterDeficit = 500; expect(autoStop(w, snap)).toContain('갈증')
  })
  it('기분80이상은실제경험치1.1배이고그아래는기본값이다', () => {
    const { w, p } = setup(); p.xp = 0; addThought(w, p, 'Thought.AteGood', 31); expect(mood(w, p)).toBe(81); gainXp(w, p, 10); expect(p.xp).toBe(11)
    p.thoughts = []; addThought(w, p, 'Thought.AteGood', 29); gainXp(w, p, 10); expect(p.xp).toBe(21)
  })
})

describe('영양 장부의 저장 계약', () => {
  it('하루2500kcal/2500ml와0.01kcal·1ml잔여를중간저장후에도정확히보존한다', () => {
    const { w, p, warm } = setup()
    for (let i = 0; i < 12345; i++) { w.s.time += 100; metabolismTick(w, p, warm, false) }
    const restored = { db, s: deserialize(serialize(w.s)) }, rp = player(restored)
    for (let i = 12345; i < TURNS_PER_DAY; i++) { w.s.time += 100; restored.s.time += 100; metabolismTick(w, p, warm, false); metabolismTick(restored, rp, warm, false) }
    expect(p.needs.kcal).toBe(-2500); expect(p.needs.waterDeficit).toBe(2500); expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('v2활성/미활성 인물은한번만변환하고혈액·HP·비타민·사망을보존한다', () => {
    const { w, p } = setup(), other = createCreature(w, 'Creature.Reaver', { x: 10, y: 10 }); other.alive = false; w.s.offCreatures.crypt1 = [other]
    const raw = JSON.parse(serialize(w.s)); raw.version = 2
    for (const [i, c] of [raw.creatures[0], raw.offCreatures.crypt1[0]].entries()) {
      c.needs.kcal = i ? 2500 : 200; c.needs.water = i ? 2400 : 1000; c.needs.vitamin = 37.25
      for (const key of ['waterDeficit', 'protein', 'hygiene', 'nutritionDay', 'kcalRemainder', 'waterRemainder', 'scurvy']) delete c.needs[key]
    }
    const migrated = deserialize(JSON.stringify(raw)), mp = player({ db, s: migrated }), mo = migrated.offCreatures.crypt1[0]
    expect(migrated.version).toBe(SAVE_VERSION); expect([mp.needs.kcal, mp.needs.waterDeficit, mp.needs.vitamin, mp.needs.protein]).toEqual([-1600, 800, 37.25, 100])
    expect([mo.needs.kcal, mo.needs.waterDeficit, mo.alive]).toEqual([700, 0, false]); expect(mp.hp).toBe(p.hp); expect(mp.body.blood).toBe(p.body.blood)
    expect(stateHash(deserialize(serialize(migrated)))).toBe(stateHash(migrated))
  })
})
