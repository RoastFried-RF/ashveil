import {npcCareFixture} from './npc-care-fixture'
import {findPath} from '../src/core/path'
import {cheb,dirIndex,DIRS} from '../src/core/geom'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {canSee} from '../src/core/fov'
export function npcCareBondsFixture(phase:'ready'|'heard'|'stale'|'pending'='ready'){
 const d=npcCareFixture('done');let approachMoves=0,preparedWaits=0
 // 완료된 실제 NPC 처치 뒤 보이는 원래 당사자에게 공개 입력으로 접근한다.
 while(cheb(d.p.pos,d.a.pos)>1&&approachMoves<20){
  if(!canSee(d.w,d.p,d.a.pos))throw Error('actual care witness cannot see original healer')
  const goals=DIRS.map(o=>({x:d.a.pos.x+o.x,y:d.a.pos.y+o.y})).filter(p=>p.x>=0&&p.y>=0&&p.x<d.s.map.w&&p.y<d.s.map.h&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p)),paths=goals.map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter(p=>p?.length).sort((a,b)=>a!.length-b!.length),next=paths[0]?.[0];if(!next)throw Error('actual healer approach unavailable')
  d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});approachMoves++
 }
 if(cheb(d.p.pos,d.a.pos)>1)throw Error('actual care witness approach incomplete')
 while(d.a.activity&&preparedWaits<30){d.act({type:'wait'});preparedWaits++}
 if(d.a.activity)throw Error('actual doctor still busy after own care hygiene')
 if(phase!=='ready')d.act({type:'talk',target:d.a.id})
 if(phase==='stale'){d.b.pos={x:12,y:30};d.b.name='다시 듣지 못한 현재 이름';d.b.npcIdentity!.name=d.b.name;d.b.body.wounds=[];d.a.npcTies![d.b.id].score=90}
 if(phase==='pending')d.act({type:'rest',turns:20},1)
 return{...d,proof:{...d.proof,phase,declaredInitialUnseenPrivateChange:phase==='stale',actualPreparedVisibleApproachMoves:approachMoves,actualPreparedWaitsForDoctor:preparedWaits,initialRendererFx:d.s.fx.splice(0)}}
}
