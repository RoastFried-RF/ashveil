// 등록된 장소 워커도 기존 출발지·인원·경로를 통과한 현재 사건에서만 호출한다.
import {rng,type World} from './ctx'
import {allowedScriptCommands,applyScriptCommands,scriptWoundDepth} from './script-commands'
import {disableScriptCall,initializeScriptState,scriptContextView} from './script-hooks'
import {validScriptJson,type ScriptCall,type ScriptJson} from './script-contracts'
export function runPlaceEventWorker(w:World,eventId:string,method:'canFire'|'execute',actorIds:number[],preview=false):boolean{
 const ref=w.db.event(eventId).worker;if(!ref)return true
 const [modId,name]=ref.split(':'),module=w.db.scriptModules.find(m=>m.modId===modId)
 if(!module||!w.db.scriptHost?.invokeWorker||!module.workers?.some(r=>r.name===name&&r.kind==='PlaceEventWorker'))return false
 const call:ScriptCall=`worker.${name}.${method}`,key=modId+':'+call
 if(w.s.scriptState?.disabled.includes(key))return false
 const state=w.s.scriptState?.mods[modId]??{},event={event:eventId,actorIds:[...new Set(actorIds)].sort((a,b)=>a-b),members:new Set(actorIds).size}as Record<string,ScriptJson>,{targets,view}=scriptContextView(w,event),stream=`mod.${modId}.${call}`as const,prior=w.s.rng[stream],shadow:World={db:w.db,s:{...w.s,rng:{...w.s.rng,...(prior?{[stream]:[...prior]}:{})}}}
 const fail=(reason:string)=>{if(!preview){initializeScriptState(w);disableScriptCall(w,modId,call,reason)}return false}
 if(!validScriptJson(state))return fail('저장된 워커 데이터 형식 오류')
 const outcome=w.db.scriptHost.invokeWorker({module,worker:name,method,event,view,state,rng:rng(shadow,stream).s})
 if(!outcome.ok)return fail(outcome.reason)
 if(!validScriptJson(outcome.state)||!validScriptJson(outcome.result)||method==='canFire'&&typeof outcome.result!=='boolean')return fail('워커 반환 데이터 형식 오류')
 const commands=method==='canFire'?[]:allowedScriptCommands(w,outcome.result,targets,scriptWoundDepth(w))
 if(!commands)return fail('허용하지 않는 워커 명령 또는 대상')
 if(!preview){initializeScriptState(w);w.s.scriptState!.mods[modId]=outcome.state;w.s.rng[stream]=[...outcome.rng];applyScriptCommands(w,commands,modId)}
 return method==='canFire'?outcome.result===true:true
}
