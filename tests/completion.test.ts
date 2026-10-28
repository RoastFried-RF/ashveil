import { describe, expect, it } from 'vitest'
import { activityStep, perform, stumbleChance } from '../src/core/actions'
import { autoSnap, autoStop, ignoreThreat } from '../src/core/autostop'
import { addWound, bodyDef, capacity, deathCause, energyMax, hpMax, hostileNear, painTotal } from '../src/core/body'
import { killCreature, rangedRange, resolveAttack, sporeCloud } from '../src/core/combat'
import { diseaseTick, exposeDisease, frostbiteTick, sleepQuality } from '../src/core/conditions'
import { createCreature } from '../src/core/creatures'
import { isOpaque, player, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR } from '../src/core/ctx'
import { hasLos, invalidateLights, sightRange } from '../src/core/fov'
import { playerAct, runUntilInput, settleReentry } from '../src/core/game'
import { addToBag, makeItem, wield } from '../src/core/items'
import { needsTick } from '../src/core/needs'
import { scentTick, smells } from '../src/core/perception'
import { breakdownAction, breakdownChances, endBreakdown, psycheTick, startBreakdown } from '../src/core/psyche'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { practice, studyBook } from '../src/core/skills'
import { temperatureTick, thermalState } from '../src/core/thermal'
import { addEffect } from '../src/core/traits'
import type { BreakDef, DiseaseDef } from '../src/core/types'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import { db, makeWorld } from './helpers'

function setup() {
  const w = makeWorld('completion', 'Bg.Excommunicate'), pl = player(w)
  pl.pos = { x: 20, y: 20 }; pl.nextAct = w.s.time
  pl.age = undefined; pl.skills.medicine = 5; pl.traits = []; pl.abilities = []; pl.bag = []; pl.equip = {}; pl.thoughts = []
  pl.hp = hpMax(w, pl); pl.needs.energy = energyMax(w, pl)
  w.s.creatures = [pl]; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.map.lights = []
  for (let y = 6; y <= 34; y++) for (let x = 6; x <= 36; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: false, spores: undefined })
  w.s.time = 12 * TURNS_PER_HOUR * 100; pl.nextAct = w.s.time
  invalidateLights(w)
  return { w, pl }
}
function fire(w: ReturnType<typeof makeWorld>) {
  w.s.map.lights = [{ pos: { ...player(w).pos }, kind: 'campfire', radius: 6 }]
  invalidateLights(w)
}

function item(w: ReturnType<typeof makeWorld>, id: string, count = 1) {
  const it = makeItem(w, id, count)
  expect(addToBag(w, player(w), it)).toBe(0)
  return it
}

describe('전투·자동 이동 연결 누락', () => {
  it('농도 5 포자는 시선을 막고 만료되면 다시 통과한다', () => {
    const { w, pl } = setup(), p = { x: 22, y: 20 }
    sporeCloud(w, p, 0, 3, 5)
    expect(isOpaque(w, p)).toBe(true)
    expect(hasLos(w, pl.pos, { x: 24, y: 20 })).toBe(false)
    for (let i = 0; i < 4; i++) playerAct(w, { type: 'wait' })
    expect(isOpaque(w, p)).toBe(false)
    expect(tileAt(w, p).spores).toBeUndefined()
    expect(hasLos(w, pl.pos, { x: 24, y: 20 })).toBe(true)
  })
  it('높은 자리 사거리는 +1, 높이가 같으면 기본값이다', () => {
    const { w, pl } = setup(), enemy = createCreature(w, 'Creature.Reaver', { x: 27, y: 20 })
    pl.equip.main = makeItem(w, 'Item.Bow')
    const base = w.db.item(pl.equip.main.def).ranged!.range
    expect(rangedRange(w, pl, enemy)).toBe(base)
    tileAt(w, pl.pos).t = 'Terrain.Rubble'
    expect(rangedRange(w, pl, enemy)).toBe(base + 1)
  })
  it('무시 목록은 새 적 경고를 억제해도 피해·3칸 접근은 중단한다', () => {
    const { w, pl } = setup(), enemy = createCreature(w, 'Creature.Reaver', { x: 25, y: 20 })
    const snap = autoSnap(w)
    w.s.creatures.push(enemy)
    expect(autoStop(w, snap)).toContain('보인다')
    expect(ignoreThreat(w, enemy.id)).toBeNull()
    expect(autoStop(w, snap)).toBeNull()
    pl.hp--
    expect(autoStop(w, snap)).toBe('다쳤다')
    pl.hp++
    enemy.pos.x = 23
    expect(autoStop(w, snap)).toContain('보인다')
    expect(w.s.autoIgnored).toEqual([])
    expect(ignoreThreat(w, enemy.id)).not.toBeNull()
  })
  it('무시한 개체가 공격하면 명중 여부와 무관하게 무시가 풀린다', () => {
    const { w, pl } = setup(), enemy = createCreature(w, 'Creature.Reaver', { x: 25, y: 20 })
    w.s.creatures.push(enemy); ignoreThreat(w, enemy.id)
    enemy.pos.x = 21
    resolveAttack(w, enemy, pl)
    expect(w.s.autoIgnored).not.toContain(enemy.id)
  })
  it('체온 단계가 악화되면 처치 중에도 자동 진행을 멈춘다', () => {
    const { w, pl } = setup(), snap = autoSnap(w)
    pl.needs.bodyTemp = 35.9
    expect(autoStop(w, snap, { skipBody: true })).toContain('체온')
  })
  it('냄새 경고는 기본 꺼짐, 켜면 새 시체만 경고한다', () => {
    const { w, pl } = setup(), corpse = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 })
    corpse.alive = false; corpse.scent = 100
    const snap = autoSnap(w); w.s.creatures.push(corpse)
    expect(autoStop(w, snap)).toBeNull()
    w.s.autoSmells = true
    expect(autoStop(w, snap)).toContain('냄새')
    expect(autoStop(w, autoSnap(w))).toBeNull()
    expect(pl.alive).toBe(true)
  })
  it('벽 너머의 적은 자연 회복의 적대 인식으로 세지 않는다', () => {
    const { w, pl } = setup(), enemy = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 })
    w.s.creatures.push(enemy)
    expect(hostileNear(w, pl)).toBe(true)
    tileAt(w, { x: 21, y: 20 }).t = 'Terrain.KtWall'
    expect(hostileNear(w, pl)).toBe(false)
  })
  it('진흙은 실제 생성되며 비틀거림과 하체 젖음을 만든다', () => {
    const { w, pl } = setup()
    expect(w.s.map.tiles.some((t) => t.t === 'Terrain.Mud')).toBe(true)
    const dry = stumbleChance(w, pl, pl.pos)
    tileAt(w, pl.pos).t = 'Terrain.Mud'
    expect(stumbleChance(w, pl, pl.pos)).toBeGreaterThan(dry)
    needsTick(w, pl, false)
    expect(pl.needs.skinWetness?.legs).toBeGreaterThanOrEqual(30)
    expect(pl.needs.skinWetness?.feet).toBeGreaterThanOrEqual(50)
    expect(w.s.map.tiles.some((t) => t.t === 'Terrain.Barricade')).toBe(true)
  })
  it('재진입해도 능력·상태 효과의 남은 턴을 보존한다', () => {
    const { w, pl } = setup(), npc = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }), left = turnOf(w)
    npc.cooldowns['Ab.Blade.Edge'] = left + 20
    npc.effects.push({ kind: 'stunned', untilTurn: left + 2 })
    npc.drowsyUntil = left + 10
    w.s.time += TURNS_PER_HOUR * 100
    settleReentry(w, w.s.map, [npc], left)
    expect(npc.cooldowns['Ab.Blade.Edge'] - turnOf(w)).toBe(20)
    expect(npc.effects[0].untilTurn - turnOf(w)).toBe(2)
    expect(npc.drowsyUntil! - turnOf(w)).toBe(10)
    expect(pl.alive).toBe(true)
  })
})

describe('독서·조리·도구', () => {
  it('책 기여 5+8+8은 15회까지, 실제 처치 12회와 경험치는 보존한다', () => {
    const { w, pl } = setup(); pl.skills.medicine = 12
    const xp = pl.xp, ap = pl.abilityPoints
    expect(studyBook(w, pl, 'Item.MedicalGuide')).toBe(5)
    expect(studyBook(w, pl, 'Item.FieldManual')).toBe(8)
    expect(studyBook(w, pl, 'Item.WardRecords')).toBe(2)
    expect(pl.skills.medicine).toBe(27)
    expect(studyBook(w, pl, 'Item.MedicalGuide')).toBe(0)
    expect([pl.xp, pl.abilityPoints]).toEqual([xp, ap])
  })
  it('40쪽을 중단·재개해도 쪽과 부분 진행이 남고 문해 1은 2400턴이 걸린다', () => {
    const { w, pl } = setup(), book = item(w, 'Item.MedicalGuide'); pl.literacy = 1
    expect(perform(w, pl, { type: 'read', uid: book.uid }).ok).toBe(true)
    for (let i = 0; i < 77; i++) activityStep(w, pl)
    expect([book.readPages, book.readProgress]).toEqual([1, 17])
    pl.activity = undefined
    perform(w, pl, { type: 'read', uid: book.uid })
    expect(pl.activity!.remaining).toBe(2323)
    for (let i = 77; i < 2400; i++) activityStep(w, pl)
    expect(pl.activity).toBeUndefined(); expect(pl.booksRead).toContain(book.def)
    expect(pl.skills.medicine).toBe(10) // 순례자 시작 숙달 5 + 책 5
    expect(perform(w, pl, { type: 'read', uid: book.uid }).ok).toBe(false)
  })
  it('문맹·어둠에서는 독서를 시작하지 못한다', () => {
    const { w, pl } = setup(), book = item(w, 'Item.MedicalGuide'); pl.literacy = 0
    expect(perform(w, pl, { type: 'read', uid: book.uid }).msg).toContain('글')
    pl.literacy = 2; w.s.map.kind = 'dungeon'; invalidateLights(w)
    expect(perform(w, pl, { type: 'read', uid: book.uid }).msg).toContain('어두워')
  })
  it('서로 다른 책 3권을 읽으면 문해 1에서 2로 오른다', () => {
    const { w, pl } = setup(); pl.literacy = 1
    for (const id of ['Item.MedicalGuide', 'Item.FieldManual', 'Item.WardRecords']) studyBook(w, pl, id)
    expect(pl.literacy).toBe(2)
  })
  it('조리는 불이 필요하며 99턴 중단 뒤 101턴으로 완성하고 한 번만 숙달한다', () => {
    const { w, pl } = setup(), meat = item(w, 'Item.RawMeat'), start = pl.skills.survival ?? 0
    expect(perform(w, pl, { type: 'cook', uid: meat.uid }).ok).toBe(false)
    fire(w); perform(w, pl, { type: 'cook', uid: meat.uid })
    for (let i = 0; i < 99; i++) activityStep(w, pl)
    pl.activity = undefined
    perform(w, pl, { type: 'cook', uid: meat.uid })
    expect(pl.activity!.remaining).toBe(101)
    for (let i = 0; i < 101; i++) activityStep(w, pl)
    expect(pl.bag.filter((i) => i.def === 'Item.RoastedMeat')).toHaveLength(1)
    expect(pl.bag.some((i) => i.uid === meat.uid)).toBe(false)
    expect(pl.skills.survival).toBe(start + 1)
  })
  it('불을 끄면 조리가 중단되며 재료·진행은 남는다', () => {
    const { w, pl } = setup(), meat = item(w, 'Item.RawMeat')
    fire(w); perform(w, pl, { type: 'cook', uid: meat.uid }); activityStep(w, pl)
    w.s.map.lights[0].off = true
    expect(activityStep(w, pl)).toBe(true)
    expect(meat.cookProgress).toBe(1); expect(pl.bag).toContain(meat)
  })
  it('횃불은 켜졌을 때 화상, 꺼지면 타격이고 들었을 때 열 +1이다', () => {
    const { w, pl } = setup(), torch = makeItem(w, 'Item.Torch')
    pl.equip.main = torch
    expect(wield(w, pl)!.atk.damageType).toBe('blunt')
    const heat = thermalState(w, pl).heat
    torch.lit = true
    expect(wield(w, pl)!.atk.damageType).toBe('burn')
    expect(thermalState(w, pl).heat).toBe(heat + 1)
    torch.fuel = 0
    expect(wield(w, pl)!.atk.damageType).toBe('blunt')
  })
})

describe('질병·수면·동상', () => {
  it('회색열의 잠복·면역 경주와 완치 뒤 재노출 면역', () => {
    const { w, pl } = setup()
    expect(exposeDisease(w, pl, 'Disease.GreyFever', 1)).toBe(true)
    const d = pl.diseases![0]
    expect(d.incubatesUntil - turnOf(w)).toBeGreaterThanOrEqual(2 * TURNS_PER_DAY)
    expect(exposeDisease(w, pl, 'Disease.GreyFever', 1)).toBe(false)
    diseaseTick(w, pl, false); expect(d.progress).toBe(0)
    d.incubatesUntil = turnOf(w)
    diseaseTick(w, pl, false)
    expect(d.progress).toBeCloseTo(22 / 24)
    expect(d.immunity).toBeCloseTo(25 / 24 * (1 + (pl.stats.vit - 10) * 0.04))
    expect(pl.needs.bodyTemp).toBe(40)
    d.immunity = 99.9; diseaseTick(w, pl, true)
    expect(pl.immuneDiseases).toContain('Disease.GreyFever'); expect(pl.diseases).toEqual([])
    expect(pl.effects.some((e) => e.kind === 'fever')).toBe(false)
    expect(exposeDisease(w, pl, 'Disease.GreyFever', 1)).toBe(false)
  })
  it('질병 진행 100은 사인이 되고 말라붙은 자는 체온 34.5와 면역을 유지한다', () => {
    const { w, pl } = setup(), npc = createCreature(w, 'Creature.Withered', { x: 22, y: 20 })
    pl.diseases = [{ def: 'Disease.GreyFever', progress: 100, immunity: 0, incubatesUntil: 0 }]
    expect(deathCause(w, pl)).toBe('회색열')
    expect(npc.needs.bodyTemp).toBe(34.5)
    expect(exposeDisease(w, npc, 'Disease.GreyFever', 1)).toBe(false)
    for (let i = 0; i < 200; i++) temperatureTick(w, npc, { ...thermalState(w, npc), feels: -50 })
    expect(npc.needs.bodyTemp).toBe(34.5)
  })
  it('맨땅 수면 질은 따뜻하면 0.5, 추위·젖음이 겹치면 0.2이며 부채도 갚는다', () => {
    const { w, pl } = setup(); fire(w)
    expect(sleepQuality(w, pl)).toBe(0.5)
    pl.needs.bodyTemp = 35; pl.needs.skinWetness = { legs: 100, torso: 100, arms: 100, head: 100, hands: 100, feet: 100 }
    expect(sleepQuality(w, pl)).toBe(0.2)
    pl.needs.fatigue = 0; pl.needs.sleepDebt = 1
    needsTick(w, pl, true)
    expect(pl.needs.sleepDebt).toBeLessThan(1)
    expect(perform(w, pl, { type: 'sleep' }).ok).toBe(true)
  })
  it('동상은 10분마다 노출을 쌓아 상처를 만들고 해동·재동결의 통증·피해를 갱신한다', () => {
    const { w, pl } = setup(), p = bodyDef(w, pl).parts.find((p) => p.groups.includes('finger'))!
    w.s.wind = { x: 4, y: 0 }; w.s.weather = 'ashrain'; w.s.time = TURNS_PER_DAY * 100
    pl.frostbite = { [p.id]: { exposure: 60, grade: 1, frozen: true } }
    frostbiteTick(w, pl)
    const state = pl.frostbite[p.id], wound = pl.body.wounds.find((w) => w.id === state.wound)!
    expect(state.grade).toBe(2); expect(wound.def).toBe('Wound.Frostbite')
    const before = painTotal(w, pl)
    fire(w); frostbiteTick(w, pl)
    expect(wound.thawed).toBe(true); expect(painTotal(w, pl)).toBeGreaterThan(before)
    const frozen = structuredClone(w.s)
    expect(stateHash(deserialize(serialize(frozen)))).toBe(stateHash(w.s))
    // 열을 없애고 폭한 기온을 구성한다.
    w.s.map.lights = []; w.s.wind = { x: 4, y: 0 }; w.s.weather = 'ashrain'; w.s.time = TURNS_PER_DAY * 100
    pl.cond = { shock: true }; pl.equip.chest = makeItem(w, 'Item.ScrapMail')
    const sev = wound.severity
    frostbiteTick(w, pl)
    expect(wound.severity).toBeGreaterThan(sev); expect(wound.thawed).toBe(false)
  })
})

describe('냄새·정신·저장', () => {
  it('조리·시체 냄새가 쌓이며 닫힌 방 밖에서는 반경이 절반이다', () => {
    const { w, pl } = setup(), target = createCreature(w, 'Creature.Reaver', { x: 24, y: 20 })
    w.s.time += 100; target.alive = false; scentTick(w, target, 0)
    expect(target.scent).toBe(2)
    target.alive = true; target.activity = { kind: 'cook', label: '요리', remaining: 10 }; scentTick(w, target, 0)
    expect(target.scent).toBe(5)
    target.scent = 100; w.s.map.rooms = [{ x: 23, y: 19, w: 3, h: 3, name: '방', type: 'empty', discovered: true }]
    for (let y = 18; y <= 22; y++) for (let x = 22; x <= 26; x++) if (x === 22 || x === 26 || y === 18 || y === 22) tileAt(w, { x, y }).t = 'Terrain.KtWall'
    expect(smells(w, pl, target)).toBe(false)
    tileAt(w, { x: 22, y: 20 }).t = 'Terrain.DoorOpen'
    expect(smells(w, pl, target)).toBe(true)
  })
  it('S78 검산 7.6%/5.2%, 의지 15는 0.7배이다', () => {
    expect(breakdownChances(78, 10)).toEqual({ minor: 7.6000000000000005, moderate: 5.2, extreme: 0 })
    expect(breakdownChances(78, 15).moderate).toBeCloseTo(3.64)
    expect(breakdownChances(49, 10)).toEqual({ minor: 0, moderate: 0, extreme: 0 })
  })
  it('폭식은 실제 음식을 소비하고 드러눕기는 피해 후 해제된다', () => {
    const { w, pl } = setup(); item(w, 'Item.Hardtack', 3)
    startBreakdown(w, pl, w.db.get<BreakDef>('Break.Binge'))
    const before = pl.needs.kcal, forced = breakdownAction(w, pl)!
    expect(forced.type).toBe('consume'); perform(w, pl, forced)
    expect(pl.needs.kcal).toBeGreaterThan(before)
    startBreakdown(w, pl, w.db.get<BreakDef>('Break.Lie'))
    expect(perform(w, pl, { type: 'move', dir: 0 }).ok).toBe(false)
    pl.hp--; psycheTick(w, pl)
    expect(pl.breakdown).toBeUndefined()
  })
  it('울음은 시야 −2, 혼잣말은 10턴마다 소리를 낸다', () => {
    const { w, pl } = setup(), before = sightRange(w, pl)
    startBreakdown(w, pl, w.db.get<BreakDef>('Break.Cry'))
    expect(sightRange(w, pl)).toBe(before - 2)
    startBreakdown(w, pl, w.db.get<BreakDef>('Break.Mutter'))
    psycheTick(w, pl)
    expect(w.s.noiseEvents.some((n) => n.source === pl.id && n.radius === 2)).toBe(true)
  })
  it('질병·독서·붕괴 진행을 저장하고 이어도 상태가 같다', () => {
    const { w, pl } = setup(); fire(w)
    const book = item(w, 'Item.MedicalGuide'); pl.literacy = 2
    perform(w, pl, { type: 'read', uid: book.uid })
    for (let i = 0; i < 43; i++) activityStep(w, pl)
    exposeDisease(w, pl, 'Disease.GreyFever', 1)
    startBreakdown(w, pl, w.db.get<BreakDef>('Break.Mutter'))
    addWound(w, pl, { def: 'Wound.Frostbite', part: 'LeftHand', severity: 3, source: '동상' })
    const restored = { db, s: deserialize(serialize(w.s)) }
    for (const ww of [w, restored]) for (let i = 0; i < 50; i++) { ww.s.time += 100; needsTick(ww, player(ww), false); diseaseTick(ww, player(ww), false); psycheTick(ww, player(ww)); activityStep(ww, player(ww)) }
    expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
})


describe('후속 정신 붕괴와 고양', () => {
  it('붕괴 중에는 해소하지 않고 종료·중단 때 한 번만 스트레스를 줄인다', () => {
    const { w, pl } = setup(); pl.needs.stress = 90
    startBreakdown(w, pl, db.get<BreakDef>('Break.Cry'))
    expect(pl.needs.stress).toBe(90); expect(pl.thoughts.some((t) => t.def === 'Thought.Breakdown')).toBe(false)
    endBreakdown(w, pl)
    expect(pl.needs.stress).toBe(75); expect(pl.thoughts.some((t) => t.def === 'Thought.Breakdown')).toBe(true)
    expect(pl.effects.some((e) => e.kind === 'crying')).toBe(false)
    endBreakdown(w, pl); expect(pl.needs.stress).toBe(75)
    startBreakdown(w, pl, db.get<BreakDef>('Break.Lie')); pl.hp--
    w.s.time += 100; psycheTick(w, pl)
    expect(pl.breakdown).toBeUndefined(); expect(pl.needs.stress).toBe(45)
  })

  it('S95 확률은 경미11·중간12·극심10.5%, 종류는 18종이다', () => {
    expect(breakdownChances(95, 10)).toEqual({ minor: 11, moderate: 12, extreme: 10.5 })
    expect(db.all<BreakDef>('Break')).toHaveLength(18)
  })
  it('짐 버리기는 큰 물건부터 버리되 빠른 슬롯 소모품을 보호한다', () => {
    const { w, pl } = setup(), small = item(w, 'Item.Bandage'), big = item(w, 'Item.RebarSpear')
    const protectedItem = item(w, 'Item.MedicalGuide')
    pl.hotbar = [{ kind: 'item', def: protectedItem.def }]
    startBreakdown(w, pl, db.get<BreakDef>('Break.Drop')); pl.breakdown!.remaining = 3
    expect(breakdownAction(w, pl)).toEqual({ type: 'drop', uid: big.uid })
    perform(w, pl, { type: 'drop', uid: big.uid }); w.s.time += 100
    expect(breakdownAction(w, pl)).toEqual({ type: 'drop', uid: small.uid })
    expect(pl.bag).toContain(protectedItem)
  })
  it('약물 탐닉은 진통제를 사용하며 단식은 음식만 거부한다', () => {
    const { w, pl } = setup(), drug = item(w, 'Item.Painkiller'), meal = item(w, 'Item.Hardtack')
    addWound(w, pl, { def: 'Wound.Cut', part: 'LeftForearm', severity: 15, source: '통증' })
    const before = painTotal(w, pl); expect(before).toBeGreaterThan(0)
    startBreakdown(w, pl, db.get<BreakDef>('Break.Drugs'))
    expect(breakdownAction(w, pl)).toEqual({ type: 'consume', uid: drug.uid })
    perform(w, pl, { type: 'consume', uid: drug.uid })
    expect(painTotal(w, pl)).toBeLessThan(before); expect(pl.bag.some((it) => it.uid === drug.uid)).toBe(false)
    startBreakdown(w, pl, db.get<BreakDef>('Break.Fast'))
    expect(perform(w, pl, { type: 'consume', uid: meal.uid }).ok).toBe(false)
    expect(perform(w, pl, { type: 'wait' }).ok).toBe(true)
  })
  it('자해는 실제 전완 상처, 장비 파괴는 착용품 내구 50%p를 깎는다', () => {
    const { w, pl } = setup(), hp = pl.hp
    startBreakdown(w, pl, db.get<BreakDef>('Break.Selfharm'))
    const wound = pl.body.wounds[0]
    expect(wound.def).toBe('Wound.Cut')
    expect(bodyDef(w, pl).parts.find((p) => p.id === wound.part)?.groups).toContain('forearm')
    expect(pl.hp).toBeLessThan(hp)
    const coat = makeItem(w, 'Item.PaddedJacket'); pl.equip.chest = coat; coat.durability = 80
    startBreakdown(w, pl, db.get<BreakDef>('Break.BreakGear'))
    expect(coat.durability).toBe(30)
  })
  it('긴장증은 행동을 막고, 정리·멍한 배회는 적이 나타나면 풀린다', () => {
    const { w, pl } = setup()
    startBreakdown(w, pl, db.get<BreakDef>('Break.Catatonia'))
    expect(perform(w, pl, { type: 'move', dir: 0 }).ok).toBe(false)
    expect(breakdownAction(w, pl)).toEqual({ type: 'wait' })
    for (const id of ['Break.Organize', 'Break.Wander']) {
      startBreakdown(w, pl, db.get<BreakDef>(id))
      expect(breakdownAction(w, pl)).not.toBeNull()
      const enemy = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }); w.s.creatures.push(enemy)
      expect(breakdownAction(w, pl)).toBeNull(); expect(pl.breakdown).toBeUndefined()
      w.s.creatures = [pl]
    }
  })
  it('광란은 가장 가까운 개체를 공격하고 기력 1.5배를 쓴다', () => {
    const { w, pl } = setup(), enemy = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 })
    w.s.creatures.push(enemy); startBreakdown(w, pl, db.get<BreakDef>('Break.Berserk'))
    const act = breakdownAction(w, pl)!, energy = pl.needs.energy, cost = wield(w, pl)!.atk.energy
    expect(act).toEqual({ type: 'attack', target: enemy.id })
    perform(w, pl, act)
    expect(pl.needs.energy).toBe(energy - cost * 1.5)
  })
  it('환청의 목적지는 저장 뒤 유지되고 도주 충동은 마지막 안전지로 간다', () => {
    const { w, pl } = setup()
    startBreakdown(w, pl, db.get<BreakDef>('Break.Voices'))
    const restored = { db, s: deserialize(serialize(w.s)) }
    expect(player(restored).breakdown!.dest).toEqual(pl.breakdown!.dest)
    expect(breakdownAction(w, pl)).toEqual(breakdownAction(restored, player(restored)))
    pl.lastSafe = { map: w.s.map.id, pos: { x: 16, y: 20 } }
    startBreakdown(w, pl, db.get<BreakDef>('Break.Flee'))
    const action = breakdownAction(w, pl)!
    expect(action.type).toBe('move')
    perform(w, pl, action); expect(pl.pos.x).toBeLessThan(20)
  })
  it('고양은 실제 성공을 2회로 세면서 같은 대상·시간당3회 상한을 지킨다', () => {
    const { w, pl } = setup(); pl.skills.medicine = 0
    addEffect(pl, 'elation', turnOf(w) + TURNS_PER_DAY)
    practice(w, pl, 'medicine', 'a'); expect(pl.skills.medicine).toBe(2)
    practice(w, pl, 'medicine', 'a'); expect(pl.skills.medicine).toBe(2)
    practice(w, pl, 'medicine', 'b'); expect(pl.skills.medicine).toBe(3)
    practice(w, pl, 'medicine', 'c'); expect(pl.skills.medicine).toBe(3)
  })
  it('물에 번진 책은 읽지 않은 쪽의20%를 한 번만 잃으며 재개해도 더 잃지 않는다', () => {
    const { w, pl } = setup(), book = item(w, 'Item.MedicalGuide'); pl.literacy = 2
    book.readPages = 10; book.wetness = { torso: 100 }
    perform(w, pl, { type: 'read', uid: book.uid })
    expect(book.lostPages).toBe(6)
    activityStep(w, pl); pl.activity = undefined
    perform(w, pl, { type: 'read', uid: book.uid })
    expect(book.lostPages).toBe(6)
    const remaining = pl.activity!.remaining
    for (let i = 0; i < remaining; i++) activityStep(w, pl)
    expect(pl.booksRead).toContain(book.def)
    expect(pl.bookMastery?.medicine).toBe(4)
  })
})


describe('정산·말단·콘텐츠 검증', () => {
  it('층 정지 중 NPC 준비 시각·실신·사기·포자 구름이 함께 멈춘다', () => {
    const { w } = setup(), npc = createCreature(w, 'Creature.Reaver', { x: 22, y: 20 }), left = turnOf(w)
    npc.nextAct = w.s.time + 80; npc.cond = { faintUntil: left + 3, painHighSince: left - 2 }
    npc.ai.mev = [{ v: -10, t: left - 4, k: 't20' }]
    sporeCloud(w, { x: 24, y: 20 }, 0, 7, 5)
    w.s.time += TURNS_PER_HOUR * 100
    settleReentry(w, w.s.map, [npc], left)
    expect(npc.nextAct - w.s.time).toBe(80)
    expect(npc.cond.faintUntil! - turnOf(w)).toBe(3)
    expect(npc.ai.mev[0].t - turnOf(w)).toBe(-4)
    expect(tileAt(w, { x: 24, y: 20 }).spores!.until - turnOf(w)).toBe(7)
  })
  it('발가락의 동상은 손 조작을 깎지 않고 손가락 동상만 깎는다', () => {
    const { w, pl } = setup(), body = bodyDef(w, pl), before = capacity(w, pl, 'manipulation')
    const toe = body.parts.find((p) => p.groups.includes('toe'))!, finger = body.parts.find((p) => p.groups.includes('finger'))!
    pl.frostbite = { [toe.id]: { exposure: 30, grade: 1, frozen: true } }
    expect(capacity(w, pl, 'manipulation')).toBe(before)
    pl.frostbite[finger.id] = { exposure: 30, grade: 1, frozen: true }
    expect(capacity(w, pl, 'manipulation')).toBeCloseTo(before * 0.9)
  })
  it('배치된 약탈자 공급원은 처음6명이고 실제 사망 시 한 명 줄어든다', () => {
    const w=makeWorld('completion-source'),src=w.s.sources!.find(s=>s.id==='reaverCamp')!
    expect([src.count, src.cap, src.deployed]).toEqual([6, 8, true])
    const npc = w.s.creatures.find(c=>src.members!.includes(c.id))!
    killCreature(w, npc, '테스트')
    expect(src.count).toBe(5)
  })
  it('잘못된 책·조리 결과·질병·붕괴 범위를 모드 로드 때 거부한다', () => {
    const pkgs = readPackages(), core = pkgs.find((p) => p.manifest.id === 'core')!
    core.defs.push({ ...db.item('Item.MedicalGuide'), id: 'Item.BadBook', book: { pages: -1, mastery: 'medicine', amount: 5 }, cooking: { result: 'Item.Missing', turns: 0 } } as never)
    core.defs.push({ ...db.get<DiseaseDef>('Disease.GreyFever'), id: 'Disease.Bad', incubationDays: [4, 2], sporeChance: 2 } as never)
    core.defs.push({ ...db.get<BreakDef>('Break.Cry'), id: 'Break.Bad', turns: [3, -1], kind: 'unknown' } as never)
    const { report } = loadMods(pkgs, [])
    expect(report.errors.some((e) => e.includes('book.pages'))).toBe(true)
    expect(report.errors.some((e) => e.includes('Item.Missing'))).toBe(true)
    expect(report.errors.some((e) => e.includes('잠복기'))).toBe(true)
    expect(report.errors.some((e) => e.includes('붕괴 종류'))).toBe(true)
  })
  it('포자 인간은 같은 난수·방어·공격의 화상 피해를 1.5배 받는다', () => {
    const { w, pl } = setup(), target = createCreature(w, 'Creature.SporeMan', { x: 21, y: 20 })
    w.s.creatures.push(target); pl.equip.main = makeItem(w, 'Item.Torch'); pl.equip.main.lit = true
    pl.stats.agi = 20; pl.stats.per = 20; target.equip = {}; target.reactPolicy = 'none'
    const pkgs = readPackages(), raw = pkgs.find((p) => p.manifest.id === 'core')!.defs.find((d) => d.id === target.def)!
    Object.assign(raw, { damageTaken: { burn: 1 } })
    const base = { db: loadMods(pkgs, []).db, s: deserialize(serialize(w.s)) }
    const a = resolveAttack(w, pl, target), b = resolveAttack(base, player(base), base.s.creatures.find((c) => c.id === target.id)!)
    expect(a.hit).toBe(true); expect(b.damage).toBeGreaterThan(0)
    expect(a.damage).toBe(Math.round(b.damage * 1.5))
  })
})


describe('긴 턴 계산의 분할·재개', () => {
  it('1회에 계산하거나 1·17행동씩 나누거나 결과가 같다', () => {
    const { w } = setup(); fire(w)
    const a = { db, s: deserialize(serialize(w.s)) }, b = { db, s: deserialize(serialize(w.s)) }
    playerAct(w, { type: 'rest', turns: 300 })
    for (const [ww, budget] of [[a, 1], [b, 17]] as const) {
      expect(playerAct(ww, { type: 'rest', turns: 300 }, budget)).toBeNull()
      let guard = 0
      while (ww.s.simulationPending && guard++ < 10000) runUntilInput(ww, budget)
      expect(guard).toBeLessThan(10000)
      expect(stateHash(ww.s)).toBe(stateHash(w.s))
    }
  })
  it('진행 중에는 새 입력을 거부하고 저장·복원해도 같은 입력 대기점으로 돌아온다', () => {
    const { w } = setup(); fire(w)
    playerAct(w, { type: 'rest', turns: 300 }, 3)
    expect(w.s.simulationPending).toBe(true)
    const hash = stateHash(w.s)
    expect(playerAct(w, { type: 'move', dir: 0 })).toContain('흐르는 중')
    expect(stateHash(w.s)).toBe(hash)
    const restored = { db, s: deserialize(serialize(w.s)) }
    while (w.s.simulationPending) runUntilInput(w, 19)
    while (restored.s.simulationPending) runUntilInput(restored, 7)
    expect(stateHash(restored.s)).toBe(stateHash(w.s))
  })
  it('잘못된 예산은 상태를 바꾸지 않고 거부한다', () => {
    const { w } = setup(), before = stateHash(w.s)
    expect(() => runUntilInput(w, 0)).toThrow('양의 정수')
    expect(stateHash(w.s)).toBe(before)
  })
})


describe('동상·포자 경계 회귀', () => {
  it('1도는 데우면 되돌아가고 3도는 실제 괴사 상처를 남긴다', () => {
    const { w, pl } = setup(), finger = bodyDef(w, pl).parts.find((p) => p.groups.includes('finger'))!
    fire(w); pl.frostbite = { [finger.id]: { exposure: 33, grade: 1, frozen: true } }
    frostbiteTick(w, pl)
    expect(pl.frostbite[finger.id].grade).toBe(0)
    w.s.map.lights = []; w.s.wind = { x: 4, y: 0 }; w.s.weather = 'ashrain'; w.s.time = TURNS_PER_DAY * 100
    pl.frostbite[finger.id] = { exposure: 100, grade: 2, frozen: true }
    frostbiteTick(w, pl)
    const f = pl.frostbite[finger.id], wound = pl.body.wounds.find((x) => x.id === f.wound)!
    expect(f.grade).toBe(3); expect(wound.def).toBe('Wound.Necrosis')
    expect(wound.severity).toBe(pl.body.maxHp[finger.id])
  })
  it('정산하지 않은 옛 포자가 만료됐다면 새 엷은 구름이 이전 농도를 물려받지 않는다', () => {
    const { w } = setup(), p = { x: 24, y: 20 }
    tileAt(w, p).spores = { until: turnOf(w) - 1, conc: 10 }
    sporeCloud(w, p, 0, 5, 2)
    expect(tileAt(w, p).spores!.conc).toBe(2)
    expect(isOpaque(w, p)).toBe(false)
  })
})


describe('수면 중 몸 신호', () => {
  it('극심한 통증에서는 잠들 수 없고 회복 가능한 수면 질로 표시하지 않는다', () => {
    const { w, pl } = setup(); fire(w)
    addWound(w, pl, { def: 'Wound.Cut', part: 'LeftForearm', severity: 140, source: '통증' })
    expect(sleepQuality(w, pl)).toBe(0)
    expect(perform(w, pl, { type: 'sleep' }).msg).toContain('아파')
  })
})


describe('시뮬레이션 종료 시각', () => {
  it('긴 자동 활동도 측정 종료 TU를 넘지 않으며 이어서 계산하면 일괄 결과와 같다', () => {
    const { w } = setup(); fire(w)
    const full = { db, s: deserialize(serialize(w.s)) }, end = w.s.time + 1000
    playerAct(full, { type: 'rest', turns: 300 })
    playerAct(w, { type: 'rest', turns: 300 }, undefined, end)
    expect(w.s.time).toBe(end); expect(w.s.simulationPending).toBe(true)
    runUntilInput(w)
    expect(stateHash(w.s)).toBe(stateHash(full.s))
  })
})
