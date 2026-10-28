// 장소의 실제 출발지/편성/경유/대기 규칙. 콘텐츠 조회가 인원이나 좌표를 만들지 않는다.
import type {World} from './ctx'
import type {Creature,MapState,PlaceEventRule,PlaceEventDef} from './types'
import type {Pos} from './geom'
import {sourceDefinitionsAvailable} from './population-sources'
export function placeEventRule(w:World,id:string):PlaceEventRule|undefined{const e=w.db.tryGet<PlaceEventDef>(id);return e?.defType==='PlaceEvent'&&e.place&&e.origin?.kind==='camp'&&e.composition?.count?{...e.place,origin:e.origin,count:e.composition.count}:undefined}
export function placeEventMembers(w:World,cs:Creature[],id:string){
 const faction=placeEventRule(w,id)?.origin.faction??'reavers'
 return cs.filter(c=>c.alive&&c.faction===faction&&c.ai.mode!=='flee'&&c.ai.mode!=='surrender')
}
export function placeRoute(w:World,map:MapState,id:string,c:Creature,trace?:Pos,stash?:Pos){
 const rule=placeEventRule(w,id),home=c.home??map.waypoints?.[rule?.origin.waypoint??'reaverCamp'],keys=rule?.route??(id==='Event.ReaverPatrol'?['stream','monastery','@home']:['@trace','@stash','@home']),route:Pos[]=[]
 if(!map.waypoints?.[rule?.origin.waypoint??'reaverCamp'])return
 for(const key of keys){if(key==='@stash'&&!stash)continue;const pos=key==='@home'?home:key==='@trace'?trace:key==='@stash'?stash:map.waypoints?.[key];if(!pos)return;route.push({...pos})}
 return route.length?route:undefined
}
export const placePatrolWait=(w:World,c:Creature)=>placeEventRule(w,c.ai.placeEvent??(c.ai.task?.kind==='search'?'Event.ReaverSearch':'Event.ReaverPatrol'))?.waitTurns??600

/** 새 종류는 실제 현재 지도 공급원에 명시된 원래 구성원만 사용한다. */
export function scriptedPlaceSource(w:World,id:string){
 const e=w.db.tryGet<PlaceEventDef>(id),rule=placeEventRule(w,id);if(!e?.worker||!rule||w.s.map.kind!=='surface'||!w.s.map.waypoints?.[rule.origin.waypoint])return
 const source=w.s.sources?.find(s=>s.id===rule.origin.waypoint&&s.floors.includes(w.s.map.id)&&!s.closed&&s.members?.length)
 if(!source||!sourceDefinitionsAvailable(w,source)||(source.faction??w.db.creature(source.species).faction)!==rule.origin.faction)return
 return{event:e,rule,source}
}
export function supportsQueuedPlaceEvent(w:World,id:string){return id==='Event.ReaverPatrol'||id==='Event.ReaverSearch'?!!placeEventRule(w,id):!!scriptedPlaceSource(w,id)}
