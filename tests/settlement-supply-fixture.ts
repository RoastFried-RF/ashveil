import {newGame,playerAct} from '../src/core/game'
import {player,tileAt,creatureAt,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {hpMax} from '../src/core/body'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {settlementCommodity,worldSimulationDef} from '../src/core/world-simulation'
import {localSettlementSupply} from '../src/core/settlement-supply'
import {db} from './helpers'

/** 실제 생성한 마을의 유한 현재 장면. 부족 모드는 선언한 재고/생산으로 시작하며 과거 흉작 이력이 아니다. */
export function settlementSupplyNativeFixture(shortage=true){
 const w:World={db,s:newGame(db,{seed:'actual-food-supply-native-297',overworld:true})},s=w.s,p=player(w),m=s.overworld!
 p.pos={...s.map.exits[0]!};let error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 const site=m.sites.find(x=>x.id==='Region.ShepherdDale')!;m.position={...site.cell};error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const depot=s.map.residentDepot!,stock=m.simulation!.settlements[site.id]!,market=m.markets![site.id],d=worldSimulationDef(w)
 const hardtack=market.items.find(i=>i.def==='Item.Hardtack')!;if(!hardtack)throw Error('original hardtack missing')
 const originalFood=settlementCommodity(w,stock,'Food'),originalReserve=stock.reserve.Food,originalHardtack={uid:hardtack.uid,count:hardtack.count},originalProduction=stock.production.Food
 if(shortage){stock.reserve.Food=1.25;stock.production.Food=0;market.items=market.items.filter(i=>d.items[i.def]?.commodity!=='Food'||i.uid===hardtack.uid);hardtack.count=3}
 market.nextRestock=1e12
 s.time=(TURNS_PER_DAY-1)*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};s.storyteller.budget=-1e9
 m.simulation!.day=0;m.simulation!.marketDay=0
 for(const market of Object.values(m.markets!)){market.day=0;market.nextRestock=Math.max(market.nextRestock,1)}
 for(const c of s.creatures)c.nextAct=1e12
 const near=[{x:depot.pos.x,y:depot.pos.y+1},{x:depot.pos.x-1,y:depot.pos.y},{x:depot.pos.x+1,y:depot.pos.y},{x:depot.pos.x,y:depot.pos.y-1}].find(pos=>w.db.terrain(tileAt(w,pos).t).passable&&!creatureAt(w,pos))
 if(!near)throw Error('actual depot has no empty adjacent position')
 p.nextAct=s.time;p.pos=near;p.age=undefined;p.traits=[];p.traumas=[];p.effects=[];p.thoughts=[];p.diseases=[];p.body.wounds=[];p.hp=hpMax(w,p)
 Object.assign(p.needs,{bodyTemp:37,kcal:2500,waterDeficit:0,fatigue:0,sleepDebt:0,wetness:0,protein:100,vitamin:100,hygiene:100,stress:0,nutritionDay:0})
 s.map.name=shortage?'유한 식량 창고·실제 부족 장부':'촌락 창고·실제 생산 장부';s.map.lights=[{pos:{...p.pos},kind:'campfire',radius:10}]
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 const before=localSettlementSupply(w);if(!before)throw Error('actual depot supply not visible')
 const eggs=market.items.find(i=>i.def==='Item.Egg');if(!eggs)throw Error('actual uncounted eggs missing')
 return{w,s,p,m,stock,market,depot,hardtack,before,proof:{shortage,declaredClock:s.time,originalGeneratedFood:originalFood,originalGeneratedReserve:originalReserve,originalHardtack,originalProduction,declaredReserve:stock.reserve.Food,declaredProduction:stock.production.Food,declaredRationFoodAtMarket:before.marketRationFood,originalUncountedEggs:{uid:eggs.uid,count:eggs.count},actualResidentCredit:stock.residentConsumption?.day===0?stock.residentConsumption.units.Food??0:0,actualConsumptionCarry:stock.consumptionCarry.Food??0,source:'Actualgeneratedtown/depot/shop/Hardtack UID. Shortage initialscene explicitly declares commonFood1.25, originalHardtack3, noothercountedrationFood and production0; other uncounted foods such as originalEggs6 remain. Not historicalcropfailure or acquisition. Actual initialresidentconsumption retained. Finite near-midnightday0/pausedNPCs/healthyplayer/light and actualdepotneighbor; no postloadworld/time/RNG/material injection.'}}
}
