// 지식은 실제 효과를 바꾸지 않는다. 완료/목격/온전한 독서/들은 소식에서만 배운다.
import {bodyDef,capacity} from './body'
import {log,turnOf,type World} from './ctx'
import {canSee,hasLos} from './fov'
import {rememberLifeEvent} from './life-memories'
import {waterSafetyDef} from './water-state'
import type {Pos} from './geom'
import type {Creature,InteractionDef,InteractionDiscovery,InteractionEvent} from './types'
export const interactionList=(w:World,c:Creature):InteractionDiscovery[]=>c.id===w.s.playerId?w.s.knowledge.interactions??[]:c.knownInteractions??[]
function aware(w:World,c:Creature){return w.s.creatures.includes(c)&&c.alive&&!c.asleep&&!c.unconscious&&bodyDef(w,c).kind==='humanoid'&&capacity(w,c,'consciousness')>=.5}
export function learnInteraction(w:World,c:Creature,id:string,method:InteractionDiscovery['method'],source:string):boolean{
 const d=w.db.tryGet<InteractionDef>(id);if(!d||d.defType!=='Interaction'||!aware(w,c)||interactionList(w,c).some(x=>x.id===id))return false
 const record:InteractionDiscovery={id,at:turnOf(w),method,source,map:w.s.map.id,region:w.s.overworld?.currentRegion}
 if(c.id===w.s.playerId)(w.s.knowledge.interactions??=[]).push(record);else(c.knownInteractions??=[]).push(record)
 rememberLifeEvent(w,c,'interaction')
 if(c.id===w.s.playerId)log(w,'good','알아냈다: '+d.label+'. 일지의 상호작용에 기록했다.')
 return true
}
/** 이 함수는 실제 완료한 효과 경로에서만 호출한다. 견적/실패 경로에는 넣지 않는다. */
export function experienceInteraction(w:World,c:Creature,event:InteractionEvent,source:string){
 for(const d of w.db.all<InteractionDef>('Interaction').filter(d=>d.event===event))learnInteraction(w,c,d.id,'experience',source)
}
export function completeInteraction(w:World,c:Creature,event:InteractionEvent,source:string,pos:Pos=c.pos){
 experienceInteraction(w,c,event,source);witnessInteraction(w,event,pos,source,c)
}
/** 현재 지도에서 실제로 보이는 발생 지점만 목격한다. 저장된 원격 지도를 조회하지 않는다. */
export function witnessInteraction(w:World,event:InteractionEvent,pos:Pos,source:string,actor?:Creature){
 for(const c of w.s.creatures){if(c===actor||!aware(w,c)||capacity(w,c,'sight')<=0||!canSee(w,c,pos)||!hasLos(w,c.pos,pos))continue
  for(const d of w.db.all<InteractionDef>('Interaction').filter(d=>d.event===event))learnInteraction(w,c,d.id,'witness',source)
 }
}
export function interactionRows(w:World,c:Creature){
 const known=interactionList(w,c)
 return w.db.all<InteractionDef>('Interaction').map(d=>{const record=known.find(r=>r.id===d.id);let formula:string|undefined
  if(record){formula=d.formula;if(d.waterTreatment){const q=waterSafetyDef(w).treatments[d.waterTreatment];formula+=' 병원체 ×'+q.pathogenMult+' · 재 ×'+q.ashMult+' · 녹은 소금은 남음.'}}
  return{id:d.id,category:d.category,label:record?d.label:'???',formula,record}
 })
}
