import type{DefDatabase}from'./defs'
import type{GameState}from'./types'
import{log,type World}from'./ctx'
/** 소유 모드가 실제 제거된 데이터만 버린다. 같은 모드의 소스 변경은 별도 이행이 필요하다. */
export function scriptContentPlan(s:GameState,db:DefDatabase){
 const current=Object.fromEntries(db.scriptSources.map(x=>[x.modId,x.hash])),saved=s.scriptState,removed:string[]=[],added=Object.keys(current).filter(id=>!s.mods.includes(id)),errors:string[]=[]
 const counts={states:0,queuedEvents:0,callbacks:0}
 if(!saved)return{removed,added,counts,errors,current}
 const changed=!!s.loadHash&&s.loadHash!==db.loadHash,old=saved.hashes
 for(const[id,hash]of Object.entries(old)){
  if(Object.hasOwn(current,id)){if(current[id]!==hash)errors.push('스크립트 구성: '+id+'의 소스가 바뀌어 원래 소스 복원 또는 별도 상태 이행이 필요하다')}
  else if(changed&&s.mods.includes(id)&&!db.loadedMods.includes(id))removed.push(id)
  else errors.push('스크립트 구성: '+id+'의 소유 모드 제거를 확인할 수 없다')
 }
 for(const id of Object.keys(current))if(!Object.hasOwn(old,id)&&(!changed||!added.includes(id)))errors.push('스크립트 구성: '+id+'의 기록된 소스가 없어 원래 구성을 복원해야 한다')
 for(const id of Object.keys(saved.mods))if(!Object.hasOwn(old,id))errors.push('스크립트 구성: '+id+'의 지속 데이터 소유 기록이 없다')
 for(const pending of saved.queuedEvents??[])if(!Object.hasOwn(old,pending.modId))errors.push('스크립트 구성: 대기 사건의 소유 소스 기록이 없다: '+pending.modId)
 counts.states=removed.filter(id=>Object.hasOwn(saved.mods,id)).length
 counts.queuedEvents=(saved.queuedEvents??[]).filter(x=>removed.includes(x.modId)).length
 const survivors=Object.keys(old).filter(id=>current[id]===old[id])
 counts.callbacks=survivors.length===0?(saved.eventRuns?.length??0):0
 if(added.length&&survivors.length&&(saved.eventRuns?.length??0)>0)errors.push('스크립트 구성: 진행 중 사건의 완료 콜백이 끝난 뒤 새 스크립트 모드를 추가해야 한다')
 return{removed,added,counts,errors:errors.map(message=>'저장된 스크립트 구성과 현재 소스가 다르다. '+message),current}
}
/** 모든 검사를 마친 승인 후보만 수정하며 물리 상태/시각/난수를 보존한다. */
export function applyScriptContentChanges(w:World):string|null{
 const plan=scriptContentPlan(w.s,w.db);if(plan.errors.length)return plan.errors.join('\n');const state=w.s.scriptState
 if(!state||!plan.removed.length&&!plan.added.length)return null
 const removed=new Set(plan.removed)
 for(const id of removed){delete state.hashes[id];delete state.mods[id]}
 for(const id of plan.added)state.hashes[id]=plan.current[id]
 state.disabled=state.disabled.filter(key=>!plan.removed.some(id=>key.startsWith(id+':')))
 state.errors=state.errors.filter(x=>!removed.has(x.modId))
 if(state.queuedEvents)state.queuedEvents=state.queuedEvents.filter(x=>!removed.has(x.modId))
 if(plan.counts.callbacks&&state.eventRuns)state.eventRuns=[]
 if(plan.removed.length)log(w,'info','제거한 모드의 스크립트 지속 데이터와 대기 실행을 폐기했다',[
  plan.removed.join(', '),'지속 데이터 '+plan.counts.states+' · 대기 사건 '+plan.counts.queuedEvents+' · 완료 콜백 '+plan.counts.callbacks,
 ])
 return null
}
