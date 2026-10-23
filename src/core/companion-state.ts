// 소속 세력은 유지한다. 고용/급료 대기 중에만 고용주와 같은 전투 편이다.
import { player, type World } from './ctx'
import type { ClinicDef, CompanionDef, Creature } from './types'
export const companionDef=(w:World)=>w.db.get<CompanionDef>('Companion.Hearth')
export const companionClinicalRule=(w:World)=>{const id=companionDef(w).clinical;return id?w.db.tryGet<ClinicDef>(id):undefined}
export const isCompanion=(w:World,c:Creature)=>c.companion?.employer===w.s.playerId&&['employed','unpaid'].includes(c.companion.status)
export const effectiveFaction=(w:World,c:Creature)=>isCompanion(w,c)?player(w).faction:c.faction
export function allCompanions(w:World):Creature[]{
  const all=[...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...Object.values(w.s.overworld?.scenes??{}).flatMap((s)=>[...s.creatures,...Object.values(s.offCreatures).flat()])]
  return [...new Map(all.filter((c)=>c.alive&&isCompanion(w,c)).map((c)=>[c.id,c])).values()]
}
export const followingParty=(w:World)=>w.s.creatures.filter((c)=>c.alive&&!c.captivity&&isCompanion(w,c)&&c.companion!.status==='employed'&&c.companion!.order==='follow')
