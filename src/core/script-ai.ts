// 시야·적대·생존 후보를 코어가 먼저 제한한다. 워커는 그 후보의 점수만 더한다.
import {hostile} from './actions'
import {clamp,rng,type World} from './ctx'
import {canSee} from './fov'
import {cheb} from './geom'
import {disableScriptCall,initializeScriptState,scriptContextView} from './script-hooks'
import {validScriptJson,type ScriptCall,type ScriptJson} from './script-contracts'
import type {Creature} from './types'
export function scriptAITargetScores(w:World,actor:Creature,candidates:Creature[],preview=false):Map<number,number>|null{
 const ref=w.db.creature(actor.def).considerationWorker
 if(!ref||!actor.alive||actor.asleep||actor.unconscious||!w.s.creatures.includes(actor))return null
 const [modId,name]=ref.split(':'),module=w.db.scriptModules.find(m=>m.modId===modId)
 if(!module||!w.db.scriptHost?.invokeWorker||!module.workers?.some(r=>r.name===name&&r.kind==='AIConsiderationWorker'))return null
 const actual=[...new Set(candidates)].filter(c=>c!==actor&&c.alive&&c.ai.mode!=='surrender'&&w.s.creatures.includes(c)&&hostile(w,actor,c)&&canSee(w,actor,c.pos)).sort((a,b)=>cheb(actor.pos,a.pos)-cheb(actor.pos,b.pos)||a.id-b.id).slice(0,32).sort((a,b)=>a.id-b.id)
 if(!actual.length)return null
 const call:ScriptCall=`worker.${name}.score`,key=modId+':'+call;if(w.s.scriptState?.disabled.includes(key))return null
 const state=w.s.scriptState?.mods[modId]??{},event={actorId:actor.id,actorIds:actual.map(c=>c.id),options:actual.map(c=>({targetId:c.id,distance:cheb(actor.pos,c.pos),hp:c.hp}))}as Record<string,ScriptJson>,{view}=scriptContextView(w,event),stream=`mod.${modId}.${call}`as const,prior=w.s.rng[stream],shadow:World={db:w.db,s:{...w.s,rng:{...w.s.rng,...(prior?{[stream]:[...prior]}:{})}}}
 const fail=(reason:string)=>{if(!preview){initializeScriptState(w);disableScriptCall(w,modId,call,reason)}return null}
 if(!validScriptJson(state))return fail('저장된 AI 워커 데이터 형식 오류')
 const outcome=w.db.scriptHost.invokeWorker({module,worker:name,method:'score',event,view,state,rng:rng(shadow,stream).s})
 if(!outcome.ok)return fail(outcome.reason)
 if(!validScriptJson(outcome.state)||!validScriptJson(outcome.result)||!Array.isArray(outcome.result)||outcome.result.length>32)return fail('AI 워커 점수 형식 오류')
 const scores=new Map<number,number>()
 for(const row of outcome.result){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['targetId','bonus'].includes(k))||typeof row.targetId!=='number'||!Number.isSafeInteger(row.targetId)||!actual.some(c=>c.id===row.targetId)||scores.has(row.targetId)||typeof row.bonus!=='number'||!Number.isSafeInteger(row.bonus))return fail('실제 보이는 적 후보의 정수 점수만 허용한다')
  scores.set(row.targetId,clamp(row.bonus,-30,30))
 }
 if(!preview){initializeScriptState(w);w.s.scriptState!.mods[modId]=outcome.state;w.s.rng[stream]=[...outcome.rng]}
 return scores
}
