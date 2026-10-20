import type{DefDatabase}from'./defs'
import type{GameState}from'./types'
import{log,type World}from'./ctx'
import{stateActors}from'./missing-statuses'
const headers=new Set(['contentMods','contentAdoptedAt','gameVersion','defSchemaVersion','contentDefinitions','contentItemShapes','contentChanges','log','knowledge','over'])
export function stateStorytellers(s:GameState){return[...new Set([s.storyteller,...Object.values(s.overworld?.scenes??{}).map(x=>x.storyteller)])]}
function purge(s:GameState,ids:Set<string>){
 const counts={scheduled:0,queued:0,callbacks:0}
 for(const st of stateStorytellers(s))if(st.pending&&ids.has(st.pending.event)){delete st.pending;counts.scheduled++}
 const scripts=s.scriptState
 if(scripts?.queuedEvents){const next=scripts.queuedEvents.filter(x=>!ids.has(x.event));counts.queued=scripts.queuedEvents.length-next.length;scripts.queuedEvents=next}
 if(scripts?.eventRuns){const next=scripts.eventRuns.filter(x=>!ids.has(x.event));counts.callbacks=scripts.eventRuns.length-next.length;scripts.eventRuns=next}
 return counts
}
/** 현재 참조만 조사하고 원래 사건/개인/정신/진단 기록은 그대로 둔다. */
export function eventDefinitionReferences(s:GameState,ids:ReadonlySet<string>){
 const refs:{path:string;key:boolean}[]=[],historical=new WeakSet<object>(stateStorytellers(s).map(x=>x.history).filter(x=>Array.isArray(x))),seen=new WeakSet<object>()
 if(s.scriptState&&Array.isArray(s.scriptState.errors))historical.add(s.scriptState.errors)
 for(const c of stateActors(s)){if(Array.isArray(c.history))historical.add(c.history);if(c.npcPsyche&&Array.isArray(c.npcPsyche.history))historical.add(c.npcPsyche.history)}
 const visit=(v:unknown,path:string)=>{if(typeof v==='string'){if(ids.has(v))refs.push({path,key:false});return}if(!v||typeof v!=='object'||seen.has(v)||historical.has(v))return;seen.add(v);for(const[k,x]of Object.entries(v)){if(!path&&headers.has(k))continue;const next=path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1');if(ids.has(k))refs.push({path:next,key:true});visit(x,next)}}
 visit(s,'');return refs
}
/** 사라진 정의의 예약만 사본으로 검사한다. 이미 출발한 인물/과거 사건 기록은 보존한다. */
export function missingEventPlan(s:GameState,db:DefDatabase){
 const removed=Object.entries(s.contentDefinitions??{}).filter(([id,type])=>type==='PlaceEvent'&&!db.has(id)).map(([id,type])=>({id,type})),ids=new Set(removed.map(x=>x.id)),errors:string[]=[]
 if(!ids.size)return{removed,counts:{scheduled:0,queued:0,callbacks:0},errors,preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('사라진 사건의 폐기에는 기록된 서로 다른 구성의 승인이 필요하다')
 const candidate=structuredClone(s),counts=purge(candidate,ids)
 errors.push(...eventDefinitionReferences(candidate,ids).map(ref=>ref.path+': 사라진 사건을 '+(ref.key?'키로 쓰는':'사용하는')+' 현재 참조를 먼저 복원해야 한다'))
 return{removed,counts,errors,preview:candidate}
}
export function applyMissingEvents(w:World):string|null{
 const plan=missingEventPlan(w.s,w.db);if(plan.errors.length)return plan.errors.join('\n');if(!plan.removed.length)return null
 const counts=purge(w.s,new Set(plan.removed.map(x=>x.id)));if(Object.values(counts).some(Boolean))log(w,'info','사라진 사건의 예약과 완료 콜백을 폐기했다',['장소 예약 '+counts.scheduled+' · 스크립트 대기 '+counts.queued+' · 완료 콜백 '+counts.callbacks,'이미 출발한 인물·공급원·과거 사건 기록은 바꾸지 않는다.'])
 return null
}
