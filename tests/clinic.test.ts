import {SAVE_VERSION} from '../src/core/game'
import { describe, expect, it } from 'vitest'
import { activityStep, treatQuality } from '../src/core/actions'
import { addWound, effectiveBleed } from '../src/core/body'
import { clinicQuote, requestClinic, type ClinicRequest } from '../src/core/clinic'
import { createCreature } from '../src/core/creatures'
import { player, tileAt, turnOf, TURNS_PER_HOUR, type World } from '../src/core/ctx'
import { ensureSociety } from '../src/core/diplomacy'
import { newGame, playerAct, runUntilInput } from '../src/core/game'
import { canSee, invalidateLights } from '../src/core/fov'
import { addToBag, findItem, makeItem } from '../src/core/items'
import { deserialize, serialize, stateHash } from '../src/core/save'
import { initializeSettlement } from '../src/core/settlements'
import { drugEffects } from '../src/core/drug-state'
import { administerDrug } from '../src/core/pharmacology'
import { loadMods } from '../src/core/defs'
import { readPackages } from '../tools/loadContent'
import type { ClinicDef, ItemDef } from '../src/core/types'
import { startProcedure, startTreatment } from '../src/core/treatment'
import { db } from './helpers'
const template = newGame(db, { seed: 'clinic-contracts', overworld: true })
function setup() {
  const w: World = { db, s: structuredClone(template) }, p = player(w)
  p.pos = { x: 20, y: 20 }; w.s.creatures = [p]; w.s.time = 12 * TURNS_PER_HOUR * 100; w.s.weather = 'clear'; w.s.weatherUntil = 1e12; w.s.wind = { x: 0, y: 0 }
  const doctor = createCreature(w, 'Creature.SettlementDoctor', { x: 21, y: 20 }); w.s.creatures.push(doctor)
  for (const c of [p, doctor]) {
    c.hp = 95; c.age = undefined; c.background = undefined; c.abilities = []; c.traumas = []; c.thoughts = []; c.effects = []; c.equip = {}; c.bag = []; c.body.wounds = []; c.body.missing = []; c.body.blood = c.body.bloodMax; c.nextAct = w.s.time
    Object.assign(c.needs, { kcal: 1000, waterDeficit: 0, protein: 100, vitamin: 100, hygiene: 100, fatigue: 10, sleepDebt: 0, bodyTemp: 37, wetness: 0, stress: 0 })
  }
  p.stats = { str: 10, agi: 10, per: 10, vit: 10, wil: 10 }; p.skills = {}; p.traits = []; p.money = 1000
  doctor.traits = ['Trait.Neat']; doctor.stats = { str: 10, agi: 10, per: 13, vit: 10, wil: 10 }; doctor.skills = { medicine: 50 }; doctor.home = { ...doctor.pos }
  for (let y = 17; y <= 23; y++) for (let x = 17; x <= 23; x++) Object.assign(tileAt(w, { x, y }), { t: 'Terrain.Earth', roof: true, items: [] })
  w.s.map.lights = [{ pos: { ...p.pos }, radius: 6, kind: 'campfire' }]; invalidateLights(w)
  const stock = (def: string, count = 1, quality?: number) => { const it = makeItem(w, def, count); if (quality !== undefined) it.quality = quality; expect(addToBag(w, doctor, it)).toBe(0); return it }
  const bag = stock('Item.MedicalBag'), thread = stock('Item.Thread', 5), needle = stock('Item.Needle'), spirit = stock('Item.Moonshine'), splint = stock('Item.Splint'); stock('Item.Tourniquet'); stock('Item.RustyKnife')
  const wound = (part = 'LeftForearm', severity = 2) => addWound(w, p, { def: 'Wound.Cut', part, severity, source: '진료 검증', contam: 30 }).wound
  return { w, p, doctor, bag, thread, needle, spirit, splint, stock, wound }
}
function finish(w: World) { let n = 0; do { runUntilInput(w, 100); } while (w.s.simulationPending && n++ < 1000); expect(n).toBeLessThan(1000) }
function finishDoctor(w: World) { const d = w.s.creatures.find((c) => c.def === 'Creature.SettlementDoctor')!; for (let n = 0; d.activity && n < 1000; n++) activityStep(w, d); expect(d.activity).toBeUndefined() }
function start(w: World, request: ClinicRequest) { const p = player(w), d = w.s.creatures.find((c) => c.def === 'Creature.SettlementDoctor')!, q = clinicQuote(w, p, d, request); expect(q.error).toBeNull(); expect(requestClinic(w, p, d, request, q.fee)).toBeNull(); return q }

describe('시술자와 환자를 분리한 실제 진료', () => {
  it('02검산B: 지각13/의료4/의료가방15/청결5/실내5는Q87이고 견적은 읽기 전용이다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound(), before = stateHash(w.s)
    const quote = clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id })
    expect(quote.error).toBeNull(); expect(quote.quality).toBe(87); expect(quote.turns).toBe(5)
    clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id }); expect(stateHash(w.s)).toBe(before)
    p.stats.per = 30; p.skills.medicine = 80; expect(clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id }).quality).toBe(87)
    doctor.stats.per = 10; expect(clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id }).quality).toBe(81)
  })
  it.each([10, 20])('스케줄러 주도권(%i)이 달라도5턴 진료는 환자에게Q87/의사물품1회만 남긴다', (agi) => {
    const { w, p, doctor, bag, wound } = setup(), wd = wound(), before = w.s.time, blood = p.body.blood, skill = p.skills.medicine
    p.stats.agi = agi; const q = clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id })
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'bandage', woundId: wd.id }, expectedFee: q.fee })).toBeNull()
    expect(w.s.time - before).toBe(500); expect(wd.bandage?.quality).toBe(87); expect(bag.uses).toBe(4); expect(p.body.blood).toBeLessThan(blood)
    expect(doctor.body.wounds).toHaveLength(0); expect(p.money).toBe(1000 - q.fee); expect(doctor.money).toBe(q.fee); expect(p.skills.medicine).toBe(skill); expect([p.activity, doctor.activity]).toEqual([undefined, undefined])
  })
  it('시술자의 다음차례까지37TU를 기다리고 마지막 작업턴까지537TU를 정산한다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound(), before = w.s.time
    doctor.nextAct += 37
    const q = clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id }); expect(q.turns).toBe(6)
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'bandage', woundId: wd.id } })).toBeNull()
    expect(w.s.time - before).toBe(537); expect(wd.bandage?.quality).toBe(87)
  })
  it('자가 처치 계수는 유지하고 타인의 다친 팔은 시술자의 건강한 손으로 처치한다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound('RightHand', 1)
    expect(treatQuality(w, p, 0, wd).q).toBe(32); expect(treatQuality(w, doctor, 15, wd, { patient: p }).q).toBe(87)
    doctor.body.missing.push('RightUpperArm'); expect(startTreatment(w, doctor, doctor.bag[0].uid, wd.id, undefined, undefined, p).ok).toBe(true)
    doctor.activity = undefined; doctor.body.missing.push('LeftUpperArm'); expect(startTreatment(w, doctor, doctor.bag[0].uid, wd.id, undefined, undefined, p).ok).toBe(false)
  })
  it('타인의 눈은 붕대/봉합이 가능하지만 내부장기는 노출된상처로 우회하지 못한다', () => {
    const { w, p, doctor, thread, wound } = setup(), eye = wound('LeftEye', 1)
    expect(startTreatment(w, p, thread.uid, eye.id).ok).toBe(false)
    expect(startTreatment(w, doctor, thread.uid, eye.id, undefined, 'suture', p).ok).toBe(true)
    doctor.activity = undefined
    const inside = addWound(w, p, { def: 'Wound.InternalBleed', part: 'LeftLung', severity: 1, internal: true, source: '진료 검증' }).wound
    expect(clinicQuote(w, p, doctor, { kind: 'suture', woundId: inside.id }).error).toContain('진찰')
    expect(startTreatment(w, doctor, thread.uid, inside.id, undefined, 'suture', p).msg).toContain('몸속')
  })
  it('세척은 환자의 오염을 줄이고 의사의 술1회만 소비한다', () => {
    const { w, p, doctor, spirit, wound } = setup(), wd = wound(), old = spirit.uses!
    start(w, { kind: 'disinfect', woundId: wd.id }); finishDoctor(w)
    expect(wd.contam).toBe(16); expect(wd.washedAt).toBeDefined(); expect(spirit.uses).toBe(old - 1); expect(doctor.effects).toHaveLength(0); expect(p.effects.some((e) => e.kind === 'sting')).toBe(true)
  })
  it('동맥 결찰은 환자의 동맥을 막고 의사의 실2/바늘내구1을 쓴다', () => {
    const { w, p, doctor, thread, needle, wound } = setup(), wd = wound(); wd.arterial = true; wd.artery = 15
    expect(clinicQuote(w, p, doctor, { kind: 'suture', woundId: wd.id }).error).toContain('결찰')
    start(w, { kind: 'ligate', woundId: wd.id }); finishDoctor(w)
    expect(wd.artery).toBeUndefined(); expect(wd.ligated).toBe(true); expect(thread.count).toBe(3); expect(needle.durability).toBe(99); expect(effectiveBleed(w, p, wd)).toBeLessThan(1)
  })
  it('실을 분리해 예약하며 한 더미가 사라지면 다른 새 실로 대체하지 않는다', () => {
    const { w, doctor, thread, stock, wound } = setup(), wd = wound(); wd.tendon = true; thread.count = 1
    const second = stock('Item.Thread', 1, 2)
    start(w, { kind: 'tendon', woundId: wd.id }); expect(doctor.activity?.supplies).toHaveLength(2)
    doctor.bag = doctor.bag.filter((i) => i.uid !== second.uid); const spare = stock('Item.Thread', 3, 3)
    activityStep(w, doctor); expect(doctor.activity).toBeUndefined(); expect(wd.tendon).toBe(true); expect(thread.count).toBe(1); expect(spare.count).toBe(3)
  })
  it('바늘을 잃거나 칼날이 망가지면 선택한 도구를 바꿔 끼우지 않는다', () => {
    const { w, doctor, needle, thread, stock, wound } = setup(), wd = wound()
    start(w, { kind: 'suture', woundId: wd.id }); doctor.bag = doctor.bag.filter((i) => i.uid !== needle.uid); stock('Item.Needle')
    activityStep(w, doctor); expect(wd.suture).toBeUndefined(); expect(thread.count).toBe(5)
    const blade = doctor.bag.find((i) => i.def === 'Item.RustyKnife')!, p = player(w); p.body.tourniquets.LeftUpperArm = w.s.time / 100
    start(w, { kind: 'amputate', part: 'LeftHand' }); blade.durability = 0; activityStep(w, doctor); expect(p.body.missing).not.toContain('LeftHand')
  })
  it('예약 뒤 실이 추가되어도 처음 정한 두 더미에서 각각1개씩 소비한다', () => {
    const { w, doctor, thread, stock, wound } = setup(), wd = wound(); wd.tendon = true; thread.count = 1
    const second = stock('Item.Thread', 1, 2); start(w, { kind: 'tendon', woundId: wd.id }); thread.count += 3
    finishDoctor(w); expect(thread.count).toBe(3); expect(findItem(doctor, second.uid)).toBeUndefined(); expect(wd.tendon).toBe(false)
  })
  it('환자의 수동 중단은 양쪽 활동을 끊고 미완료물품을 돌려쓰되 진료비는 환불하지 않는다', () => {
    const { w, p, doctor, bag, wound } = setup(), wd = wound(), q = start(w, { kind: 'bandage', woundId: wd.id })
    activityStep(w, doctor); expect(playerAct(w, { type: 'stopActivity' })).toBeNull()
    expect([p.activity, doctor.activity]).toEqual([undefined, undefined]); expect(wd.bandage).toBeUndefined(); expect(bag.uses).toBe(5); expect(p.money).toBe(1000 - q.fee); expect(doctor.money).toBe(q.fee)
  })
  it('절반 이상 진행한 부목은 환자에게 반쪽 효과와 실제 소비를 보존한다', () => {
    const { w, p, doctor, splint, wound } = setup(), wd = wound('LeftForearm', 3); wd.fracture = { grade: 'simple', progress: 0 }
    start(w, { kind: 'splint', woundId: wd.id }); for (let n = 0; n < 5; n++) activityStep(w, doctor)
    expect(playerAct(w, { type: 'stopActivity' })).toBeNull(); expect(wd.splint?.half).toBe(true); expect(findItem(doctor, splint.uid)).toBeUndefined(); expect(p.activity).toBeUndefined()
  })
  it.each(['hands', 'move'] as const)('유효한5턴 작업 뒤 %s 중단은 당시Q의 반쪽 부목을 보존한다', (change) => {
    const { w, p, doctor, splint, wound } = setup(), wd = wound('LeftForearm', 3); wd.fracture = { grade: 'simple', progress: 0 }
    start(w, { kind: 'splint', woundId: wd.id }); for (let n = 0; n < 5; n++) activityStep(w, doctor)
    const q = doctor.activity!.lastTreatQuality!; expect(q).toBeGreaterThan(50)
    if (change === 'hands') doctor.body.missing = ['LeftUpperArm', 'RightUpperArm']
    else p.pos.x -= 2
    activityStep(w, doctor); expect(wd.splint).toEqual({ quality: q, half: true }); expect(findItem(doctor, splint.uid)).toBeUndefined(); expect(p.activity).toBeUndefined()
  })
  it('4턴 뒤 손을 잃은 무효 작업은 다섯번째 진행으로 세지 않아 반쪽 부목을 만들지 않는다', () => {
    const { w, doctor, splint, wound } = setup(), wd = wound('LeftForearm', 3); wd.fracture = { grade: 'simple', progress: 0 }
    start(w, { kind: 'splint', woundId: wd.id }); for (let n = 0; n < 4; n++) activityStep(w, doctor)
    doctor.body.missing = ['LeftUpperArm', 'RightUpperArm']; activityStep(w, doctor); expect(wd.splint).toBeUndefined(); expect(findItem(doctor, splint.uid)).toBe(splint)
  })
  it('진행 중 부목 자체를 잃으면 여분으로 반쪽 부목을 복제하지 않는다', () => {
    const { w, doctor, splint, stock, wound } = setup(), wd = wound('LeftForearm', 3); wd.fracture = { grade: 'simple', progress: 0 }
    start(w, { kind: 'splint', woundId: wd.id }); for (let n = 0; n < 5; n++) activityStep(w, doctor)
    doctor.bag = doctor.bag.filter((it) => it.uid !== splint.uid); const spare = stock('Item.Splint'); activityStep(w, doctor)
    expect(wd.splint).toBeUndefined(); expect(findItem(doctor, spare.uid)).toBe(spare)
  })
  it.each(['move', 'sleep', 'death', 'hands'] as const)('시술자/환자의 상태 변경(%s)은 다음 작업에서 진료를 중단한다', (change) => {
    const { w, p, doctor, bag, wound } = setup(), wd = wound(); start(w, { kind: 'bandage', woundId: wd.id })
    if (change === 'move') p.pos.x -= 2
    if (change === 'sleep') doctor.asleep = true
    if (change === 'death') doctor.alive = false
    if (change === 'hands') doctor.body.missing = ['LeftUpperArm', 'RightUpperArm']
    activityStep(w, p); expect(p.activity).toBeUndefined(); expect(doctor.activity).toBeUndefined(); expect(wd.bandage).toBeUndefined(); expect(bag.uses).toBe(5)
  })
  it('환자가 중간에 의식을 잃어도 살아 있고 곁에 있으면 의사는 계속 처치한다', () => {
    const { w, p, bag, wound } = setup(), wd = wound(); start(w, { kind: 'bandage', woundId: wd.id }); p.unconscious = true
    finishDoctor(w); expect(wd.bandage?.quality).toBe(87); expect(bag.uses).toBe(4); expect(p.unconscious).toBe(true); expect(p.activity).toBeUndefined()
  })
  it.each([true, false])('이물질 제거 성공=%s의 출혈/악화는 환자에게만 적용한다', (success) => {
    const { w, p, doctor, wound } = setup(), wd = wound(), blood = p.body.blood, doctorHp = doctor.hp
    wd.foreign = { kind: 'arrow', ammo: 'Item.Arrow', contam: 10, pain: 0 }
    start(w, { kind: 'extract', woundId: wd.id }); w.s.rng.body = [success ? 0 : 4294967295, 0, 0, 0]; finishDoctor(w)
    if (success) { expect(wd.foreign).toBeUndefined(); expect(p.body.blood).toBe(blood - 10); expect(tileAt(w, p.pos).items.some((i) => i.def === 'Item.Arrow')).toBe(true) }
    else { expect(wd.foreign).toBeDefined(); expect(wd.severity).toBe(4); expect(p.hp).toBe(93) }
    expect(doctor.hp).toBe(doctorHp); expect(doctor.body.wounds).toHaveLength(0)
  })
  it('의사에게 받은 시술도 환자의 탈구와 힘줄/절단 상태에만 작용한다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound(); wd.dislocated = true
    start(w, { kind: 'reduce', woundId: wd.id }); finishDoctor(w); expect(wd.dislocated).toBe(false)
    wd.tendon = true; start(w, { kind: 'tendon', woundId: wd.id }); finishDoctor(w); expect(wd.tendon).toBe(false)
    p.effects = []; p.body.tourniquets.LeftUpperArm = w.s.time / 100
    expect(startProcedure(w, doctor, 'amputate', undefined, 'LeftHand', p).ok).toBe(true)
    p.activity = { kind: 'careWait', healerId: doctor.id, remaining: 60, label: '검증' }; finishDoctor(w)
    expect(p.body.missing).toContain('LeftHand'); expect(doctor.body.missing).toHaveLength(0)
  })
  it('진료 중 각인은 두 사람/예약 UID/남은시간/지불을 그대로 이어서 같은 결과를 낸다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound(); wd.tendon = true
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'tendon', woundId: wd.id } }, 1)).toBeNull()
    for (let n = 0; n < 13; n++) runUntilInput(w, 1)
    expect(p.activity?.kind).toBe('careWait'); expect(doctor.activity?.remaining).toBeGreaterThan(0)
    const legacy = JSON.parse(serialize(w.s)); legacy.version = 8
    const restored = { db, s: deserialize(JSON.stringify(legacy)) }; expect({ ...restored.s, version: 8 }).toEqual(legacy); finish(w); finish(restored)
    expect(stateHash(restored.s)).toBe(stateHash(w.s)); expect(wd.tendon).toBe(false)
  })
})

describe('진료 계약·시설·구형 각인', () => {
  it('돈/견적불일치/적대/거리/물품부족/바쁜의사는 아무것도 지불하거나 소모하지 않는다', () => {
    for (const kind of ['money','quote','hostile','distance','stock','busy'] as const) {
      const { w, p, doctor, wound } = setup(), wd = wound()
      if (kind === 'money') p.money = 0
      if (kind === 'hostile') doctor.attackedBy = [p.id]
      if (kind === 'distance') doctor.pos.x += 3
      if (kind === 'stock') doctor.bag = []
      if (kind === 'busy') doctor.activity = { kind: 'rest', remaining: 10, label: '휴식' }
      const before = stateHash(w.s); expect(requestClinic(w, p, doctor, { kind: 'bandage', woundId: wd.id }, kind === 'quote' ? 999 : undefined)).not.toBeNull(); expect(stateHash(w.s)).toBe(before)
    }
  })
  it('의료가방은 실제5회 쓰면 사라지고 여섯번째 진료를 발급하지 않는다', () => {
    const { w, p, doctor, bag, wound } = setup()
    for (let n = 0; n < 5; n++) { const wd = wound(); start(w, { kind: 'bandage', woundId: wd.id }); finishDoctor(w) }
    expect(findItem(doctor, bag.uid)).toBeUndefined(); const wd = wound(); expect(clinicQuote(w, p, doctor, { kind: 'bandage', woundId: wd.id }).error).toContain('물품')
  })
  it('정착지 초기화는 의사1명과 유한한 사적물품을 만들며 소모·사망·재초기화로 보충하지 않는다', () => {
    const { w, p } = setup(), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
    w.s.creatures = [p]; m.currentRegion = site.id; w.s.map.settlementInitialized = undefined; w.s.map.clinicInitialized = undefined; initializeSettlement(w)
    const doctor = w.s.creatures.find((c) => db.creature(c.def).clinic)!; expect(doctor.clinicSite).toBe(site.id); expect(w.s.creatures).toHaveLength(5); expect(doctor.bag.filter((i) => i.def === 'Item.MedicalBag')).toHaveLength(2)
    doctor.bag = []; doctor.alive = false; const before = stateHash(w.s); initializeSettlement(w); expect(stateHash(w.s)).toBe(before)
    const copy = { db, s: deserialize(serialize(w.s)) }; initializeSettlement(copy); expect(stateHash(copy.s)).toBe(before)
  })
  it('버전7 몸과 치료/돈/물품을 바꾸지 않으며 구형 정착지에 의사만 한 번 추가한다', () => {
    const { w, p } = setup(), m = w.s.overworld!, site = m.sites.find((s) => s.kind === 'settlement' && s.faction === 'coalition')!
    w.s.creatures = [p]; m.currentRegion = site.id; w.s.map.settlementInitialized = true; w.s.map.clinicInitialized = undefined
    const resident = createCreature(w, 'Creature.Settler', { x: 35, y: 18 }); w.s.creatures.push(resident); resident.hp = 50
    const raw = JSON.parse(serialize(w.s)); raw.version = 7; const s = deserialize(JSON.stringify(raw)); expect(s.version).toBe(SAVE_VERSION); expect({ ...s, version: 7 }).toEqual(raw)
    const restored = { db, s }; initializeSettlement(restored); expect(restored.s.creatures.find((c) => c.id === resident.id)).toEqual(resident); expect(restored.s.creatures.filter((c) => c.def === 'Creature.SettlementDoctor')).toHaveLength(1)
    const hash = stateHash(restored.s); initializeSettlement(restored); expect(stateHash(restored.s)).toBe(hash)
  })
  it('평판의 진료 거절·가격 보정은 실제 견적에 적용한다', () => {
    const { w, p, doctor, wound } = setup(), wd = wound(), society = ensureSociety(w)!
    society.reputation.coalition = 0; const neutral = clinicQuote(w, p, doctor, { kind: 'suture', woundId: wd.id }).fee
    society.reputation.coalition = 80; expect(clinicQuote(w, p, doctor, { kind: 'suture', woundId: wd.id }).fee).toBeLessThan(neutral)
    society.reputation.coalition = -80; expect(clinicQuote(w, p, doctor, { kind: 'suture', woundId: wd.id }).error).not.toBeNull()
  })
})

describe('실제 진찰·검사 시점의 임상 기록', () => {
  it('견적은 결과를 미리 만들지 않고10턴 뒤에만 진찰 기록과 비용을 남긴다', () => {
    const { w, p, doctor } = setup(), contents=()=>JSON.stringify(doctor.bag,(key,value)=>key==='gearAgedAt'?undefined:value), before = w.s.time, bag = contents(), skill = p.skills.medicine, xp = p.xp, hash = stateHash(w.s)
    expect(clinicQuote(w, p, doctor, { kind: 'diagnose' }).turns).toBe(10); expect(stateHash(w.s)).toBe(hash); expect(p.medicalReports).toBeUndefined()
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'diagnose' } })).toBeNull()
    expect(w.s.time - before).toBe(1000); expect(p.money).toBe(994); expect(doctor.money).toBe(6); expect(contents()).toBe(bag)
    expect(p.medicalReports).toHaveLength(1); expect(p.medicalReports![0]).toMatchObject({ examinerId: doctor.id, mastery: 4, quality: 72 }); expect(p.skills.medicine).toBe(skill); expect(p.xp).toBe(xp)
  })
  it('3단계 복부 진찰은 내출혈의 소견을 찾되 장기명/상처 수치까지 알아내지는 않는다', () => {
    const { w, p, doctor } = setup(); doctor.skills.medicine = 30
    addWound(w, p, { def: 'Wound.InternalBleed', part: 'Liver', severity: 2, internal: true, source: '검증' })
    start(w, { kind: 'diagnose' }); const rng = JSON.stringify(w.s.rng); finishDoctor(w)
    const result = p.medicalReports![0].findings.join(' '); expect(result).toContain('복부가 단단'); expect(result).toContain('내출혈이 의심'); expect(result).not.toMatch(/간:|Liver|심각도|ml|맥을/); expect(JSON.stringify(w.s.rng)).toBe(rng)
  })
  it('1단계 시술자는 겉만 살피며 맥/숨은 장기를 투시하지 않는다', () => {
    const { w, p, doctor } = setup(); doctor.skills.medicine = 5; p.body.blood *= .78
    addWound(w, p, { def: 'Wound.InternalBleed', part: 'Liver', severity: 2, internal: true, source: '검증' })
    start(w, { kind: 'diagnose' }); finishDoctor(w); const text = p.medicalReports![0].findings.join(' ')
    expect(text).not.toMatch(/단단|맥을|내출혈이 의심|Liver/); expect(text).toContain('내부 이상까지 배제한 것은 아니다')
  })
  it('4단계 맥 소견은22%손실을15~30%범위로 기록한다', () => {
    const { w, p } = setup(); p.body.blood = p.body.bloodMax * .78
    start(w, { kind: 'diagnose' }); finishDoctor(w); expect(p.medicalReports![0].findings.join(' ')).toContain('혈액 손실 약 15~30%'); expect(p.medicalReports![0].findings.join(' ')).not.toMatch(/22%|ml/)
  })
  it('진찰 뒤 새 출혈/상처가 생겨도 과거 기록의 내용을 바꾸지 않는다', () => {
    const { w, p, wound } = setup(); start(w, { kind: 'diagnose' }); finishDoctor(w); const report = JSON.stringify(p.medicalReports)
    p.body.blood *= .62; wound('RightHand', 3); expect(JSON.stringify(p.medicalReports)).toBe(report)
  })
  it('감염은 의심 소견으로 남기고 면역 경주/질병 잠복의 숨은 값은 공개하지 않는다', () => {
    const { w, p, wound } = setup(), wd = wound(); wd.infection = { progress: 47.3, immunity: 93.6 }
    p.diseases = [{ def: 'Disease.GreyFever', incubatesUntil: w.s.time / 100 + 1000, progress: 0, immunity: 0 }]
    start(w, { kind: 'diagnose' }); finishDoctor(w); const text = p.medicalReports![0].findings.join(' ')
    expect(text).toContain('감염 의심'); expect(text).not.toMatch(/47\.3|93\.6|회색열|GreyFever/)
  })
  it('어두운 검사 여건으로Q가40미만이면 판별 실패를 기록하고 숨은 소견을 만들지 않는다', () => {
    const { w, p, doctor } = setup(); doctor.skills.medicine = 30; w.s.map.kind = 'dungeon'; w.s.map.lights = []; invalidateLights(w)
    addWound(w, p, { def: 'Wound.InternalBleed', part: 'Liver', severity: 1, internal: true, source: '검증' })
    start(w, { kind: 'diagnose' }); finishDoctor(w); expect(p.medicalReports![0].quality).toBeLessThan(40); expect(p.medicalReports![0].findings.join(' ')).toContain('충분히 판단하지 못했다'); expect(p.medicalReports![0].findings.join(' ')).not.toContain('복부가 단단')
  })
  it('중간 취소는 양쪽 활동을 끊고 검사 결과를 만들지 않는다', () => {
    const { w, p, doctor } = setup(); start(w, { kind: 'diagnose' }); activityStep(w, doctor); expect(playerAct(w, { type: 'stopActivity' })).toBeNull()
    expect([p.activity, doctor.activity]).toEqual([undefined, undefined]); expect(p.medicalReports).toBeUndefined(); expect(p.money).toBe(994)
  })
  it('의사의 손을 잃으면 환자 대기를 끊고 미완료 기록을 쓰지 않는다', () => {
    const { w, p, doctor } = setup(); start(w, { kind: 'diagnose' }); doctor.body.missing = ['LeftUpperArm', 'RightUpperArm']; activityStep(w, p)
    expect([p.activity, doctor.activity]).toEqual([undefined, undefined]); expect(p.medicalReports).toBeUndefined()
  })
  it('진찰 중간 각인의 결과·지불·남은시간과 전체 상태가 같다', () => {
    const { w, p, doctor, wound } = setup(); wound()
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'diagnose' } }, 1)).toBeNull()
    for (let n = 0; n < 5; n++) runUntilInput(w, 1)
    expect(doctor.activity?.kind).toBe('diagnose'); expect(p.medicalReports).toBeUndefined(); const restored = { db, s: deserialize(serialize(w.s)) }
    finish(w); finish(restored); expect(stateHash(restored.s)).toBe(stateHash(w.s)); expect(p.medicalReports).toHaveLength(1)
  })
  it('NPC 환자의 기록은 그 환자에게 남으며 플레이어 로그나 지식에 새지 않는다', () => {
    const { w, p, doctor } = setup(), npc = createCreature(w, 'Creature.Settler', { x: 22, y: 20 }); npc.money = 100; w.s.creatures.push(npc)
    const knowledge = JSON.stringify(w.s.knowledge), logs = JSON.stringify(w.s.log)
    expect(requestClinic(w, npc, doctor, { kind: 'diagnose' })).toBeNull(); finishDoctor(w)
    expect(npc.medicalReports).toHaveLength(1); expect(p.medicalReports).toBeUndefined(); expect(JSON.stringify(w.s.knowledge)).toBe(knowledge); expect(JSON.stringify(w.s.log)).toBe(logs)
  })
  it('의료물품이 바닥나도 진찰은 가능하지만 숙달이 없는 의사는 진찰하지 못한다', () => {
    const { w, p, doctor } = setup(); doctor.bag = []; start(w, { kind: 'diagnose' }); finishDoctor(w); expect(p.medicalReports).toHaveLength(1)
    doctor.skills.medicine = 0; const before = stateHash(w.s); expect(requestClinic(w, p, doctor, { kind: 'diagnose' })).toContain('숙달1'); expect(stateHash(w.s)).toBe(before)
  })
  it('과거 진료는10회만 보관하며 반복 진찰이XP/AP/숙달을 주지 않는다', () => {
    const { w, p } = setup(), before = [p.xp, p.abilityPoints, p.skills.medicine]
    for (let n = 0; n < 12; n++) { w.s.time += 1000; start(w, { kind: 'diagnose' }); finishDoctor(w) }
    expect(p.medicalReports).toHaveLength(10); expect(p.medicalReports![0].at).toBe(14430); expect([p.xp, p.abilityPoints, p.skills.medicine]).toEqual(before)
  })
})

describe('실제 약품 재고·환자 투약·부작용', () => {
  it('투약 견적은 환자 내성40의 통증28/의존8.4%를 읽기 전용으로 예고한다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.PoppyTincture')
    p.drugs = { active: [], tolerance: { analgesic: 40 }, toleranceAt: turnOf(w), lastDose: {}, addicted: [], revision: 0 }
    const before = stateHash(w.s), q = clinicQuote(w, p, doctor, { kind: 'dose', uid: it.uid })
    expect(q.error).toBeNull(); expect(q.quality).toBeNull(); expect(q.fee).toBe(24); expect(q.lines.join(' ')).toContain('28.0'); expect(q.lines.join(' ')).toContain('8.4%'); expect(stateHash(w.s)).toBe(before)
    start(w, { kind: 'dose', uid: it.uid }); finishDoctor(w); expect(drugEffects(w, p).pain).toBe(28); expect(p.drugs.tolerance.analgesic).toBe(60); expect(doctor.drugs).toBeUndefined()
  })
  it('의사의37TU대기와1턴을 정산하고 환자에게만 차를 투여하며 재고1/비용12를 쓴다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.WillowTea', 3), before = w.s.time
    doctor.nextAct += 37
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'dose', uid: it.uid } })).toBeNull()
    expect(w.s.time - before).toBe(137); expect(p.money).toBe(988); expect(doctor.money).toBe(12); expect(it.count).toBe(2); expect(drugEffects(w, p).pain).toBe(10); expect(doctor.drugs).toBeUndefined()
  })
  it('차의 실제200ml수분과 팅크의 변비/호흡감소도 환자에게 적용한다', () => {
    const { w, p, doctor, stock } = setup(), tea = stock('Item.WillowTea'), poppy = stock('Item.PoppyTincture')
    p.needs.waterDeficit = 300; const doctorNeeds = JSON.stringify(doctor.needs)
    start(w, { kind: 'dose', uid: tea.uid }); finishDoctor(w); expect(p.needs.waterDeficit).toBe(100)
    start(w, { kind: 'dose', uid: poppy.uid }); finishDoctor(w); expect(p.effects.some((e) => e.kind === 'constipation')).toBe(true); expect(drugEffects(w, p).breathingLoss).toBe(.1); expect(JSON.stringify(doctor.needs)).toBe(doctorNeeds)
  })
  it('동일 약 재투여는 하나의 효과를 유지하면서 지속/내성과 실제재고를 갱신한다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.PoppyTincture', 2)
    start(w, { kind: 'dose', uid: it.uid }); finishDoctor(w); const until = p.drugs!.active[0].until
    w.s.time += 1200 * 100; start(w, { kind: 'dose', uid: it.uid }); finishDoctor(w)
    expect(p.drugs!.active.filter((d) => d.def === 'Drug.PoppyTincture')).toHaveLength(1); expect(drugEffects(w, p).pain).toBe(35); expect(p.drugs!.active[0].until).toBeGreaterThan(until); expect(p.drugs!.tolerance.analgesic).toBeGreaterThan(20); expect(findItem(doctor, it.uid)).toBeUndefined()
  })
  it('쓴이끼는3턴 뒤 선택한 상처에만 바르고 자극2를 남기며 전신 항생제로 바뀌지 않는다', () => {
    const { w, p, doctor, stock, wound } = setup(), it = stock('Item.BitterMoss', 2), a = wound(), b = wound('RightForearm'), before = w.s.time
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'dose', uid: it.uid, woundId: a.id } })).toBeNull()
    expect(w.s.time - before).toBe(300); expect(a.topicalDrug?.def).toBe('Drug.BitterMoss'); expect(b.topicalDrug).toBeUndefined(); expect(drugEffects(w, p).antibiotic).toBe(0); expect(drugEffects(w, p).topicalPain).toBe(2); expect(it.count).toBe(1)
  })
  it('식별한 앰플은 실제72시간 전신 항생 효과를 주고 상처를 즉시 치료하지 않는다', () => {
    const { w, p, stock, wound } = setup(), it = stock('Item.PurificationAmpoule'), wd = wound(), knowledge = JSON.stringify(w.s.knowledge)
    it.appraisal = 2; const severity = wd.severity; start(w, { kind: 'dose', uid: it.uid }); finishDoctor(w)
    expect(drugEffects(w, p).antibiotic).toBe(.7); expect(p.drugs!.active[0].until - turnOf(w)).toBe(86400); expect(p.drugs!.active[0].sourceKnown).toBe(true); expect(wd.severity).toBe(severity); expect(wd.healed).toBe(0); expect(JSON.stringify(w.s.knowledge)).toBe(knowledge)
  })
  it('용도를 확인하지 않은 앰플·등록하지 않은 약·숙달 부족은 지불 없이 거절한다', () => {
    for (const kind of ['unidentified','unlisted','mastery'] as const) {
      const { w, p, doctor, stock } = setup(), it = stock(kind === 'unidentified' ? 'Item.PurificationAmpoule' : kind === 'unlisted' ? 'Item.AshLeaf' : 'Item.PoppyTincture')
      if (kind === 'mastery') doctor.skills.medicine = 5
      const before = stateHash(w.s); expect(requestClinic(w, p, doctor, { kind: 'dose', uid: it.uid })).not.toBeNull(); expect(stateHash(w.s)).toBe(before)
    }
  })
  it('외용약은 몸속 상처/없는 부위에 바르지 못한다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.BitterMoss'), wd = addWound(w, p, { def: 'Wound.InternalBleed', part: 'Liver', internal: true, severity: 1, source: '검증' }).wound
    expect(requestClinic(w, p, doctor, { kind: 'dose', uid: it.uid, woundId: wd.id })).not.toBeNull()
    wd.internal = false; expect(requestClinic(w, p, doctor, { kind: 'dose', uid: it.uid, woundId: wd.id })).not.toBeNull()
    const surface = addWound(w, p, { def: 'Wound.Cut', part: 'LeftForearm', severity: 1, source: '검증' }).wound; p.body.missing.push('LeftUpperArm')
    expect(requestClinic(w, p, doctor, { kind: 'dose', uid: it.uid, woundId: surface.id })).not.toBeNull()
  })
  it.each([false, true])('환자가 의식을 잃은 뒤 외용=%s의 투약은 경로에 맞게 완료/중단한다', (external) => {
    const { w, p, stock, wound } = setup(), it = stock(external ? 'Item.BitterMoss' : 'Item.PoppyTincture', 2), wd = wound()
    start(w, { kind: 'dose', uid: it.uid, ...(external ? { woundId: wd.id } : {}) }); p.unconscious = true; finishDoctor(w)
    if (external) { expect(wd.topicalDrug).toBeDefined(); expect(it.count).toBe(1) }
    else { expect(p.drugs).toBeUndefined(); expect(it.count).toBe(2) }
  })
  it('예약한 약UID를 잃으면 다른 더미가 있어도 투여하거나 소모하지 않는다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.PoppyTincture'), spare = stock('Item.PoppyTincture', 1, 2)
    start(w, { kind: 'dose', uid: it.uid }); doctor.bag = doctor.bag.filter((d) => d.uid !== it.uid); finishDoctor(w)
    expect(p.drugs).toBeUndefined(); expect(findItem(doctor, spare.uid)).toBe(spare)
  })
  it('같은UID의 약이 다른 처방으로 바뀌어도 원래 가격으로 투여하지 않는다', () => {
    const { w, p, stock } = setup(), it = stock('Item.WillowTea'); start(w, { kind: 'dose', uid: it.uid }); it.def = 'Item.PoppyTincture'; finishDoctor(w)
    expect(p.drugs).toBeUndefined(); expect(p.money).toBe(988); expect(it.count).toBe(1)
  })
  it('도포 중단은 물품/약효를 남기지 않으며 선불 비용만 보존한다', () => {
    const { w, p, doctor, stock, wound } = setup(), it = stock('Item.BitterMoss', 2), wd = wound(); start(w, { kind: 'dose', uid: it.uid, woundId: wd.id }); activityStep(w, doctor)
    expect(playerAct(w, { type: 'stopActivity' })).toBeNull(); expect(wd.topicalDrug).toBeUndefined(); expect(it.count).toBe(2); expect(p.money).toBe(988); expect(doctor.money).toBe(12)
  })
  it('외용 투약 중간 각인은 UID/시각/지불/실제효과를 같은 상태로 잇는다', () => {
    const { w, p, doctor, stock, wound } = setup(), it = stock('Item.BitterMoss', 2), wd = wound()
    expect(playerAct(w, { type: 'clinic', target: doctor.id, request: { kind: 'dose', uid: it.uid, woundId: wd.id } }, 1)).toBeNull(); expect(doctor.activity?.kind).toBe('dose'); expect(p.activity?.kind).toBe('careWait')
    const restored = { db, s: deserialize(serialize(w.s)) }; finish(w); finish(restored); expect(stateHash(restored.s)).toBe(stateHash(w.s)); expect(wd.topicalDrug).toBeDefined()
  })
  it('NPC 환자도 같은 약효/소비를 받고 플레이어 지식·로그는 바꾸지 않는다', () => {
    const { w, p, doctor, stock } = setup(), it = stock('Item.WillowTea'), npc = createCreature(w, 'Creature.Settler', { x: 22, y: 20 }); npc.money = 100; w.s.creatures.push(npc)
    const knowledge = JSON.stringify(w.s.knowledge), logs = JSON.stringify(w.s.log)
    expect(requestClinic(w, npc, doctor, { kind: 'dose', uid: it.uid })).toBeNull(); finishDoctor(w); expect(drugEffects(w, npc).pain).toBe(10); expect(p.drugs).toBeUndefined(); expect(JSON.stringify(w.s.knowledge)).toBe(knowledge); expect(JSON.stringify(w.s.log)).toBe(logs)
  })
  it('버전9 진료 기록/약효/내성/손상/재고는 형식 번호 외에 바꾸지 않는다', () => {
    const { w, p, wound } = setup(); wound(); start(w, { kind: 'diagnose' }); finishDoctor(w); administerDrug(w, p, 'Drug.WillowTea', 'Item.WillowTea'); p.hp = 53
    const old = JSON.parse(serialize(w.s)); old.version = 9; const restored = deserialize(JSON.stringify(old)); expect(restored.version).toBe(SAVE_VERSION); expect({ ...restored, version: 9 }).toEqual(old)
  })
  it('모드의 수면 처방도 투약100TU를 지불하고 새 피격에 깨어나는 조건을 보존한다', () => {
    const { w, p, doctor, stock, wound } = setup(); wound()
    const sedative: ItemDef = { defType: 'Item', id: 'Item.ClinicSedative', label: '식별한 수면 정제', sprite: 'pill_white', category: 'drug', weight: .01, size: [1,1], value: 10, drug: { effect: 'sedative', durationTurns: 2400, def: 'Drug.SleepPill' } }
    const policy = db.get<ClinicDef>('Clinic.Hearth'), mod = loadMods([...readPackages(), { manifest: { id: 'clinic.sedation', name: '수면 처방 검증', version: '1' }, defs: [sedative], patches: [{ op: 'replace', target: 'Clinic.Hearth', path: '/prescriptions', value: [...policy.prescriptions, { item: 'Item.ClinicSedative', mastery: 1, fee: 10 }] }] }])
    expect(mod.report.errors).toEqual([]); w.db = mod.db; w.s.mods = [...mod.report.order]
    const it = stock('Item.ClinicSedative'); start(w, { kind: 'dose', uid: it.uid }); activityStep(w, doctor)
    expect(p.activity?.drugSleep).toBe(true); expect(p.activity?.woundCount).toBe(p.body.wounds.length); expect(p.nextAct).toBe(w.s.time + 100); expect(findItem(doctor, it.uid)).toBeUndefined()
    doctor.nextAct = p.nextAct; runUntilInput(w, 2); expect(p.activity?.elapsed).toBe(1)
    wound('RightForearm'); finish(w); expect(p.asleep).toBe(false); expect(p.activity).toBeUndefined()
  })
  it('일반 수면을 현재 차례에서 취소하면 다음 신체틱 없이 눈을 뜨고 잠기운을 남긴다', () => {
    const { w, p, doctor } = setup(), before = w.s.time; doctor.nextAct = w.s.time + 100
    p.activity = { kind: 'sleep', remaining: 1800, total: 1801, elapsed: 1, label: '수면' }; p.asleep = true
    expect(playerAct(w, { type: 'stopActivity' })).toBeNull(); expect(w.s.time).toBe(before); expect(p.asleep).toBe(false); expect(p.lastWokeAt).toBe(turnOf(w)); expect(p.drowsyUntil).toBe(turnOf(w) + 10); expect(canSee(w, p, doctor.pos)).toBe(true)
  })
})
