// 실제 완료한 생활 사건의 기억. 조회는 기억/시간/난수/물품을 만들지 않는다.
import type {World} from './ctx'
import {addThought} from './thoughts'
import {traitOverride} from './traits'
import type {BodyPartDef,Creature,ThoughtDef} from './types'
export type LifeEvent=NonNullable<ThoughtDef['lifeEvent']>
export const lifeMemoryThoughts=(w:World,event:LifeEvent)=>w.db.all<ThoughtDef>('Thought').filter(d=>d.lifeEvent===event)
export function rememberLifeEvent(w:World,c:Creature,event:LifeEvent,context?:{quality?:number;disease?:string;roomType?:string;tradeGain?:number;threatRatio?:number;part?:BodyPartDef;opinion?:number}){
 for(const d of lifeMemoryThoughts(w,event)){
  if(d.minEventQuality!==undefined&&(context?.quality===undefined||context.quality<d.minEventQuality)||d.eventBackground!==undefined&&c.background!==d.eventBackground||d.eventDisease!==undefined&&context?.disease!==d.eventDisease||d.minEventThreatRatio!==undefined&&(context?.threatRatio===undefined||context.threatRatio<d.minEventThreatRatio)||d.minEventTradeGain!==undefined&&(context?.tradeGain===undefined||context.tradeGain<d.minEventTradeGain)||d.eventRoomTypes!==undefined&&(!context?.roomType||!d.eventRoomTypes.includes(context.roomType)))continue
  if(d.eventOpinion&&(!Number.isFinite(context?.opinion)||!context?.opinion))continue
  const face=d.faceEvent&&context?.part&&!context.part.internal&&context.part.groups.some(g=>d.faceEvent!.groups.includes(g))?d.faceEvent:undefined
  const override=face?(face.traitMoodKey?traitOverride(w,c,face.traitMoodKey):undefined)??face.mood:d.traitMoodKey?traitOverride(w,c,d.traitMoodKey):undefined
  addThought(w,c,d.id,d.eventOpinion?(override??d.mood)*Math.sign(context!.opinion!):override)
 }
}
