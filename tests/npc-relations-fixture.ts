import {npcSocialFixture} from './npc-social-fixture'
import {heardNpcRelationships} from '../src/core/npc-relations'
import {findPath} from '../src/core/path'
import {cheb,DIRS,dirIndex} from '../src/core/geom'
import {creatureAt,inBounds,terrainAt} from '../src/core/ctx'
import {updatePlayerVision} from '../src/core/fov'
export type NpcRelationPhase='listen'|'heard'|'stale'|'pending'
export function npcRelationsFixture(phase:NpcRelationPhase='listen',hidden=false,clash=false){
 const d=npcSocialFixture(hidden,clash),start=d.s.time;d.act({type:'wait'});if(!d.a.npcTies?.[d.b.id])throw Error('actual source first-hand NPC conversation missing')
 let walked=0
 while(cheb(d.p.pos,d.a.pos)>1&&walked<120){const goals=DIRS.map(dir=>({x:d.a.pos.x+dir.x,y:d.a.pos.y+dir.y})).filter(p=>inBounds(d.w,p)&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p)),paths=goals.map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter(p=>p?.length).sort((a,b)=>a!.length-b!.length),next=paths[0]?.[0];if(!next)throw Error('actual approach to source unavailable');d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});walked++}
 if(cheb(d.p.pos,d.a.pos)>1)throw Error('actual approach to source incomplete')
 const proof={...d.proof,declaredUnseenPrivateChange:phase==='stale',actualPreparationNpcWaitTurns:1,actualPreparationWalkTurns:walked,actualPreparationTU:d.s.time-start,originalDirectNpcContactAt:d.a.npcTies[d.b.id].lastAt,phase}
 const finish=()=>({...d,proof:{...proof,initialRendererFx:[...proof.initialRendererFx,...d.s.fx.splice(0)]},report:heardNpcRelationships(d.w,d.a.id)})
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 if(phase==='listen')return finish()
 d.act({type:'talk',target:d.a.id});if(!heardNpcRelationships(d.w,d.a.id))throw Error('actual player conversation did not hear original private neighbor memory')
 if(phase==='stale'){
  // 별도의 선언한 숨은 초기 변화 장면이다. 과거 이웃의 이동/사건/친밀도 획득으로 주장하지 않는다.
  d.b.pos={x:12,y:30};d.b.name='나중에 바뀐 숨은 이름';if(d.b.npcIdentity)d.b.npcIdentity.name=d.b.name;d.b.unconscious=true;d.a.npcTies[d.b.id].score=30
  updatePlayerVision(d.w,d.p)
 }
 return finish()
}
