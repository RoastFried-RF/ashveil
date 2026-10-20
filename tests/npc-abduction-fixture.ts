import {companionRecoveryFixture} from './companion-recovery-fixture'
import {db} from './helpers'
import {player,tileAt,type World} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type NpcAbductionPhase='ready'|'planned'|'bound'|'escorting'|'home'|'pending'
let template:string|undefined,captorId=0,victimId=0,ropeUid=0
function prepared():World{
 if(template)return{db,s:deserialize(template)}
 const d=companionRecoveryFixture(),{w,s,p,guard:victim,m}=d;d.act({type:'dismissCompanion',target:victim.id})
 const old=m.currentRegion!,region='Region.GreyCloister',scene=m.scenes[region],captor=scene.creatures.find(c=>c.def==='Creature.Reaver')!
 m.scenes[old]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c!==p&&c!==victim),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
 s.map=scene.map;s.maps=scene.maps;s.creatures=[p,victim,...scene.creatures];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell}
 p.pos={x:21,y:26};p.mapId=s.map.id;p.nextAct=s.time;m.society!.reputation.reavers=0
 victim.pos={x:24,y:20};victim.mapId=s.map.id;victim.home={x:24,y:20};victim.ai.mode='surrender';victim.activity=undefined;victim.asleep=false;victim.unconscious=false;victim.nextAct=s.time+2000
 captor.pos={x:20,y:20};captor.mapId=s.map.id;captor.home={x:18,y:20};captor.ai.mode='guard';captor.ai.path=undefined;captor.activity=undefined;captor.asleep=false;captor.unconscious=false;captor.nextAct=s.time+100
 for(const c of [captor,victim])Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,bodyTemp:37})
 for(let y=17;y<=28;y++)for(let x=17;x<=27;x++){const tile=tileAt(w,{x,y});if(tile.cont||tile.placed||tile.items.length)throw Error('initial abduction floor would overwrite an existing object');tile.t='Terrain.Earth';tile.roof=true}
 const rope=makeItem(w,'Item.Rope');if(addToBag(w,captor,rope))throw Error('initial original captor rope does not fit');captorId=captor.id;victimId=victim.id;ropeUid=rope.uid
 invalidateLights(w);updatePlayerVision(w,p);template=serialize(s);return{db:w.db,s:deserialize(template)}
}
export function npcAbductionFixture(phase:NpcAbductionPhase='ready'){
 const w=prepared(),s=w.s,p=player(w),victim=s.creatures.find(c=>c.id===victimId)!,captor=s.creatures.find(c=>c.id===captorId)!,start=s.time
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const proof={phase,originalCaptorId:captor.id,originalVictimId:victim.id,originalRopeUid:ropeUid,originalActorIds:s.creatures.map(c=>c.id),declaredInitialSurrenderPositionsRopeHomeNeedsAndPlayerNeutrality:true,actualPriorCompanionDismissal:true,notClaimingEarlierCombatTravelOrNaturallyMeasuredCaptureRate:true}
 const finish=()=>({w,s,p,victim,captor,act,proof:{...proof,actualWaitTurns:(s.time-start)/100,initialRendererFx:s.fx.splice(0)}})
 if(phase==='ready')return finish()
 if(phase==='pending'){act({type:'rest',turns:40},1);return finish()}
 for(let i=0;i<120;i++){
  act({type:'wait'})
  if(phase==='planned'&&captor.abduction)return finish()
  if(phase==='bound'&&victim.captivity&&!victim.captivity.escort)return finish()
  if(phase==='escorting'&&victim.captivity?.escort)return finish()
  if(phase==='home'&&victim.captivity&&!victim.captivity.anklesFree&&!captor.abduction&&Math.max(Math.abs(captor.pos.x-18),Math.abs(captor.pos.y-20))<=1)return finish()
 }
 throw Error('actual NPC approach/capture/escort did not reach '+phase)
}
