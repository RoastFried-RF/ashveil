import {companionCartographyFixture} from './companion-cartography-fixture'
import {cheb,dirIndex} from '../src/core/geom'
import {addToBag} from '../src/core/items'
import {turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {npcFieldMap} from '../src/core/npc-map-memory'
import type {Rumor} from '../src/core/types'
export function scoutRoomFixture(){
 const d=companionCartographyFixture(),roomIndex=d.s.map.rooms.findIndex(r=>r.type==='ruin'),room=d.s.map.rooms[roomIndex]!
 const cell=d.s.map.tiles.findIndex((t,i)=>t.room===roomIndex&&d.w.db.terrain(t.t).stairs&&d.w.db.terrain(t.t).passable&&i%d.s.map.w>=room.x&&Math.floor(i/d.s.map.w)>=room.y)
 if(cell<0)throw Error('원래 수도원 계단')
 d.npc.pos={x:cell%d.s.map.w,y:Math.floor(cell/d.s.map.w)};d.npc.companion!.order='follow';d.npc.companion!.anchor={...d.npc.pos};d.npc.companion!.lastLeader={...d.p.pos}
 // 이 장면은 처음부터 실제 수도원에 떨어져 있던 유효 초기 동료가 돌아오는 과정이다. 출발까지 실행했다고 쓰지 않는다.
 for(const it of [...d.npc.bag]){d.npc.bag=d.npc.bag.filter(i=>i!==it);delete it.gx;delete it.gy;delete it.rot;if(addToBag(d.w,d.p,it))throw Error('초기 원래 재료')}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return{...d,roomIndex,room,initialNpcPos:{...d.npc.pos}}
}
export type ScoutRoomPhase='distant'|'returned'|'heard'|'conflict'|'pending'
export function scoutRoomNativeFixture(phase:ScoutRoomPhase,initialSetup?:(d:ReturnType<typeof scoutRoomFixture>)=>void){
 const d=scoutRoomFixture(),initialTime=d.s.time
 initialSetup?.(d)
 if(phase==='conflict'){
  const r=d.room,claim:Rumor={id:'initial-old-abbey-map',kind:'map',mapId:d.s.map.id,mapDepth:0,roomIdx:d.roomIndex,roomName:r.name,source:'이전에 읽은 행상 지도',text:'행상이 전한 오래된 위치다.',hop:0,writtenAt:0,foundAt:0,mapDocument:{title:'오래된 수도원 약도',author:'이전 행상',mapId:d.s.map.id,kind:'surface',depth:0,w:d.s.map.w,h:d.s.map.h,writtenAt:0,reliability:40,error:3,rooms:[{roomIndex:d.roomIndex,name:r.name,x:r.x+2,y:r.y,w:r.w,h:r.h}]}}
  // 실제 전에 읽은 유효 초기 기록이며 과거 독서 입력을 실행했다고 주장하지 않는다.
  d.s.knowledge.rumors!.push(claim)
 }
 if(phase!=='distant'){
  for(let i=0;i<200&&cheb(d.npc.pos,d.p.pos)>2;i++)d.act({type:'wait'})
  if(cheb(d.npc.pos,d.p.pos)>2)throw Error('실제 동료가 귀환하지 않았다')
  for(let i=0;i<8&&cheb(d.npc.pos,d.p.pos)>1;i++)d.act({type:'move',dir:dirIndex(Math.sign(d.npc.pos.x-d.p.pos.x),Math.sign(d.npc.pos.y-d.p.pos.y))})
  d.act({type:'wait'})
  if(!npcFieldMap(d.w,d.npc)?.rooms.some(r=>r.roomIndex===d.roomIndex))throw Error('실제 원래 방 관찰 없음')
 }
 if(['heard','conflict','pending'].includes(phase))d.act({type:'talk',target:d.npc.id})
 if(phase==='pending')d.act({type:'rest',turns:20},2)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,npcId:d.npc.id,initialNpcPos:d.initialNpcPos,netReturnDistance:Math.max(Math.abs(d.npc.pos.x-d.initialNpcPos.x),Math.abs(d.npc.pos.y-d.initialNpcPos.y)),roomIndex:d.roomIndex,actualRoomObservationAt:npcFieldMap(d.w,d.npc)?.rooms.find(r=>r.roomIndex===d.roomIndex)?.seenAt,playerStillNotDiscovered:!d.room.discovered,currentTurn:turnOf(d.w),pending:phase==='pending',initialDistantCompanionExplicit:true}}
}
