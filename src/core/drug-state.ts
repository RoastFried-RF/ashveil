// 약효·내성·금단의 읽기 전용 계산. 몸/신경/수면 모듈을 참조하지 않는다.
import { clamp, START_TURN, turnOf, TURNS_PER_DAY, type World } from './ctx'
import type { Creature, DrugDef, DrugFamily, PharmacologyDef, Wound } from './types'
export const pharmacologyDef = (w: World) => w.db.get<PharmacologyDef>('Pharmacology.Human')
export const DRUG_FAMILIES: DrugFamily[] = ['analgesic', 'alcohol', 'stimulant']
export const DRUG_FAMILY_LABEL: Record<DrugFamily, string> = { analgesic: '진통', alcohol: '술', stimulant: '각성' }
export function drugTolerance(w: World, c: Creature, family: DrugFamily): number {
  if (!c.drugs) return 0
  const elapsed = Math.max(0, turnOf(w) - c.drugs.toleranceAt) / TURNS_PER_DAY
  return Math.round(clamp((c.drugs.tolerance[family] ?? 0) - elapsed * pharmacologyDef(w).families[family].decay, 0, 100) * 1e6) / 1e6
}
export function drugPotency(w: World, c: Creature, family?: DrugFamily): number { return family ? 1 - drugTolerance(w, c, family) / 200 : 1 }
export function innateAlcoholDependence(w: World, c: Creature): boolean { return !c.drugs?.recovered?.includes('alcohol') && c.traits.some((id) => w.db.trait(id).mods?.alcoholNeed) }
export function dependency(w: World, c: Creature, family: DrugFamily) {
  const d = pharmacologyDef(w), explicit = c.drugs?.addicted.includes(family) ?? false
  const innate = family === 'alcohol' && innateAlcoholDependence(w, c)
  const oldDrink = family === 'alcohol' ? c.effects.find((e) => e.kind === 'drankRecently') : undefined
  const last = c.drugs?.lastDose[family] ?? (innate ? oldDrink ? oldDrink.untilTurn - TURNS_PER_DAY : START_TURN - d.families.alcohol.withdrawalTurns : undefined)
  const elapsed = last === undefined ? 0 : Math.max(0, turnOf(w) - last)
  const addicted = (explicit || innate) && elapsed < d.recoveryTurns
  const stage = !addicted || elapsed < d.families[family].withdrawalTurns ? 0 : Math.min(3, 1 + Math.floor((elapsed - d.families[family].withdrawalTurns) / d.withdrawalStageTurns))
  return { addicted, stage, last, elapsed }
}
export function alcoholWithdrawalStage(w: World, c: Creature): number { return !c.drugs && !innateAlcoholDependence(w, c) ? 0 : dependency(w, c, 'alcohol').stage }
export function withdrawalStage(w: World, c: Creature): number { if (!c.drugs && !innateAlcoholDependence(w, c)) return 0; return Math.max(...DRUG_FAMILIES.map((f) => dependency(w, c, f).stage)) }
export function withdrawalPain(w: World, c: Creature): number {
  if (!c.drugs && !innateAlcoholDependence(w, c)) return 0
  const d = pharmacologyDef(w)
  return dependency(w, c, 'analgesic').stage >= 3 ? d.severeAnalgesicPain : withdrawalStage(w, c) ? d.withdrawalPain : 0
}
export function drugKey(w: World, c: Creature): string {
  const s = c.drugs, topical = c.body.wounds.filter((wd) => wd.topicalDrug && wd.topicalDrug.until > turnOf(w))
  if (!s && !topical.length && !innateAlcoholDependence(w, c)) return ''
  let key = s ? `${s.toleranceAt}:${s.active.filter((d) => d.until > turnOf(w)).map((d) => `${d.def}:${d.until}:${d.potency}:${d.amount ?? 1}`).join(',')}:${JSON.stringify(s.tolerance)}:${JSON.stringify(s.lastDose)}:${s.addicted.join(',')}:${s.recovered?.join(',') ?? ''}` : ''
  for (const wound of topical) key += `/${wound.id}:${wound.topicalDrug!.def}:${wound.topicalDrug!.until}`
  return key + ':withdrawal:' + DRUG_FAMILIES.map((f) => dependency(w, c, f).stage).join(',')
}
export interface DrugEffects {
  pain: number
  consciousness: number
  breathingLoss: number
  sleep: number
  reaction: number
  bleedMult: number
  antibiotic: number
  febrileCooling: number
  coldAwareness: number
  heatLossMult: number
  wakeThreshold: number
  sedated: boolean
  alcoholDoses: number
  overdose: boolean
  topicalPain: number
}
const cache = new WeakMap<Creature, { db: World['db']; key: string; value: DrugEffects }>()
const EMPTY_EFFECTS: Readonly<DrugEffects> = Object.freeze({ pain: 0, consciousness: 0, breathingLoss: 0, sleep: 0, reaction: 0, bleedMult: 1, antibiotic: 0, febrileCooling: 0, coldAwareness: 0, heatLossMult: 1, wakeThreshold: 0, sedated: false, alcoholDoses: 0, overdose: false, topicalPain: 0 })
export function drugEffects(w: World, c: Creature): Readonly<DrugEffects> {
  const key = drugKey(w, c)
  if (!key) return EMPTY_EFFECTS
  const old = cache.get(c)
  if (old?.db === w.db && old.key === key) return old.value
  const value: DrugEffects = { pain: 0, consciousness: 0, breathingLoss: 0, sleep: 0, reaction: 0, bleedMult: 1, antibiotic: 0, febrileCooling: 0, coldAwareness: 0, heatLossMult: 1, wakeThreshold: 0, sedated: false, alcoholDoses: 0, overdose: false, topicalPain: 0 }
  const now = turnOf(w)
  for (const dose of c.drugs?.active ?? []) {
    if (dose.until <= now) continue
    const d = w.db.tryGet<DrugDef>(dose.def)
    if (!d) continue
    const amount = dose.amount ?? 1
    value.pain += d.pain * dose.potency * amount
    value.consciousness += d.consciousness * amount
    value.breathingLoss += d.breathing * amount
    value.sleep += (d.sleep > 0 ? d.sleep * dose.potency : d.sleep) * amount
    value.reaction += d.reaction * dose.potency * amount
    value.bleedMult *= 1 + (d.bleedMult - 1) * amount
    value.antibiotic = Math.max(value.antibiotic, (d.antibiotic ?? 0) * amount)
    value.febrileCooling = Math.max(value.febrileCooling, (d.febrileCooling ?? 0) * amount)
    value.coldAwareness = Math.max(value.coldAwareness, d.coldAwareness ?? 0)
    value.heatLossMult = Math.max(value.heatLossMult, d.heatLossMult ?? 1)
    value.wakeThreshold = Math.max(value.wakeThreshold, d.wakeThreshold ?? 0)
    value.sedated ||= !!d.forceSleep
    if (d.family === 'alcohol') value.alcoholDoses += amount
  }
  for (const wound of c.body.wounds) if (wound.topicalDrug && wound.topicalDrug.until > now) value.topicalPain += w.db.tryGet<DrugDef>(wound.topicalDrug.def)?.irritation ?? 0
  value.overdose = value.consciousness > pharmacologyDef(w).overdoseAt
  cache.set(c, { db: w.db, key, value }); return value
}
export function alcoholStage(w: World, c: Creature): number {
  const active = drugEffects(w, c).alcoholDoses
  return Math.min(3, Math.ceil(active) || (c.effects.some((e) => e.kind === 'alcohol' && e.untilTurn > turnOf(w)) ? 1 : 0))
}
export function topicalAntibiotic(w: World, wound: Wound): number {
  return wound.topicalDrug && wound.topicalDrug.until > turnOf(w) ? w.db.tryGet<DrugDef>(wound.topicalDrug.def)?.antibiotic ?? 0 : 0
}

/** 실제 유효 복용의 조건 사고. 중복 복용은 같은 행을 중첩하지 않는다. */
export function drugThoughts(w:World,c:Creature):string[]{
 if(!c.drugs?.active.length)return []
 const turn=turnOf(w),out=new Set<string>()
 for(const dose of c.drugs?.active??[]){
  if(dose.until<=turn||dose.potency<=0||(dose.amount??1)<=0)continue
  const id=w.db.tryGet<DrugDef>(dose.def)?.thought
  if(id)out.add(id)
 }
 return [...out]
}
