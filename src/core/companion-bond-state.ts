import { isCompanion } from './companion-state'
import { clamp, turnOf, type World } from './ctx'
import type { CompanionBond, CompanionBondDef, Creature } from './types'
export const companionBondDef=(w:World)=>w.db.get<CompanionBondDef>('CompanionBond.Hearth')
export function ensureCompanionBond(w:World,c:Creature,impression=0):CompanionBond{
  if(c.companion!.bond)return c.companion!.bond
  const now=turnOf(w),d=companionBondDef(w),score=clamp(d.initial+impression,d.min,d.max),delta=score-d.initial
  return c.companion!.bond={score,together:0,lastTick:now,day:Math.floor(now/28800),positiveToday:0,events:delta?[{turn:now,kind:'firstImpression',delta,text:'처음 실제로 만났을 때의 인상이 남았다.'}]:[]}
}
export function companionMorale(w:World,c:Creature):number{
  if(!isCompanion(w,c))return 0
  const d=companionBondDef(w),score=c.companion!.bond?.score??d.initial
  return Math.max(-d.moraleCap,Math.min(d.moraleCap,Math.trunc(score/d.moraleDivisor)))
}
