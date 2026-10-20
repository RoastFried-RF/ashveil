import {rememberMeeting} from './first-impressions'
import {scurvyLines} from './scurvy-state'
import {airLines,ashLungStage} from './air-state'
import {diseaseLines} from './disease-state'
import { clinicalDosePlan } from './clinical-drugs'
// 정착지 의사: 같은 처치 규칙, 실제 물품/지불/시간. 조회는 상태를 바꾸지 않는다.
import { bloodLoss, capacity, effectiveBleed, part, tryPart, woundDef } from './body'
import { channelTurns, hostileAware } from './action-time'
import { creatureById, log, turnOf, type World } from './ctx'
import { reputationBand } from './diplomacy'
import { economyDef } from './economy'
import { findItem, itemDef, qualityOf } from './items'
import { isProcedure, procedureDef, treatmentArm } from './medical'
import { isSurgery, surgeryDef } from './surgery'
import { externalTreatmentError, startProcedure, startTreatment, treatmentAccess, treatQuality } from './treatment'
import { masteryStage } from './skills'
import type { Activity, ClinicDef, ClinicKind, Creature, MedicalReport } from './types'

export interface ClinicRequest { kind: ClinicKind | 'dose'; uid?: number; woundId?: number; part?: string }
export interface ClinicQuote { error: string | null; fee: number; turns: number; quality: number | null; lines: string[]; activity?: Activity }
export const clinicDef = (w: World, doctor: Creature) => {
  const id = w.db.creature(doctor.def).clinic
  return id ? w.db.tryGet<ClinicDef>(id) : undefined
}

export function clinicQuote(w: World, patient: Creature, doctor: Creature, request: ClinicRequest): ClinicQuote {
  const out: ClinicQuote = { error: null, fee: 0, turns: 0, quality: 0, lines: [] }, rule = clinicDef(w, doctor)
  const fail = (msg: string) => { out.error = msg; return out }
  if (!rule) return fail('진료하는 사람이 아니다')
  const access = treatmentAccess(w, doctor, patient)
  if (access) return fail(access)
  if (patient.id === doctor.id || patient.unconscious || patient.asleep || capacity(w, patient, 'consciousness') < .5) return fail('의식이 또렷해야 진료를 부탁할 수 있다')
  if (patient.activity || doctor.activity) return fail('하던 일을 마친 뒤 진료를 부탁해야 한다')
  if (hostileAware(w, doctor) || hostileAware(w, patient)) return fail('교전 중에는 진료할 수 없다')
  const rep = reputationBand(w, doctor.faction)
  if (patient.id === w.s.playerId && !rep.trade) return fail('이 세력은 진료를 거절한다')
  if (request.kind !== 'dose' && !Object.hasOwn(rule.fees, request.kind)) return fail('제공하지 않는 진료다')
  const wd = patient.body.wounds.find((x) => x.id === request.woundId)
  if (wd?.internal) return fail('몸속 상처는 먼저 진찰이 필요하다')
  if (request.woundId !== undefined && !wd) return fail('그 상처가 없다')
  if (wd && wd.healed >= wd.severity && !['tendon', 'reduce', 'extract'].includes(request.kind)) return fail('이미 아문 상처다')
  const actor: Creature = { ...doctor, activity: undefined }
  let tool = 0, suturing = false, fee: number
  if (request.kind === 'dose') {
    const plan = clinicalDosePlan(w, doctor, patient, rule, request.uid, request.woundId)
    if (plan.error) return fail(plan.error)
    actor.activity = plan.activity
    out.quality = null; out.lines = plan.lines; fee = plan.fee
  } else {
    fee = rule.fees[request.kind]
    if (request.kind === 'diagnose') {
      if (masteryStage(w, doctor, 'medicine') < rule.examination.mastery) return fail(`진찰에는 의료 숙달${rule.examination.mastery}단계가 필요하다`)
      const n = channelTurns(w, doctor, rule.examination.turns, { arm: treatmentArm(w, doctor) })
      if (n === null) return fail('시술자가 손을 쓸 수 없다')
      actor.activity = { kind: 'diagnose', patientId: patient.id, remaining: n, total: n, label: '진찰' }
    } else if (isProcedure(request.kind)) {
      const result = startProcedure(w, actor, request.kind, request.woundId, request.part, patient)
      if (!result.ok) return fail(result.msg!)
      tool = procedureDef(w, request.kind).toolBonus
    } else {
      const surgery = isSurgery(request.kind) ? surgeryDef(w, request.kind) : undefined
      const it = doctor.bag.filter((i) => (i.uses ?? 1) > 0 && (surgery ? i.def === surgery.supply : itemDef(w, i).medical?.kind === request.kind))
        .sort((a, b) => (itemDef(w, b).medical?.tool ?? 0) - (itemDef(w, a).medical?.tool ?? 0) || a.uid - b.uid)[0]
      if (!it) return fail('의사에게 필요한 처치 물품이 남아 있지 않다')
      const result = startTreatment(w, actor, it.uid, request.woundId, request.part, surgery?.kind, patient)
      if (!result.ok) return fail(result.msg!)
      tool = surgery ? surgery.toolBonus + [-5, 0, 3, 5, 8, 10][qualityOf(findItem(actor, actor.activity!.toolUid!)!)] : itemDef(w, it).medical?.tool ?? 0
      suturing = !!surgery
    }
  }
  out.activity = actor.activity
  out.turns = actor.activity!.total! + Math.ceil(Math.max(0, doctor.nextAct - w.s.time) / 100)
  if (request.kind !== 'dose') { const quality = treatQuality(w, doctor, tool, wd, { patient, part: request.part, suturing }); out.quality = quality.q; out.lines = quality.lines }
  out.fee = Math.ceil(fee * (patient.id === w.s.playerId ? rep.price : 1))
  if ((patient.money ?? 0) < out.fee) return fail('진료비가 부족하다')
  return out
}

export function requestClinic(w: World, patient: Creature, doctor: Creature, request: ClinicRequest, expectedFee?: number): string | null {
  const quote = clinicQuote(w, patient, doctor, request)
  if (quote.error) return quote.error
  if (expectedFee !== undefined && expectedFee !== quote.fee) return '진료비가 달라졌다. 다시 확인해야 한다'
  patient.money = (patient.money ?? 0) - quote.fee
  doctor.money = (doctor.money ?? 0) + quote.fee
  doctor.activity = quote.activity!
  doctor.activity.woundCount = doctor.body.wounds.length
  patient.activity = { kind: 'careWait', healerId: doctor.id, remaining: quote.turns, total: quote.turns, label: `${doctor.name}의 진료 — ${quote.activity!.label}` }
  rememberMeeting(w,patient,doctor)
  doctor.met = true
  patient.history.push({ turn: turnOf(w), kind: 'treat', text: `${doctor.name}에게 ${quote.activity!.label} 의뢰 (${quote.fee}${economyDef(w).currency})` })
  if (patient.id === w.s.playerId) log(w, 'info', `${doctor.name}에게 진료비 ${quote.fee}${economyDef(w).currency}을(를) 냈다. ${quote.activity!.label} (${quote.turns}턴, ${quote.quality === null ? '규격1회분' : `예상 Q ${quote.quality}`}). 중단해도 진료비는 돌려받지 못한다.`)
  return null
}

/** 검사 종료 때의 임상 소견만 보관한다. 기록을 읽어도 현재 몸의 숨겨진 값은 다시 조회하지 않는다. */
export function finishDiagnostic(w: World, doctor: Creature, act: Activity) {
  const patient = creatureById(w, act.patientId), rule = clinicDef(w, doctor)
  if (!patient || !rule || externalTreatmentError(w, doctor, act)) return
  const mastery = masteryStage(w, doctor, 'medicine')
  if (mastery < rule.examination.mastery) { if (patient.id === w.s.playerId) log(w, 'warn', '시술자의 의료 숙달이 부족해 진찰을 마치지 못했다.'); return }
  const quality = treatQuality(w, doctor, 0, undefined, { patient }).q
  const report: MedicalReport = { at: turnOf(w), examinerId: doctor.id, examiner: doctor.name, mastery, quality, findings: [] }
  const findings = report.findings
  if (quality < rule.examination.quality) findings.push('검사 여건이 나빠 충분히 판단하지 못했다. 상태가 나아지면 다시 진찰해야 한다.')
  else {
    for (const wd of patient.body.wounds) {
      if (wd.internal || wd.healed >= wd.severity) continue
      const signs = [wd.artery && !wd.ligated ? '동맥 출혈' : '', wd.infection ? '감염 의심' : '', wd.fracture ? '골절' : '', wd.tendon ? '힘줄 손상' : '', wd.dislocated ? '탈구' : '', wd.foreign ? '이물질' : ''].filter(Boolean)
      findings.push(`${part(w, patient, wd.part).label}: ${woundDef(w, wd).label}${signs.length ? ` — ${signs.join(', ')}` : ''}`)
    }
    if (mastery >= rule.examination.abdomenMastery) {
      const abdominalBleeding = patient.body.wounds.some((wd) => {
        if (!wd.internal || effectiveBleed(w, patient, wd) <= 0) return false
        let pd = tryPart(w, patient, wd.part)
        const visited = new Set<string>()
        while (pd && !visited.has(pd.id)) { visited.add(pd.id); if (pd.groups.includes('abdomen')) return true; pd = pd.parent ? tryPart(w, patient, pd.parent) : undefined }
        return false
      })
      if (abdominalBleeding) findings.push('복부가 단단하다. 내출혈이 의심된다. 움직임을 줄이고 즉시 쉬어야 한다.')
    }
    if (mastery >= rule.examination.pulseMastery) {
      const loss = bloodLoss(patient), range = loss >= .4 ? '40% 이상' : loss >= .3 ? '30~40%' : loss >= .15 ? '15~30%' : loss >= .1 ? '10~15%' : '10% 미만'
      findings.push(`맥을 짚은 소견: 혈액 손실 약 ${range}.${loss >= .3 ? ' 위급한 상태다.' : ''}`)
    }
    for(const line of scurvyLines(w,patient))findings.push('영양 소견: '+line)
    for(const line of diseaseLines(w,patient))findings.push('질병 소견: '+line)
    if(ashLungStage(w,patient))for(const line of airLines(w,patient))findings.push('호흡 소견: '+line)
    if (capacity(w, patient, 'breathing') < .8) findings.push('호흡이 약해졌다. 쉬면서 상태를 살펴야 한다.')
    if (!findings.length) findings.push('겉으로 드러난 뚜렷한 이상을 찾지 못했다. 내부 이상까지 배제한 것은 아니다.')
  }
  const reports = patient.medicalReports ??= []
  reports.push(report)
  if (reports.length > rule.examination.reportLimit) reports.splice(0, reports.length - rule.examination.reportLimit)
  patient.history.push({ turn: report.at, kind: 'treat', text: `${doctor.name}의 진찰: ${findings.join(' ')}` })
  if (patient.id === w.s.playerId) log(w, 'info', `${doctor.name}의 진찰이 끝났다. ${findings.join(' ')}`)
}
