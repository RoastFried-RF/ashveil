import {rememberLifeEvent} from './life-memories'
import { woundHandContact } from './hand-hygiene'
import { wakeAfterSleep } from './sleep-state'
// 투여·내성·금단·과용. 읽기 전용 몸 계산은 drug-state에 둔다.
import { capacity, energyMax, faint, isMissing, part } from './body'
import { exposeDisease } from './conditions'
import { clamp, log, rng, turnOf, type World } from './ctx'
import { dependency, DRUG_FAMILIES, drugEffects, drugPotency, drugTolerance, innateAlcoholDependence, pharmacologyDef } from './drug-state'
import { findItem, itemDef, removeOne } from './items'
import { hydrate } from './nutrition'
import { addThought } from './thoughts'
import { addEffect } from './traits'
import type { Activity, Creature, DrugDef, DrugState } from './types'
function ensureDrugState(w: World, c: Creature): DrugState {
  if (c.drugs) return c.drugs
  const alcohol = dependency(w, c, 'alcohol')
  return c.drugs = { active: [], tolerance: {}, lastDose: alcohol.last === undefined ? {} : { alcohol: alcohol.last }, addicted: innateAlcoholDependence(w, c) ? ['alcohol'] : [], toleranceAt: turnOf(w), revision: 0 }
}
function settleTolerance(w: World, c: Creature) {
  const values = Object.fromEntries(DRUG_FAMILIES.map((family) => [family, drugTolerance(w, c, family)]))
  const s = ensureDrugState(w, c); s.tolerance = values; s.toleranceAt = turnOf(w)
}
function expireCourses(w: World, c: Creature, observeEnd=false) {
  const s = c.drugs
  if (!s) return
  const now = turnOf(w), expired = s.active.filter((d) => d.until <= now)
  if (expired.length) {
    for (const dose of expired) {
      const d = w.db.tryGet<DrugDef>(dose.def)
      if (d?.reboundFatigue) { c.needs.fatigue = Math.min(100, c.needs.fatigue + d.reboundFatigue * (dose.amount ?? 1)); if (c.id === w.s.playerId) log(w, 'warn', `${d.label}의 기운이 빠지며 피로가 몰려온다.`) }
    }
    const alcoholEnded=observeEnd&&expired.some(dose=>dose.until===now&&w.db.tryGet<DrugDef>(dose.def)?.family==='alcohol')&&!s.active.some(dose=>dose.until>now&&w.db.tryGet<DrugDef>(dose.def)?.family==='alcohol')
    s.active = s.active.filter((d) => d.until > now); s.revision++
    if(alcoholEnded)rememberLifeEvent(w,c,'hangover')
    if (c.activity?.drugSleep && !s.active.some((dose) => w.db.tryGet<DrugDef>(dose.def)?.forceSleep)) { wakeAfterSleep(w, c); c.activity = undefined }
  }
  for (const wound of c.body.wounds) if (wound.topicalDrug && wound.topicalDrug.until <= now) { delete wound.topicalDrug; s.revision++ }
}
function recoverDependencies(w: World, c: Creature) {
  const s = ensureDrugState(w, c), now = turnOf(w), policy = pharmacologyDef(w)
  for (const family of [...s.addicted]) {
    const last = s.lastDose[family]
    if (last !== undefined && now - last >= policy.recoveryTurns) {
      s.addicted = s.addicted.filter((f) => f !== family); (s.recovered ??= []).push(family); s.revision++
      if (family === 'alcohol') {
        c.traits = c.traits.filter((id) => id !== 'Trait.Alcoholic')
        if (!c.traits.includes('Trait.Teetotaler') && rng(w, 'body').chance(policy.abstinentChance)) c.traits.push('Trait.Teetotaler')
      }
      if (c.id === w.s.playerId) log(w, 'good', '오랫동안 약을 쓰지 않아 의존에서 벗어났다.')
    }
  }
}
export function drugPreview(w: World, c: Creature, id: string, amount = 1) {
  const d = w.db.get<DrugDef>(id), tolerance = d.family ? drugTolerance(w, c, d.family) : 0, potency = drugPotency(w, c, d.family)
  return { tolerance, potency, pain: d.pain * potency * amount, addiction: Math.min(1, d.addiction * (1 + tolerance / 100) * amount), duration: d.durationTurns }
}
export function administerDrug(w: World, c: Creature, id: string, source?: string, amount = 1, woundId?: number, sourceKnown = true): string | null {
  if(w.db.body(c.body.def).kind==='mechanical')return '기계형에는 약물을 투여할 수 없다'
  const d = w.db.tryGet<DrugDef>(id)
  if (!d || !Number.isFinite(amount) || amount <= 0 || amount > 1) return '투여할 약과 양을 확인해야 한다'
  const wound = woundId === undefined ? undefined : c.body.wounds.find((wd) => wd.id === woundId)
  if (d.external && amount !== 1) return '외용약은 한 번에 한 몫씩 발라야 한다'
  if (d.external && (!wound || wound.internal || part(w, c, wound.part).internal || isMissing(w, c, wound.part))) return '겉으로 드러난 상처에만 약을 바를 수 있다'
  if (!c.alive) return '죽은 몸에 약을 투여할 수 없다'
  if(d.curesDisease&&amount>=1){c.diseases=c.diseases?.filter(s=>s.def!==d.curesDisease);if(c.id===w.s.playerId)log(w,'good',d.label+'를 투여했다. 해당 질병을 치료했지만 원래 상처는 남는다.')}
  expireCourses(w, c)
  recoverDependencies(w, c)
  const before = drugPreview(w, c, id, amount), now = turnOf(w), policy = pharmacologyDef(w)
  settleTolerance(w, c)
  const s = c.drugs!, existing = s.active.find((dose) => dose.def === id), alreadyActive = !!existing
  if (d.external) {
    wound!.topicalDrug = { def: id, until: now + d.durationTurns }
  } else {
    // 구형 음주 효과가 남은 상태에서 다시 마시면 남은 한 잔을 먼저 이어받는다.
    if (d.family === 'alcohol' && !s.active.some((dose) => w.db.get<DrugDef>(dose.def).family === 'alcohol')) {
      const old = c.effects.find((e) => e.kind === 'alcohol' && e.untilTurn > now)
      if (old) { s.active.push({ def: id, until: old.untilTurn, potency: 1, amount: 1 }); c.effects = c.effects.filter((e) => e !== old && e.kind !== 'drankRecently') }
    }
    if (d.family === 'alcohol') {
      const end = Math.max(now, ...s.active.filter((dose) => w.db.get<DrugDef>(dose.def).family === 'alcohol').map((dose) => dose.until))
      s.active.push({ def: id, until: end + Math.ceil(d.durationTurns * amount), potency: before.potency, amount, ...(source ? { source, sourceKnown } : {}) })
      c.thoughts = c.thoughts.filter((t) => t.def !== 'Thought.Drunk')
    } else {
      s.active = s.active.filter((dose) => dose.def !== id)
      const retain = existing && existing.potency * (existing.amount ?? 1) >= before.potency * amount
      const duration = d.forceSleep ? Math.ceil(d.durationTurns * amount) : d.durationTurns
      s.active.push({ def: id, until: d.forceSleep ? Math.max(now + duration, existing?.until ?? 0) : now + duration, potency: retain ? existing.potency : before.potency, amount: retain ? existing.amount ?? 1 : amount, ...(source ? { source, sourceKnown } : {}) })
      // 같은 개척기 약을 다시 복용하면 구형 효과와 이중 적용하지 않는다.
      const legacy = id === 'Drug.WhiteTablet' ? ['painkiller', 'analgesic'] : id === 'Drug.PillStimulant' ? ['stimulant'] : id === 'Drug.PillAntibiotic' ? ['antibiotic'] : id === 'Drug.SleepPill' ? ['sedative'] : []
      c.effects = c.effects.filter((e) => !legacy.includes(e.kind))
    }
  }
  if (d.family) {
    s.tolerance[d.family] = clamp(before.tolerance + d.tolerance * amount, 0, 100); s.lastDose[d.family] = now
    if (!s.addicted.includes(d.family) && before.addiction > 0 && rng(w, 'body').chance(before.addiction)) {
      s.addicted.push(d.family); if (s.recovered) s.recovered = s.recovered.filter((family) => family !== d.family)
      if (d.family === 'alcohol' && !c.traits.includes('Trait.Alcoholic')) { c.traits = c.traits.filter((id) => id !== 'Trait.Teetotaler'); c.traits.push('Trait.Alcoholic') }
      if (c.id === w.s.playerId) {
        const appearance = source && w.db.tryGet<import('./types').ItemDef>(source)
        const label = !sourceKnown && appearance ? appearance.unknownLabel ?? appearance.label : d.label
        log(w, 'warn', `${label}에 의존하게 됐다.`)
      }
    }
  }
  if (d.fatigue && !alreadyActive) c.needs.fatigue = Math.max(0, c.needs.fatigue - d.fatigue * before.potency * amount)
  if (d.fillEnergy && !alreadyActive) c.needs.energy = energyMax(w, c)
  if (d.stress && !alreadyActive) c.needs.stress = Math.max(0, c.needs.stress - d.stress * amount)
  if (d.water) hydrate(w, c, d.water * amount)
  if (d.emptyNausea && c.needs.kcal <= 0 && rng(w, 'body').chance(d.emptyNausea * amount)) { addEffect(c, 'nausea', now + policy.nauseaTurns); addThought(w, c, 'Thought.Nausea') }
  if (d.constipation) { addEffect(c, 'constipation', now + policy.constipationTurns); addThought(w, c, 'Thought.Constipation') }
  if (d.dysenteryRisk) exposeDisease(w, c, 'Disease.Dysentery', Math.min(1, d.dysenteryRisk * amount))
  if (d.forceSleep && (!alreadyActive || c.activity?.drugSleep)) { c.activity = { kind: 'sleep', remaining: Math.ceil(d.durationTurns * amount), total: Math.ceil(d.durationTurns * amount), label: '약기운에 수면', drugSleep: true }; c.asleep = true }
  s.revision++
  return null
}
export function pharmacologyTick(w: World, c: Creature) {
  if(w.db.body(c.body.def).kind==='mechanical')return
  const current=turnOf(w)
  if(c.effects.some(e=>e.kind==='alcohol'&&e.untilTurn===current)&&!c.effects.some(e=>e.kind==='alcohol'&&e.untilTurn>current)&&!c.drugs?.active.some(dose=>w.db.tryGet<DrugDef>(dose.def)?.family==='alcohol'))rememberLifeEvent(w,c,'hangover')
  if (!c.drugs && !innateAlcoholDependence(w, c)) return
  const s = ensureDrugState(w, c), now = turnOf(w), policy = pharmacologyDef(w)
  expireCourses(w, c,true)
  recoverDependencies(w, c)
  const effects = drugEffects(w, c), checks = s.lastChecks ??= {}
  if (effects.overdose && now % policy.overdoseCheckTurns === 0 && checks.overdose !== now) { checks.overdose = now; if (rng(w, 'body').chance(policy.overdoseFaintChance)) faint(w, c, '약물 과용으로') }
  if (dependency(w, c, 'alcohol').stage >= 3 && now % policy.deliriumCheckTurns === 0 && checks.delirium !== now) { checks.delirium = now; if (rng(w, 'body').chance(policy.deliriumFaintChance)) faint(w, c, '금단 발작으로') }
}
export function topicalError(w: World, c: Creature, uid: number, woundId: number): string | null {
  if(w.db.body(c.body.def).kind==='mechanical')return '기계의 천공은 밀봉 패치로 막아야 한다'
  const item = findItem(c, uid), id = item && itemDef(w, item).drug?.def, d = id && w.db.tryGet<DrugDef>(id)
  if (!d || !d.external) return '상처에 바를 약이 없다'
  const wound = c.body.wounds.find((wd) => wd.id === woundId)
  if (!wound) return '상처가 없다'
  if (wound.internal || part(w, c, wound.part).internal || isMissing(w, c, wound.part)) return '겉으로 드러난 상처에만 약을 바를 수 있다'
  if (c.unconscious || capacity(w, c, 'manipulation') < .2) return '손을 쓸 수 없다'
  return null
}
export function startTopical(w: World, c: Creature, uid: number, woundId: number, factor: number): string | null {
  const error = topicalError(w, c, uid, woundId)
  if (error) return error
  const d = w.db.get<DrugDef>(itemDef(w, findItem(c, uid)!).drug!.def!), turns = Math.ceil((d.applyTurns ?? 3) * factor)
  c.activity = { kind: 'medicate', uid, woundId, remaining: turns, total: turns, label: d.label }
  return null
}
export function finishTopical(w: World, c: Creature, activity: Activity): boolean {
  if (activity.uid === undefined || activity.woundId === undefined || topicalError(w, c, activity.uid, activity.woundId)) { if (c.id === w.s.playerId) log(w, 'warn', '약을 바르기 전에 상처나 물품 상태가 바뀌었다.'); return false }
  const item = findItem(c, activity.uid)!, d = itemDef(w, item)
  if (administerDrug(w, c, d.drug!.def!, d.id, 1, activity.woundId)) return false
  const wound = c.body.wounds.find((wd) => wd.id === activity.woundId)
  if (wound) woundHandContact(w, c, wound)
  removeOne(w, c, item.uid)
  if (c.id === w.s.playerId) log(w, 'good', `${d.label}을(를) 상처에 발랐다.`)
  return true
}
export function drugLines(w: World, c: Creature): string[] {
  const now = turnOf(w), effects = drugEffects(w, c), out: string[] = []
  for (const dose of c.drugs?.active ?? []) if (dose.until > now) {
    const d = w.db.tryGet<DrugDef>(dose.def)
    if (!d) continue
    const source = dose.source ? w.db.tryGet<import('./types').ItemDef>(dose.source) : undefined
    const known = !(source?.relic && !dose.sourceKnown) && !(source?.unidentified && !w.s.knowledge.pillKnown[source.id])
    const name = known ? d.label : source?.unknownLabel ?? source?.label ?? '정체를 모르는 약효'
    out.push(`${name} · ${Math.ceil((dose.until - now) / 20)}분 남음${known && d.pain ? ` · 통증−${(d.pain * dose.potency * (dose.amount ?? 1)).toFixed(1)}` : ''}`)
  }
  for (const family of DRUG_FAMILIES) {
    const state = dependency(w, c, family), tolerance = drugTolerance(w, c, family)
    if (tolerance || state.addicted) out.push(`${{ analgesic: '진통', alcohol: '술', stimulant: '각성' }[family]} 내성 ${tolerance.toFixed(1)}/100${state.addicted ? ` · 의존${state.stage ? ` · 금단${state.stage}단계` : ''}` : ''}`)
  }
  for (const wound of c.body.wounds) if (wound.topicalDrug && wound.topicalDrug.until > now) out.push(`${w.db.body(c.body.def).parts.find((p) => p.id === wound.part)?.label ?? wound.part} · ${w.db.get<DrugDef>(wound.topicalDrug.def).label} · ${Math.ceil((wound.topicalDrug.until - now) / 1200)}시간 남음`)
  if (effects.consciousness || effects.breathingLoss) out.push(`약물 의식 감점 ${effects.consciousness.toFixed(2)} · 호흡 감소 ${effects.breathingLoss.toFixed(2)}`)
  if (effects.overdose) out.push('과용: 호흡 억제 중 · 기절 위험')
  if (dependency(w, c, 'alcohol').stage >= 3) out.push('떨림섬망: 환각·금단 발작 위험')
  if (c.effects.some((e) => e.kind === 'nausea' && e.untilTurn > now)) out.push('약 때문에 속이 메스껍다.')
  if (c.effects.some((e) => e.kind === 'constipation' && e.untilTurn > now)) out.push('변비로 배가 더부룩하다.')
  return out
}
