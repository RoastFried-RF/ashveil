import {prisonerWitnessesFixture} from './prisoner-witnesses-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {rescueOffers} from '../src/core/rescue-contracts'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type CaptiveWitnessPhase='unbound'|'bound'|'heard'|'offer'|'pending'
export function captiveWitnessesFixture(phase:CaptiveWitnessPhase='bound'){
 const d=prisonerWitnessesFixture(),{w,s,p,witness,victim,act}=d,rope=makeItem(w,'Item.Rope')
 if(addToBag(w,p,rope))throw Error('declared initial interrogator rope cannot fit');witness.ai.mode='surrender';witness.activity=undefined;witness.nextAct=s.time+28800*100
 const proof={...d.proof,phase,declaredInitialInterrogatorRopeAndSpeakerSurrender:true,originalInterrogatorRopeUid:rope.uid}
 const finish=()=>({...d,rope,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='unbound')return finish()
 act({type:'prisoner',operation:'bind',target:witness.id,ropeUid:rope.uid});if(witness.captivity?.rope.uid!==rope.uid)throw Error('actual original witness binding did not finish')
 if(phase==='bound')return finish()
 if(phase==='pending'){act({type:'rest',turns:20},1);return finish()}
 act({type:'prisoner',operation:'interrogate',target:witness.id});if(s.knowledge.prisonerSightings?.[victim.id]?.heard?.kind!=='interrogation')throw Error('actual completed interrogation did not report original witness memory')
 if(phase==='heard')return finish()
 // 기존 목격자를 풀어 줘 살아서 기존 장부 곁에 있는 초기 장면으로 돌아온다. 여행/운반 이력은 주장하지 않는다.
 act({type:'prisoner',operation:'release',target:witness.id});const m=s.overworld!,region='Region.ShepherdDale',scene=m.scenes[region]
 m.scenes[m.currentRegion!]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c!==p&&c!==witness),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
 s.map=scene.map;s.maps=scene.maps;s.creatures=[p,witness,...scene.creatures];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell};witness.pos={x:30,y:18};witness.ai.mode='guard';witness.home={...witness.pos};witness.mapId=s.map.id;p.pos={x:29,y:18};p.mapId=s.map.id;p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
 for(const r of m.contracts??[])if(r.site===region&&r.status==='active')act({type:'contractCancel',target:witness.id,contract:r.id})
 if(!rescueOffers(w,p,witness).some(o=>o.person===victim.id&&o.witness?.kind==='interrogation'))throw Error('actual interrogation-origin rescue offer missing')
 return finish()
}
