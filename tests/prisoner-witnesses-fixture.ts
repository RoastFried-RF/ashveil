import {prisonerMemoryFixture} from './prisoner-memory-fixture'
import {player,tileAt,type World} from '../src/core/ctx'
import {addToBag} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {killCreature} from '../src/core/combat'
import {db} from './helpers'
export type PrisonerWitnessPhase='private'|'ready'|'heard'|'stale'|'direct'|'offer'|'pending'
let template:string|undefined,witnessId=0,victimId=0
function prepared():World{
 if(template)return{db,s:deserialize(template)}
 const d=prisonerMemoryFixture(),{w,s,p,victim}=d,town=s.overworld!.scenes['Region.ShepherdDale'],witness=town.creatures.find(c=>c.traderSite==='Region.ShepherdDale')!
 town.creatures=town.creatures.filter(c=>c!==witness);s.creatures.push(witness);witness.mapId=s.map.id;witness.pos={x:22,y:20};witness.home={...witness.pos};witness.asleep=false;witness.unconscious=false;witness.activity=undefined;witness.ai.mode='guard';witness.nextAct=s.time+100
 if(witness.equip.off){const it=witness.equip.off;delete witness.equip.off;if(addToBag(w,witness,it))throw Error('original witness offhand cannot fit in own bag')}
 witness.equip.off=p.equip.off;delete p.equip.off;Object.assign(witness.needs,{kcal:1000,waterDeficit:0,fatigue:10,bodyTemp:37})
 invalidateLights(w);updatePlayerVision(w,p);for(let i=0;!witness.prisonerSightings?.[victim.id]&&i<3;i++){const error=playerAct(w,{type:'wait'});if(error)throw Error(error)}
 if(!witness.prisonerSightings?.[victim.id]||s.knowledge.prisonerSightings?.[victim.id])throw Error('actual witness-only first observation was not private')
 witnessId=witness.id;victimId=victim.id;template=serialize(s);return{db:w.db,s:deserialize(template)}
}
export function prisonerWitnessesFixture(phase:PrisonerWitnessPhase='ready'){
 const w=prepared(),s=w.s,p=player(w),witness=s.creatures.find(c=>c.id===witnessId)!,victim=s.creatures.find(c=>c.id===victimId)!,at=witness.prisonerSightings![victim.id]!.at
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const proof={phase,originalWitnessId:witness.id,originalVictimId:victim.id,originalActorIds:s.creatures.map(c=>c.id),actualWitnessObservationAt:at,declaredInitialWitnessLocationLampHolderAndConversationLocation:true,notClaimingWitnessInterregionJourneyOrNaturalAbductionHistory:true}
 const finish=()=>({w,s,p,witness,victim,act,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='private')return finish()
 witness.pos={x:21,y:31};witness.home={...witness.pos};witness.nextAct=s.time+28800*100;invalidateLights(w);updatePlayerVision(w,p)
 if(phase==='ready')return finish()
 if(phase==='pending'){act({type:'rest',turns:20},1);return finish()}
 act({type:'talk',target:witness.id});if(!s.knowledge.prisonerSightings?.[victim.id]?.heard)throw Error('actual adjacent conversation did not pass original witness record')
 if(phase==='heard')return finish()
 if(phase==='offer'){
  const m=s.overworld!,region='Region.ShepherdDale',scene=m.scenes[region]
  m.scenes[m.currentRegion!]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c!==p&&c!==witness),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
  s.map=scene.map;s.maps=scene.maps;s.creatures=[p,witness,...scene.creatures];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell};witness.pos={x:30,y:18};p.pos={x:29,y:18};p.mapId=s.map.id;witness.mapId=s.map.id;p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
  for(const r of m.contracts??[])if(r.site===region&&r.status==='active')act({type:'contractCancel',target:witness.id,contract:r.id})
  return finish()
 }
 if(phase==='stale'){victim.pos={x:24,y:20};killCreature(w,victim,'선언한 원격 사망');return finish()}
 // 플레이어가 기존 등불을 든 초기 근접 상태를 선언한다. 이전 이동/양도를 주장하지 않는다.
 p.pos={x:21,y:21};p.equip.off=witness.equip.off;delete witness.equip.off;tileAt(w,p.pos).t='Terrain.Earth';invalidateLights(w);updatePlayerVision(w,p);return finish()
}
