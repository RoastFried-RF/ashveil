// 실제 관찰한 무대화 시간만 사용한다. 조회는 시간/관찰/사고/난수를 만들지 않는다.
import {turnOf,type World} from './ctx'
import {traitMul} from './traits'
import type {Creature,ThoughtDef} from './types'
const human=(w:World,c:Creature)=>w.db.body(c.body.def).kind==='humanoid'
export function observeSocialTime(w:World,c:Creature){if(c.alive&&c.faction==='player'&&human(w,c))c.socialObservation??={since:turnOf(w)}}
export function recordConversation(w:World,a:Creature,b:Creature){
 const now=turnOf(w)
 for(const c of[a,b])if(c.alive&&human(w,c)){const o=c.socialObservation??={since:now};o.lastTalk=now}
}
export function isolationThoughts(w:World,c:Creature){
 const o=c.socialObservation
 if(!o||!human(w,c))return[]
 const elapsed=Math.max(0,turnOf(w)-(o.lastTalk??o.since))
 return w.db.all<ThoughtDef>('Thought').flatMap(d=>{
  const rule=d.isolation;if(!rule||elapsed<=rule.graceTurns)return[]
  const steps=Math.min(rule.maxSteps,Math.ceil((elapsed-rule.graceTurns)/rule.stepTurns)),mood=d.mood*steps*(rule.traitMultiplier?traitMul(w,c,rule.traitMultiplier):1)
  return mood?[{def:d.id,label:d.label,mood:Math.trunc(mood),count:1}]:[]
 })
}
