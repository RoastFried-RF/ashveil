import {runScriptHooks} from './script-hooks'
import {recordBrainTrauma} from './brain-recovery'
import {npcStressEvent} from './npc-psyche'
import {finishSleepMemories} from './sleep-memories'
import {infectionFor,infectionSystemic} from './infection-state'
import {fatigueBand} from './fatigue-state'
import {scurvyBleed} from './scurvy-state'
import {ashLungCap,inhaledAsh} from './air-state'
import {diseasePain,diseaseCapacityMultiplier,diseaseKey,recordWoundDiseaseRisk} from './disease-state'
import { aquaticHypoxiaPenalty, drowningFatal } from './aquatic-state'
import { parasiteBloodRate } from './parasite-state'
import { alcoholStage, drugEffects, drugKey, pharmacologyDef, topicalAntibiotic, withdrawalPain, withdrawalStage } from './drug-state'
import { recordConcussion } from './head-trauma'
import { machineReady, machineRules } from './machine-state'
import { ambientTemp } from './environment'
import { prostheticAt, prostheticPartEfficiency, prostheticKey, prostheticSupport } from './prosthetic-state'
import { hygieneContamination } from './food-state'
// 신체·상처·출혈·통증·의식·감염 (02). 플레이어와 모든 생물에 동일 규칙 (대칭성).
// HP 풀 + 6부위 상태(뼈대, §2.0) 위에 세부 부위 트리·상처 개체·기능 능력치(디테일 층)를 얹는다.

import { hungerStage, nutritionConsciousness, nutritionDef, nutritionKey, nutritionMultiplier, thirstBand, thirstStage } from './nutrition-state'
import { clamp, log, rng, tileAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { sutureRule } from './surgery'
import {rememberPartLoss} from './body-memories'
import { completeHealing, chronicPain, recoveryCap, recoveryKey, scarPainMultiplier, tourniquetNerves } from './recovery'
import { regenerationPeriod, willForChecks } from './growth'
import { scentTick } from './perception'
import { canSee } from './fov'
import { addEffect, effectMag, hasEffect, traitAdd, traitMul, traitOverride } from './traits'
import type { BodyDef, BodyPartDef, BodyState, Creature, CreatureDef, Region, Wound, WoundDef } from './types'

const partCache = new WeakMap<BodyDef, Map<string, BodyPartDef>>()
const fingerCache = new WeakMap<BodyDef, readonly string[]>()

// 몸 상태에서 나오는 값(의식·기능 능력치·부위 상태·통증)은 같은 상태면 같은 값이다.
// 상태 지문은 그 값들이 읽는 입력을 빠짐없이 담아야 한다 — 하나라도 반올림하거나 빠뜨리면
// 캐시 이력(불러오기 직후 빈 캐시 vs 이어 온 캐시)에 따라 값이 달라져 결정론이 깨진다.
const memo = new WeakMap<Creature, { db: World['db']; key: string; m: Map<string, number> }>()

/** 캐시가 읽는 동상 입력은 손가락 1도 이상 여부다. 노출·발가락 값의 직렬화는 불필요하다. */
function frozenHands(w: World, c: Creature): boolean {
  if (!c.frostbite) return false
  const def = bodyDef(w, c)
  let fingers = fingerCache.get(def)
  if (!fingers) {
    fingers = def.parts.filter(p => p.groups.includes('finger')).map(p => p.id)
    fingerCache.set(def, fingers)
  }
  // 몸 정의만 불변 캐시한다. 동상 등급은 같은 TU에도 항상 원래 몸에서 읽는다.
  for (const id of fingers) if ((c.frostbite[id]?.grade ?? 0) >= 1) return true
  return false
}

function stateKey(w: World, c: Creature): string {
  const turn = turnOf(w)
  let k = JSON.stringify(c.body.def)
  for (const wd of c.body.wounds) {
    k += `${wd.def}:${wd.thawed ? 1 : 0}:${wd.part}:${wd.severity}:${wd.healed}:${wd.fracture ? wd.fracture.grade + wd.fracture.progress : ''}:${wd.splint ? wd.splint.quality + (wd.splint.half ? 'h' : '') : ''}:${wd.infection ? wd.infection.progress+':'+infectionFor(w,wd).pain : ''}:${wd.tendon ? 1 : 0}:${wd.suture?.def ?? ''}:${wd.suture?.quality ?? ''}:${wd.foreign?.pain ?? ''}:${wd.dislocated ? 1 : 0};`
  }
  if(c.body.machine) k += `|machine:${JSON.stringify(c.body.machine)}`
  const n = c.needs
  const fx = c.effects.filter((e) => e.untilTurn > turn).map((e) => e.kind + (e.magnitude ?? '')).sort().join(',')
  const eq = Object.values(c.equip).map((i) => i?.uid ?? '').join(',')
  return `${k}|${c.body.concussionCap ?? ''}:${c.aquatic?.hypoxia??''}|${prostheticKey(w, c)}|${nutritionKey(w, c)}|${drugKey(w, c)}|${Object.entries(c.body.organDamage ?? {}).map(([id, n]) => id + n).join(',')}|${recoveryKey(w, c)}|${frozenHands(w, c) ? 1 : 0}|${diseaseKey(w,c)}:${inhaledAsh(c)}|${c.body.blood}|${c.body.missing.join(',')}|${Object.keys(c.body.tourniquets).join(',')}|${fx}|${n.bodyTemp}|${n.sleepDebt ?? 0}|${fatigueBand(w,c).consciousness}:${infectionSystemic(w,c).consciousness}|${c.cond?.shock ? 1 : 0}|${c.age?.years ?? 30}:${c.age?.jointPain ? 1 : 0}:${c.age?.senses ? 1 : 0}|${c.stats.vit}|${c.stats.wil}|${c.stats.per}|${c.traits.join(',')}|${c.abilities.length}|${eq}|${c.leading?.hand??''}`
}

function cached(w: World, c: Creature, name: string, fn: () => number): number {
  const key = stateKey(w, c)
  let e = memo.get(c)
  if (!e || e.db !== w.db || e.key !== key) { e = { db: w.db, key, m: new Map() }; memo.set(c, e) }
  const hit = e.m.get(name)
  if (hit !== undefined) return hit
  const v = fn()
  e.m.set(name, v)
  return v
}

export function bodyDef(w: World, c: Creature): BodyDef {
  return w.db.body(c.body.def)
}

export function partMap(def: BodyDef): Map<string, BodyPartDef> {
  let m = partCache.get(def)
  if (!m) {
    m = new Map(def.parts.map((p) => [p.id, p]))
    partCache.set(def, m)
  }
  return m
}

export function part(w: World, c: Creature, id: string): BodyPartDef {
  const p = partMap(bodyDef(w, c)).get(id)
  if (!p) throw new Error(`부위 없음: ${id}`)
  return p
}

export function tryPart(w: World, c: Creature, id: string): BodyPartDef | undefined {
  return partMap(bodyDef(w, c)).get(id)
}

/** 부위 HP = round(기본 HP × 체격) (02 §2.1) */
export function createBody(def: BodyDef, cdef: CreatureDef): BodyState {
  const build = cdef.hpMult ?? 1
  const maxHp: Record<string, number> = {}
  for (const p of def.parts) maxHp[p.id] = Math.max(1, Math.round(p.hp * build))
  const blood = Math.round(def.bloodMl * (cdef.bloodMult ?? 1))
  const body: BodyState = { def: def.id, blood, bloodMax: blood, maxHp, missing: [], wounds: [], tourniquets: {} }
  if(def.kind==='mechanical'&&def.mechanical)body.machine={coolant:def.mechanical.coolantMl,heat:0,power:100,shutdownUntil:0}
  return body
}

export function anatomicalMissing(w: World, c: Creature, id: string): boolean {
  const map = partMap(bodyDef(w, c))
  let cur: BodyPartDef | undefined = map.get(id)
  while (cur) {
    if (c.body.missing.includes(cur.id)) return true
    cur = cur.parent ? map.get(cur.parent) : undefined
  }
  return false
}

export function isMissing(w: World, c: Creature, id: string): boolean {
  return anatomicalMissing(w, c, id) && !prostheticAt(w, c, id)
}

export function isDescendantOrSelf(w: World, c: Creature, id: string, ancestor: string): boolean {
  const map = partMap(bodyDef(w, c))
  let cur: BodyPartDef | undefined = map.get(id)
  while (cur) {
    if (cur.id === ancestor) return true
    cur = cur.parent ? map.get(cur.parent) : undefined
  }
  return false
}

/** 부위의 미치유 sev 합 */
export function partDamage(c: Creature, id: string): number {
  let d = c.body.organDamage?.[id] ?? 0
  for (const wd of c.body.wounds) if (wd.part === id) d += wd.severity - wd.healed
  return d
}

/** 부위 체력 비율 0~1 */
export function partHealth(w: World, c: Creature, id: string): number {
  if (prostheticAt(w, c, id)) return 1
  if (isMissing(w, c, id)) return 0
  return clamp(1 - partDamage(c, id) / c.body.maxHp[id], 0, 1)
}

export function isDestroyed(w: World, c: Creature, id: string): boolean {
  const replacement = prostheticAt(w, c, id)
  if (replacement) return (replacement.state.item.durability ?? 100) <= 0
  return isMissing(w, c, id) || partDamage(c, id) >= c.body.maxHp[id]
}

/** 골절 효율 상한: 금 0.6 / 단순 미처치 0.1 · 부목 0.2 / 복합 0 → 치유 진행에 따라 1.0까지 (02 §3.1·§9) */
export function fractureCap(wd: Wound): number {
  const f = wd.fracture
  if (!f) return 1
  let cap = f.grade === 'hairline' ? 0.6 : f.grade === 'simple' ? (wd.splint ? (wd.splint.half ? 0.15 : 0.2) : 0.1) : 0
  cap += (1 - cap) * clamp(f.progress, 0, 1)
  return cap
}

/** 지혈대가 감긴 팔·다리 아래 부위인가 (상완·대퇴 자신은 제외) */
function belowTourniquet(w: World, c: Creature, p: BodyPartDef): boolean {
  return !!p.limb && p.limb !== p.id && c.body.tourniquets[p.limb] !== undefined
}

/**
 * 부위 효율 e (02 §3.1) = Π(상처·상태의 효율 상한) — HP 비율 항은 6부위 HP%가 맡는다.
 * 단, 장기·감각기·기도처럼 작은 기능 부위는 남은 체력 비율이 곧 기능이다.
 */
export function partEff(w: World, c: Creature, id: string): number {
  const replacement = prostheticPartEfficiency(w, c, id)
  if (replacement !== undefined) return replacement
  const p = tryPart(w, c, id)
  if (!p || isMissing(w, c, id)) return 0
  if (partDamage(c, id) >= c.body.maxHp[id]) return 0
  let e = p.internal || p.capacities ? partHealth(w, c, id) : 1
  for (const wd of c.body.wounds) {
    if (wd.part !== id) continue
    e = Math.min(e, fractureCap(wd))
    if (wd.tendon) e = Math.min(e, 0.5)
    if (wd.dislocated) e = Math.min(e, w.db.get<import('./types').RecoveryDef>('Recovery.Wounds').dislocationCap)
  }
  e = Math.min(e, recoveryCap(c, p))
  if (belowTourniquet(w, c, p)) e = 0
  return e
}

export function bloodLoss(c: Creature): number {
  return c.body.bloodMax>0 ? 1 - c.body.blood / c.body.bloodMax : 0
}

export function woundDef(w: World, wd: Wound): WoundDef {
  return w.db.wound(wd.def)
}

// ── 처치 계수 (02 §6) ──────────────────────────────

/** 붕대 처치계수: 일반 0.5 − 0.4Q, 동맥 0.8 − 0.2Q. 응급 처치(15 §6.6)는 감소폭 ×1.5, 하한 0.15 / 동맥 0.6 */
export function bandageCoef(q: number, arterial: boolean, firstAid = 0): number {
  let coef = arterial ? 0.8 - 0.2 * q / 100 : 0.5 - 0.4 * q / 100
  if (firstAid > 0) coef = Math.max(arterial ? 0.6 : 0.15, 1 - (1 - coef) * (1 + firstAid))
  return coef
}

function lying(c: Creature): boolean {
  return !!c.asleep || c.unconscious || c.activity?.kind === 'rest' || c.activity?.kind === 'sleep' || c.breakdown?.kind === 'lie'
}

/** 이번 턴 실제 출혈량 ml/턴 = (상처 출혈 × 처치계수 + 동맥 × 동맥 계수) × 혈액순환 × 상황계수 */
export function effectiveBleed(w: World, c: Creature, wd: Wound): number {
  if(machineRules(w,c))return 0
  if (wd.cauterized) return 0
  let b = wd.bleed
  if (wd.foreign?.kind === 'arrow') b *= w.db.get<import('./types').RecoveryDef>('Recovery.Wounds').arrowBleedMult
  let a = wd.artery ?? 0
  if (wd.suture) b *= sutureRule(w, wd)!.bleedMult
  if (b <= 0 && a <= 0) return 0
  const p = tryPart(w, c, wd.part)
  if (!wd.internal) {
    const tq = wd.stumpLimb ?? p?.limb
    if (tq && c.body.tourniquets[tq] !== undefined) return 0
    if (c.body.pressing === wd.id) { b *= 0.3; a *= 0.5 }
    else if (c.activity?.kind === 'treat' && c.activity.woundId === wd.id) { b *= 0.7; a *= 0.7 }
    else if (wd.bandage) {
      b *= bandageCoef(wd.bandage.quality, false, wd.bandage.firstAid)
      a *= bandageCoef(wd.bandage.quality, true, wd.bandage.firstAid)
    }
  }
  let s = 1
  const turn = turnOf(w)
  if (c.exerted) s *= 1.3
  else if (lying(c)) s *= 0.8
  s += alcoholStage(w, c) * 0.15
  if (c.needs.bodyTemp < 35) s *= 0.8
  if (hasEffect(c, 'stimulant', turn)) s *= 1.1
  s *= drugEffects(w, c).bleedMult
  return (b + a) * s * capacity(w, c, 'bloodPumping') * traitMul(w, c, 'bleedMult') * (c.needs.scurvy >= 80 ? nutritionDef(w).scurvyBleedMult : 1)
}

export function totalBleed(w: World, c: Creature, externalOnly = false): number {
  if(machineRules(w,c))return 0
  let t = scurvyBleed(w,c)
  for (const wd of c.body.wounds) if (!externalOnly || !wd.internal) t += effectiveBleed(w, c, wd)
  return t+parasiteBloodRate(w,c)
}

// ── 통증 (02 §7) ────────────────────────────────

const FRACTURE_PAIN = { hairline: 6, simple: 15, compound: 25 }

/** 총 통증 0~150 = Σ상처 통증 × 특성계수 × (1 − 진통효과) */
export function painTotal(w: World, c: Creature): number {
  return cached(w, c, 'pain', () => painTotalRaw(w, c))
}

function painTotalRaw(w: World, c: Creature): number {
  if(machineRules(w,c))return 0
  const turn = turnOf(w)
  let p = chronicPain(w, c) + diseasePain(w,c)
  for (const wd of c.body.wounds) {
    const def = woundDef(w, wd)
    const pd = tryPart(w, c, wd.part)
    let woundPain = (wd.severity - wd.healed) * def.painPerSeverity * (pd?.pain ?? 1) * (wd.thawed ? 1.5 : 1)
    if (wd.fracture) woundPain += wd.splint || wd.fracture.grade === 'hairline' ? 6 : FRACTURE_PAIN[wd.fracture.grade]
    if (wd.foreign) woundPain += w.db.get<import('./types').RecoveryDef>('Recovery.Wounds').foreignPain + wd.foreign.pain
    if (wd.dislocated) woundPain += w.db.get<import('./types').RecoveryDef>('Recovery.Wounds').dislocationPain
    if (wd.infection) woundPain += infectionFor(w,wd).pain
    p += woundPain * scarPainMultiplier(w, c, wd.part)
  }
  p += 15 * Object.keys(c.body.tourniquets).length
  if (hasEffect(c, 'foodPoisoning', turn)) p += 10
  if (hasEffect(c, 'reperfusion', turn)) p += 10
  if (hasEffect(c, 'sting', turn)) p += 10
  if (hasEffect(c, 'frostbite', turn)) p += 2
  p += drugEffects(w, c).topicalPain + withdrawalPain(w, c)
  p *= traitMul(w, c, 'painMult')
  if (hasEffect(c, 'painkiller', turn)) p *= 0.5
  if (hasEffect(c, 'analgesic', turn)) p *= 0.3
  if (hasEffect(c, 'alcohol', turn)) p *= 0.75
  p = Math.max(0, p - drugEffects(w, c).pain)
  if (hasEffect(c, 'breath', turn)) p *= 0.5
  return clamp(p, 0, 150)
}

/** 통증 단계 0~5: 없음 <15 · 경미 <30 · 중간 <50 · 심각 <70 · 극심 <90 · 극한 */
export function painStage(p: number): number {
  return p < 15 ? 0 : p < 30 ? 1 : p < 50 ? 2 : p < 70 ? 3 : p < 90 ? 4 : 5
}

export const PAIN_LABEL = ['없음', '경미', '중간', '심각', '극심', '극한'] as const

export function painLabel(p: number): string {
  return PAIN_LABEL[painStage(p)]
}

/** 다턴 배율 (01 §5.1): 경미 1.00 · 중간 1.05 · 심각 1.15 · 극심·극한 1.30 */
export const PAIN_MULTI = [1, 1, 1.05, 1.15, 1.3, 1.3]

// ── 기능 능력치 (02 §3.2) ──────────────────────────

/** P혈액: 손실 L% <15 → 0 / 15~30 → 0.05 + (L−15)×0.01 / 30~40 → 0.20 + (L−30)×0.02 / 40~50 → 0.40 + (L−40)×0.04 */
function bloodPenalty(loss: number): number {
  const L = loss * 100
  if (L < 15) return 0
  if (L < 30) return 0.05 + (L - 15) * 0.01
  if (L < 40) return 0.2 + (L - 30) * 0.02
  return 0.4 + (L - 40) * 0.04
}

function tempPenalty(t: number, heatShift = 0): number {
  if (t < 32) return 0.4
  if (t < 34) return 0.15
  if (t < 35) return 0.05
  if (t > 41 - heatShift) return 0.4
  if (t > 39.5 - heatShift) return 0.1
  return 0
}

function consciousnessOrgan(w: World, c: Creature): BodyPartDef | undefined {
  return bodyDef(w, c).parts.find((p) => p.capacities?.consciousness)
}

/** 의식 기관 효율: 여러 개(융합체 머리 셋)면 가장 성한 것 */
function brainEff(w: World, c: Creature): number {
  let best = -1
  for (const p of bodyDef(w, c).parts) if (p.capacities?.consciousness) best = Math.max(best, partEff(w, c, p.id))
  return best < 0 ? 1 : best
}

/** 의식 = 뇌e × (1 − P통증 − P혈액 − P피로 − P체온 − P약물 − P쇼크) × (0.4 + 0.6 × 산소공급) */
export function consciousness(w: World, c: Creature): number {
  return cached(w, c, 'cons', () => consciousnessRaw(w, c))
}

function consciousnessRaw(w: World, c: Creature): number {
  if(machineRules(w,c))return machineReady(w,c)?brainEff(w,c)*genericCapacity(w,c,'bloodPumping'):0
  const turn = turnOf(w)
  const brain = brainEff(w, c)
  const n = c.needs
  let pen = Math.max(0, painTotal(w, c) - 20) / 200
  pen += bloodPenalty(bloodLoss(c))+aquaticHypoxiaPenalty(w,c)
  pen += fatigueBand(w,c).consciousness
  pen += (w.db.creature(c.def).temperatureLimits?0:tempPenalty(n.bodyTemp, thirstBand(w, c).heatShift)) + nutritionConsciousness(w, c)
  pen += drugEffects(w, c).consciousness
  if (hasEffect(c, 'sedative', turn)) pen += 0.08
  if (hasEffect(c, 'alcohol', turn)) pen += 0.06
  if (c.cond?.shock) pen += 0.15
  pen += infectionSystemic(w,c).consciousness
  const oxygen = Math.min(capacity(w, c, 'breathing'), capacity(w, c, 'bloodPumping'))
  let v = brain * (1 - pen) * (0.4 + 0.6 * oxygen)
  if (hasEffect(c, 'stimulant', turn)) v *= 1.1
  // 머리 불구: 의식 상한 0.5 (혼미, 02 §2.0.3)
  if (regionState(w, c, 'head') === 4) v = Math.min(v, 0.5)
  return clamp(v, 0, Math.min(1.2, c.body.concussionCap ?? 1.2))
}

/** 의식계수 = clamp(0, 1, (의식 − 0.3) / 0.4) — 이동·조작에 곱한다 */
function consCoef(w: World, c: Creature): number {
  return clamp((consciousness(w, c) - 0.3) / 0.4, 0, 1)
}

function byId(w: World, c: Creature, id: string): number {
  return tryPart(w, c, id) ? partEff(w, c, id) : 0
}

/** 다리효율 = 대퇴e × 정강이e × (0.6 + 0.4 × 발e), 발e = 발 체력비 × (0.85 + 0.15 × 발가락 잔존비) */
export function legEff(w: World, c: Creature, side: 'Left' | 'Right'): number {
  const foot = `${side}Foot`
  let toes = 0
  for (let i = 1; i <= 5; i++) if (!isMissing(w, c, `${side}Toe${i}`)) toes++
  const footE = isMissing(w, c, foot) ? 0 : partEff(w, c, foot) * partHealth(w, c, foot) * (0.85 + 0.15 * toes / 5)
  return byId(w, c, `${side}Thigh`) * byId(w, c, `${side}Shin`) * (0.6 + 0.4 * footE)
}

const FINGERS: [string, number][] = [['Thumb', 0.35], ['Index', 0.25], ['Middle', 0.18], ['Ring', 0.12], ['Pinky', 0.1]]

/** 손조작(h) = 상완e × 전완e × 손e × Σ(손가락 가중 × 손가락e) */
export function handManip(w: World, c: Creature, side: 'Left' | 'Right'): number {
  let f = 0
  for (const [id, wt] of FINGERS) f += wt * byId(w, c, `${side}${id}`)
  return byId(w, c, `${side}UpperArm`) * byId(w, c, `${side}Forearm`) * byId(w, c, `${side}Hand`) * f
}

/** 자가 처치에 실제 사용하는 한 손의 조작 능력. 의식·금단·동상·특성 상한은 양손 조작과 같다. */
export function handCapacity(w: World, c: Creature, side: 'Left' | 'Right', ignoreLead=false): number {
  if(!ignoreLead&&c.leading?.hand===side)return 0
  return clamp(handManip(w, c, side) * manipulationFactor(w, c), 0, traitOverride(w, c, 'manipulationCap') ?? 1.2)
}

function manipulationFactor(w: World, c: Creature): number {
  let f = consCoef(w, c)
  if (hasEffect(c, 'withdrawal', turnOf(w))) f *= 0.85
  if (frozenHands(w, c)) f *= 0.9
  return f
}

function pair(a: number, b: number, hi: number, lo: number): number {
  return Math.max(a, b) * hi + Math.min(a, b) * lo
}

/** 일반 몸(사족·융합체): 그 능력치를 가진 부위의 가중 평균 */
function genericCapacity(w: World, c: Creature, cap: string): number {
  let total = 0, weight = 0
  for (const p of bodyDef(w, c).parts) {
    const cw = p.capacities?.[cap]
    if (!cw) continue
    weight += cw
    total += cw * partEff(w, c, p.id) * (p.internal || p.capacities ? 1 : partHealth(w, c, p.id))
  }
  return weight > 0 ? total / weight : 1
}

export function capacity(w: World, c: Creature, cap: string): number {
  if(c.captivity&&(cap==='manipulation'||cap==='moving'&&!c.captivity.anklesFree))return 0
  if (cap === 'consciousness') return consciousness(w, c)
  return cached(w, c, cap, () => capacityRaw(w, c, cap))
}

function capacityRaw(w: World, c: Creature, cap: string): number {
  const kind = bodyDef(w, c).kind
  if(kind==='mechanical'){
    const d=machineRules(w,c)!,m=c.body.machine
    if(cap==='bloodPumping')return partEff(w,c,d.powerCell)
    if(cap==='breathing')return partEff(w,c,d.coolingLoop)
    let v=genericCapacity(w,c,cap)
    if(cap==='moving'){
      const legs=bodyDef(w,c).parts.filter(p=>p.qleg)
      v=Math.min(1,legs.reduce((sum,p)=>sum+partEff(w,c,p.id),0)*1.2/Math.max(1,legs.length))
    }
    if(cap==='moving'||cap==='manipulation')v*=consCoef(w,c)
    if((cap==='moving'||cap==='manipulation')&&m&&m.coolant<d.coolantMl/2)v*=m.coolant/(d.coolantMl/2)
    return clamp(v,0,1)
  }
  let v: number
  if (kind === 'humanoid') {
    switch (cap) {
      case 'moving': {
        const l = legEff(w, c, 'Left'), r = legEff(w, c, 'Right')
        v = (Math.min(l, r) < 0.2 ? Math.max(l, r) * 0.3 : (l + r) / 2) * byId(w, c, 'Pelvis') * consCoef(w, c)
        break
      }
      case 'manipulation':
        v = (0.6 * (c.leading?.hand==='Right'?0:handManip(w, c, 'Right')) + 0.4 * (c.leading?.hand==='Left'?0:handManip(w, c, 'Left'))) * manipulationFactor(w, c)
        break
      case 'sight': v = pair(byId(w, c, 'LeftEye'), byId(w, c, 'RightEye'), 0.75, 0.25) * consCoef(w, c); break
      case 'hearing': v = pair(byId(w, c, 'LeftEar'), byId(w, c, 'RightEar'), 0.7, 0.3); break
      case 'breathing': {
        const ribs = c.body.wounds.some((wd) => wd.part === 'Chest' && wd.fracture) ? 0.8 : 1
        v = (byId(w, c, 'LeftLung') + byId(w, c, 'RightLung')) / 2 * byId(w, c, 'Neck') * ribs
        break
      }
      case 'bloodPumping': v = byId(w, c, 'Heart'); break
      default: v = genericCapacity(w, c, cap)
    }
  } else if (kind === 'quadruped' && cap === 'moving') {
    let sum = 0
    for (const p of bodyDef(w, c).parts) {
      if (!p.qleg) continue
      const paw = p.id.replace('Leg', 'Paw')
      sum += partEff(w, c, p.id) * (0.6 + 0.4 * (isMissing(w, c, paw) ? 0 : partEff(w, c, paw)))
    }
    v = Math.min(1, sum * 0.3) * consCoef(w, c)
  } else {
    v = genericCapacity(w, c, cap)
    if (cap === 'moving' || cap === 'manipulation') v *= consCoef(w, c)
  }
  const capOverride = traitOverride(w, c, `${cap}Cap`)
  if (cap === 'breathing') { const drug = drugEffects(w, c); v = Math.max(0, v - drug.breathingLoss); if (drug.overdose) v *= pharmacologyDef(w).overdoseBreathing }
  if (cap === 'manipulation' && withdrawalStage(w, c) >= 2) v *= pharmacologyDef(w).withdrawalManipulation
  v *= diseaseCapacityMultiplier(w,c,cap)
  return clamp(v, 0, Math.min(capOverride??1.2,cap==='breathing'?ashLungCap(w,c):1.2))
}

// ── 상처 생성 ─────────────────────────────────────

export interface WoundSpec {
  def: string
  part: string
  /** 정수 피해 D */
  severity: number
  source: string
  sourceId?: number
  /** 동맥 출혈 ml/턴 (0이면 없음) */
  artery?: number
  internal?: boolean
  fracture?: Wound['fracture']
  /** 상처 출혈 항 배율 (무기 × 능력) */
  bleedMult?: number
  /** 생성 시 추가 오염 */
  contam?: number
  tendon?: boolean
  foreign?: Wound['foreign']
  dislocated?: boolean
  /** 베기·물기로 떨어져 나갈 수 있는가 */
  canSever?: boolean
}

/** 작은 상처 출혈 문턱 (CANON D34): 심각도 < 부위 HP × 15%면 상처 출혈 × 0.5. 동맥 출혈은 그대로 */
export const SMALL_WOUND_PCT = 15
export const SMALL_WOUND_BLEED = 0.5

/** 상처 추가 (02 §4). 반환: 이번 상처로 처음 파괴된 부위 id */
export function addWound(w: World, c: Creature, spec: WoundSpec): { wound: Wound; damage:number; destroyed?: string; severed?: boolean } {
  const mechanical=machineRules(w,c)
  if(mechanical){
    const original=spec.def
    const mapped:Record<string,string>={'Wound.Cut':'Wound.MachineCrack','Wound.Bite':'Wound.MachineCrack','Wound.Stab':'Wound.MachinePerforation','Wound.Gunshot':'Wound.MachinePerforation','Wound.InternalBleed':'Wound.MachinePerforation','Wound.Bruise':'Wound.MachineDeformation','Wound.Burn':'Wound.MachineHeat'}
    spec={...spec,def:mapped[original]??original,artery:0,tendon:false,foreign:undefined,dislocated:false,canSever:false,contam:0}
    if(original==='Wound.Cut'||original==='Wound.Bite')spec.severity=Math.max(1,Math.floor(spec.severity/2))
    if(original==='Wound.Burn'&&c.body.machine)c.body.machine.heat=clamp(c.body.machine.heat+spec.severity,0,100)
    if(original==='Wound.Bruise')spec.fracture={grade:'simple',progress:0}
  }
  const def = w.db.wound(spec.def)
  const pd = part(w, c, spec.part)
  const sev = Math.max(1, Math.round(spec.severity))
  // 상처 출혈 = sev × 유형 출혈계수 × 부위 혈관계수 (내출혈은 × 장기계수) × 배율
  const coef = spec.internal ? pd.organ ?? 1 : pd.vessel ?? 1
  const hpPart = c.body.maxHp[spec.part] ?? 0
  const small = !spec.internal && hpPart > 0 && sev * 100 < hpPart * SMALL_WOUND_PCT
  const bleed = sev * def.bleedPerSeverity * coef * (spec.bleedMult ?? 1) * (small ? SMALL_WOUND_BLEED : 1)
  const env = tileAt(w, c.pos)
  let contam = def.contamination + (spec.contam ?? 0) + (pd.contam ?? 0) + (!spec.internal && def.visible !== false ? hygieneContamination(w, c) : 0)
  if (w.db.terrain(env.t).id.includes('Mud')) contam += 20
  if (c.needs.wetness > 50 && ['ashrain', 'ashstorm'].includes(w.s.weather)) contam += 10
  const wound: Wound = {
    id: w.s.nextId++,
    def: spec.def,
    part: spec.part,
    severity: sev,
    healed: 0,
    bleed: mechanical?0:Math.round(bleed * 10) / 10,
    artery: spec.artery || undefined,
    arterial: !!spec.artery,
    internal: !!spec.internal || def.visible === false,
    fracture: spec.fracture,
    tendon: spec.tendon,
    tendonAt: spec.tendon ? turnOf(w) : undefined,
    foreign: spec.foreign,
    dislocated: spec.dislocated,
    contam: mechanical?0:clamp(contam, 0, 100),
    ageTurns: 0,
    source: spec.source,
    sourceId: spec.sourceId,
  }
  const recovery = w.db.get<import('./types').RecoveryDef>('Recovery.Wounds')
  if (wound.dislocated === undefined && spec.def === 'Wound.Bruise' && !wound.internal && !wound.fracture && !prostheticAt(w, c, spec.part) && pd.groups.some((g) => ['hand', 'forearm', 'upperArm', 'foot', 'shin', 'thigh'].includes(g)) && recovery.dislocationChance > 0 && sev >= hpPart * recovery.dislocationSeverity && !c.body.wounds.some((wd) => wd.part === spec.part && wd.dislocated) && rng(w, 'body').chance(recovery.dislocationChance)) {
    wound.dislocated = true
    if (c.faction === 'player') log(w, 'danger', `${pd.label}의 관절이 빠졌다. 맞추기 전에는 쓰기 어렵다.`)
  }
  recordWoundDiseaseRisk(w,c,wound,spec.contam??0)
  const before = partDamage(c, spec.part)
  c.body.wounds.push(wound)
  c.lastAttacker = spec.source
  mergeWounds(c, spec.part, spec.def)
  recordBrainTrauma(w,c,spec.part,wound.id)
  if (spec.part === 'Skull' && spec.fracture && !prostheticAt(w, c, spec.part)) recordConcussion(w, c, wound.id)
  let destroyed: string | undefined
  let severed = false
  // 이번 상처로 처음 한계를 넘었을 때만 '파괴' (02 §4: 손가락·손·발·귀·코는 떨어져 나가고, 큰 부위는 효율 0)
  if (before < c.body.maxHp[spec.part] && partDamage(c, spec.part) >= c.body.maxHp[spec.part] && !c.body.missing.includes(spec.part)) {
    destroyed = spec.part
    if (pd.detach && pd.parent && spec.canSever) {
      sever(w, c, pd, spec.source)
      severed = true
    }
  }
  npcStressEvent(w,c,'hurt')
  if(w.s.creatures.includes(c))runScriptHooks(w,'onWoundInflicted',{ownerId:c.id,woundId:wound.id,wound:wound.def,part:wound.part,severity:wound.severity,internal:!!wound.internal})
  return { wound, damage:sev, destroyed, severed }
}

/** 같은 부위·같은 유형이 3개를 넘으면 가장 작은 둘을 합친다 (02 §4) */
function mergeWounds(c: Creature, partId: string, defId: string) {
  const same = c.body.wounds.filter((x) => x.part === partId && x.def === defId && !x.patched && !x.fracture && !x.bandage && !x.suture && !x.foreign && !x.dislocated && !x.tendon)
  if (same.length <= 3) return
  same.sort((a, b) => a.severity - a.healed - (b.severity - b.healed))
  const [a, b] = same
  if(defId==='Wound.Bite'||c.biteRisks?.some(r=>r.wound===a.id||r.wound===b.id||a.mergedIds?.includes(r.wound)||b.mergedIds?.includes(r.wound)))a.mergedIds=[...new Set([...(a.mergedIds??[]),b.id,...(b.mergedIds??[])])]
  if(b.biteCareUntil!==undefined)a.biteCareUntil=Math.max(a.biteCareUntil??0,b.biteCareUntil)
  a.severity += b.severity
  a.healed += b.healed
  a.bleed += b.bleed
  a.artery = (a.artery ?? 0) + (b.artery ?? 0) || undefined
  a.arterial = a.arterial || b.arterial
  a.contam = Math.max(a.contam, b.contam)
  if(b.diseaseRisk?.length)a.diseaseRisk=[...(a.diseaseRisk??[]),...b.diseaseRisk]
  c.body.wounds = c.body.wounds.filter((x) => x !== b)
}

function sever(w: World, c: Creature, pd: BodyPartDef, source: string) {
  c.body.missing.push(pd.id)
  rememberPartLoss(w,c,pd)
  let sev = 0
  for (const x of c.body.wounds) if (isDescendantOrSelf(w, c, x.part, pd.id)) sev += x.severity - x.healed
  c.body.wounds = c.body.wounds.filter((x) => !isDescendantOrSelf(w, c, x.part, pd.id))
  const parent = part(w, c, pd.parent!)
  // 절단면은 부모 부위의 베임으로 남는다
  const s = Math.max(1, Math.min(Math.round(sev / 2), Math.round(c.body.maxHp[parent.id] * 0.6)))
  c.body.wounds.push({
    id: w.s.nextId++, def: 'Wound.Severed', part: parent.id, severity: s, healed: 0,
    bleed: Math.round(s * w.db.wound('Wound.Severed').bleedPerSeverity * (parent.vessel ?? 1) * 10) / 10,
    arterial: false, internal: false, contam: 25, ageTurns: 0, source,
  })
  c.history.push({ turn: turnOf(w), kind: 'maimed', text: `${pd.label}을(를) 잃음 (${source})` })
}

/** 사망 원인 판정 (살아 있으면 null) — 02 §2.0.1 사망 경로 */
export function deathCause(w: World, c: Creature): string | null {
  if (c.hp <= 0) return '치명상'
  for (const group of w.db.creature(c.def).deathAllOf ?? []) {
    if (group.every((id) => isDestroyed(w, c, id))) return `${group.map((id) => part(w, c, id).label).join('·')} 모두 파괴`
  }
  for (const p of bodyDef(w, c).parts) {
    if (p.vital && isDestroyed(w, c, p.id)) return `${p.label} 파괴`
    if (p.delayedDeath && isDestroyed(w, c, p.id)) {
      const since = (c.organFailAt ??= {})[p.id] ??= turnOf(w)
      if (turnOf(w) - since >= TURNS_PER_DAY) return `${p.label} 기능 정지`
    }
  }
  if (machineRules(w,c)) return null
  if(drowningFatal(w,c))return '익사'
  if (bloodLoss(c) >= 0.5) return '과다 출혈'
  const limits=w.db.creature(c.def).temperatureLimits
  if (c.needs.bodyTemp < (limits?.min??28)) return '저체온'
  if (c.needs.bodyTemp > (limits?.max??42.5 - thirstBand(w, c).heatShift)) return '고체온'
  const disease = c.diseases?.find((d) => {const limit=w.db.get<import('./types').DiseaseDef>(d.def).fatalAfterTurns;return d.immunity<100&&(limit!==undefined?turnOf(w)>=d.incubatesUntil+limit:d.progress>=100)})
  if (disease) return w.db.get(disease.def).label ?? '질병'
  if (c.needs.nutritionFatal) return c.needs.nutritionFatal
  if (c.needs.waterDeficit >= nutritionDef(w).thirst.at(-1)!.deficit) return '탈수'
  if (c.body.wounds.some((wd) => (wd.infection?.sepsis ?? 0) >= 100)) return '패혈증'
  return null
}

// ── 턴당 처리 ─────────────────────────────────────

/** 일일 치유 배율 (02 §13): 처치(무처치 0.6 · 붕대 1.0 · 소작 0.8) × 휴식 × 영양 */
function healRate(w: World, c: Creature, wd: Wound, sleeping: boolean): number {
  let f = wd.suture ? sutureRule(w, wd)!.healMult : wd.cauterized ? 0.8 : wd.bandage ? 1.0 : 0.6
  f *= sleeping ? 1.2 : c.exerted ? 0.7 : 1
  f *= nutritionMultiplier(w, c, 'healing')
  if (!infectionFor(w,wd).healing) f = 0
  return f
}

const FRACTURE_DAYS = { hairline: 8, simple: 21, compound: 35 }
export function healFracture(wd: Wound, turns = 1) {
  if (!wd.fracture || wd.fracture.progress >= 1) return
  const speed = wd.splint ? 0.7 + 0.5 * wd.splint.quality / 100 : 0.7
  wd.fracture.progress = Math.min(1, wd.fracture.progress + speed * turns / (FRACTURE_DAYS[wd.fracture.grade] * TURNS_PER_DAY))
}

export function bodyTick(w: World, c: Creature, sleeping: boolean) {
  if(machineRules(w,c)){mechanicalBodyTick(w,c);return}
  const turn = turnOf(w)
  const r = rng(w, 'body')
  const cond = (c.cond ??= {})
  let bled = scurvyBleed(w,c)
  for (const wd of c.body.wounds) {
    wd.ageTurns++
    const def = woundDef(w, wd)
    const eb = effectiveBleed(w, c, wd)
    if (eb > 0) {
      bled += eb
      if (!wd.internal) {
        const t = tileAt(w, c.pos)
        t.blood = Math.min(400, t.blood + eb)
      }
    }
    // 응고 (02 §6): 10턴마다. 동맥은 자연 응고 없음
    if (wd.ageTurns % 10 === 0 && wd.bleed > 0) {
      let clot = wd.internal ? 0.92 : 0.9
      if (lying(c)) clot = 0.85
      if (!wd.internal && (wd.bandage || (c.activity?.kind === 'treat' && c.activity.woundId === wd.id) || c.body.pressing === wd.id)) clot = 0.8
      if (alcoholStage(w, c) || cond.shock) clot = 0.95
      wd.bleed *= clot
      if (wd.bleed < 0.5) wd.bleed = 0
    }
    // 감염 성립 판정: 생성 6시간 뒤 1회 (02 §10.1)
    if (!wd.infectionChecked && wd.ageTurns >= TURNS_PER_HOUR * 6) {
      wd.infectionChecked = true
      const q = wd.bandage?.quality ?? 0
      const ch = wd.cauterized ? 0 : wd.contam * 0.008 * (1 - 0.3 * q / 100) / traitMul(w, c, 'immunityMult')
      if (r.chance(clamp(ch, 0, 0.95))) {
        wd.infection = { progress: 0, immunity: 0 }
        if (c.faction === 'player') log(w, 'danger', `${part(w, c, wd.part).label}의 ${def.label}이(가) 곪기 시작한다.`)
      }
    }
    // 감염 vs 면역 경주: 1시간마다 I += I/24, M += M/24 (02 §10.2)
    if (wd.infection && wd.ageTurns % TURNS_PER_HOUR === 0) {
      const inf = wd.infection
      const anti = Math.max(hasEffect(c, 'antibiotic', turn) ? 0.7 : 0, drugEffects(w, c).antibiotic, topicalAntibiotic(w, wd))
      const iDay = 30 * (1 + wd.contam / 200) * (1 - anti) * (wd.def === 'Wound.Burn' ? 1.2 : 1)
      const n = c.needs
      let m = 25 * nutritionMultiplier(w, c, 'immunity') * (sleeping ? 1.2 : c.exerted ? 0.8 : 1)
      m *= n.bodyTemp < 35 ? 0.8 : 1
      m *= 1 + (c.stats.vit - 10) * 0.04
      m *= traitMul(w, c, 'immunityMult')
      if (inf.progress >= 100) inf.sepsis = (inf.sepsis ?? 0) + 40 / 24
      else inf.progress += iDay / 24
      inf.immunity += m / 24
      if (inf.immunity >= 100) {
        wd.infection = undefined
        if (c.faction === 'player') {
          log(w, 'good', `${part(w, c, wd.part).label}의 감염을 이겨냈다.`)
          ;(c.crisis ??= { last: {}, arterial: [], bleeding: false, wasUnconscious: false }).infectionWon = true
        }
      }
    }
    // 치유 (02 §13)
    if (def.healPerDay > 0 && wd.healed < wd.severity) {
      wd.healed = Math.min(wd.severity, wd.healed + def.healPerDay * traitMul(w, c, 'healMult') * healRate(w, c, wd, sleeping) / TURNS_PER_DAY)
    }
    healFracture(wd)

  }
  // 아문 상처 제거 (골절은 뼈가 붙을 때까지 남는다)
  const before = c.body.wounds.length
  completeHealing(w, c)
  if (c.faction === 'player' && c.body.wounds.length < before) log(w, 'good', '상처 하나가 아물었다.')
  c.body.blood = Math.max(0, c.body.blood - bled)
  scentTick(w, c, bled)
  // 혈액 회복: 하루 400ml × 영양 × 수분 (탈수면 0), 1시간 단위 (02 §6)
  if (turn % TURNS_PER_HOUR === 0 && c.body.blood < c.body.bloodMax && thirstStage(w, c) < 3) {
    const nutr = hungerStage(w, c) >= 2 ? .5 : 1
    const restored = Math.min(c.body.bloodMax - c.body.blood, Math.floor(400 / 24 * nutr))
    c.body.blood += restored; c.needs.waterDeficit += restored
  }
  // HP 회복 (02 §2.0.1): 적대 인식이 없을 때 floor(100/활력)턴마다 +1, 수면 ×3. 실혈 30%·쇼크면 정지
  const max = hpCap(w, c)
  if (c.hp < max && bloodLoss(c) < 0.3 && !cond.shock && !hostileNear(w, c)) {
    let regen = (1 / regenerationPeriod(w, c)) * (sleeping ? 3 : 1)
    if (hasEffect(c, 'draught', turn)) regen += 0.5
    c.hp = Math.min(max, c.hp + regen * nutritionMultiplier(w, c, 'healing'))
  }
  if (c.hp > hpMax(w, c)) c.hp = hpMax(w, c)
  tourniquetTick(w, c)
  shockAndFaint(w, c)
  c.body.pressing = undefined
}

/** 누출은 응고·수면·붕대와 무관하다. 자연 치유나 골절 회복도 진행하지 않는다. */
export function coolantLeak(w: World,c:Creature):number{
  const d=machineRules(w,c)
  if(!d)return 0
  return c.body.wounds.reduce((sum,wd)=>sum+(!wd.patched&&wd.def==='Wound.MachinePerforation'&&(wd.part===d.chassis||wd.part===d.coolingLoop)?Math.max(0,wd.severity-wd.healed)*d.leakPerSeverity:0),0)
}

function mechanicalBodyTick(w:World,c:Creature){
  const d=machineRules(w,c)!,m=c.body.machine
  if(!m)return
  const turn=turnOf(w),r=rng(w,'body')
  for(const wd of c.body.wounds)wd.ageTurns++
  m.coolant=Math.max(0,m.coolant-coolantLeak(w,c))
  m.power=Math.max(0,m.power-d.idlePower)
  // 최대 열의 코어 손상은 같은 턴의 냉각으로 지워지지 않는다.
  if(m.heat>=100)addWound(w,c,{def:'Wound.MachineHeat',part:d.core,severity:d.coreDamage,source:'과열'})
  const cooling=d.cooling*m.coolant/d.coolantMl*partEff(w,c,d.coolingLoop)-Math.max(0,ambientTemp(w)-d.ambientThreshold)/d.ambientDivisor
  const hot=m.heat>=d.shutdownHeat
  m.heat=clamp(m.heat-cooling,0,100)
  if((hot&&(m.heat>=100||r.chance(d.shutdownChance)))||(w.db.terrain(tileAt(w,c.pos).t).water&&partDamage(c,d.chassis)>0&&r.chance(d.shortChance))){
    m.shutdownUntil=Math.max(m.shutdownUntil,turn+r.int(d.shutdownTurns[0],d.shutdownTurns[1]))
    c.activity=undefined
  }
  c.unconscious=!machineReady(w,c)||partEff(w,c,d.core)<=0
  c.needs.energy=m.power
}

/** 지혈대: 2시간 안전, 4시간을 넘기면 아래 부위 괴사 (02 §12.2) */
function tourniquetTick(w: World, c: Creature) {
  const turn = turnOf(w)
  for (const [limb, at] of Object.entries(c.body.tourniquets)) {
    const since = turn - at
    tourniquetNerves(w, c, limb, at)
    if (since === TURNS_PER_HOUR * 2 && c.faction === 'player') log(w, 'warn', '지혈대를 감은 지 두 시간. 손끝·발끝 감각이 없다. 더 두면 신경이 상한다.')
    if (since > TURNS_PER_HOUR * 4 && since % 600 === 0) {
      const distal = bodyDef(w, c).parts.filter((p) => p.limb === limb && p.id !== limb && !p.internal && !isMissing(w, c, p.id))
      const target = distal[distal.length - 1]
      if (target) {
        addWound(w, c, { def: 'Wound.Necrosis', part: target.id, severity: 3, source: '지혈대 장시간 압박' })
        if (c.faction === 'player') log(w, 'danger', `${target.label}이(가) 검게 변해간다. 지혈대를 너무 오래 감았다.`)
      }
    }
  }
}

/** 쇼크·기절 (02 §6.3·§7) */
function shockAndFaint(w: World, c: Creature) {
  const turn = turnOf(w)
  const r = rng(w, 'body')
  const cond = (c.cond ??= {})
  const loss = bloodLoss(c)
  const pain = painTotal(w, c)
  const isPl = c.faction === 'player'
  if (pain >= 70) cond.painHighSince ??= turn
  else cond.painHighSince = undefined
  // 10턴마다: 쇼크 진입 · 실혈 40% 기절 저항
  if (turn % 10 === 0) {
    if (!cond.shock) {
      let ch = 0
      if (loss >= 0.3) ch = Math.max(ch, (loss * 100 - 25) * 0.04)
      if (cond.painHighSince !== undefined && turn - cond.painHighSince >= 30) ch = Math.max(ch, 0.15)
      if (ch > 0 && traitMul(w, c, 'painMult') > 0 && r.chance(ch)) {
        cond.shock = true
        cond.shockOkSince = undefined
        if (isPl) log(w, 'danger', '식은땀이 흐르고 손발이 차갑다. 쇼크 상태다. 누워서 피를 멈춰야 한다.')
      }
    }
    if (loss >= 0.4 && !c.unconscious) {
      const resist = 50 + (c.stats.vit - 10) * 5 - (loss * 100 - 40) * 5
      if (!r.chance(clamp(resist, 0, 100) / 100)) faint(w, c, '피를 너무 많이 흘려')
    }
  }
  // 쇼크 회복: 손실 < 25%, 통증 < 50, 누운 상태, 체온 ≥ 36이 1시간
  if (cond.shock) {
    const ok = loss < 0.25 && pain < 50 && lying(c) && c.needs.bodyTemp >= 36
    if (!ok) cond.shockOkSince = undefined
    else if ((cond.shockOkSince ??= turn) + TURNS_PER_HOUR <= turn) {
      cond.shock = false
      if (isPl) log(w, 'good', '쇼크에서 벗어났다. 손끝에 온기가 돈다.')
    }
  }
  // 통증 기절: 임계 = 80 + (의지 − 10) × 2 이상이면 매 턴 5% + (통증 − 임계)%
  const thr = 80 + (willForChecks(w, c) - 10) * 2
  if (pain >= thr && !c.unconscious && r.chance((5 + pain - thr) / 100)) faint(w, c, '고통을 못 이겨')
  // 기절 회복: 10턴마다 의식 ≥ 0.35면 깬다
  const cons = consciousness(w, c)
  if (cond.faintUntil !== undefined && (turn >= cond.faintUntil || (turn % 10 === 0 && cons >= 0.35))) cond.faintUntil = undefined
  const wasOut = c.unconscious
  c.unconscious = cons < 0.3 || hasEffect(c, 'stunned', turn) || cond.faintUntil !== undefined
  if (isPl && wasOut !== c.unconscious) log(w, c.unconscious ? 'danger' : 'info', c.unconscious ? '의식을 잃었다…' : '정신이 돌아왔다.')
}

/** 기절: 30~120턴, 손에 든 물건을 떨어뜨린다 (02 §7) */
export function faint(w: World, c: Creature, why: string) {
  const turn = turnOf(w)
  const cond = (c.cond ??= {})
  if (cond.faintUntil !== undefined) return
  cond.faintUntil = turn + rng(w, 'body').int(30, 120)
  finishSleepMemories(w,c)
  c.unconscious = true
  c.asleep = false
  if (c.faction === 'player') log(w, 'danger', `${why} 정신을 잃었다.`)
  else if (w.s.visible.includes(c.pos.y * w.s.map.w + c.pos.x)) log(w, 'combat', `${c.name}이(가) ${why} 쓰러졌다.`)
}

/** 급성 통증 스파이크(+40 이상: 소작·절단): 즉시 기절 판정 (스파이크 − 20)% */
export function painSpike(w: World, c: Creature, spike: number) {
  if (spike >= 40 && rng(w, 'body').chance((spike - 20) / 100 * traitMul(w, c, 'painMult'))) faint(w, c, '극심한 통증에')
}

/** 외부에서 관찰 가능한 상태 묘사 (적 툴팁용) */
export function observedCondition(w: World, c: Creature): string[] {
  if(machineRules(w,c)){
    const out:string[]=[],m=c.body.machine!
    if(coolantLeak(w,c)>0)out.push('이음새에서 냉각액이 샌다')
    if(m.heat>=machineRules(w,c)!.protectiveHeat)out.push('과열 보호 모드다')
    if(c.unconscious)out.push('구동을 멈췄다')
    if(capacity(w,c,'moving')<.5)out.push('구동 다리가 제대로 움직이지 않는다')
    return out.length?out:['외장은 성해 보인다']
  }
  const out: string[] = []
  const bleed = totalBleed(w, c, true)
  if (bleed >= 40) out.push('피를 쏟고 있다')
  else if (bleed >= 10) out.push('피를 흘린다')
  else if (bleed > 0.5) out.push('피가 배어 나온다')
  const mv = capacity(w, c, 'moving')
  if (mv < 0.5) out.push('거의 걷지 못한다')
  else if (mv < 0.85) out.push('절뚝인다')
  const loss = bloodLoss(c)
  if (loss > 0.3) out.push('창백하고 비틀거린다')
  else if (loss > 0.15) out.push('얼굴이 질렸다')
  if (c.unconscious) out.push('쓰러져 있다')
  for (const m of c.body.missing) out.push(`${part(w, c, m).label} 없음`)
  if (c.ai.mode === 'flee') out.push('도망치려 한다')
  if (c.ai.mode === 'surrender') out.push('무기를 내려놓고 항복했다')
  if (out.length === 0) out.push('멀쩡해 보인다')
  return out
}

// ── 6부위 상태 (02 §2.0) ─────────────────────────

export const REGION_LABEL: Record<Region, string> = { head: '머리', torso: '몸통', larm: '왼팔', rarm: '오른팔', lleg: '왼다리', rleg: '오른다리' }
export const STATE_LABEL = ['멀쩡', '타박', '부상', '중상', '불구'] as const

export function partRegion(w: World, c: Creature, id: string): Region {
  return tryPart(w, c, id)?.region ?? 'torso'
}

/** 6부위 최대치 = 최대 HP × 비율 (02 §2.0.2, CANON D18) */
export const REGION_RATIO: Record<Region, number> = { head: 0.3, torso: 0.6, larm: 0.35, rarm: 0.35, lleg: 0.4, rleg: 0.4 }

export function regionMax(w: World, c: Creature, r: Region): number {
  return hpMax(w, c) * REGION_RATIO[r]
}

function regionParts(w: World, c: Creature, r: Region): BodyPartDef[] {
  return bodyDef(w, c).parts.filter((p) => p.region === r)
}

/** 부위 HP% 0~100 = floor(100 − Σ(그 부위 미치유 상처 sev) × 100 / 부위 최대치) */
export function regionHpPct(w: World, c: Creature, r: Region): number {
  const ext = regionParts(w, c, r).filter((p) => !p.internal)
  if (!ext.length) return 100
  if (ext.every((p) => isMissing(w, c, p.id))) return 0
  let sev = 0
  for (const wd of c.body.wounds) if (partRegion(w, c, wd.part) === r) sev += wd.severity - wd.healed
  return clamp(Math.floor(100 - (sev * 100) / regionMax(w, c, r)), 0, 100)
}

/** 부위 기능 효율 0~1: 머리 = 뇌e · 몸통 = min(호흡, 혈액순환) · 팔 = 상완e × 전완e × 손e · 다리 = 다리효율 */
export function regionFunction(w: World, c: Creature, r: Region): number {
  const kind = bodyDef(w, c).kind
  if (r === 'head') {
    const organ = consciousnessOrgan(w, c)
    if (kind === 'humanoid' || kind === 'quadruped') return organ ? partEff(w, c, organ.id) : 1
  }
  if (r === 'torso') return Math.min(capacity(w, c, 'breathing'), capacity(w, c, 'bloodPumping'))
  if (kind === 'humanoid') {
    const side = r === 'larm' || r === 'lleg' ? 'Left' : 'Right'
    if (r === 'larm' || r === 'rarm') return byId(w, c, `${side}UpperArm`) * byId(w, c, `${side}Forearm`) * byId(w, c, `${side}Hand`)
    return legEff(w, c, side)
  }
  const ext = regionParts(w, c, r).filter((p) => !p.internal)
  if (!ext.length) return 1
  return Math.max(...ext.map((p) => partEff(w, c, p.id) * (p.capacities ? 1 : partHealth(w, c, p.id))))
}

function stageOf(v: number): number {
  if (v >= 0.85) return 0
  if (v >= 0.6) return 1
  if (v >= 0.35) return 2
  if (v > 0) return 3
  return 4
}

/** 부위 체력 비율 0~1 (화면용) */
export function regionHealth(w: World, c: Creature, r: Region): number {
  return regionHpPct(w, c, r) / 100
}

/** 0 멀쩡 · 1 타박 · 2 부상 · 3 중상 · 4 불구 = HP% 단계와 기능 단계 중 나쁜 쪽 (02 §2.0.2) */
export function regionState(w: World, c: Creature, r: Region): number {
  return cached(w, c, 'rs_' + r, () => regionStateRaw(w, c, r))
}

function regionStateRaw(w: World, c: Creature, r: Region): number {
  if (!regionParts(w, c, r).length) return 0
  return Math.max(stageOf(regionHpPct(w, c, r) / 100), stageOf(regionFunction(w, c, r)))
}

// 02 §2.0.3 부위 상태 불이익 (인덱스 = 상태 0~4)
const HEAD_PER = [0, 1, 2, 3, 5]
const HEAD_HIT = [0, 3, 6, 10, 15]
const TORSO_EMAX = [1, 0.95, 0.85, 0.7, 0.5]
const TORSO_REGEN = [1, 0.9, 0.75, 0.5, 0.25]
const ARM_HIT = [0, 2, 5, 10, 100]
export const ARM_DMG = [1, 0.95, 0.85, 0.7, 0]
export const ARM_BLOCK = [0, 5, 10, 20, 100]
const ARM_MULTI = [1, 1, 1.1, 1.25, 1.25]
const LEG_EVA = [1, 0.9, 0.75, 0.5, 0.25]
const LEG_STUMBLE = [0, 0, 5, 15, 30]

/** 부위 불이익. arm = 무기를 쥔 팔, 양손이면 두 팔 중 나쁜 쪽 */
export function regionPenalties(w: World, c: Creature, arm: 'larm' | 'rarm' = 'rarm', twoHanded = false) {
  const st = (r: Region) => regionState(w, c, r)
  const head = st('head'), torso = st('torso'), la = st('larm'), ra = st('rarm'), ll = st('lleg'), rl = st('rleg')
  const support = twoHanded ? prostheticSupport(w, c, 'Left') : undefined
  const supportStage = support === undefined ? la : stageOf(Math.max(regionFunction(w, c, 'larm'), support))
  const armSt = twoHanded ? Math.max(supportStage, ra) : arm === 'larm' ? la : ra
  return {
    per: HEAD_PER[head],
    /** 머리 + 무기 쥔 팔 명중 불이익 */
    hit: HEAD_HIT[head] + ARM_HIT[armSt],
    headHit: HEAD_HIT[head],
    armHit: ARM_HIT[armSt],
    damageMult: ARM_DMG[armSt],
    armState: armSt,
    leftArm: la,
    rightArm: ra,
    /** 회피치(양수일 때)에 곱한다 = (왼다리 + 오른다리) / 2 */
    evasionCoef: (LEG_EVA[ll] + LEG_EVA[rl]) / 2,
    /** 비틀거림 % (다리 몫) */
    stumble: LEG_STUMBLE[ll] + LEG_STUMBLE[rl],
    crawl: ll === 4 && rl === 4,
    mainArmCrippled: ra === 4,
    energyMax: TORSO_EMAX[torso],
    energyRegen: TORSO_REGEN[torso],
    /** 다턴 행동 배율(쓰는 팔) */
    multiTurn: ARM_MULTI[armSt],
  }
}

/** 최대 HP = 50 + 활력 × 5 (+ 강인함). NPC는 × 체격, 보스는 고정값 (02 §2.0.1, D26) */
export function hpMax(w: World, c: Creature): number {
  const def = w.db.creature(c.def)
  const base = def.hpBase ?? (50 + c.stats.vit * 5) * (def.hpMult ?? 1)
  return Math.round(base + traitAdd(w, c, 'maxHp'))
}

/** HP 회복 상한 = 최대 HP − floor(Σ 미치유 상처 sev / 2) (02 §2.0.1, CANON D19) */
export function hpCap(w: World, c: Creature): number {
  let sev = 0
  for (const wd of c.body.wounds) sev += wd.severity - wd.healed
  return Math.max(0, hpMax(w, c) - Math.floor(sev / 2))
}

export function energyMax(w: World, c: Creature): number {
  return Math.round((50 + c.stats.wil * 5) * TORSO_EMAX[regionState(w, c, 'torso')])
}

/** 적대를 실제로 인식하고 있으면 회복할 수 없다. 벽 너머의 적은 제외한다 */
export function hostileNear(w: World, c: Creature): boolean {
  for (const o of w.s.creatures) {
    if (!o.alive || o.asleep || o.unconscious || o.id === c.id || o.faction === c.faction) continue
    if (o.faction === 'vermin' || o.ai.mode === 'surrender') continue
    if (c.faction !== 'player' && o.faction !== 'player') continue
    if (canSee(w, c, o.pos)) return true
  }
  return false
}

/** 효과 크기 (기절 남은 턴 등 UI용) */
export function effectLeft(c: Creature, kind: string, turn: number): number {
  const e = c.effects.find((x) => x.kind === kind && x.untilTurn > turn)
  return e ? e.untilTurn - turn : effectMag(c, kind, turn)
}

export function addStun(c: Creature, turn: number, turns: number) {
  addEffect(c, 'stunned', turn + turns)
}
