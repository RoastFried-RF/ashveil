import {companionRecoveryFixture} from './companion-recovery-fixture'
import {db} from './helpers'
import {player,tileAt,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {activityStep} from '../src/core/actions'
import {startPrisonerAction} from '../src/core/prisoners'
import {playerAct} from '../src/core/game'
import {killCreature} from '../src/core/combat'
import {dirIndex,cheb} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
export type PrisonerMemoryPhase='unseen'|'observed'|'released'|'dead'|'stale'|'pending'
let template:string|undefined,captorId=0,victimId=0,ropeId=0
function prepared():World{
 if(template)return{db,s:deserialize(template)}
 const d=companionRecoveryFixture(),s=d.s,m=d.m,old=m.currentRegion!,region='Region.GreyCloister',scene=m.scenes[region],captor=scene.creatures.find(c=>c.def==='Creature.Reaver')!,victim=d.guard
 m.scenes[old]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c!==d.p&&c!==victim),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
 s.map=scene.map;s.maps=scene.maps;s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;s.creatures=[d.p,victim,...scene.creatures];m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell}
 d.p.pos={x:21,y:32};d.p.mapId=s.map.id;d.p.nextAct=s.time;victim.pos={x:21,y:20};victim.mapId=s.map.id;victim.unconscious=true;victim.activity=undefined;victim.nextAct=s.time+28800*100
 // 기존 등불의 초기 소지자를 플레이어로 선언한다. 시신 자체가 계속 빛난다고 가정하지 않는다.
 d.p.equip.off=victim.equip.off;delete victim.equip.off
 captor.pos={x:20,y:20};captor.mapId=s.map.id;captor.asleep=false;captor.unconscious=false;captor.activity=undefined;captor.ai.mode='guard';captor.nextAct=s.time+28800*100;captor.needs.fatigue=10
 for(let y=17;y<=34;y++)for(let x=17;x<=27;x++){const tile=tileAt(d.w,{x,y});if(tile.cont||tile.placed||tile.items.length)throw Error('declared initial sighting floor would overwrite an existing object');tile.t='Terrain.Earth';tile.roof=true}
 const rope=makeItem(d.w,'Item.Rope');if(addToBag(d.w,captor,rope))throw Error('declared initial captor rope does not fit')
 const error=startPrisonerAction(d.w,captor,victim,'bind',rope.uid);if(error)throw Error(error);for(let i=0;captor.activity&&i<20;i++)activityStep(d.w,captor);if(!victim.captivity)throw Error('actual original guard binding did not finish')
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);captorId=captor.id;victimId=victim.id;ropeId=rope.uid;template=serialize(s);return{db:d.w.db,s:deserialize(template)}
}
export function prisonerMemoryFixture(phase:PrisonerMemoryPhase='unseen'){
 const w=prepared(),s=w.s,p=player(w),victim=s.creatures.find(c=>c.id===victimId)!,captor=s.creatures.find(c=>c.id===captorId)!
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const proof={phase,originalVictimId:victim.id,originalCaptorId:captor.id,originalRopeUid:ropeId,originalLampUid:p.equip.off?.uid,originalActorIds:s.creatures.map(c=>c.id),declaredInitialCaptivityObservationPositionsAndLampHolder:true,notClaimingEarlierInterregionTravelOrAttackHistory:true}
 const finish=()=>({w,s,p,victim,captor,act,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='unseen')return finish()
 for(let i=0;!s.knowledge.prisonerSightings?.[victim.id]&&i<30;i++)act({type:'move',dir:0})
 if(!s.knowledge.prisonerSightings?.[victim.id])throw Error('actual public approach did not identify original bound guard')
 if(phase==='observed')return finish()
 if(phase==='stale'){
  p.pos={x:21,y:32};invalidateLights(w);updatePlayerVision(w,p);victim.pos={x:24,y:20};killCreature(w,victim,'선언한 원격 초기 변화');return finish()
 }
 if(phase==='dead'){killCreature(w,victim,'선언한 현장 사망');act({type:'wait'});return finish()}
 for(let i=0;cheb(p.pos,victim.pos)>1&&i<20;i++)act({type:'move',dir:dirIndex(Math.sign(victim.pos.x-p.pos.x),Math.sign(victim.pos.y-p.pos.y))})
 act({type:'prisoner',operation:'release',target:victim.id})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return finish()
}
