// 수면 박탈의 지각은 당사자에게만 속한다. 실제 소음/생물 정보로 바꾸지 않는다.
import {turnOf,type World} from './ctx'
import type {Creature,ThoughtDef} from './types'
export const hallucinationRules=(w:World)=>w.db.tryGet<ThoughtDef>('Thought.Hallucination')?.hallucination
export function hallucinating(w:World,c:Creature):boolean{
 const d=hallucinationRules(w),debt=c.needs.sleepDebt
 return!!d&&c.alive&&!c.asleep&&!c.unconscious&&c.activity?.kind!=='sleep'&&w.db.body(c.body.def).kind!=='mechanical'&&Number.isFinite(debt)&&(debt??0)>=d.debtHours
}
export function privateSound(w:World,c:Creature){
 const p=c.phantomSound,now=turnOf(w)
 return hallucinating(w,c)&&p&&p.map===w.s.map.id&&p.at<=now&&p.until>now?p:undefined
}
