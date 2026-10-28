import {recoveryContractsFixture} from './recovery-contracts-fixture'
import {hireQuote} from '../src/core/companions'
import {addToBag} from '../src/core/items'
import {creatureAt,terrainAt} from '../src/core/ctx'
import {findPath} from '../src/core/path'
import {cheb,dirIndex} from '../src/core/geom'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export type CompanionRecoveryPhase='ready'|'assigned'|'carrying'|'returned'|'paused'|'pending'
export function companionRecoveryFixture(phase:CompanionRecoveryPhase='ready'){
 const d=recoveryContractsFixture('accepted'),guard=d.s.creatures.find(c=>d.w.db.creature(c.def).ai==='guard'&&!c.traderSite&&!c.clinicSite)!
 if(!guard)throw Error('actual original coalition guard missing')
 d.p.money=1000
 for(let i=0;cheb(d.p.pos,guard.pos)>1&&i<80;i++){
  const candidates=[{x:guard.pos.x-1,y:guard.pos.y},{x:guard.pos.x+1,y:guard.pos.y},{x:guard.pos.x,y:guard.pos.y-1},{x:guard.pos.x,y:guard.pos.y+1}].filter(p=>terrainAt(d.w,p).passable&&!creatureAt(d.w,p)).sort((a,b)=>cheb(d.p.pos,a)-cheb(d.p.pos,b)),next=candidates.map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})?.[0]).find(Boolean)
  if(!next)throw Error('actual original guard hire approach unavailable');d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)})
 }
 const hire=hireQuote(d.w,guard);if(hire.error)throw Error(hire.error);d.act({type:'hireCompanion',target:guard.id})
 const town=d.m.currentRegion!,roster=d.s.sources!.find(s=>s.kind==='residents')!,originalRoster=[...roster.members!]
 d.field();const home=d.m.scenes[town];if(!home.creatures.includes(guard))throw Error('actual hired guard not in original stored town')
 home.creatures=home.creatures.filter(c=>c!==guard);d.s.creatures.push(guard);d.p.pos={x:20,y:15};guard.pos={x:19,y:15};guard.mapId=d.s.map.id;guard.nextAct=d.s.time+100;guard.activity=undefined;guard.asleep=false;guard.unconscious=false;guard.companion!.anchor={...guard.pos};guard.companion!.lastLeader={...d.p.pos};guard.ai.path=undefined;guard.ai.target=undefined
 Object.assign(guard.needs,{kcal:1000,waterDeficit:0,fatigue:10,sleepDebt:0,bodyTemp:37})
 const lamp=d.p.equip.off;if(!lamp||lamp.def!=='Item.Lantern')throw Error('original declared player lamp missing')
 if(guard.equip.off&&addToBag(d.w,guard,guard.equip.off))throw Error('original guard off-hand item does not fit in own bag')
 guard.equip.off=lamp;delete d.p.equip.off;lamp.lit=true;invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const proof={...d.proof,phase,readyAt:d.s.time,originalGuardId:guard.id,originalOwner:guard.faction,originalRoster,hireFee:hire.fee,actualHireTurns:1,declaredInitialPlayerCash:1000,declaredInitialAlreadyWithPlayerInVault:true,notClaimingGuardInterregionTravel:true,originalLampUid:lamp.uid,originalActorIds:d.s.creatures.map(c=>c.id)}
 const finish=()=>({...d,guard,proof:{...proof,initialRendererFx:d.s.fx.splice(0)}})
 if(phase==='ready')return finish()
 d.act({type:'companionRecoveryAssign',target:guard.id,contract:d.record!.id})
 if(phase==='assigned')return finish()
 if(phase==='pending'){d.act({type:'rest',turns:20},1);return finish()}
 if(phase==='paused'){for(let i=0;i<3;i++)d.act({type:'wait'});return finish()}
 for(let i=0;i<100;i++){
  if(phase==='carrying'&&guard.recoveryCargo)break
  if(phase==='returned'&&d.p.bag.some(it=>it.uid===d.book.uid))break
  d.act({type:'wait'})
 }
 if(phase==='carrying'&&!guard.recoveryCargo)throw Error('actual guard failed to fetch original in100turns')
 if(phase==='returned'&&!d.p.bag.some(it=>it.uid===d.book.uid))throw Error('actual guard failed to return original in100turns')
 return finish()
}
