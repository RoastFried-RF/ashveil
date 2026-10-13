// 신체·상처·출혈·통증·의식·감염. 플레이어와 모든 생물에 동일 규칙 (대칭성).

import { clamp, log, lerpTable, rng, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, tileAt, type World } from './ctx'
import { addEffect, hasEffect, traitMul } from './traits'
import type { BodyDef, BodyPartDef, BodyState, Capacity, Creature, CreatureDef, Wound, WoundDef } from './types'

const partCache = new WeakMap<BodyDef, Map<string, BodyPartDef>>()

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

export function createBody(def: BodyDef, cdef: CreatureDef): BodyState {
  const hpMult = cdef.hpMult ?? 1
  const maxHp: Record<string, number> = {}
  for (const p of def.parts) maxHp[p.id] = Math.max(1, Math.round(p.hp * hpMult))
  const blood = Math.round(def.bloodMl * (cdef.bloodMult ?? 1))
  return { def: def.id, blood, bloodMax: blood, maxHp, missing: [], wounds: [], tourniquets: {} }
}

export function isMissing(w: World, c: Creature, id: string): boolean {
  const map = partMap(bodyDef(w, c))
  let cur: BodyPartDef | undefined = map.get(id)
  while (cur) {
    if (c.body.missing.includes(cur.id)) return true
    cur = cur.parent ? map.get(cur.parent) : undefined
  }
  return false
}

export function partDamage(c: Creature, id: string): number {
  let d = 0
  for (const wd of c.body.wounds) if (wd.part === id) d += wd.severity - wd.healed
  return d
}

/** 부위 자체 체력 비율 0~1 */
export function partHealth(w: World, c: Creature, id: string): number {
  if (isMissing(w, c, id)) return 0
  const max = c.body.maxHp[id]
  return clamp(1 - partDamage(c, id) / max, 0, 1)
}

/** 기능 기여용 유효 체력: 팔다리 상위 부위의 손상, 골절 반영 */
export function effectiveHealth(w: World, c: Creature, id: string): number {
  const map = partMap(bodyDef(w, c))
  let h = partHealth(w, c, id)
  if (h === 0) return 0
  if (c.body.wounds.some((wd) => wd.part === id && wd.fracture && !wd.splinted)) h *= 0.45
  else if (c.body.wounds.some((wd) => wd.part === id && wd.fracture)) h *= 0.75
  let cur = map.get(id)
  while (cur?.parent) {
    const parent = map.get(cur.parent)!
    if (parent.limb) {
      let ph = partHealth(w, c, parent.id)
      if (c.body.wounds.some((wd) => wd.part === parent.id && wd.fracture && !wd.splinted)) ph *= 0.45
      h *= 0.5 + 0.5 * ph
    }
    cur = parent
  }
  return h
}

export function bloodLoss(c: Creature): number {
  return 1 - c.body.blood / c.body.bloodMax
}

export function woundDef(w: World, wd: Wound): WoundDef {
  return w.db.wound(wd.def)
}

function limbOf(w: World, c: Creature, partId: string): string | undefined {
  return part(w, c, partId).limb
}

/** 이번 턴 실제 출혈량 (ml/턴) */
export function effectiveBleed(w: World, c: Creature, wd: Wound): number {
  if (wd.bleed <= 0 || wd.cauterized) return 0
  let b = wd.bleed
  if (wd.bandage) b *= wd.arterial ? wd.bandage.arterialMult : wd.bandage.bleedMult
  const limb = limbOf(w, c, wd.part)
  if (limb && c.body.tourniquets[limb] !== undefined) b = 0
  if (c.body.pressing === wd.id) b *= 0.25
  b *= traitMul(w, c, 'bleedMult')
  if (hasEffect(c, 'alcohol', turnOf(w))) b *= 1.2
  if (c.exerted) b *= 1.3
  return b
}

export function totalBleed(w: World, c: Creature, externalOnly = false): number {
  let t = 0
  for (const wd of c.body.wounds) if (!externalOnly || !wd.internal) t += effectiveBleed(w, c, wd)
  return t
}

export function painTotal(w: World, c: Creature): number {
  const turn = turnOf(w)
  let p = 0
  for (const wd of c.body.wounds) {
    const def = woundDef(w, wd)
    const pd = part(w, c, wd.part)
    let wp = def.painPerSeverity * (wd.severity - wd.healed) * (pd.painMult ?? 1)
    if (wd.bandage) wp *= 0.85
    if (wd.fracture) wp += (wd.splinted ? 5 : 14) * (c.exerted && !wd.splinted ? 1.5 : 1)
    if (wd.infection) wp += wd.infection.progress * 0.15
    p += wp
  }
  for (const limb of Object.keys(c.body.tourniquets)) {
    const since = turn - c.body.tourniquets[limb]
    p += 6 + Math.min(20, since / 120)
  }
  p *= traitMul(w, c, 'painMult')
  if (hasEffect(c, 'painkiller', turn)) p *= 0.5
  if (hasEffect(c, 'analgesic', turn)) p *= 0.3
  if (hasEffect(c, 'alcohol', turn)) p *= 0.75
  return p
}

export function painLabel(p: number): string {
  if (p < 10) return '없음'
  if (p < 30) return '약함'
  if (p < 60) return '심함'
  if (p < 80) return '극심'
  return '쇼크 위험'
}

export const BLOOD_TABLE: [number, number][] = [[0, 1], [0.15, 1], [0.3, 0.8], [0.4, 0.5], [0.5, 0]]
const PAIN_TABLE: [number, number][] = [[0, 1], [40, 0.95], [80, 0.75], [120, 0.45], [160, 0.3]]
const TEMP_TABLE: [number, number][] = [[28, 0], [32, 0.5], [35, 0.9], [36, 1]]

export function consciousness(w: World, c: Creature): number {
  const turn = turnOf(w)
  let v = effectiveHealth(w, c, 'Brain')
  v *= lerpTable(BLOOD_TABLE, bloodLoss(c))
  v *= lerpTable(PAIN_TABLE, painTotal(w, c))
  v *= lerpTable(TEMP_TABLE, c.needs.bodyTemp)
  if (hasEffect(c, 'sedative', turn)) v *= 0.85
  if (hasEffect(c, 'alcohol', turn)) v *= 0.95
  if (hasEffect(c, 'stimulant', turn)) v *= 1.1
  if (c.needs.fatigue > 90) v *= 0.85
  return clamp(v, 0, 1)
}

export function capacity(w: World, c: Creature, cap: Capacity): number {
  if (cap === 'consciousness') return consciousness(w, c)
  const def = bodyDef(w, c)
  let total = 0, weight = 0
  for (const p of def.parts) {
    const cw = p.capacities?.[cap]
    if (!cw) continue
    weight += cw
    total += cw * effectiveHealth(w, c, p.id)
  }
  let v = weight > 0 ? total / weight : 1
  const turn = turnOf(w)
  if (cap === 'moving' || cap === 'manipulation') {
    v *= clamp(consciousness(w, c) / 0.8, 0, 1)
    if (c.needs.bodyTemp < 35) v *= 0.8
  }
  if (cap === 'manipulation') {
    if (hasEffect(c, 'alcohol', turn)) v *= 0.9
    if (hasEffect(c, 'withdrawal', turn)) v *= 0.85
  }
  if (cap === 'moving' && Object.keys(c.body.tourniquets).some((l) => l.endsWith('Leg'))) v *= 0.85
  return clamp(v, 0, 1)
}

export interface WoundSpec {
  def: string
  part: string
  severity: number
  source: string
  arterial?: boolean
  internal?: boolean
  fracture?: boolean
  bleedMult?: number
  /** 한 번의 큰 베기/물기로 부위가 떨어져 나갈 수 있는가 */
  canSever?: boolean
}

/** 상처 추가. 반환: 부위가 파괴됐으면 그 부위 id */
export function addWound(w: World, c: Creature, spec: WoundSpec): { wound: Wound; destroyed?: string } {
  const def = w.db.wound(spec.def)
  const pd = part(w, c, spec.part)
  const arterial = !!spec.arterial
  // 작은 상처는 덜 흐른다: 심각도 12 기준으로 0.25~1.5배
  const sizeFactor = clamp(spec.severity / 12, 0.25, 1.5)
  let bleed = spec.severity * sizeFactor * def.bleedPerSeverity * (pd.bleedMult ?? 1) * (spec.bleedMult ?? 1)
  if (arterial) bleed *= 4
  const wound: Wound = {
    id: w.s.nextId++,
    def: spec.def,
    part: spec.part,
    severity: Math.round(spec.severity * 10) / 10,
    healed: 0,
    bleed: Math.round(bleed * 10) / 10,
    arterial,
    internal: !!spec.internal || def.visible === false,
    fracture: !!spec.fracture,
    ageTurns: 0,
    source: spec.source,
  }
  c.body.wounds.push(wound)
  c.lastAttacker = spec.source
  let destroyed: string | undefined
  if (partDamage(c, spec.part) >= c.body.maxHp[spec.part] && !c.body.missing.includes(spec.part)) {
    destroyed = spec.part
    if (!pd.vital && pd.parent && spec.canSever) {
      c.body.missing.push(spec.part)
      // 남은 상처는 절단면으로 통합
      c.body.wounds = c.body.wounds.filter((x) => !isDescendantOrSelf(w, c, x.part, spec.part))
      const sev = Math.min(14, c.body.maxHp[pd.parent] * 0.35)
      c.body.wounds.push({
        id: w.s.nextId++, def: 'Wound.Severed', part: pd.parent, severity: sev, healed: 0,
        bleed: Math.round(sev * w.db.wound('Wound.Severed').bleedPerSeverity * (pd.artery ? 2 : 1) * 10) / 10,
        arterial: !!pd.artery, internal: false, fracture: false, ageTurns: 0, source: spec.source,
      })
      c.history.push({ turn: turnOf(w), kind: 'maimed', text: `${pd.label}을(를) 잃음 (${spec.source})` })
    }
  }
  return { wound, destroyed }
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

/** 사망 원인 판정 (살아 있으면 null) */
export function deathCause(w: World, c: Creature): string | null {
  const def = bodyDef(w, c)
  for (const p of def.parts) {
    if (p.vital && partHealth(w, c, p.id) <= 0) return `${p.label} 파괴`
  }
  const root = def.parts.find((p) => !p.parent)!
  if (partHealth(w, c, root.id) <= 0) return `${root.label} 파괴`
  if (c.body.missing.includes('Neck') || c.body.missing.includes('Head')) return '머리 절단'
  if (bloodLoss(c) >= 0.5) return '과다 출혈'
  if (c.needs.bodyTemp < 28) return '저체온'
  if (c.needs.kcal < -6000) return '아사'
  if (c.needs.water < -2500) return '탈수'
  if (c.body.wounds.some((wd) => wd.infection && wd.infection.progress >= 100)) return '패혈증'
  return null
}

/** 턴당 신체 처리 */
export function bodyTick(w: World, c: Creature, sleeping: boolean) {
  const turn = turnOf(w)
  const r = rng(w, 'body')
  let bled = 0
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
    // 응고
    if (wd.bleed > 0 && !wd.arterial) {
      let clot = def.clotPerTurn
      if (c.exerted) clot = 1 - (1 - clot) * 0.4
      if (wd.bandage) clot -= 0.004
      if (traitMul(w, c, 'bleedMult') > 1) clot = 1 - (1 - clot) * 0.6
      wd.bleed *= clot
      if (wd.bleed < 0.05) wd.bleed = 0
    } else if (wd.arterial && wd.bleed > 0) {
      // 동맥은 거의 굳지 않는다. 계속 누르고 있으면 서서히 멎는다.
      wd.bleed *= c.body.pressing === wd.id ? 0.985 : 0.9997
      if (wd.bleed < 0.3) { wd.bleed = 0; wd.arterial = false }
    }
    // 감염 판정 (30분 후 1회)
    if (!wd.infectionChecked && wd.ageTurns >= 600) {
      wd.infectionChecked = true
      if (!wd.cauterized && def.infectionChance > 0) {
        let ch = def.infectionChance
        ch *= wd.bandage ? wd.bandage.infectionMult : 1.5
        if (wd.disinfected) ch *= 0.3
        ch /= traitMul(w, c, 'immunityMult')
        if (r.chance(clamp(ch, 0, 0.95))) {
          wd.infection = { progress: 0, immunity: 0 }
          if (c.faction === 'player') log(w, 'danger', `${part(w, c, wd.part).label}의 ${def.label}이(가) 곪기 시작한다. 열이 오른다.`)
        }
      }
    }
    // 감염 vs 면역 경주
    if (wd.infection) {
      const inf = wd.infection
      inf.progress += (45 + wd.severity) / TURNS_PER_DAY
      let imm = 50 * traitMul(w, c, 'immunityMult')
      if (sleeping) imm *= 1.4
      if (c.needs.kcal < 0) imm *= 0.6
      if (c.needs.water < 0) imm *= 0.7
      if (hasEffect(c, 'antibiotic', turn)) imm += 90
      inf.immunity += imm / TURNS_PER_DAY
      if (inf.immunity >= 100) {
        wd.infection = undefined
        if (c.faction === 'player') log(w, 'good', `${part(w, c, wd.part).label}의 감염을 이겨냈다.`)
      }
    }
    // 치유
    const bleeding = effectiveBleed(w, c, wd) > 0.5
    if (!bleeding && def.healPerDay > 0) {
      let h = def.healPerDay * traitMul(w, c, 'healMult')
      if (sleeping) h *= 1.5
      if (c.needs.kcal < 0) h *= 0.3
      if (c.needs.vitamin <= 0) h *= 0.5
      if (wd.infection) h *= 0.3
      if (wd.fracture && !wd.splinted) h *= 0.4
      wd.healed += h / TURNS_PER_DAY
    }
  }
  // 회복된 상처 제거
  const before = c.body.wounds.length
  c.body.wounds = c.body.wounds.filter((wd) => wd.healed < wd.severity)
  if (c.faction === 'player' && c.body.wounds.length < before) log(w, 'good', '상처 하나가 아물었다.')
  c.body.blood = Math.max(0, c.body.blood - bled)
  // 재생
  if (bled < 0.5 && c.needs.water > 300 && c.body.blood < c.body.bloodMax) {
    c.body.blood = Math.min(c.body.bloodMax, c.body.blood + 0.06)
    c.needs.water -= 0.06
  }
  // 지혈대 괴사
  for (const [limb, at] of Object.entries(c.body.tourniquets)) {
    const since = turn - at
    if (since === TURNS_PER_HOUR && c.faction === 'player') log(w, 'warn', '지혈대를 감은 지 한 시간. 손끝·발끝이 차갑다.')
    if (since > TURNS_PER_HOUR * 2 && since % 600 === 0) {
      const distal = bodyDef(w, c).parts.filter((p) => p.limb === limb && !p.internal && !isMissing(w, c, p.id))
      const target = distal[distal.length - 1]
      if (target) {
        addWound(w, c, { def: 'Wound.Necrosis', part: target.id, severity: 3, source: '지혈대 장시간 압박' })
        if (c.faction === 'player') log(w, 'danger', `${target.label}이(가) 검게 변해간다. 지혈대를 너무 오래 감았다.`)
      }
    }
  }
  // 쇼크·기절
  const pain = painTotal(w, c)
  if (pain >= 80 && !c.unconscious && r.chance((pain - 80) / 400)) {
    addEffect(c, 'shock', turn + r.int(20, 60))
    if (c.faction === 'player') log(w, 'danger', '고통이 시야를 하얗게 덮는다. 쇼크로 쓰러졌다.')
  }
  const cons = consciousness(w, c)
  const wasOut = c.unconscious
  c.unconscious = cons < 0.3 || hasEffect(c, 'shock', turn) || hasEffect(c, 'stunned', turn)
  if (c.faction === 'player' && wasOut !== c.unconscious) {
    log(w, c.unconscious ? 'danger' : 'info', c.unconscious ? '의식을 잃었다…' : '정신이 돌아왔다.')
  }
  c.body.pressing = undefined
}

/** 외부에서 관찰 가능한 상태 묘사 (적 툴팁용) */
export function observedCondition(w: World, c: Creature): string[] {
  const out: string[] = []
  const bleed = totalBleed(w, c, true)
  if (bleed > 20) out.push('피를 쏟고 있다')
  else if (bleed > 6) out.push('피를 흘린다')
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
