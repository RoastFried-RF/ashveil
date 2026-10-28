// 동료가 실제 그 자리에서 기록한 방만, 현재 실제 대화로 전한다. 원격 현재 지형/주민/물품은 조회하지 않는다.
import {capacity} from './body'
import {isCompanion} from './companion-state'
import {hostile} from './diplomacy'
import {hasLos} from './fov'
import {cheb} from './geom'
import {fieldMapRegion} from './npc-map-memory'
import {learnRumor} from './rumor-state'
import {log,turnOf,type World} from './ctx'
import type {Creature,Rumor} from './types'
export function hearScoutRooms(w:World,listener:Creature,speaker:Creature):number{
 if(!isCompanion(w,speaker)||speaker.companion!.employer!==listener.id||!w.s.creatures.includes(listener)||!w.s.creatures.includes(speaker)||!listener.alive||!speaker.alive||listener.asleep||speaker.asleep||listener.unconscious||speaker.unconscious||capacity(w,listener,'consciousness')<.5||capacity(w,speaker,'consciousness')<.5||capacity(w,listener,'hearing')<.2||capacity(w,speaker,'hearing')<.2||cheb(listener.pos,speaker.pos)>1||!hasLos(w,listener.pos,speaker.pos)||hostile(w,listener,speaker))return 0
 let count=0
 for(const map of speaker.fieldMaps??[]){
  if(map.region!==fieldMapRegion(w))continue
  for(const room of map.rooms){
   if(!Number.isFinite(room.seenAt)||room.seenAt<0||room.seenAt>turnOf(w))continue
   const rumor:Rumor={id:`scout-room:${w.s.seed}:${speaker.id}:${map.region??'local'}:${map.mapId}:${room.roomIndex??room.name}:${room.seenAt}`,kind:'room',regionId:map.region,mapId:map.mapId,mapDepth:map.depth,mapW:map.w,mapH:map.h,roomIdx:room.roomIndex,roomName:room.name,rect:{x:room.x,y:room.y,w:room.w,h:room.h},source:speaker.name+'의 직접 정찰',hop:0,writtenAt:room.seenAt,foundAt:turnOf(w),text:`“${map.name}: ${room.name} 위치를 기억한다.” — 동료가 실제로 본 방의 당시 기록`}
   if(!learnRumor(w,listener,rumor))continue
   count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 정찰 이야기를 들었다. '+rumor.text)
  }
  for(const stair of map.stairs){
   if(!Number.isFinite(stair.seenAt)||stair.seenAt<0||stair.seenAt>turnOf(w))continue
   const rumor:Rumor={id:`scout-stairs:${w.s.seed}:${speaker.id}:${map.region??'local'}:${map.mapId}:${stair.x},${stair.y}:${stair.terrain}:${stair.seenAt}`,kind:'stairs',regionId:map.region,mapId:map.mapId,mapDepth:map.depth,mapW:map.w,mapH:map.h,stair:{x:stair.x,y:stair.y,terrain:stair.terrain,label:stair.label},source:speaker.name+'의 직접 정찰',hop:0,writtenAt:stair.seenAt,foundAt:turnOf(w),text:`“${map.name}: ${stair.label} 위치를 기억한다.” — 동료가 실제로 본 계단의 당시 기록`}
   if(!learnRumor(w,listener,rumor))continue
   count++;if(listener.id===w.s.playerId)log(w,'info',speaker.name+'에게 계단 이야기를 들었다. '+rumor.text)
  }
 }
 return count
}
