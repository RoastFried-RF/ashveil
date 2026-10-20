// 현재 실제로 서 있는 방/계단만 개인 기록에 남긴다. 플레이어의 탐험/쪽지/원격 방을 복사하지 않는다.
import {inBounds,tileAt,turnOf,type World} from './ctx'
import {canObserveTerrain} from './fov'
import type {Creature,NpcMapMemory} from './types'
export function fieldMapRegion(w:World){const o=w.s.overworld;return o?(o.currentRegion??`@${o.position.x},${o.position.y}`):undefined}
export function npcFieldMap(w:World,c:Creature):NpcMapMemory|undefined{return c.fieldMaps?.find(m=>m.region===fieldMapRegion(w)&&m.mapId===w.s.map.id)}
/** 미래/잘못된 시각을 과거의 직접 기록으로 작성하지 않는다. 원본 기억은 변경하지 않는다. */
export function npcRecordedMap(w:World,c:Creature):NpcMapMemory|undefined{const m=npcFieldMap(w,c);if(!m)return;const valid=(r:{seenAt:number})=>Number.isFinite(r.seenAt)&&r.seenAt>=0&&r.seenAt<=turnOf(w);return{...m,rooms:m.rooms.filter(valid),stairs:m.stairs.filter(valid),...(m.landmarks?{landmarks:m.landmarks.filter(valid)}:{})}}
export function observeNpcMap(w:World,c:Creature){
 if(c.id===w.s.playerId||!c.alive||c.asleep||c.unconscious||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||w.db.body(c.body.def).kind!=='humanoid'||!inBounds(w,c.pos))return
 const m=w.s.map,t=tileAt(w,c.pos),inside=(r:typeof m.rooms[number])=>c.pos.x>=r.x&&c.pos.y>=r.y&&c.pos.x<r.x+r.w&&c.pos.y<r.y+r.h,indexed=t.room===undefined?undefined:m.rooms[t.room],roomIndex=indexed&&inside(indexed)?t.room!:m.rooms.findIndex(inside),r=roomIndex>=0?m.rooms[roomIndex]:undefined,terrain=w.db.terrain(t.t),old=npcFieldMap(w,c)
 const previous=r&&old?.rooms.find(v=>v.roomIndex===roomIndex),newRoom=!!r&&(!previous||previous.name!==r.name||previous.type!==r.type||previous.x!==r.x||previous.y!==r.y||previous.w!==r.w||previous.h!==r.h)
 const stair=old?.stairs.find(s=>s.x===c.pos.x&&s.y===c.pos.y),newStair=!!terrain.stairs&&(!stair||stair.terrain!==t.t||stair.label!==terrain.label)
 const landmark=old?.landmarks?.find(s=>s.x===c.pos.x&&s.y===c.pos.y),newLandmark=m.kind==='surface'&&!!(terrain.water||terrain.waterSource)&&(!landmark||landmark.terrain!==t.t||landmark.label!==terrain.label)
 if(!newRoom&&!newStair&&!newLandmark||!canObserveTerrain(w,c))return
 const memory:NpcMapMemory=old??{region:fieldMapRegion(w),mapId:m.id,name:m.name,kind:m.kind,depth:m.depth,w:m.w,h:m.h,rooms:[],stairs:[]}
 if(!old)(c.fieldMaps??=[]).push(memory)
 const at=turnOf(w)
 if(newRoom){const entry={roomIndex,type:r!.type,name:r!.name,x:r!.x,y:r!.y,w:r!.w,h:r!.h,seenAt:at},index=memory.rooms.findIndex(v=>v.roomIndex===roomIndex);if(index<0)memory.rooms.push(entry);else memory.rooms[index]=entry}
 if(newStair){const entry={...c.pos,terrain:t.t,label:terrain.label,seenAt:at},index=memory.stairs.findIndex(s=>s.x===c.pos.x&&s.y===c.pos.y);if(index<0)memory.stairs.push(entry);else memory.stairs[index]=entry}
 if(newLandmark){const entries=memory.landmarks??=[],entry={...c.pos,kind:'water' as const,terrain:t.t,label:terrain.label,seenAt:at},index=entries.findIndex(s=>s.x===c.pos.x&&s.y===c.pos.y);if(index>=0)entries[index]=entry;else if(entries.length<128)entries.push(entry)}
}
