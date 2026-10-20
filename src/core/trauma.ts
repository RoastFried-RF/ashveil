// 04 §7: 생존한 위기 → 공포 → 노출·교전·처치로 극복. 난수는 body 스트림.
import { bloodLoss, deathCause, hpMax } from './body'
import { creatureById, log, rng, terrainAt, turnOf, TURNS_PER_DAY, TURNS_PER_HOUR, type World } from './ctx'
import { canSee, lightLevel } from './fov'
import { willForChecks } from './growth'
import { fearActive, fearFamily, fearTargets, traumaLabel } from './fear-state'
import { cheb, type Pos } from './geom'
import { wield } from './items'
import { addThought } from './thoughts'
import { traitMul, traitOverride } from './traits'
import type { Creature, Trauma, TraumaDef } from './types'

export function traumaChance(stress: number, will: number, mult = 1): number {
  return Math.max(5, Math.min(90, (30 + stress / 2 - (will - 10) * 3) * mult))
}
export function gainTrauma(w: World, c: Creature, def: string, target?: string): Trauma | undefined {
  if ((def === 'Trauma.Water' && traitOverride(w, c, 'waterFearImmune')) || c.faction !== 'player' || (def === 'Trauma.Blood' && traitOverride(w, c, 'bloodFearImmune'))) return
  const old = c.traumas?.find((t) => t.def === def && t.target === target)
  if (old) return old
  const t: Trauma = { def, target, overcome: 0 }
  ;(c.traumas ??= []).push(t)
  const label = traumaLabel(w, t)
  log(w, 'danger', `그 순간이 머릿속에서 지워지지 않는다. ${label}을(를) 얻었다.`)
  c.history.push({ turn: turnOf(w), kind: 'trauma', text: `${label} 획득` })
  return t
}
export function overcome(w: World, c: Creature, t: Trauma, score: number, reason: string) {
  if (!c.traumas?.includes(t)) return
  t.overcome = Math.max(-100, Math.min(100, t.overcome + score))
  const label = traumaLabel(w, t)
  log(w, score > 0 ? 'good' : 'warn', `${label}: 극복 ${score > 0 ? '+' : ''}${score} (${t.overcome}/100 · ${reason})`)
  if (t.overcome < 100) return
  c.traumas = c.traumas.filter((o) => o !== t)
  c.history.push({ turn: turnOf(w), kind: 'trauma', text: `${label} 극복` })
  log(w, 'good', `${label}을(를) 극복했다.`)
  if (!rng(w, 'body').chance(Math.max(0, Math.min(100, 15 + (willForChecks(w, c) - 10) * 2)) / 100)) return
  const d = w.db.get<TraumaDef>(t.def), positive = w.db.trait(d.positive.trait)
  c.traits = c.traits.filter((id) => {
    if (!positive.conflicts?.includes(id) && !w.db.trait(id).conflicts?.includes(positive.id)) return true
    log(w, 'info', `${w.db.trait(id).label} 특성을 잃었다.`); return false
  })
  if (!c.traits.includes(positive.id)) c.traits.push(positive.id)
  if (t.target && !(c.fearlessAgainst ??= []).includes(t.target)) c.fearlessAgainst.push(t.target)
  log(w, 'good', `${t.target ? w.db.creature(t.target).label + ' ' : ''}${positive.label} 특성을 얻었다.`)
}
function cause(w: World, c: Creature): { def: string; target?: string } | undefined {
  const wound = [...c.body.wounds].reverse().find((wd) => wd.ageTurns < TURNS_PER_HOUR && (wd.sourceId !== undefined || wd.def === 'Wound.Burn'))
  const attacker = creatureById(w, wound?.sourceId)
  if (attacker && attacker.id !== c.id) return { def: 'Trauma.Species', target: fearFamily(w, attacker) }
  if (wound?.def === 'Wound.Burn') return { def: 'Trauma.Fire' }
  if (terrainAt(w, c.pos).water && !traitOverride(w, c, 'waterFearImmune')) return { def: 'Trauma.Water' }
  if (lightLevel(w, c.pos) === 3) return { def: 'Trauma.Dark' }
  if (bloodLoss(c) >= 0.4 || c.body.wounds.some((wd) => !wd.internal && wd.bleed > 0)) return { def: 'Trauma.Blood' }
  return undefined
}
/** 즉시 붕괴 판정 배율을 반환. 의식이 없는 동안 노출 극복은 진행하지 않는다. */
export function traumaTick(w: World, c: Creature): number {
  if (c.faction !== 'player' || !c.alive) return 0
  const turn = turnOf(w), n = c.needs
  const near = bloodLoss(c) >= 0.4 || c.unconscious || n.bodyTemp < 32
  if (near && !c.nearDeath && !deathCause(w, c)) {
    addThought(w, c, 'Thought.NearDeath')
    n.stress = Math.min(100, n.stress + 15)
    const from = cause(w, c)
    if (from && rng(w, 'body').chance(traumaChance(n.stress, willForChecks(w, c), traitMul(w, c, 'traumaMult')) / 100)) gainTrauma(w, c, from.def, from.target)
  }
  if (near || c.nearDeath !== undefined) c.nearDeath = near
  let acute = 0
  for (const t of [...(c.traumas ?? [])]) {
    const d = w.db.get<TraumaDef>(t.def), active = fearActive(w, c, t)
    const targets = t.target && active ? fearTargets(w, c, t.target) : []
    const appeared = d.kind === 'species' ? targets.some((o) => !t.visible?.includes(o.id)) : active && !t.active
    if (appeared) {
      acute = Math.max(acute, t.overcome <= -50 ? 3 : 2)
      if (d.kind === 'species' && targets.some((o) => !t.seenTargets?.includes(o.id))) n.stress = Math.min(100, n.stress + 5)
    }
    if (active && d.stressPer10 && turn % 10 === 0 && t.lastStressTurn !== turn) {
      t.lastStressTurn = turn
      n.stress = Math.min(100, n.stress + d.stressPer10 * traitMul(w, c, 'stressMult'))
    }
    if (d.kind === 'dark') {
      if (!active) t.darkSince = undefined
      else {
        t.darkSince ??= turn
        if (turn - t.darkSince >= TURNS_PER_HOUR) { t.darkSince += TURNS_PER_HOUR; overcome(w, c, t, d.overcome.darkHour, '칠흑에서 한 시간 버팀') }
      }
    }
    if (d.kind === 'blood' && active) {
      const visible = w.s.creatures.filter((o) => o.id === c.id || canSee(w, c, o.pos)).flatMap((o) => o.body.wounds.filter((wd) => !wd.internal && wd.bleed > 0 && wd.healed < wd.severity))
      const seen = (t.seenWounds ??= [])
      for (const wd of visible) if (!seen.includes(wd.id)) {
        seen.push(wd.id)
        if (!c.unconscious && rng(w, 'body').chance(Math.min(1, (5 + wd.severity) / 100))) {
          c.unconscious = true; (c.cond ??= {}).faintUntil = turn + 30
          log(w, 'danger', '출혈 상처를 보고 정신을 잃었다.')
        }
      }
      // 상처 ID는 전역 고유하며, 사라진 상처의 기록만 정리한다.
      const aliveIds = new Set(w.s.creatures.flatMap((o) => o.body.wounds.map((wd) => wd.id)))
      t.seenWounds = seen.filter((id) => aliveIds.has(id))
    }
    if (d.kind === 'species') {
      for (const [id, e] of Object.entries(t.encounters ?? {})) {
        const other = creatureById(w, Number(id))
        if (!e.done && other?.alive && !targets.includes(other) && t.visible?.includes(other.id) && other.ai.mode !== 'flee' && (c.movedTurn ?? -10) >= turn - 1 && cheb(c.pos, other.pos) > (e.distance ?? 0)) {
          e.done = true; addThought(w, c, 'Thought.Fled'); overcome(w, c, t, d.overcome.flee, '교전에서 물러남')
        }
        if (other) e.distance = cheb(c.pos, other.pos)
      }
      t.visible = targets.map((o) => o.id)
      t.seenTargets = [...new Set([...(t.seenTargets ?? []), ...t.visible])]
    }
    t.active = active
  }
  return acute
}
function threat(w: World, c: Creature): number { return Math.max(0, c.hp / hpMax(w, c)) * (wield(w, c)?.atk.damage ?? 3) }
export function traumaEngage(w: World, c: Creature, other: Creature) {
  if (c.faction !== 'player') return
  for (const t of c.traumas ?? []) if (t.target === fearFamily(w, other)) {
    const encounters = (t.encounters ??= {})
    encounters[other.id] ??= { broken: !!c.breakdown, done: false, qualifies: threat(w, other) >= threat(w, c) * 0.5, distance: cheb(c.pos, other.pos) }
  }
}
export function traumaVictory(w: World, c: Creature, other: Creature, finishing: boolean) {
  for (const t of [...(c.traumas ?? [])]) {
    const e = t.encounters?.[other.id]
    if (t.target !== fearFamily(w, other) || !e || e.done) continue
    e.done = true
    if (!e.broken && e.qualifies) { const d = w.db.get<TraumaDef>(t.def); overcome(w, c, t, finishing ? d.overcome.finishing : d.overcome.victory, finishing ? '교전에서 마무리' : '교전에서 승리') }
  }
}
export function traumaBreakdown(w: World, c: Creature) {
  for (const t of [...(c.traumas ?? [])]) if (t.target && fearActive(w, c, t)) {
    for (const o of fearTargets(w, c, t.target)) { traumaEngage(w, c, o); const e = t.encounters?.[o.id]; if (e) e.broken = true }
    overcome(w, c, t, w.db.get<TraumaDef>(t.def).overcome.breakdown, '공포 대상 앞에서 붕괴')
  }
}
export function traumaHandleFire(w: World, c: Creature) {
  const day = Math.floor(turnOf(w) / TURNS_PER_DAY)
  for (const t of [...(c.traumas ?? [])]) if (w.db.get<TraumaDef>(t.def).kind === 'fire' && t.lastFireDay !== day) { t.lastFireDay = day; overcome(w, c, t, w.db.get<TraumaDef>(t.def).overcome.fireDay, '불 다루기') }
}
export function traumaTreat(w: World, c: Creature, wound: number) {
  for (const t of [...(c.traumas ?? [])]) if (w.db.get<TraumaDef>(t.def).kind === 'blood' && !t.treatedWounds?.includes(wound)) {
    ;(t.treatedWounds ??= []).push(wound)
    overcome(w, c, t, w.db.get<TraumaDef>(t.def).overcome.treatment, '자기 상처 처치')
  }
}
export function traumaMove(w: World, c: Creature, from: Pos) {
  for (const t of [...(c.traumas ?? [])]) if (w.db.get<TraumaDef>(t.def).kind === 'water') {
    const was = !!terrainAt(w, from).water, wet = !!terrainAt(w, c.pos).water
    if (!was && wet) { t.waterEntry = { ...from }; t.waterLast = { ...c.pos }; t.active = false }
    if (was && wet) t.waterLast = { ...c.pos }
    if (was && !wet) {
      // 진입과 탈출 방향이 같아야 건넌 것으로 친다. 같은 기슭 왕복으로 점수를 얻지 않는다.
      if (t.waterEntry && t.waterLast && (c.pos.x - t.waterLast.x) * (t.waterLast.x - t.waterEntry.x) + (c.pos.y - t.waterLast.y) * (t.waterLast.y - t.waterEntry.y) > 0) overcome(w, c, t, w.db.get<TraumaDef>(t.def).overcome.crossing, '물을 건넘')
      t.waterEntry = undefined; t.waterLast = undefined
    }
  }
}
export function traumaMeat(w: World, c: Creature, other: Creature, base: number): number {
  const family = fearFamily(w, other)
  if (!c.fearlessAgainst?.includes(family)) return base
  const carry = (c.meatYieldCarry ??= {}), mult = w.db.get<TraumaDef>('Trauma.Species').positive.yieldMult
  const extra = (carry[family] ?? 0) + base * (mult - 1)
  const whole = Math.floor(extra + 1e-9)
  carry[family] = Math.max(0, extra - whole)
  return base + whole
}
