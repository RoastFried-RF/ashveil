import type{DefDatabase}from'./defs'
import type{GameState}from'./types'
import{stateStorytellers,eventDefinitionReferences}from'./missing-events'
function mutate(s:GameState,aliases:ReadonlyMap<string,string>){
 const counts={scheduled:0,queued:0,callbacks:0}
 for(const st of stateStorytellers(s)){const to=st.pending&&aliases.get(st.pending.event);if(to){st.pending!.event=to;counts.scheduled++}}
 for(const x of s.scriptState?.queuedEvents??[]){const to=aliases.get(x.event);if(to){x.event=to;counts.queued++}}
 for(const x of s.scriptState?.eventRuns??[]){const to=aliases.get(x.event);if(to){x.event=to;counts.callbacks++}}
 return counts
}
/** 예약/완료 콜백의 같은 기록만 옮기고 과거 사건과 실제 인원은 바꾸지 않는다. */
export function eventRenamePlan(s:GameState,db:DefDatabase){
 const aliases=new Map<string,string>(),renamed:{from:string;to:string}[]=[],errors:string[]=[]
 for(const[from,to]of Object.entries(db.definitionRenames)){if(s.contentDefinitions?.[from]!=='PlaceEvent')continue;if(db.tryGet(to)?.defType!=='PlaceEvent'){errors.push(from+' → '+to+': 사건 ID 이행 목적지의 종류가 다르다');continue}aliases.set(from,to);renamed.push({from,to})}
 if(!aliases.size)return{aliases,renamed,errors,counts:{scheduled:0,queued:0,callbacks:0},preview:undefined as GameState|undefined}
 if(!s.loadHash||s.loadHash===db.loadHash)errors.push('사건 ID 이행은 기록된 서로 다른 구성의 승인이 필요하다')
 const preview=structuredClone(s),counts=mutate(preview,aliases)
 errors.push(...eventDefinitionReferences(preview,new Set(aliases.keys())).map(ref=>ref.path+': 지원하지 않는 사건 ID '+(ref.key?'키':'참조')+'의 별도 이행이 필요하다'))
 return{aliases,renamed,errors,counts,preview}
}
export function applyEventRenames(s:GameState,db:DefDatabase):string|null{const plan=eventRenamePlan(s,db);if(plan.errors.length)return plan.errors.join('\n');if(plan.aliases.size)mutate(s,plan.aliases);return null}
