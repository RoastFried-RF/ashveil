import { woundHandContact } from './hand-hygiene'
import {companionClinicalRule} from './companion-state'
// 의사 소유의 실제 약 한 몫을 환자에게 투여한다. 약효 계산은 자가 복용과 같다.
import { capacity, isMissing, part } from './body'
import { channelTurns } from './action-time'
import { creatureById, log, turnOf, type World } from './ctx'
import { drugEffects, pharmacologyDef } from './drug-state'
import { findItem, itemDef, removeOne } from './items'
import { treatmentArm } from './medical'
import { administerDrug, drugPreview } from './pharmacology'
import { masteryStage } from './skills'
import { externalTreatmentError, treatmentAccess } from './treatment'
import type { Activity, ClinicDef, Creature, DrugDef } from './types'

export function clinicalDoseError(w: World, doctor: Creature, patient: Creature, policy: ClinicDef, uid?: number, woundId?: number): string | null {
  const access = treatmentAccess(w, doctor, patient)
  if (access) return access
  const it = uid === undefined ? undefined : doctor.bag.find((i) => i.uid === uid), prescription = it && policy.prescriptions.find((p) => p.item === it.def)
  if (!it || !prescription || !Number.isSafeInteger(it.count) || it.count < 1 || it.missingItem || it.half || it.dirty || !Number.isFinite(it.durability ?? 100) || (it.durability ?? 100) <= 0 || !Number.isFinite(it.uses ?? 1) || (it.uses ?? 1) < 1) return '시술자에게 사용할 수 있는 원래 처방약이 남아 있지 않다'
  if (it.waterFrozen) return '얼어 있는 약은 먼저 녹여야 한다'
  if (masteryStage(w, doctor, 'medicine') < prescription.mastery) return `이 약에는 의료 숙달${prescription.mastery}단계가 필요하다`
  const d = itemDef(w, it), drug = d.drug?.def && w.db.tryGet<DrugDef>(d.drug.def)
  if (!drug || d.unidentified || d.food || d.drink) return '투약할 수 있는 처방약이 아니다'
  if (d.relic && (it.appraisal ?? 0) < 2) return '의사가 아직 용도를 확인하지 못한 유물 약품이다'
  if (drug.external) {
    const wd = patient.body.wounds.find((x) => x.id === woundId)
    if (!wd || wd.internal || part(w, patient, wd.part).internal || isMissing(w, patient, wd.part)) return '겉으로 드러난 상처를 골라야 한다'
  } else if (patient.unconscious || patient.asleep || capacity(w, patient, 'consciousness') < .5) return '환자가 깨어서 약을 받을 수 있어야 한다'
  return null
}

export function clinicalDosePlan(w: World, doctor: Creature, patient: Creature, policy: ClinicDef, uid?: number, woundId?: number): { error: string | null; fee: number; activity?: Activity; lines: string[] } {
  const out: { error: string | null; fee: number; activity?: Activity; lines: string[] } = { error: clinicalDoseError(w, doctor, patient, policy, uid, woundId), fee: 0, lines: [] }
  if (out.error) return out
  const it = findItem(doctor, uid!)!, d = itemDef(w, it), drug = w.db.get<DrugDef>(d.drug!.def!), prescription = policy.prescriptions.find((p) => p.item === it.def)!
  const n = channelTurns(w, doctor, drug.external ? drug.applyTurns ?? 3 : policy.doseTurns, { arm: treatmentArm(w, doctor) })
  if (n === null) { out.error = '시술자가 손을 쓸 수 없다'; return out }
  out.fee = prescription.fee
  out.activity = { kind: 'dose', patientId: patient.id, uid, woundId, remaining: n, total: n, label: `${drug.label} ${drug.external ? '바르기' : '투약'}`, supplies: [{ uid: it.uid, def: it.def, count: 1, ...(it.uses === undefined ? {} : { uses: 1 }) }] }
  const preview = drugPreview(w, patient, drug.id), current = drugEffects(w, patient)
  out.lines.push(`규격 1회분 · 지속 ${Math.ceil(drug.durationTurns / 20)}분`)
  if(drug.curesDisease)out.lines.push((w.db.get(drug.curesDisease).label??'해당 질병')+' 치료 · 원래 상처와 다른 질병은 남는다')
  if (drug.pain) out.lines.push(`이번 1회분의 통증 감소 ${preview.pain.toFixed(1)} · 현재 내성 ${preview.tolerance.toFixed(1)}`)
  if (drug.antibiotic) out.lines.push(`${drug.external ? '해당 상처의' : '전신'} 감염 진행 ${Math.round(drug.antibiotic * 100)}% 감소`)
  if (drug.irritation) out.lines.push(`피부 자극: 통증 +${drug.irritation}`)
  if (drug.consciousness) out.lines.push(`의식 감점 ${drug.consciousness.toFixed(2)}`)
  if (drug.breathing) out.lines.push(`호흡 감소 ${drug.breathing.toFixed(2)}`)
  if (preview.addiction) out.lines.push(`이번 투여의 의존 위험 ${(preview.addiction * 100).toFixed(1)}%`)
  if (drug.constipation) out.lines.push('변비 위험')
  if (drug.emptyNausea) out.lines.push('빈속이면 메스꺼울 수 있다')
  if (drug.dysenteryRisk) out.lines.push(`이질 위험 ${Math.round(drug.dysenteryRisk * 100)}%`)
  if (drug.forceSleep) out.lines.push('약기운이 지속되는 동안 잠에 빠진다')
  if (current.overdose || (drug.family === 'alcohol' || !patient.drugs?.active.some((a) => a.def === drug.id && a.until > turnOf(w))) && current.consciousness + drug.consciousness > pharmacologyDef(w).overdoseAt) out.lines.push('과용: 호흡 억제와 기절 위험이 있다')
  if (patient.drugs?.active.some((a) => a.def === drug.id && a.until > turnOf(w))) out.lines.push('같은 약의 복용은 지속 시간을 갱신하고 내성을 더 쌓는다')
  return out
}

export function finishClinicalDose(w: World, doctor: Creature, act: Activity) {
  const patient = creatureById(w, act.patientId), id = w.db.creature(doctor.def).clinic, policy = act.companionClinical?companionClinicalRule(w):id && w.db.tryGet<ClinicDef>(id)
  const error = !patient || !policy ? '환자나 처방이 없다' : externalTreatmentError(w, doctor, act) ?? clinicalDoseError(w, doctor, patient, policy, act.uid, act.woundId)
  if (error || !patient) { if (act.patientId === w.s.playerId) log(w, 'warn', `투약 중단: ${error}.`); return }
  const it = findItem(doctor, act.uid!)!, d = itemDef(w, it), drug = w.db.get<DrugDef>(d.drug!.def!)
  const failed = administerDrug(w, patient, drug.id, it.def, 1, act.woundId, true)
  if (failed) { if (patient.id === w.s.playerId) log(w, 'warn', `투약 중단: ${failed}.`); return }
  if (drug.external) { const wound = patient.body.wounds.find((wd) => wd.id === act.woundId); if (wound) woundHandContact(w, doctor, wound) }
  if (it.uses !== undefined) { it.uses--; if (it.uses <= 0) removeOne(w, doctor, it.uid) }
  else removeOne(w, doctor, it.uid)
  // 약이 진료 대기를 수면으로 바꾸어도 투약의 마지막100TU와 피격 기상 조건을 보존한다.
  if (patient.activity?.drugSleep) { patient.activity.woundCount = patient.body.wounds.length; patient.nextAct = Math.max(patient.nextAct, w.s.time + 100) }
  patient.history.push({ turn: turnOf(w), kind: 'treat', text: `${doctor.name}의 ${drug.label} ${drug.external ? '도포' : '투약'}` })
  if (patient.id === w.s.playerId) log(w, 'info', `${doctor.name}이(가) ${drug.label}을(를) ${drug.external ? '상처에 발랐다' : '투여했다'}.`)
}
