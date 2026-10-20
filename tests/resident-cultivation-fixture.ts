import {bountyContractsFixture} from './bounty-contracts-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {creatureAt,inBounds,terrainAt,player,type World} from '../src/core/ctx'
import {cheb,DIRS,dirIndex} from '../src/core/geom'
import {findPath} from '../src/core/path'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {serialize,deserialize} from '../src/core/save'
import {residentCultivationDecision} from '../src/core/resident-cultivation'
import {cultivationStatus} from '../src/core/cultivation'
import type {Action} from '../src/core/actions'
export function residentCultivationFixture(residentSeeds=true){
 const d=bountyContractsFixture('resident-cultivation-native'),c=d.s.creatures.find(c=>c.def==='Creature.SettlementGuard'&&c.ai.mode==='guard')!
 if(!c||!c.home)throw Error('actual original resident guard/home missing')
 const originalHome={...c.home},farmHome={x:40,y:20};if(!terrainAt(d.w,farmHome).soil||terrainAt(d.w,farmHome).bedding)throw Error('declared rural home is not actual empty soil');c.pos={...farmHome};c.home={...farmHome}
 const approach=()=>DIRS.map(v=>({x:c.home!.x+v.x,y:c.home!.y+v.y})).filter(p=>inBounds(d.w,p)&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p)).map(p=>findPath(d.w,d.p.pos,p,{avoidCreatures:true,selfId:d.p.id})).filter((p):p is NonNullable<typeof p>=>!!p?.length).sort((a,b)=>a.length-b.length)[0]?.[0]
 let observerWalk=0;while(cheb(d.p.pos,c.pos)>1&&observerWalk<60){const next=approach();if(!next)throw Error('original observer approach unavailable');d.act({type:'move',dir:dirIndex(next.x-d.p.pos.x,next.y-d.p.pos.y)});observerWalk++}
 if(cheb(d.p.pos,c.pos)>1)throw Error('actual observer did not reach original resident')
 // 새 한낮/모든 주민 활성 순서는 명시한 초기 일정이다. 앞선12시간 플레이는 주장하지 않는다.
 d.s.time=(Math.floor(d.s.time/100/28800)+1)*28800*100+14400*100;d.s.weather='clear';d.s.weatherUntil=d.s.time+1200*100
 for(let i=0;i<d.s.creatures.length;i++)d.s.creatures[i].nextAct=d.s.time+i*100
 d.p.nextAct=d.s.time;c.nextAct=d.s.time;c.ai.mode='guard';c.ai.target=undefined;c.ai.dest=undefined;c.ai.path=undefined
 const seed=makeItem(d.w,'Item.ShadeSeeds',2);if(addToBag(d.w,residentSeeds?c:d.p,seed))throw Error('declared original resident seeds do not fit')
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),farmer=s.creatures.find(a=>a.id===c.id)!
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 return{w,s,p,c:farmer,seedUid:seed.uid,act,decision:()=>residentCultivationDecision(w,farmer),crop:()=>farmer.residentPlot?cultivationStatus(w,farmer.residentPlot.pos):undefined,proof:{originalActors:s.creatures.map(a=>a.id),originalResident:farmer.id,originalHome,declaredRuralHome:{...farmer.home!},declaredInitialIdleFarmer:true,originalBottles:farmer.bag.filter(i=>i.def==='Item.WaterBottle').map(i=>({uid:i.uid,uses:i.uses})),declaredInitialSeedKit:2,declaredInitialSeedOwner:residentSeeds?'resident':'player',seedUid:seed.uid,declaredNoonAndAllResidentsActiveSchedule:true,actualObserverWalkTurns:observerWalk,noClaimOfEarlierFarmOrEarlierTwelveHourWait:true,initialRendererFx:s.fx.splice(0)}}
}

export type ResidentCultivationPhase='initial'|'watered'|'nearRipe'|'harvested'|'pending'
export function residentCultivationNativeFixture(phase:ResidentCultivationPhase='initial'){
 const d=residentCultivationFixture(false)
 if(phase!=='initial'){
  d.act({type:'giveResidentSeed',target:d.c.id,uid:d.seedUid})
  for(let i=0;(!d.crop()||d.crop()!.waterMl<=300)&&i<12;i++)d.act({type:'wait'})
  if(!d.crop()||d.crop()!.waterMl<=300)throw Error('original resident did not plant and water original gifted seed')
  d.act({type:'move',dir:0})
 }
 if(phase==='nearRipe'||phase==='harvested'){d.crop()!.state.growth=d.crop()!.total-3;d.crop()!.state.lastAt=Math.floor(d.s.time/100)}
 if(phase==='harvested'){for(let i=0;!d.c.bag.some(item=>item.def==='Item.ShadeRoot')&&i<60;i++)d.act({type:'wait'});if(!d.c.bag.some(item=>item.def==='Item.ShadeRoot'))throw Error('original resident did not actually harvest')}
 if(phase==='pending')d.act({type:'rest',turns:20},1)
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),c=s.creatures.find(a=>a.id===d.c.id)!
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,c,seedUid:d.seedUid,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)},crop:()=>c.residentPlot?cultivationStatus(w,c.residentPlot.pos):undefined,proof:{...d.proof,phase,declaredFinalThreeGrowthTurns:phase==='nearRipe'||phase==='harvested',noClaimOfEarlier28797GrowthTurns:true,actualSeedGiftAndNpcPlantingAlreadyPrepared:phase!=='initial',initialRendererFx:s.fx.splice(0)}}
}
