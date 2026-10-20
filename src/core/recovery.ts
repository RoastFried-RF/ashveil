import {finishBrainRecovery} from './brain-recovery'
// 02 §13. 치유된 상처와 남는 후유증을 구별한다. 활성/미활성 지역이 같은 완료 처리를 쓴다.
import {rememberLifeEvent} from './life-memories'
import { clamp, log, rng, turnOf, TURNS_PER_HOUR, type World } from './ctx'
import { sutureRule } from './surgery'
import { ambientTemp } from './environment'
import type { BodyPartDef, Creature, RecoveryDef, Wound } from './types'

const rules = (w: World) => w.db.get<RecoveryDef>('Recovery.Wounds')
const joint = (p: BodyPartDef) => p.groups.some((g) => ['hand', 'foot', 'shin', 'paw', 'finger', 'toe'].includes(g))
export function completeHealing(w: World, c: Creature, eligible: (wd: Wound) => boolean = () => true) {
  const remaining: Wound[] = [], r = rng(w, 'body'), d = rules(w), turn = turnOf(w), parts = w.db.body(c.body.def).parts
  for (const wd of c.body.wounds) {
    if (wd.foreign || wd.dislocated || wd.healed < wd.severity || (wd.fracture && wd.fracture.progress < 1) || !eligible(wd)) { remaining.push(wd); continue }
    const p = parts.find((p) => p.id === wd.part)
    if (!p) continue
    const large = wd.severity >= c.body.maxHp[wd.part] * d.largeScarFraction
    const contracture = joint(p) && wd.def === 'Wound.Burn'
    const chance = w.db.wound(wd.def).scarChance * (wd.suture ? sutureRule(w, wd)!.scarMult : 1) * (1.5 - (wd.suture?.quality ?? wd.bandage?.quality ?? wd.splint?.quality ?? 0) / 100)
    if (!wd.internal && (wd.scar || wd.cauterized || contracture || (chance > 0 && r.chance(Math.min(1, chance))))) {
      const scars = (c.body.scars ??= []), old = scars.find((s) => s.part === wd.part)
      const cap = contracture ? d.contractureCap : joint(p) && large ? d.largeScarCap : 1
      const newScar=!old||wd.severity>old.severity||cap<old.cap||contracture&&!old.burn
      if (old) { if (cap < old.cap) { old.source = wd.source; old.at = turn }; old.severity = Math.max(old.severity, wd.severity); old.cap = Math.min(old.cap, cap); old.burn ||= contracture }
      else scars.push({ part: wd.part, severity: wd.severity, cap, burn: contracture, at: turn, source: wd.source })
      if(newScar)rememberLifeEvent(w,c,'scar',{part:p})
      if (c.faction === 'player') log(w, 'warn', `${p.label}에 ${contracture ? '화상 구축' : '흉터'}이(가) 남았다.`)
    }
    if (wd.tendon) {
      if (!(c.body.damagedTendons ??= []).includes(wd.part)) c.body.damagedTendons.push(wd.part)
      const since = (c.body.tendonSince ??= {}); since[wd.part] = Math.min(since[wd.part] ?? Infinity, wd.tendonAt ?? turn - wd.ageTurns)
    }
    const malunion = !!wd.fracture && (!wd.splint || wd.splint.half || wd.splint.quality < 30)
    if ((large || malunion) && !c.body.chronicPain?.includes(wd.part) && r.chance(d.chronicChance)) {
      ;(c.body.chronicPain ??= []).push(wd.part)
      if (c.faction === 'player') log(w, 'warn', `${p.label}에 만성 통증이 남았다.`)
    }
  }
  c.body.wounds = remaining
  finishBrainRecovery(w,c)
}
export function scarPainMultiplier(w: World, c: Creature, part: string): number {
  return c.body.scars?.some((s) => s.part === part) ? rules(w).scarPainMult : 1
}
export function nerveLoss(c: Creature, p: BodyPartDef): number { return p.limb ? c.body.nerveDamage?.[p.limb] ?? 0 : 0 }
export function recoveryCap(c: Creature, p: BodyPartDef): number {
  let cap = c.body.scars?.find((s) => s.part === p.id)?.cap ?? 1.2
  if (c.body.damagedTendons?.includes(p.id)) cap = Math.min(cap, .5)
  // 손/발의 말단 기능에 한 번만 상한을 건다. 각 손가락마다 다시 곱하지 않는다.
  if (p.groups.some((g) => ['hand', 'foot', 'paw'].includes(g))) cap = Math.min(cap, 1 - nerveLoss(c, p))
  return cap
}
export function chronicPain(w: World, c: Creature): number {
  const count = (c.body.chronicPain?.length ?? 0) + (c.age?.jointPain ? 1 : 0)
  if (!count) return 0
  const d = rules(w), cold = ambientTemp(w) < d.coldThreshold ? d.coldBonus : 0
  const rain = w.s.map.kind === 'surface' && ['ashrain', 'ashstorm'].includes(w.s.weather) ? d.rainBonus : 0
  const sinceWake = c.lastWokeAt === undefined ? Infinity : turnOf(w) - c.lastWokeAt
  const waking = sinceWake >= 0 && sinceWake < d.wakeTurns ? d.wakeBonus : 0
  return count * d.chronicPain + cold + rain + waking
}
/** 상태 캐시도 같은 환경·기상 후 시간 창을 읽어야 저장 복원 결과가 같다. */
export function recoveryKey(w: World, c: Creature): string {
  const scars = c.body.scars?.map((s) => `${s.part}:${s.cap}`).join(',') ?? ''
  return `${scars}|${c.body.damagedTendons?.join(',') ?? ''}|${Object.entries(c.body.nerveDamage ?? {}).map(([id, v]) => `${id}:${v}`).join(',')}|${c.body.chronicPain?.join(',') ?? ''}:${chronicPain(w, c)}`
}
export function tourniquetNerves(w: World, c: Creature, limb: string, at: number) {
  const total = clamp((turnOf(w) - at - 2 * TURNS_PER_HOUR) / TURNS_PER_HOUR * rules(w).nerveLossPerHour, 0, 1)
  if (total <= 0) return
  const clocks = (c.body.nerveClock ??= {}), clock = clocks[limb]?.since === at ? clocks[limb] : { since: at, applied: 0 }
  const delta = Math.max(0, total - clock.applied)
  if (delta) { const damage = (c.body.nerveDamage ??= {}); damage[limb] = clamp((damage[limb] ?? 0) + delta, 0, 1) }
  clock.applied = Math.max(clock.applied, total); clocks[limb] = clock
}
export function nerveFrostbiteMultiplier(w: World, c: Creature, p: BodyPartDef): number { return nerveLoss(c, p) > 0 ? rules(w).nerveFrostbiteMult : 1 }
export function recoveryLines(w: World, c: Creature): string[] {
  const parts = w.db.body(c.body.def).parts, label = (id: string) => parts.find((p) => p.id === id)?.label ?? id
  return [
    ...(c.body.concussionEvents?.length ? [`뇌진탕 누적${c.body.concussionEvents.length}회${c.body.concussionCap ? ` · 의식 상한${Math.round(c.body.concussionCap * 100)}%` : ''}`] : []),
    ...Object.entries(c.body.organDamage ?? {}).filter(([, n]) => n > 0).map(([id, n]) => `${label(id)} · 영구 손상 ${n.toFixed(1)}HP`),
    ...(c.body.scars ?? []).map((s) => `${label(s.part)} · ${s.burn ? '화상 구축' : '흉터'} · 새 상처 통증 ×${rules(w).scarPainMult}${s.cap < 1 ? ` · 기능 상한 ${(s.cap * 100).toFixed(0)}%` : ''}`),
    ...(c.body.chronicPain ?? []).map((id) => `${label(id)} · 만성 통증 +${rules(w).chronicPain} (추위·재비·기상 직후 악화)`),
    ...(c.body.damagedTendons ?? []).map((id) => `${label(id)} · 힘줄 손상 · 기능 상한50%`),
    ...Object.entries(c.body.nerveDamage ?? {}).filter(([, loss]) => loss > 0).map(([id, loss]) => `${label(id)} 아래 · 신경 손상 ${(loss * 100).toFixed(1)}% · 손/발 기능 감소·동상 위험 ×${rules(w).nerveFrostbiteMult}`),
  ]
}
