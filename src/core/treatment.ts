import {companionClinicalRule,isCompanion} from './companion-state'
import {hasItemWorkerMethod,runItemAppliedWorker} from './script-item'
import {recordNpcCare} from './npc-care-state'
import {rememberLifeEvent} from './life-memories'
import {npcStressEvent} from './npc-psyche'
import {washBiteRisk,mitigateBiteRisk} from './bite-disease'
// 시술자가 가진 도구·숙달을 쓰고 환자의 몸에 처치를 남긴다.
import type { ActResult } from './actions'
import { dirtyHands, handQuality, woundHandContact } from './hand-hygiene'
import { channelTurns, hostileAware } from './action-time'
import { bandageCoef, capacity, handCapacity, isMissing, painSpike, painTotal, part, tryPart, woundDef } from './body'
import { fx } from './combat'
import { clamp, creatureById, log, rng, terrainAt, tileAt, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { hasLos, lightLevel } from './fov'
import { allItems, findItem, itemDef, qualityOf, removeOne, supplyItems } from './items'
import { canHeatBlade, finishProcedure, isProcedure, medicalBlade, procedureDef, procedureError, treatmentArm, type Procedure } from './medical'
import { diagonalBlocked } from './path'
import { cheb } from './geom'
import { hostile } from './diplomacy'
import { emitNoise } from './perception'
import { masteryStage, practice } from './skills'
import { isSurgery, markSuture, surgeryDef, surgeryError, surgeryTool, type Surgery } from './surgery'
import { addThought } from './thoughts'
import { addEffect, effectiveStat, traitAdd } from './traits'
import { traumaTreat } from './trauma'
import type { Activity, Creature, ItemInst, Wound } from './types'

const FAIL = (msg: string): ActResult => ({ ok: false, tu: 0, msg })
const isPl = (c: Creature) => c.faction === 'player'

const patientFields = (c: Creature, patient: Creature): Partial<Activity> => c.id === patient.id ? {} : { patientId: patient.id }

/** 자가 처치의 기존 조건은 각 처치가 검사한다. 타인 처치에는 접근과 시술자 의식을 더 검사한다. */
export function treatmentAccess(w: World, c: Creature, patient: Creature): string | null {
  if(w.db.body(patient.body.def).kind==='mechanical')return '기계는 제작·정비 창에서 부품으로 수리해야 한다'
  if (!c.alive || !patient.alive) return '살아 있는 환자만 처치할 수 있다'
  if (c.id === patient.id) return null
  if (c.unconscious || c.asleep || capacity(w, c, 'consciousness') < .5) return '시술자의 의식이 또렷해야 한다'
  const dx = patient.pos.x - c.pos.x, dy = patient.pos.y - c.pos.y
  if (cheb(c.pos, patient.pos) > 1 || !hasLos(w, c.pos, patient.pos) || diagonalBlocked(w, c.pos, dx, dy)) return '환자 곁에서 처치해야 한다'
  if (hostile(w, c, patient)) return '적대하는 상대를 처치할 수 없다'
  return null
}

function bindSupplies(c: Creature, def: string, count: number, preferred: number): NonNullable<Activity['supplies']> {
  let left = count
  const bindings: NonNullable<Activity['supplies']> = []
  for (const it of supplyItems(c).filter((i) => i.def === def).sort((a, b) => (a.uid === preferred ? -1 : b.uid === preferred ? 1 : a.uid - b.uid))) {
    const take = Math.min(left, it.count)
    if (take) bindings.push({ uid: it.uid, def, count: take })
    left -= take
    if (!left) break
  }
  return bindings
}

function spendMedical(w: World, c: Creature, it: ItemInst) {
  if (it.uses === undefined) removeOne(w, c, it.uid)
  else if (--it.uses <= 0) removeOne(w, c, it.uid)
}

/** 타인 처치는 시작 때 정한 물품을 잃으면 다른 더미로 자동 대체하지 않는다. */
export function externalTreatmentError(w: World, c: Creature, act: Activity): string | null {
  if (act.patientId === undefined) return null
  const patient = creatureById(w, act.patientId)
  if (!patient) return '환자가 없다'
  const access = treatmentAccess(w, c, patient)
  if (access) return access
  if(act.companionClinical&&(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||patient.id!==w.s.playerId||companionClinicalRule(w)?.id!==act.companionClinical||hostileAware(w,c)||hostileAware(w,patient)))return '부탁한 진료의 동행·급료·규칙 또는 안전이 달라졌다'
  if(act.companionAid&&(!isCompanion(w,c)||c.companion!.status!=='employed'||c.companion!.paidUntil<=turnOf(w)||!['firstAid','rescue'].includes(c.companion!.aid?.mode??'off')||patient.id!==w.s.playerId&&!isCompanion(w,patient)||hostileAware(w,c)||hostileAware(w,patient)))return '상호 돌봄 지침·급료·동행 또는 안전이 달라졌다'
  if (channelTurns(w, c, 1, { arm: treatmentArm(w, c) }) === null) return '시술자가 손을 쓸 수 없다'
  if (patient.activity?.kind !== 'careWait' || patient.activity.healerId !== c.id) return '환자가 진료를 중단했다'
  const supplies = boundSuppliesError(c, act)
  if (supplies) return supplies
  if (act.toolUid !== undefined) {
    const it = findItem(c, act.toolUid)
    if (!it || (it.durability ?? 100) <= 0) return '쓰던 처치 도구가 없어졌다'
  }
  if (act.uid !== undefined && !isSurgery(act.treat)) {
    const it = findItem(c, act.uid)
    if (!it || (it.uses ?? 1) <= 0) return '쓰던 치료 물품이 없어졌다'
  }
  return null
}

function boundSuppliesError(c: Creature, act: Activity): string | null {
  for (const bound of act.supplies ?? []) {
    const it = findItem(c, bound.uid)
    if (!it || it.def !== bound.def || it.count < bound.count || (bound.uses !== undefined && (it.uses ?? 0) < bound.uses)) return '예약한 처치 물품이 없어졌다'
  }
  return null
}

export function recordTreatmentProgress(w: World, c: Creature, act: Activity) {
  if (act.patientId === undefined || act.treat !== 'splint') return
  const patient = creatureById(w, act.patientId), it = findItem(c, act.uid ?? -1)
  if (patient && it) act.lastTreatQuality = treatQuality(w, c, itemDef(w, it).medical?.tool ?? 0, patient.body.wounds.find((wd) => wd.id === act.woundId), { patient }).q
}

/** 마지막 작업 턴을 양쪽 모두 정산한 뒤 환자의 입력을 받는다. */
export function releasePatient(w: World, c: Creature, act: Activity, completed = false) {
  const patient = creatureById(w, act.patientId)
  if (patient?.activity?.kind === 'careWait' && patient.activity.healerId === c.id) {
    patient.activity = undefined
    if (completed) patient.nextAct = Math.max(patient.nextAct, w.s.time + 100)
  }
}

export function startProcedure(w: World, c: Creature, kind: Procedure, woundId?: number, target?: string, patient: Creature = c): ActResult {
  const access = treatmentAccess(w, c, patient)
  if (access) return FAIL(access)
  const wd = patient.body.wounds.find((x) => x.id === woundId), rule = procedureDef(w, kind)
  target ??= wd?.part
  const err = procedureError(w, c, rule, wd, target, patient)
  if (err) return FAIL(err)
  const n = channelTurns(w, c, rule.turns * (masteryStage(w, c, 'medicine') >= 5 ? .9 : 1), { arm: treatmentArm(w, c, patient.id === c.id ? target : undefined) })
  if (n === null) return FAIL('손이 말을 듣지 않아 처치할 수 없다')
  c.activity = { ...patientFields(c, patient), kind: 'treat', treat: rule.kind, remaining: n, total: n, woundId: wd?.id, limb: target, toolUid: rule.blade ? medicalBlade(w, c)?.uid : undefined, label: rule.label }
  return { ok: true, tu: 0 }
}

/** 처치 기본 턴 (01 §4.2): 지혈대 3 · 붕대 사지 5 / 몸통·머리 6 · 부목 10 · 세척 3. 응급 처치 ×0.6, 의료 숙달 5단계 ×0.9 */
function treatBase(w: World, c: Creature, kind: string, wd?: Wound, patient: Creature = c): number {
  let base = kind === 'tourniquet' ? 3 : kind === 'splint' ? 10 : kind === 'disinfect' ? 3 : 5
  if (kind === 'bandage' && wd) {
    const reg = tryPart(w, patient, wd.part)?.region
    if (reg === 'torso' || reg === 'head') base = 6
  }
  if (kind === 'tourniquet' && patient.id !== c.id) base *= .8
  let f = 1 - Math.min(0.6, traitAdd(w, c, 'treatSpeed'))
  if (masteryStage(w, c, 'medicine') >= 5) f *= 0.9
  return Math.ceil(base * f - 1e-9)
}

/** 처치를 시작할 수 있나: 다턴 배율 ×4를 넘으면(손이 말을 듣지 않으면) 불가 */
export function canTreat(w: World, c: Creature, kind: string, wd?: Wound): boolean {
  return !/Eye/.test(wd?.part ?? '') && channelTurns(w, c, treatBase(w, c, kind, wd), { arm: treatmentArm(w, c, wd?.part) }) !== null
}

/**
 * 처치 품질 Q (02 §12.1)
 * = clamp(5, 100, (40 + (지각 − 10) × 2 + 의료 숙달 × 4 + 도구 + 조명 + 청결 + 환경 − 통증 페널티) × 조작 × 자가계수)
 */
export function treatQuality(w: World, c: Creature, tool: number, wd?: Wound, options: { suturing?: boolean; part?: string; patient?: Creature } = {}): { q: number; lines: string[] } {
  const patient = options.patient ?? c
  const lines: string[] = []
  let v = 40
  const add = (label: string, x: number) => { if (x) { v += x; lines.push(`${label} ${x > 0 ? '+' : ''}${x}`) } }
  add('지각', (effectiveStat(w, c, 'per') - 10) * 2)
  add('의료 숙달', masteryStage(w, c, 'medicine') * 4)
  add('도구', tool)
  add('청결 습관', traitAdd(w, c, 'treatCleanliness'))
  add('손 위생', handQuality(w, c))
  add('조명', [0, -5, -15, -30][lightLevel(w, patient.pos)])
  if (c.equip.hands) add('장갑', options.suturing ? -15 : -5)
  if (options.suturing) add('봉합 손재주', traitAdd(w, c, 'sutureBonus'))
  if (tileAt(w, patient.pos).roof) add('실내', 5)
  if (w.s.map.kind === 'surface' && ['ashrain', 'ashstorm'].includes(w.s.weather) && !tileAt(w, patient.pos).roof) add('재비', -5)
  if (terrainAt(w, patient.pos).id.includes('Mud')) add('진흙', -5)
  if (hostileAware(w, c)) add('적대 인식', -15)
  add('통증', -Math.floor(Math.max(0, painTotal(w, c) - 30) * 0.3))
  const targetPart = wd?.part ?? options.part
  const manip = handCapacity(w, c, treatmentArm(w, c, patient.id === c.id ? targetPart : undefined) === 'larm' ? 'Left' : 'Right')
  const reg = targetPart ? tryPart(w, patient, targetPart)?.region : undefined
  const self = patient.id !== c.id ? 1 : reg === 'rarm' || reg === 'larm' ? .7 : /Back/.test(targetPart ?? '') ? .4 : .85
  const q = clamp(Math.round(v * Math.min(1, manip) * self + 1e-9), 5, 100)
  lines.push(`× 조작 ${manip.toFixed(2)} × 자가 ${self} = Q ${q}`)
  return { q, lines }
}

export function startTreatment(w: World, c: Creature, uid: number, woundId?: number, limb?: string, procedure?: Surgery, patient: Creature = c): ActResult {
  const access = treatmentAccess(w, c, patient); if (access) return FAIL(access)
  const it = findItem(c, uid)
  if (!it) return FAIL('없다')
  const def = itemDef(w, it)
  const med = def.medical
  if (it.uses !== undefined && it.uses <= 0) return FAIL('치료 도구를 다 썼다')
  if (!med) return FAIL('치료 도구가 아니다')
  const wd: Wound | undefined = woundId !== undefined ? patient.body.wounds.find((x) => x.id === woundId) : undefined
  let lb = limb
  if (procedure && med.kind !== 'suture') return FAIL('이 물건으로 외과 처치를 할 수 없다')
  if (med.kind === 'suture') {
    const rule = surgeryDef(w, procedure ?? 'suture'), err = surgeryError(w, c, rule, wd, limb, patient)
    if (err) return FAIL(err)
    const needle = surgeryTool(w, c, rule)!
    const base = rule.turns + Math.ceil((wd?.severity ?? 0) * rule.perSeverity)
    const n = channelTurns(w, c, base * (masteryStage(w, c, 'medicine') >= 5 ? .9 : 1), { arm: treatmentArm(w, c, patient.id === c.id ? wd?.part ?? limb : undefined) })
    if (n === null) return FAIL('손이 말을 듣지 않아 봉합할 수 없다')
    c.activity = { ...patientFields(c, patient), kind: 'treat', treat: rule.kind, remaining: n, total: n, uid, toolUid: needle.uid, woundId, limb, label: rule.label }
    if (patient.id !== c.id) c.activity.supplies = bindSupplies(c, rule.supply, rule.count, uid)
    return { ok: true, tu: 0 }
  }
  switch (med.kind) {
    case 'bandage':
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.internal) return FAIL('몸속 상처는 붕대로 막을 수 없다')
      if (wd.bandage && !wd.bandage.dirty && !med.dirty && turnOf(w) - wd.bandage.at < TURNS_PER_DAY) return FAIL('이미 붕대가 감겨 있다')
      break
    case 'tourniquet':
      if (!lb && wd) lb = tryPart(w, patient, wd.part)?.limb
      if (!lb || !tryPart(w, patient, lb)?.limb) return FAIL('지혈대는 팔이나 다리에만 감을 수 있다')
      if (patient.body.tourniquets[lb] !== undefined) return FAIL('이미 감겨 있다')
      if (isMissing(w, patient, lb)) return FAIL('그 팔다리는 이미 없다')
      break
    case 'splint': {
      const target = wd ?? patient.body.wounds.find((x) => x.fracture && !x.splint)
      if (!target?.fracture) return FAIL('부러진 곳이 없다')
      if (target.splint && !target.splint.half) return FAIL('이미 부목을 댔다')
      if (target.part === 'Chest') return FAIL('갈비뼈에는 부목을 댈 수 없다. 압박 붕대만 감을 수 있다')
      woundId = target.id
      break
    }
    case 'disinfect':
      if (!wd) return FAIL('상처를 골라야 한다')
      if (wd.internal) return FAIL('몸속 상처는 씻을 수 없다')
      break
  }
  const target = woundId !== undefined ? patient.body.wounds.find((x) => x.id === woundId) : undefined
  if (patient.id === c.id && /Eye/.test(target?.part ?? '')) return FAIL('자기 눈은 혼자 처치할 수 없다')
  const n = channelTurns(w, c, treatBase(w, c, med.kind, target, patient), { arm: treatmentArm(w, c, patient.id === c.id ? target?.part ?? lb : undefined) })
  if (n === null) return FAIL('손이 말을 듣지 않아 처치할 수 없다 (다턴 배율 ×4 초과)')
  c.activity = { ...patientFields(c, patient), kind: 'treat', treat: med.kind, remaining: n, total: n, uid, woundId, limb: lb, label: `${def.label} — ${med.kind === 'tourniquet' ? '지혈대 감기' : med.kind === 'splint' ? '부목 대기' : med.kind === 'disinfect' ? '상처 씻기' : '붕대 감기'}` }
  if (patient.id !== c.id) c.activity.supplies = [{ uid: it.uid, def: it.def, count: 1, ...(it.uses === undefined ? {} : { uses: 1 }) }]
  if (isPl(c)) log(w, 'info', `${c.activity.label} (${n}턴)`)
  return { ok: true, tu: 0 }
}

/** 채널이 끝났을 때 처치 효과 (02 §12.2) */
export function finishTreat(w:World,c:Creature,act:Activity,half=false){
  if(!c.alive||!w.s.creatures.includes(c)||!hasItemWorkerMethod(w,'onApplied'))return finishTreatCore(w,c,act,half)
  const patient=act.patientId===undefined?c:creatureById(w,act.patientId)
  if(!patient?.alive||!w.s.creatures.includes(patient))return finishTreatCore(w,c,act,half)
  const before=allItems(c).filter(i=>w.db.item(i.def).compWorker).map(i=>({uid:i.uid,item:i.def,count:i.count,uses:i.uses})),wound=patient.body.wounds.find(x=>x.id===act.woundId),part=act.limb??wound?.part
  finishTreatCore(w,c,act,half)
  for(const source of before){
    const after=allItems(c).find(i=>i.uid===source.uid&&i.def===source.item),countConsumed=Math.max(0,source.count-(after?.count??0)),usesConsumed=source.uses===undefined?0:Math.max(0,source.uses-(after?.uses??0))
    if(countConsumed||usesConsumed)runItemAppliedWorker(w,c,patient,{uid:source.uid,item:source.item,countConsumed,usesConsumed,mlConsumed:0,gramsConsumed:0},{effect:act.treat??'treat',partial:half,...(act.woundId===undefined?{}:{woundId:act.woundId}),...(part?{part}:{})})
  }
}
function finishTreatCore(w: World, c: Creature, act: Activity, half = false) {
  const patient = act.patientId === undefined ? c : creatureById(w, act.patientId)
  const priorWork = half && act.patientId !== undefined && act.treat === 'splint'
  if (!patient || !patient.alive || (priorWork ? boundSuppliesError(c, act) : treatmentAccess(w, c, patient) || externalTreatmentError(w, c, act))) return
  const turn = turnOf(w)
  const wd = act.woundId !== undefined ? patient.body.wounds.find((x) => x.id === act.woundId) : undefined
  if (isProcedure(act.treat)) {
    const rule = procedureDef(w, act.treat), err = procedureError(w, c, rule, wd, act.limb ?? wd?.part, patient)
    const blade = rule.blade ? allItems(c).find((i) => i.uid === act.toolUid) : undefined
    if (err || (rule.blade && (!blade || (blade.durability ?? 100) <= 0 || !itemDef(w, blade).attacks?.some((a) => a.family === 'blade')))) { if (isPl(patient)) log(w, 'warn', `처치 중단: ${err ?? '쓰던 칼날이 없어졌다'}.`); return }
    const q = treatQuality(w, c, rule.toolBonus, wd, { part: act.limb, patient }).q
    if (wd) woundHandContact(w, c, wd)
    finishProcedure(w, patient, rule, q, wd, act.limb ?? wd?.part, c)
    if (rule.kind === 'amputate') dirtyHands(w, c)
    if (blade) blade.durability = Math.max(0, (blade.durability ?? 100) - 1)
    return
  }
  if (isSurgery(act.treat)) {
    const rule = surgeryDef(w, act.treat), needle = allItems(c).find((i) => i.uid === act.toolUid)
    const err = surgeryError(w, c, rule, wd, act.limb, patient)
    if (err || !needle || (needle.durability ?? 100) <= 0 || !itemDef(w, needle).toolTags?.includes(rule.toolTag)) { if (isPl(patient)) log(w, 'warn', `처치 중단: ${err ?? '쓰던 바늘이 없어졌다'}.`); return }
    const q = treatQuality(w, c, rule.toolBonus + [-5, 0, 3, 5, 8, 10][qualityOf(needle)], wd, { suturing: true, part: act.limb, patient }).q
    if (wd) woundHandContact(w, c, wd)
    let left = rule.count
    const supplies = supplyItems(c).filter((i) => i.def === rule.supply && (!act.supplies || act.supplies.some((b) => b.uid === i.uid))).sort((a, b) => (a.uid === act.uid ? -1 : b.uid === act.uid ? 1 : a.uid - b.uid))
    for (const supply of supplies) { const take = act.supplies?.find((b) => b.uid === supply.uid)?.count ?? Math.min(left, supply.count); supply.count -= take; left -= take; if (!left) break }
    c.bag = c.bag.filter((i) => i.count > 0)
    if(c.equip.belt?.contents)c.equip.belt.contents=c.equip.belt.contents.filter(i=>i.count>0)
    needle.durability = Math.max(0, (needle.durability ?? 100) - 1)
    if (wd) {
      if (wd.washedAt === undefined) wd.contam = Math.min(100, wd.contam * 1.5)
      markSuture(w, wd, rule, q)
      if(q>=50)npcStressEvent(w,patient,'treated',wd.id)
      if(rule.kind==='suture'&&patient.faction==='player')rememberLifeEvent(w,patient,'treatment',{quality:q})
      if (rule.kind === 'ligate') { wd.artery = undefined; wd.ligated = true }
      if (rule.kind === 'tendon') wd.tendon = false
      traumaTreat(w, patient, wd.id)
    }
    const target = wd?.part ?? act.limb
    if (rule.kind === 'tendon' && target) {
      patient.body.damagedTendons = patient.body.damagedTendons?.filter((id) => id !== target)
      if (patient.body.tendonSince) delete patient.body.tendonSince[target]
    }
    practice(w, c, 'medicine', wd ? `wound:${wd.id}` : `tendon:${target}:${turn}`)
    if (isPl(patient)) { log(w, 'good', `${rule.label} 완료 (Q ${q}).${wd?.washedAt === undefined && wd ? ' 세척하지 않아 오염이 늘었다.' : ''}`); patient.history.push({ turn, kind: 'treat', text: `${target ? part(w, patient, target).label : ''} ${rule.label} (Q ${q})` }) }
    return
  }
  if (act.treat === 'cauterize') {
    if (!wd) return
    if (!canHeatBlade(w, c) || c.traumas?.some((t) => t.def === 'Trauma.Fire')) { if (isPl(patient)) log(w, 'warn', '불이나 칼날을 잃었거나 불 공포 때문에 소작을 중단했다.'); return }
    cauterize(w, c, wd)
    return
  }
  const it = act.uid !== undefined ? findItem(c, act.uid) : undefined
  if (!it) return
  const def = itemDef(w, it)
  const med = def.medical!
  const { q: currentQ, lines } = treatQuality(w, c, med.tool ?? 0, wd, { patient })
  const q = priorWork ? act.lastTreatQuality ?? currentQ : currentQ
  if (priorWork) lines.splice(0, lines.length, `마지막으로 진행한 부목 작업의 Q ${q}`)
  switch (act.treat) {
    case 'bandage': {
      if (!wd) return
      woundHandContact(w, c, wd)
      wd.bandage = { quality: q, at: turn, dirty: med.dirty, firstAid: traitAdd(w, c, 'bandageBonus') || undefined }
      if (med.dirty) wd.contam = Math.min(100, wd.contam + 10)
      spendMedical(w, c, it)
      recordNpcCare(w,c,patient,act,q)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      if (!half) traumaTreat(w, patient, wd.id)
      if(!half&&q>=50)npcStressEvent(w,patient,'treated',wd.id)
      if(!half&&patient.faction==='player')rememberLifeEvent(w,patient,'treatment',{quality:q})
      fx(w, { k: 'status', id: patient.id, text: '붕대', color: '#e8e0c8', turn })
      if (isPl(patient)) {
        const coef = bandageCoef(q, false, wd.bandage.firstAid)
        let msg = `${part(w, patient, wd.part).label}의 ${woundDef(w, wd).label}에 ${def.label}을(를) 감았다. (Q ${q} → 출혈 ×${coef.toFixed(2)})`
        if (wd.arterial) msg += ' 하지만 동맥 출혈은 붕대로는 멈추지 않는다. 지혈대나 소작이 필요하다.'
        log(w, wd.arterial ? 'warn' : 'info', msg, lines)
        patient.history.push({ turn, kind: 'treat', text: `${part(w, patient, wd.part).label} 붕대 (Q ${q})` })
      }
      return
    }
    case 'tourniquet': {
      const lb = act.limb
      if (!lb) return
      if (wd) woundHandContact(w, c, wd)
      patient.body.tourniquets[lb] = turn
      removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `limb:${lb}`)
      if (isPl(patient)) log(w, 'info', `${part(w, patient, lb).label}에 지혈대를 단단히 감았다. 아래로는 피가 돌지 않는다. 두 시간 안에 풀어야 한다.`)
      return
    }
    case 'splint': {
      if (!wd?.fracture) return
      wd.splint = { quality: q, half: half || undefined }
      removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      if (!half) traumaTreat(w, patient, wd.id)
      if (isPl(patient)) log(w, 'info', half ? `${part(w, patient, wd.part).label}에 부목을 반만 묶었다. 효과가 절반이다.` : `${part(w, patient, wd.part).label}에 부목을 댔다. (Q ${q})`, lines)
      return
    }
    case 'disinfect': {
      if (!wd) return
      woundHandContact(w, c, wd)
      wd.contam = Math.round(wd.contam * (med.washMult ?? 0.75))
      wd.washedAt = turn
      washBiteRisk(w,patient,wd)
      addEffect(patient, 'sting', turn + 20)
      it.uses = (it.uses ?? 1) - 1
      if ((it.uses ?? 0) <= 0) removeOne(w, c, it.uid)
      practice(w, c, 'medicine', `wound:${wd.id}`)
      if (!half) traumaTreat(w, patient, wd.id)
      if (isPl(patient)) log(w, 'info', `${part(w, patient, wd.part).label}의 상처를 술로 씻었다. 타는 듯이 쓰라리다. (오염 ${wd.contam})`)
      return
    }
  }
}

/** 소작 (02 §12.2): 출혈 즉시 0, 오염 5, 화상(sev × 0.5), 통증 스파이크 +45. 대퇴·경동맥은 성공률 40 + Q/2 % */
function cauterize(w: World, c: Creature, wd: Wound) {
  const turn = turnOf(w)
  const r = rng(w, 'body')
  const { q } = treatQuality(w, c, 0, wd)
  woundHandContact(w, c, wd)
  const big = (wd.artery ?? 0) >= 150
  const ok = !big || r.int(0, 99) < 40 + Math.floor(q / 2)
  if (ok) {
    wd.cauterized = true
    wd.cauterizedAt=turn
    mitigateBiteRisk(w,c,wd)
    wd.bleed = 0
    wd.artery = undefined
    wd.contam = 5
    wd.infectionChecked = true
  }
  c.body.wounds.push({
    id: w.s.nextId++, def: 'Wound.Burn', part: wd.part, severity: Math.max(1, Math.ceil(wd.severity * 0.5)), healed: 0, bleed: 0, arterial: false,
    internal: false, contam: 5, ageTurns: 0, source: '소작', scar: true, infectionChecked: true,
  })
  c.heat = undefined
  emitNoise(w, c.pos, 12, c.id)
  addThought(w, c, 'Thought.Cauterized')
  practice(w, c, 'medicine', `wound:${wd.id}`)
  fx(w, { k: 'status', id: c.id, text: '지글…', color: '#ff9040', turn })
  if (isPl(c)) {
    log(w, ok ? 'warn' : 'danger', ok
      ? `달군 칼날을 ${part(w, c, wd.part).label}에 댄다. 살 타는 냄새. 비명이 새어 나온다. 출혈은 멎었다.`
      : `달군 칼날을 댔지만 굵은 동맥은 지져지지 않았다. 피가 계속 뿜어져 나온다. (성공률 ${40 + Math.floor(q / 2)}%)`)
    c.history.push({ turn, kind: 'treat', text: `${part(w, c, wd.part).label} 소작${ok ? '' : ' (실패)'}` })
  }
  painSpike(w, c, 45)
}

/** 처치 채널이 끊겼을 때 (01 §7): 부목은 절반 이상 묶었으면 반쪽 부목, 소작은 가열 보존 */
export function interruptTreat(w: World, c: Creature) {
  const act = c.activity
  if (act?.kind === 'careWait') {
    const healer = creatureById(w, act.healerId)
    if (healer?.activity?.patientId === c.id) {
      interruptTreat(w, healer)
      healer.activity = undefined
    }
    return
  }
  if (act?.kind === 'rescueDrag') { releasePatient(w,c,act);return }
  if (act?.kind === 'diagnose' || act?.kind === 'dose') { releasePatient(w, c, act); return }
  if (act?.kind !== 'treat') return
  const done = (act.total ?? 0) - act.remaining
  if (act.treat === 'splint' && done * 2 >= (act.total ?? 0)) finishTreat(w, c, act, true)
  if (act.treat === 'cauterize') c.heat = { done: Math.min(20, done), at: turnOf(w) }
  if (done > 0) {
    const patient = act.patientId === undefined ? c : creatureById(w, act.patientId), wd = patient?.body.wounds.find((x) => x.id === act.woundId)
    if (wd && !wd.internal && w.db.wound(wd.def).handContact) dirtyHands(w, c)
  }
  releasePatient(w, c, act)
}

