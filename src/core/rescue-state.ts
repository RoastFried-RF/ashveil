import { effectiveFaction, isCompanion } from './companion-state'
import { hostile } from './diplomacy'
import { turnOf, type World } from './ctx'
import type { Creature, RescueDef } from './types'
export const rescueDef=(w:World)=>w.db.get<RescueDef>('Rescue.Hearth')
export const rescueActive=(w:World,c:Creature)=>!!c.rescue&&turnOf(w)<c.rescue.until
export const rescuedBy=(w:World,actor:Creature,c:Creature)=>rescueActive(w,c)&&c.rescue!.by===(isCompanion(w,actor)?w.s.playerId:actor.id)
export function rescueCaptor(w:World,actor:Creature,c:Creature):Creature|undefined{
 const cap=c.captivity;if(!cap||cap.faction===effectiveFaction(w,actor))return undefined
 const captor=[...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...Object.values(w.s.overworld?.scenes??{}).flatMap((s)=>[...s.creatures,...Object.values(s.offCreatures).flat()])].find((o)=>o.id===cap.captor)
 return captor&&(hostile(w,actor,captor)||isCompanion(w,c))?captor:undefined
}
