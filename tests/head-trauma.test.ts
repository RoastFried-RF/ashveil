import { describe, expect, it } from 'vitest'
import { activityStep, perform } from '../src/core/actions'
import { addWound, consciousness, partEff } from '../src/core/body'
import { resolveAttack } from '../src/core/combat'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_DAY, type World } from '../src/core/ctx'
import { loadMods, type PatchOp } from '../src/core/defs'
import { invalidateLights } from '../src/core/fov'
import { recordConcussion } from '../src/core/head-trauma'
import { addToBag, makeItem, meleeWield } from '../src/core/items'
import { startMaintenance } from '../src/core/crafting'
import { startProsthetic } from '../src/core/prosthetics'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { masteryNext, masteryStage, masterySteps, studyBook } from '../src/core/skills'
import { readPackages } from '../tools/loadContent'
import { makeWorld } from './helpers'

function setup(patches: PatchOp[] = []) {
  const w = makeWorld('head-trauma', 'Bg.Excommunicate'), p = player(w)
  if (patches.length) { const result = loadMods([...readPackages(), { manifest: { id: 'injury.test', name: '검증', version: '1' }, defs: [], patches }]); expect(result.report.errors).toEqual([]); w.db = result.db }
  p.traits = []; p.abilities = []; p.equip = {}; p.bag = []; p.effects = []; p.thoughts = []; p.body.wounds = []; p.body.missing = []; p.skills = {}; p.background = undefined; p.age = undefined; p.literacy = 3; p.pos = { x: 20, y: 20 }; p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.hp = 90; p.body.blood = p.body.bloodMax; p.unconscious = false; p.cond = {}
  Object.assign(p.needs, { kcal: 0, waterDeficit: 0, fatigue: 20, bodyTemp: 37, protein: 100, vitamin: 100, hygiene: 100, stress: 0 })
  w.s.creatures = [p]; w.s.time = 14400 * 100; p.nextAct = w.s.time; w.s.weather = 'clear'; w.s.wind = { x: 0, y: 0 }; w.s.noiseEvents = []
  w.s.map = { ...w.s.map, lights: [{ pos: { ...p.pos }, kind: 'campfire', radius: 6 }] }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  invalidateLights(w); return { w, p }
}
const patch = (path: string, value: unknown): PatchOp => ({ op: 'replace', target: 'Recovery.Wounds', path, value })
function add(w: World, id: string, count = 1) { const it = makeItem(w, id, count); expect(addToBag(w, player(w), it)).toBe(0); return it }
function finish(w: World) { const p = player(w); for (let i = 0; p.activity && i < 3000; i++) activityStep(w, p); expect(p.activity).toBeUndefined() }

describe('누적 뇌진탕·건망과 학습', () => {
  it('서로 다른3충격에만 영구 의식 상한.95를 남기며 같은 상처는 한 번만 센다', () => {
    const { w, p } = setup([patch('/forgetfulChance', 0)]), before = structuredClone(w.s.rng.body)
    recordConcussion(w, p, 800); recordConcussion(w, p, 800); recordConcussion(w, p, 801)
    expect(p.body.concussionEvents).toEqual([800, 801]); expect(consciousness(w, p)).toBe(1)
    recordConcussion(w, p, 802); expect(consciousness(w, p)).toBe(.95); recordConcussion(w, p, 800); expect(p.body.concussionEvents).toHaveLength(3)
    expect(w.s.rng.body).toEqual(before); const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }; expect(consciousness(copy, player(copy))).toBe(.95)
  })
  it('실제로 두개골이 골절되면 뇌진탕을 기록하고 외부2차 판정은 중복하지 않는다', () => {
    const { w, p } = setup(), wd = addWound(w, p, { def: 'Wound.Bruise', part: 'Skull', severity: 2, source: '골절 검증', fracture: { grade: 'hairline', progress: 0 } }).wound
    expect(p.body.concussionEvents).toEqual([wd.id]); recordConcussion(w, p, wd.id); expect(p.body.concussionEvents).toHaveLength(1)
  })
  it('실제 머리 타격으로 기절하면 뇌진탕이 한 번 기록된다', () => {
    const { w, p } = setup(), a = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 }); a.stats.agi = 30; a.stats.per = 30; a.equip = {}; p.needs.energy = 0; w.s.creatures.push(a)
    for (let i = 0; !p.body.concussionEvents?.length && i < 20; i++) resolveAttack(w, a, p, { mods: { stunBonus: 100, partWeights: { head: 1000, torso: 0, rarm: 0, larm: 0, rleg: 0, lleg: 0 } } })
    expect(p.body.concussionEvents).toHaveLength(1)
  })
  it('건망은 문턱×1.5를 적용하되 이미 배운 의료3/생존2를 잃지 않는다', () => {
    const { w, p } = setup([patch('/forgetfulChance', 1)]); p.skills = { medicine: 30, survival: 15 }
    for (const id of [800, 801, 802]) recordConcussion(w, p, id)
    expect(p.traits).toContain('Trait.Forgetful'); expect(masterySteps(w, p)).toEqual([7, 22, 45, 75, 120]); expect(masteryStage(w, p, 'medicine')).toBe(3); expect(masteryStage(w, p, 'survival')).toBe(2); expect(masteryNext(w, p, 'medicine')).toBe(75)
    p.skills.medicine = 75; expect(masteryStage(w, p, 'medicine')).toBe(4)
    const copy: World = { db: w.db, s: deserialize(serialize(w.s)) }; expect(masteryStage(copy, player(copy), 'survival')).toBe(2); expect(player(copy).masteryFloor).toEqual({ medicine: 3, survival: 2 })
  })
  it('건망을 이미 얻은 인물은3회마다 확률을 중복 소비하거나 문턱을 더 늘리지 않는다', () => {
    const { w, p } = setup([patch('/forgetfulChance', 1)]); p.traits = ['Trait.Forgetful']; const before = structuredClone(w.s.rng.body)
    for (let id = 800; id < 806; id++) recordConcussion(w, p, id)
    expect(p.traits).toEqual(['Trait.Forgetful']); expect(w.s.rng.body).toEqual(before); expect(masterySteps(w, p)).toEqual([7, 22, 45, 75, 120]); expect(consciousness(w, p)).toBe(.95)
  })
  it('건망과40세 이상 학습 배율을 함께 적용하고 책만으로는2단계까지다', () => {
    const { w, p } = setup(); p.traits = ['Trait.Forgetful']; p.age = { years: 45, nextBirthday: turnOf(w) + TURNS_PER_DAY, masteryMult: .8 }
    expect(masterySteps(w, p)).toEqual([6, 18, 36, 60, 96])
    const { db, report } = loadMods([...readPackages(), { manifest: { id: 'books.test', name: '검증', version: '1' }, defs: ['A', 'B', 'C'].map((id) => ({ defType: 'Item', id: `Item.Book${id}`, parent: 'Item.MedicalGuide', book: { pages: 1, mastery: 'medicine', amount: 8 } })), patches: [] }])
    expect(report.errors).toEqual([]); w.db = db
    for (const id of ['A', 'B', 'C']) studyBook(w, p, `Item.Book${id}`, true)
    expect(p.skills.medicine).toBe(18); expect(masteryStage(w, p, 'medicine')).toBe(2)
  })
  it('상처가 아물고 시간이 지나도 뇌진탕 기록/영구 상한은 사라지지 않는다', () => {
    const { w, p } = setup([patch('/forgetfulChance', 0)])
    for (let i = 0; i < 3; i++) addWound(w, p, { def: 'Wound.Bruise', part: 'Skull', severity: 1, source: '검증', fracture: { grade: 'hairline', progress: 0 } })
    p.body.wounds = []; w.s.time += 10 * TURNS_PER_DAY * 100; expect(consciousness(w, p)).toBe(.95); expect(p.body.concussionEvents).toHaveLength(3)
  })
})

describe('자연 탈구와 치료', () => {
  it('충분히 강한 관절 타박은 탈구로 이어지고 실제 맞추기 처치로 해소한다', () => {
    const { w, p } = setup([patch('/dislocationChance', 1)]), severity = Math.ceil(p.body.maxHp.LeftHand * .3)
    const wd = addWound(w, p, { def: 'Wound.Bruise', part: 'LeftHand', severity, source: '검증' }).wound
    expect(wd.dislocated).toBe(true); expect(partEff(w, p, 'LeftHand')).toBe(.3)
    expect(perform(w, p, { type: 'procedure', procedure: 'reduce', woundId: wd.id }).ok).toBe(true); finish(w)
    expect(wd.dislocated).toBe(false); expect(partEff(w, p, 'LeftHand')).toBe(1)
  })
  it('약한 타박·내부 상처·골절·이미 탈구한 관절에는 새 탈구 난수를 쓰지 않는다', () => {
    const { w, p } = setup([patch('/dislocationChance', 1)]), before = structuredClone(w.s.rng.body)
    addWound(w, p, { def: 'Wound.Bruise', part: 'LeftForearm', severity: 1, source: '약함' })
    addWound(w, p, { def: 'Wound.Bruise', part: 'Stomach', severity: 5, source: '내부', internal: true })
    addWound(w, p, { def: 'Wound.Bruise', part: 'RightHand', severity: 5, source: '골절', fracture: { grade: 'hairline', progress: 0 } })
    expect(w.s.rng.body).toEqual(before)
    addWound(w, p, { def: 'Wound.Bruise', part: 'LeftHand', severity: 5, source: '첫 탈구' }); const once = structuredClone(w.s.rng.body)
    addWound(w, p, { def: 'Wound.Bruise', part: 'LeftHand', severity: 5, source: '두 번째 타박' }); expect(w.s.rng.body).toEqual(once)
  })
  it('실제 전투 타박이 자연 탈구를 만들며 중간 저장으로 보존한다', () => {
    const { w, p } = setup([patch('/dislocationChance', 1), patch('/dislocationSeverity', .05)]), a = createCreature(w, 'Creature.Reaver', { x: 21, y: 20 }); a.equip = {}; a.stats.agi = 30; a.stats.per = 30; p.needs.energy = 0; w.s.creatures.push(a)
    for (let i = 0; !p.body.wounds.some((wd) => wd.dislocated) && i < 20; i++) resolveAttack(w, a, p, { mods: { partWeights: { rarm: 1000, larm: 0, head: 0, torso: 0, rleg: 0, lleg: 0 } } })
    expect(p.body.wounds.some((wd) => wd.dislocated)).toBe(true); const copy = deserialize(serialize(w.s)); expect(stateHash(copy)).toBe(stateHash(w.s))
  })
})

describe('의수족 후속 정합', () => {
  it('활의 근접 공격은 의수 전원이 꺼지면 남은 손을 쓰고 두 손이 모두 없으면 거부한다', () => {
    const { w, p } = setup(); p.skills.medicine = 30; p.body.missing = ['RightForearm']; const arm = add(w, 'Item.PioneerArm'); arm.appraisal = 2; add(w, 'Item.Needle'); startProsthetic(w, p, 'install', 'RightForearm', arm.uid, 1); finish(w)
    p.equip.main = makeItem(w, 'Item.Bow'); expect(meleeWield(w, p)!.arm).toBe('rarm')
    w.s.time = p.body.prosthetics!.RightForearm.powerUntil! * 100; expect(meleeWield(w, p)!.arm).toBe('larm'); p.body.missing.push('LeftHand'); expect(meleeWield(w, p)).toBeUndefined()
  })
  it('실제 수리는 설치한 목제 의족의 UID를 유지하며 재료와 영구 최대 내구를 반영한다', () => {
    const { w, p } = setup(); p.body.missing = ['LeftShin']; const peg = add(w, 'Item.PegLeg'); add(w, 'Item.HuntingKnife'); add(w, 'Item.Wood', 3)
    startProsthetic(w, p, 'install', 'LeftShin', peg.uid, 1); finish(w); const installed = p.body.prosthetics!.LeftShin.item; installed.durability = 40
    expect(startMaintenance(w, p, 'repair', installed.uid, 1)).toBeNull(); finish(w)
    expect(installed.uid).toBe(peg.uid); expect(installed.durability).toBeGreaterThan(40); expect(installed.maxDurability).toBeLessThan(100); expect(p.body.prosthetics!.LeftShin.item.uid).toBe(peg.uid)
  })
})
