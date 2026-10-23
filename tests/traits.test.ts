import {completeHealing} from '../src/core/recovery'
import { describe, expect, it } from 'vitest'
import { activityStep, channelTurns, perform, stumbleChance, treatQuality } from '../src/core/actions'
import { bodyDef, capacity, hpMax, painTotal } from '../src/core/body'
import { canSee, invalidateLights, sightRange } from '../src/core/fov'
import { previewHit, resolveAttack } from '../src/core/combat'
import { diseaseTick, exposeDisease, sleepQuality } from '../src/core/conditions'
import { createCreature, pickTraits } from '../src/core/creatures'
import { player, tileAt, TURNS_PER_HOUR } from '../src/core/ctx'
import { craftingQuality } from '../src/core/crafting'
import { addToBag, makeItem } from '../src/core/items'
import { moraleOf } from '../src/core/morale'
import { needsTick } from '../src/core/needs'
import { startPrisonerAction } from '../src/core/prisoners'
import { awardDefeat } from '../src/core/progression'
import { psycheTick } from '../src/core/psyche'
import { initiative } from '../src/core/scheduler'
import { stateHash, serialize, deserialize } from '../src/core/save'
import { activeThoughts, addThought, mood } from '../src/core/thoughts'
import { thermalState } from '../src/core/thermal'
import { gainTrauma } from '../src/core/trauma'
import { effectiveStat, traitMul } from '../src/core/traits'
import type { RecipeDef, TraitDef } from '../src/core/types'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('traits-021', 'Bg.Excommunicate'), pl = player(w)
  pl.age = undefined; pl.pos = { x: 20, y: 20 }; pl.background = undefined; pl.traits = []; pl.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; pl.abilities = []; pl.equip = {}; pl.bag = []; pl.thoughts = []; pl.hp = hpMax(w, pl); pl.needs.stress = 10; pl.needs.fatigue = 20
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.map.lights = []; w.s.map.ambient = 18; w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time
  for (let y = 12; y <= 28; y++) for (let x = 12; x <= 28; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, items: [], blood: 0 })
  invalidateLights(w); return { w, pl }
}
function hostile(w: ReturnType<typeof makeWorld>) { const c = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 }); w.s.creatures.push(c); return c }
function equip(w: ReturnType<typeof makeWorld>, def: string) { const p = player(w), it = makeItem(w, def); p.equip.main = it; return it }
function val(w: ReturnType<typeof makeWorld>, id: string) { return activeThoughts(w, player(w)).find((t) => t.def === id)?.mood }

describe('정본 특성과 호환', () => {
  it('울림 듣는 자를 포함한38종을 시작 추첨하며 호환4종·공포 사냥꾼·후천적 건망은 남아 있다', () => {
    const active = db.all<TraitDef>('Trait').filter((t) => (t.weight ?? 1) > 0)
    expect(active).toHaveLength(38); expect(db.all('Trait')).toHaveLength(44)
    const { w } = setup(), bg = db.background('Bg.Excommunicate')
    for (let i = 0; i < 200; i++) {
      const picked = pickTraits(w, bg, 3); expect(picked).toHaveLength(3)
      for (const id of picked) { expect(active.some((t) => t.id === id)).toBe(true); expect(picked.some((t) => db.trait(id).conflicts?.includes(t))).toBe(false) }
    }
    expect(db.trait('Trait.ThinBlood').mods?.bleedMult).toBe(1.5)
  })
  it('예민 지각+1은 저장 능력치를 바꾸지 않고 전투·시야·주도권·제작·처치에 적용된다', () => {
    const { w, pl } = setup(), c = hostile(w); pl.stats.per = 11
    const hit = previewHit(w, pl, c)!.chance, q = treatQuality(w, pl, 0).q, sight = sightRange(w, pl), init = initiative(pl, w), r = db.get<RecipeDef>('Recipe.Bandage'), cq = craftingQuality(w, pl, r, 15)
    pl.traits = ['Trait.Sensitive']; expect(effectiveStat(w, pl, 'per')).toBe(12); expect(pl.stats.per).toBe(11)
    expect(previewHit(w, pl, c)!.chance).toBe(hit + 2); expect(sightRange(w, pl)).toBe(sight); expect(initiative(pl, w)).toBe(init + 1)
    expect(treatQuality(w, pl, 0).q).toBeGreaterThan(q)
    expect(craftingQuality(w, pl, r, 15)).toBe(cq + 2)
    pl.traits = []; pl.stats.per = 14; const thresholdSight = sightRange(w, pl)
    pl.traits = ['Trait.Sensitive']; expect(sightRange(w, pl)).toBe(thresholdSight + 1); expect(pl.stats.per).toBe(14)
  })
  it('얕은 잠·깊은 잠·편집증은 실제 수면 질에 곱해진다', () => {
    const { w, pl } = setup(), base = sleepQuality(w, pl)
    pl.traits = ['Trait.LightSleeper']; expect(sleepQuality(w, pl)).toBeCloseTo(base * .9)
    pl.traits = ['Trait.DeepSleeper']; expect(sleepQuality(w, pl)).toBeCloseTo(base * 1.1)
    pl.traits = ['Trait.Paranoid']; expect(sleepQuality(w, pl)).toBeCloseTo(base * .7)
  })
  it('추위·더위 체질은 쾌적 구간 양쪽을 옮긴다', () => {
    const { w, pl } = setup(), base = thermalState(w, pl)
    pl.traits = ['Trait.ColdResistant']; expect(thermalState(w, pl).low).toBe(base.low - 3); expect(thermalState(w, pl).high).toBe(base.high - 2)
    pl.traits = ['Trait.HeatResistant']; expect(thermalState(w, pl).low).toBe(base.low + 2); expect(thermalState(w, pl).high).toBe(base.high + 3)
  })
  it('빠른 발·느림보는 평지에서0, 진흙에서5/15이며 회피도+1/−1', () => {
    const { w, pl } = setup(), to = { x: 21, y: 20 }
    pl.traits = ['Trait.Plodder']; expect(stumbleChance(w, pl, to)).toBe(0)
    tileAt(w, to).t = 'Terrain.Mud'; expect(stumbleChance(w, pl, to)).toBe(15)
    pl.traits = ['Trait.FleetFooted']; expect(stumbleChance(w, pl, to)).toBe(5)
  })
  it('무딘 손은 조작상한0.9, 손재주는 손 작업 시간과 Q를 바꾼다', () => {
    const { w, pl } = setup(), recipe = db.get<RecipeDef>('Recipe.Bandage'), base = craftingQuality(w, pl, recipe, 15)
    pl.traits = ['Trait.NimbleHands']; expect(channelTurns(w, pl, 20)).toBe(18); expect(craftingQuality(w, pl, recipe, 15)).toBe(base + 5)
    expect(channelTurns(w, pl, 20, { dexterous: false })).toBe(20)
    pl.traits = ['Trait.ClumsyHands']; expect(capacity(w, pl, 'manipulation')).toBe(.9)
  })
  it('튼튼한 체질과 허약은 실제 질병 면역 경주를1.2/0.8배로 바꾼다', () => {
    const values: number[] = []
    for (const traits of [[], ['Trait.Robust'], ['Trait.Frail']]) {
      const { w, pl } = setup(); pl.traits = traits; exposeDisease(w, pl, 'Disease.GreyFever', 1); pl.diseases![0].incubatesUntil = 0
      diseaseTick(w, pl, false); values.push(pl.diseases![0].immunity)
    }
    expect(values[1]).toBeCloseTo(values[0] * 1.2); expect(values[2]).toBeCloseTo(values[0] * .8)
  })
  it('강골은 일반 피격의 골절 확률에도0.7배로 적용된다', () => {
    const lines: string[] = []
    for (const traits of [[], ['Trait.HardBones']]) {
      const { w, pl } = setup(), c = hostile(w); pl.traits = traits; equip(w, 'Item.PipeClub')
      w.s.knowledge.bestiary[c.def] = { seen: 0, fought: 0, killed: 0, dissected: 1 }
      // 같은 공격·난수·무장 상태로 대상의 특성만 바꾼다.
      c.equip = {}; c.traits = traits; c.asleep = true; c.reactPolicy = 'none'; w.s.rng.combat = [0, 0, 0, 1]; resolveAttack(w, pl, c)
      lines.push(w.s.log.flatMap((e) => e.detail ?? []).find((s) => s.startsWith('골절 판정')) ?? '')
    }
    expect(lines[0]).toContain('× 1 ='); expect(lines[1]).toContain('× 0.7 =')
  })
  it('느림보 기력 재생은 몸 상태를 적용한 뒤1.1배다', () => {
    const a = setup(), b = setup(); a.pl.needs.energy = 0; b.pl.needs.energy = 0; b.pl.traits = ['Trait.Plodder']
    needsTick(a.w, a.pl, false); needsTick(b.w, b.pl, false); expect(b.pl.needs.energy).toBeCloseTo(a.pl.needs.energy * 1.1)
  })
  it('매의 눈·근시는 실제 원거리 명중과5칸 밖 시야를 바꾼다', () => {
    const { w, pl } = setup(), c = hostile(w); equip(w, 'Item.Bow'); const base = previewHit(w, pl, c, true)!.chance
    pl.traits = ['Trait.KeenEyed']; expect(previewHit(w, pl, c, true)!.chance).toBe(base + 5)
    pl.traits = ['Trait.Nearsighted']; expect(previewHit(w, pl, c, true)!.chance).toBe(base - 10)
    c.pos = { x: 28, y: 20 }; expect(canSee(w, pl, c.pos)).toBe(false)
    c.pos = { x: 27, y: 20 }; expect(canSee(w, pl, c.pos)).toBe(true)
  })
})

describe('기분과 행동을 바꾸는 특성', () => {
  it('낙천/비관·외톨이·밤낮의 기분은 조건형 사고로 설명된다', () => {
    const { w, pl } = setup(); pl.traits = ['Trait.Optimist']; expect(mood(w, pl)).toBe(56)
    pl.traits = ['Trait.Pessimist']; expect(mood(w, pl)).toBe(44); addThought(w, pl, 'Thought.NearDeath'); expect(val(w, 'Thought.NearDeath')).toBe(-8)
    pl.thoughts = []; pl.traits = ['Trait.Loner']; expect(mood(w, pl)).toBe(53)
    pl.traits = ['Trait.NightOwl']; expect(val(w, 'Thought.Daylight')).toBe(-2); w.s.time = 0; expect(val(w, 'Thought.Night')).toBe(3)
  })
  it('다정·알코올 의존·금주가·철위장의 기억 값이 달라진다', () => {
    const { w, pl } = setup(); pl.traits = ['Trait.TenderHearted']; addThought(w, pl, 'Thought.KilledHuman'); addThought(w, pl, 'Thought.KilledBeast')
    expect(val(w, 'Thought.KilledHuman')).toBe(-6); expect(val(w, 'Thought.KilledBeast')).toBe(-3)
    pl.traits = ['Trait.Alcoholic']; addThought(w, pl, 'Thought.Drunk'); expect(val(w, 'Thought.Drunk')).toBe(9)
    pl.thoughts = pl.thoughts.filter((t) => t.def !== 'Thought.Drunk'); pl.traits = ['Trait.Teetotaler']; addThought(w, pl, 'Thought.Drunk'); expect(val(w, 'Thought.Drunk')).toBe(-6)
    pl.traits = ['Trait.IronStomach']; addThought(w, pl, 'Thought.AteRaw'); expect(val(w, 'Thought.AteRaw')).toBeUndefined(); expect(traitMul(w, pl, 'foodPoisonMult')).toBe(.3)
  })
  it('미식가 Q35 경계의 요리와 품질 정보를 구분해 먹는다', () => {
    for (const [q, expected] of [[34, undefined], [35, 12]] as const) {
      const { w, pl } = setup(); pl.traits = ['Trait.Gourmand']; const food = makeItem(w, 'Item.RoastedMeat'); food.foodQ = q; addToBag(w, pl, food)
      expect(perform(w, pl, { type: 'consume', uid: food.uid }).ok).toBe(true); expect(val(w, 'Thought.FineMeal')).toBe(expected)
    }
  })
  it('깔끔쟁이·허영은 장비·흉터를 읽고 처치 청결+5를 적용한다', () => {
    const { w, pl } = setup(), q = treatQuality(w, pl, 0).q, knife = equip(w, 'Item.HuntingKnife'); knife.edge = 49; pl.traits = ['Trait.Neat']
    expect(val(w, 'Temperament.Neat')).toBe(-3); expect(treatQuality(w, pl, 0).q).toBeGreaterThan(q)
    pl.traits = ['Trait.Vain']; pl.equip.chest = makeItem(w, 'Item.LeatherCoat'); pl.equip.chest.quality = 2
    expect(val(w, 'Temperament.Clothes')).toBe(3)
    const head = bodyDef(w, pl).parts.find((p) => p.region === 'head' && !p.internal)!
    pl.body.wounds.push({ id: w.s.nextId++, def: 'Wound.Cut', part: head.id, severity: 2, healed: 2, scar: true, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 100, source: '흉터' })
    expect(val(w, 'Thought.Scar')).toBeUndefined()
    completeHealing(w,pl)
    expect(val(w, 'Thought.Scar')).toBe(-10)
    expect(val(w, 'Temperament.Scar')).toBeUndefined()
  })
  it('겁쟁이·무모 사기−15/+15와 통증 둔감0.6/예민1.3이 실제 적용된다', () => {
    const { w, pl } = setup(), base = moraleOf(w, pl)
    pl.traits = ['Trait.Coward']; expect(moraleOf(w, pl)).toBe(base - 15)
    pl.traits = ['Trait.Reckless']; expect(moraleOf(w, pl)).toBe(base + 15)
    pl.body.wounds.push({ id: w.s.nextId++, def: 'Wound.Cut', part: 'LeftForearm', severity: 10, healed: 0, bleed: 0, arterial: false, internal: false, contam: 0, ageTurns: 0, source: '검증' })
    pl.traits = []; const pain = painTotal(w, pl); pl.traits = ['Trait.PainTolerant']; expect(painTotal(w, pl)).toBeCloseTo(pain * .6)
    pl.traits = ['Trait.Sensitive']; expect(painTotal(w, pl)).toBeCloseTo(pain * 1.3)
  })
  it('다정의 항복 수용 기억은 실제 석방을 선택했을 때 한 번만 생성한다', () => {
    const { w, pl } = setup(), c = hostile(w); c.ai.mode = 'surrender'; pl.traits = ['Trait.TenderHearted']; awardDefeat(w, pl, c, 1, '항복')
    expect(val(w,'Thought.AcceptedSurrender')).toBeUndefined(); expect(startPrisonerAction(w,pl,c,'release')).toBeNull(); while(pl.activity)activityStep(w,pl)
    expect(val(w, 'Thought.AcceptedSurrender')).toBe(6); c.ai.mode='surrender'; expect(startPrisonerAction(w,pl,c,'release')).toBeNull();while(pl.activity)activityStep(w,pl);awardDefeat(w, pl, c, 1, '중복'); expect(pl.thoughts.find((t) => t.def === 'Thought.AcceptedSurrender')!.count).toBe(1)
  })
  it('피 냄새 특성은 적 출혈 때만 기분과 시간당 스트레스를 바꾸고 피 공포와 상충한다', () => {
    const { w, pl } = setup(), c = hostile(w); pl.traits = ['Trait.Bloodlust']; pl.needs.stress = 30
    expect(val(w, 'Temperament.Blood')).toBeUndefined(); c.body.wounds.push({ id: w.s.nextId++, def: 'Wound.Cut', part: 'LeftForearm', severity: 2, healed: 0, bleed: 1, arterial: false, internal: false, contam: 0, ageTurns: 0, source: '검증' })
    expect(val(w, 'Temperament.Blood')).toBe(3); psycheTick(w, pl); expect(pl.needs.stress).toBe(28)
    expect(gainTrauma(w, pl, 'Trauma.Blood')).toBeUndefined()
  })
  it('수다쟁이는 잠행 중 실제 소음을 내며 다른 특성은 이 판정을 하지 않는다', () => {
    const { w, pl } = setup(); pl.traits = ['Trait.Talkative']; pl.sneaking = true; w.s.rng.body = [0, 0, 0, 1]
    psycheTick(w, pl); expect(w.s.noiseEvents.some((n) => n.source === pl.id && n.radius === 2)).toBe(true)
  })
  it('서로 다른 요리Q는 같은 품질 단계라도 합쳐져 경계를 잃지 않는다', () => {
    const { w, pl } = setup(), a = makeItem(w, 'Item.RoastedMeat'), b = makeItem(w, 'Item.RoastedMeat'); a.foodQ = 34; b.foodQ = 35
    addToBag(w, pl, a); addToBag(w, pl, b); expect(pl.bag.filter((i) => i.def === a.def)).toHaveLength(2)
  })
  it('신앙심의 기도는10분을 완료해야 회복하며 진행을 저장해 이어갈 수 있다', () => {
    const { w, pl } = setup(); pl.traits = ['Trait.Pious']; pl.needs.stress = 40
    expect(perform(w, pl, { type: 'pray' }).ok).toBe(true)
    for (let i = 0; i < 100; i++) activityStep(w, pl)
    expect(pl.needs.stress).toBe(40); const copy = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, copy]) for (let i = 0; i < 100; i++) activityStep(ww, player(ww))
    expect(pl.needs.stress).toBe(30); expect(pl.activity).toBeUndefined(); expect(stateHash(copy.s)).toBe(stateHash(w.s))
  })
})
