import {bountyContractsFixture} from './bounty-contracts-fixture'
import {changeMap,playerAct} from '../src/core/game'
import {recoveryOffers,isRecoveryContract} from '../src/core/recovery-contracts'
import {tileAt,type World} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {findPath} from '../src/core/path'
import {cheb,dirIndex} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {db} from './helpers'
import type {Action} from '../src/core/actions'
export type RecoveryPhase='inspect'|'inspected'|'offer'|'accepted'|'pickup'|'deliver'|'completed'|'substitute'|'pending'
let template:string|undefined
function prepared():World{
 if(template)return{db,s:deserialize(template)}
 const d=bountyContractsFixture('recovery-actual')
 const exit=d.s.map.exits[0]
 for(let i=0;cheb(d.p.pos,exit)>0&&i<180;i++){const next=findPath(d.w,d.p.pos,exit,{avoidCreatures:true,selfId:d.p.id})?.[0];if(!next)throw Error('actual town exit route unavailable');d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)})}
 if(cheb(d.p.pos,exit)>0)throw Error('actual town exit not reached')
 d.act({type:'leave'});const site=d.m.sites.find(s=>s.id==='Region.ShadeGrove')!;d.m.position={...site.cell};const existing=new Set(Object.keys(d.m.scenes));d.act({type:'enterRegion'});for(const key of Object.keys(d.m.scenes))if(!existing.has(key))delete d.m.scenes[key]
 changeMap(d.w,'seed-vault');d.p.pos={x:22,y:8};d.p.nextAct=d.s.time;d.p.traits=[];const lamp=makeItem(d.w,'Item.Lantern');lamp.lit=true;d.p.equip.off=lamp;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 template=serialize(d.s);return{db,s:deserialize(template)}
}
export function recoveryContractsFixture(phase:RecoveryPhase='offer'){
 // 같은 시드로 생성한 실제 원본 세계에서 각 장면의 공개 입력을 준비한다.
 const w=prepared(),s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!,m=s.overworld!,pos={x:23,y:8},source=tileAt(w,pos),book=source.cont!.items.find(i=>i.def==='Item.SeedVaultLedger')!,homeRegion='Region.ShepherdDale',townScene=m.scenes[homeRegion]
 if(!townScene)throw Error('original coalition town scene missing')
 const trader=townScene.creatures.find(c=>c.traderSite===homeRegion)!,market=m.markets![homeRegion],act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const switchTo=(region:string,target:{x:number;y:number})=>{
  const scene=m.scenes[region];if(!scene)throw Error('original recovery scene missing')
  m.scenes[m.currentRegion!]={map:s.map,maps:s.maps,creatures:s.creatures.filter(c=>c.id!==p.id),offCreatures:s.offCreatures,sources:s.sources??[],storyteller:s.storyteller,noiseEvents:s.noiseEvents};delete m.scenes[region]
  s.map=scene.map;s.maps=scene.maps;s.creatures=[p,...scene.creatures];s.offCreatures=scene.offCreatures;s.sources=scene.sources;s.storyteller=scene.storyteller;s.noiseEvents=scene.noiseEvents;m.currentRegion=region;m.position={...m.sites.find(x=>x.id===region)!.cell};p.mapId=s.map.id;p.pos={...target};p.nextAct=s.time;invalidateLights(w);updatePlayerVision(w,p)
 }
 const adjacent=()=>[{x:trader.pos.x-1,y:trader.pos.y},{x:trader.pos.x+1,y:trader.pos.y},{x:trader.pos.x,y:trader.pos.y-1},{x:trader.pos.x,y:trader.pos.y+1}].find(q=>{const scene=m.scenes[homeRegion];return scene&&w.db.terrain(scene.map.tiles[q.y*scene.map.w+q.x].t).passable&&!scene.creatures.some(c=>c.alive&&c.pos.x===q.x&&c.pos.y===q.y)})!
 const home=()=>switchTo(homeRegion,adjacent()),field=()=>switchTo('Region.ShadeGrove',{x:22,y:8})
 const proof={phase,originalBookUid:book.uid,originalBookDef:book.def,initialBank:market.money,declaredInitialLampAndAdjacentVaultPosition:true,notClaimingPastPurchaseVaultAccessOrInterregionTravel:true,declaredInitialSubstitute:phase==='substitute'}
 const finish=()=>({w,s,p,m,pos,source,book,trader,market,act,home,field,proof:{...proof,initialRendererFx:s.fx.splice(0)},offer:recoveryOffers(w,p,trader)[0],record:m.contracts?.filter(isRecoveryContract).at(-1)})
 if(phase==='inspect')return finish()
 act({type:'search'});if(!source.observed?.contents?.items.some(i=>i.uid===book.uid))throw Error('actual fine-view original book observation missing')
 if(phase==='inspected')return finish()
 act({type:'lootClose'});home();const offer=recoveryOffers(w,p,trader)[0];if(!offer)throw Error('actual observed original book recovery offer missing')
 if(phase==='offer')return finish()
 act({type:'recoveryAccept',target:trader.id,offer:offer.id,expectedReward:offer.reward})
 if(phase==='accepted')return finish()
 if(phase==='pending'){act({type:'rest',turns:20},1);return finish()}
 if(phase==='substitute'){const other=makeItem(w,'Item.SeedVaultLedger');if(addToBag(w,p,other))throw Error('declared initial substitute book does not fit');return finish()}
 field();if(phase==='pickup')return finish()
 act({type:'search'});act({type:'lootTake',uid:book.uid});act({type:'lootClose'});home();if(phase==='deliver')return finish()
 const record=m.contracts!.filter(isRecoveryContract).at(-1)!;act({type:'recoveryDeliver',target:trader.id,contract:record.id,expectedReward:record.reward});return finish()
}
