import {ashWorkshopFixture}from'./ash-workshop-fixture'
import {creatureAt,inBounds,player,terrainAt,tileAt,turnOf,type World}from'../src/core/ctx'
import {DIRS}from'../src/core/geom'
import {marketFor}from'../src/core/economy'
import {serialize,deserialize}from'../src/core/save'
import {invalidateLights,updatePlayerVision}from'../src/core/fov'
import {playerAct}from'../src/core/game'
import {cultivationStatus}from'../src/core/cultivation'
import type{Action}from'../src/core/actions'

/** Finite original market/guard/bottles; declared healthy noon observation at the shop. */
export function pilgrimFieldsFixture(warm=true){
 const d=ashWorkshopFixture(),c=d.s.creatures.find(c=>c.def==='Creature.SettlementGuard'&&c.faction==='pilgrims')!
 if(!c?.home)throw Error('Original pilgrim guard/home missing')
 const originalPos={...c.pos},originalHome={...c.home},originalCash=c.money,originalTime=d.s.time
 const at=DIRS.map(v=>({x:d.c.pos.x+v.x,y:d.c.pos.y+v.y})).find(p=>inBounds(d.w,p)&&terrainAt(d.w,p).passable&&!creatureAt(d.w,p))
 if(!at)throw Error('No initial adjacent observation site');c.pos=at
 Object.assign(c.needs,{kcal:3000,waterDeficit:0,fatigue:0,bodyTemp:37,hygiene:100,stress:0})
 c.ai.mode='guard';delete c.ai.target;delete c.ai.dest;delete c.ai.path;c.asleep=false;c.unconscious=false
 d.s.time=(Math.floor(d.s.time/2880000)+1)*2880000+1440000;d.s.weather='clear';d.s.weatherUntil=d.s.time+2880000
 const m=d.s.overworld!,cell=m.cells[m.position.y*m.w+m.position.x];if(warm)cell.temperature=20
 for(const other of d.s.creatures)other.nextAct=other.id===c.id||other.id===d.p.id?d.s.time:d.s.time+1e9
 d.p.nextAct=d.s.time
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=player(w),guard=s.creatures.find(a=>a.id===c.id)!,trader=s.creatures.find(a=>a.id===d.c.id)!,market=marketFor(w,trader)!
 invalidateLights(w);updatePlayerVision(w,p);s.fx=[]
 const proof={originalGuard:guard.id,originalHome,originalPos,originalCash,originalTime,declaredInitialTime:s.time,declaredInitialAdjacentGuardPosition:guard.pos,declaredHealthyGuard:true,declaredNoon:true,declaredWarmCell:warm,onlyOriginalGuardAndObserverScheduled:true,initialStock:market.items.map(i=>({uid:i.uid,def:i.def,count:i.count})),initialGuardBag:guard.bag.map(i=>({uid:i.uid,def:i.def,count:i.count})),noSeedOrCashGiftToGuard:true,noPostCaptureInjection:true,noClaimOfEarlierNormalTravelOrFiveDaysGrowth:true}
 return{w,s,p,c:guard,trader,market,proof,act:(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}}
}

/** Separately declared last-three-growth-turn scene; no claim of five effective days. */
export function pilgrimHarvestFixture(){
 const d=pilgrimFieldsFixture()
 for(let i=0;i<150;i++){d.act({type:'wait'});if(d.c.residentPlot&&cultivationStatus(d.w,d.c.residentPlot.pos)!.waterMl>300)break}
 if(!d.c.residentPlot)throw Error('Original guard did not allocate and plant its actual seed')
 const crop=cultivationStatus(d.w,d.c.residentPlot.pos)!
 if(crop.waterMl<=300)throw Error('Actual guard did not water its plot')
 crop.state.growth=crop.total-3;crop.state.lastAt=turnOf(d.w)
 const grain=d.market.items.filter(i=>i.def==='Item.Oats');d.market.items=d.market.items.filter(i=>!grain.includes(i));for(const item of grain){delete item.gx;delete item.gy;delete item.rot}tileAt(d.w,d.p.pos).items.push(...grain)
 d.trader.nextAct=d.s.time
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);d.s.fx=[]
 return{...d,proof:{...d.proof,actualSeedAllocationAndPlantingBeforeCapture:true,declaredLastThreeEffectiveGrowthTurns:true,noClaimOfEarlierFiveEffectiveDays:true,declaredOriginalMerchantActiveAtCapture:true,declaredInitialOldMarketGrainMovedToObserverFloor:grain.map(i=>({uid:i.uid,def:i.def,count:i.count})),originalOldGrainPreservedPhysically:true,initialCrop:structuredClone(crop.state)}}
}
