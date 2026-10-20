import {prisonerMemoryFixture} from './prisoner-memory-fixture'
import {isRescueContract,rescueOffers} from '../src/core/rescue-contracts'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
export type RescueContractPhase='offer'|'accepted'|'field'|'freed'|'returned'|'completed'|'pending'
export function rescueContractsFixture(phase:RescueContractPhase='offer'){
 const d=prisonerMemoryFixture('observed'),{w,s,p,victim,captor}=d,m=s.overworld!,homeRegion='Region.ShepherdDale',fieldRegion=m.currentRegion!,trader=m.scenes[homeRegion].creatures.find(c=>c.traderSite===homeRegion)!,market=m.markets![homeRegion]
 const act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const switchTo=(region:string,pos:{x:number;y:number},bringVictim=false)=>{
  const scene=m.scenes[region];if(!scene)throw Error('original rescue scene missing')
  m.scenes[m.currentRegion!]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c!==p&&(!bringVictim||c!==victim)),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
  s.map=scene.map;s.maps=scene.maps;s.creatures=[p,...scene.creatures,...(bringVictim?[victim]:[])];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(site=>site.id===region)!.cell};p.pos={...pos};p.mapId=s.map.id;p.nextAct=s.time
  if(bringVictim){const spots=s.map.tiles.flatMap((t,i)=>{const q={x:i%s.map.w,y:Math.floor(i/s.map.w)};return Math.max(Math.abs(q.x-trader.pos.x),Math.abs(q.y-trader.pos.y))<=2&&w.db.terrain(t.t).passable&&!s.creatures.some(c=>c!==victim&&c.alive&&c.pos.x===q.x&&c.pos.y===q.y)?[q]:[]});if(!spots.length)throw Error('declared initial returned original person lacks a free tile');victim.pos=spots[0]!;victim.mapId=s.map.id}
  invalidateLights(w);updatePlayerVision(w,p)
 }
 const home=(bring=false)=>{const scene=m.scenes[homeRegion];if(!scene)throw Error('original town not stored');const pos=[{x:trader.pos.x-1,y:trader.pos.y},{x:trader.pos.x+1,y:trader.pos.y},{x:trader.pos.x,y:trader.pos.y-1},{x:trader.pos.x,y:trader.pos.y+1}].find(q=>w.db.terrain(scene.map.tiles[q.y*scene.map.w+q.x].t).passable&&!scene.creatures.some(c=>c.alive&&c.pos.x===q.x&&c.pos.y===q.y));if(!pos)throw Error('original trader lacks a free adjacent tile');switchTo(homeRegion,pos,bring)}
 const field=()=>switchTo(fieldRegion,{x:21,y:21})
 home();for(const r of m.contracts??[])if(r.site===homeRegion&&r.status==='active')act({type:'contractCancel',target:trader.id,contract:r.id})
 const offer=rescueOffers(w,p,trader)[0];if(!offer)throw Error('actual witnessed original guard rescue offer missing')
 const proof={...d.proof,phase,actualPriorRecoveryEscrowRefunded:true,declaredInitialScenePlacementNotClaimingJourneyOrUnconsciousTransport:true}
 const finish=()=>({w,s,p,m,victim,captor,trader,market,offer,record:m.contracts?.filter(isRescueContract).at(-1),act,home,field,proof:{...proof,initialRendererFx:s.fx.splice(0)}})
 if(phase==='offer')return finish()
 act({type:'rescueContractAccept',target:trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 if(phase==='pending'){act({type:'rest',turns:20},1);return finish()}
 field();if(phase==='field')return finish()
 act({type:'prisoner',operation:'release',target:victim.id});if(!m.contracts?.filter(isRescueContract).at(-1)!.proof)throw Error('actual original-rope release proof missing')
 if(phase==='freed')return finish()
 home(true);if(phase==='returned')return finish()
 const record=m.contracts!.filter(isRescueContract).at(-1)!;act({type:'rescueContractReport',target:trader.id,contract:record.id,expectedReward:record.reward});return finish()
}
