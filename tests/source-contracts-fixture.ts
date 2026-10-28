import {bountyContractsFixture} from './bounty-contracts-fixture'
import {changeMap} from '../src/core/game'
import {sourceOffers,isSourceContract} from '../src/core/source-contracts'
import {tileAt,turnOf} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type SourceContractPhase='offer'|'accepted'|'work'|'report'|'completed'|'staleOffer'|'staleSurvey'|'staleReport'|'pending'
export function sourceContractsFixture(phase:SourceContractPhase='offer'){
 const d=bountyContractsFixture('source-contracts-actual');d.field();changeMap(d.w,'crypt1')
 const pos={...d.s.map.waypoints!.conduitCrack},device=tileAt(d.w,pos).device!,source=d.s.sources!.find(s=>s.id==='conduit')!,actors=d.s.creatures.map(c=>c.id)
 d.p.pos={x:pos.x-1,y:pos.y};d.p.nextAct=d.s.time;d.p.traits=[]
 for(const c of d.s.creatures)if(c.id!==d.p.id){c.asleep=true;c.nextAct=d.s.time+28800*100}
 const hammer=makeItem(d.w,'Item.IronHammer'),stones=makeItem(d.w,'Item.Stone',4),lamp=makeItem(d.w,'Item.Lantern');lamp.lit=true;d.p.equip.off=lamp
 for(const it of [hammer,stones])if(addToBag(d.w,d.p,it))throw Error('declared initial source-contract supplies do not fit')
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const observation=structuredClone(tileAt(d.w,pos).observed!),site=d.m.currentRegion!,field=()=>d.switchTo(site,{x:pos.x-1,y:pos.y})
 d.home()
 if(phase.startsWith('stale')){
  d.act({type:'wait'});d.act({type:'wait'})
  // 선언한 별도 초기 현장이다. 과거 NPC 공사를 실행했다고 주장하지 않는다.
  source.closed={at:turnOf(d.w)-1,by:actors.find(id=>id!==d.p.id)!,mapId:'crypt1',deviceUid:device.uid};device.completed=['seal'];device.installed=[makeItem(d.w,'Item.Stone',4)]
  const map=d.m.scenes[site].map;map.tiles[pos.y*map.w+pos.x].t='Terrain.ClosedConduitCrack'
 }
 const offer=sourceOffers(d.w,d.p,d.trader)[0];if(!offer)throw Error('actual observed original source-control offer unavailable')
 const proof={phase,declaredInitialSupplies:true,notClaimingPastMiningPurchaseApproachOrInterregionTravel:true,declaredInitialOldClosure:phase.startsWith('stale'),originalCryptActorIds:actors,originalTownActorIds:d.s.creatures.map(c=>c.id),observation,source:source.id,deviceUid:device.uid,hammer:hammer.uid,stones:stones.uid,reward:offer.reward,initialBank:1000}
 const finish=()=>({...d,source,device,pos,field,hammer,stones,offer,record:d.m.contracts?.filter(isSourceContract).at(-1),proof:{...proof,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='offer'||phase==='staleOffer')return finish()
 d.act({type:'sourceContractAccept',target:d.trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 field();if(phase==='work'||phase==='staleSurvey')return finish()
 const record=d.m.contracts!.filter(isSourceContract).at(-1)!
 if(phase==='staleReport')d.act({type:'sourceContractSurvey',contract:record.id})
 else if(phase==='pending'){d.act({type:'deviceWork',pos,uid:device.uid,operation:'seal'},1);return finish()}
 else d.act({type:'deviceWork',pos,uid:device.uid,operation:'seal'})
 d.home();if(phase==='report'||phase==='staleReport')return finish()
 d.act({type:'sourceContractReport',target:d.trader.id,contract:record.id,expectedReward:record.reward});return finish()
}
