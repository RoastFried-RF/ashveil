import {newGame,playerAct} from '../src/core/game'
import {player,tileAt,TURNS_PER_DAY,type World} from '../src/core/ctx'
import {hpMax} from '../src/core/body'
import {makeItem,addToBag} from '../src/core/items'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {settlementCommodity,seasonalProductionMultiplier,worldSimulationDef} from '../src/core/world-simulation'
import {regionalPrice} from '../src/core/economy'
import {db} from './helpers'
/** 유한한 초기 상점·몸·시간 경계. 경계 이전 날짜의 생산/날씨/이동 이력을 주장하지 않는다. */
export function seasonalProductionNativeFixture(winter=false){
 const w:World={db,s:newGame(db,{seed:'seasonal-food-native-294',overworld:true})},s=w.s,p=player(w),m=s.overworld!
 p.pos={...s.map.exits[0]!};let error=playerAct(w,{type:'leave'});if(error)throw Error(error)
 const site=m.sites.find(x=>x.id==='Region.ShepherdDale')!;m.position={...site.cell};error=playerAct(w,{type:'enterRegion'});if(error)throw Error(error)
 const trader=s.creatures.find(c=>c.traderSite===site.id)!,market=m.markets![site.id],stock=m.simulation!.settlements[site.id]!,elapsedDay=winter?11:0
 s.time=((elapsedDay+1)*TURNS_PER_DAY-1)*100;s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};s.storyteller.budget=-1e9
 m.simulation!.day=elapsedDay;m.simulation!.marketDay=elapsedDay
 for(const market of Object.values(m.markets!)){market.day=elapsedDay;market.nextRestock=Math.max(market.nextRestock,elapsedDay+1)}
 for(const c of s.creatures)c.nextAct=1e12
 p.nextAct=s.time;p.pos={x:trader.pos.x,y:trader.pos.y+1};p.age=undefined;p.traits=[];p.traumas=[];p.effects=[];p.thoughts=[];p.diseases=[];p.equip={};p.bag=[];p.body.wounds=[];p.hp=hpMax(w,p);p.money=1000
 Object.assign(p.needs,{bodyTemp:37,kcal:2500,waterDeficit:0,fatigue:0,sleepDebt:0,wetness:0,protein:100,vitamin:100,hygiene:100,stress:0,nutritionDay:elapsedDay})
 tileAt(w,p.pos).t='Terrain.Earth';tileAt(w,p.pos).roof=true;s.map.worldCell={...site.cell};s.map.name=(winter?'겨울':'가을')+' 촌락·실제 일일 생산 검증'
 s.map.lights=[{pos:{...p.pos},kind:'campfire',radius:10}]
 const bow=makeItem(w,'Item.Bow'),string=makeItem(w,'Item.BowString');for(const item of[bow,string])if(addToBag(w,p,item))throw Error('finite original bow/string bag')
 s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 const food=()=>settlementCommodity(w,stock,'Food'),price=()=>regionalPrice(w,market,'Item.Hardtack')
 const credit=stock.residentConsumption?.day===elapsedDay?stock.residentConsumption.units.Food??0:0,consumption=worldSimulationDef(w).consumption.Food??0,production=(stock.production.Food??0)*seasonalProductionMultiplier(w,site.faction,'Food',elapsedDay),spend=Math.floor(Math.max(0,(stock.population.S+stock.population.I+stock.population.R)*consumption-credit)+(stock.consumptionCarry.Food??0)+1e-9)
 return{w,s,p,m,trader,market,stock,bow,string,food,price,expectedFoodDelta:production-spend,proof:{winter,declaredElapsedDay:elapsedDay,declaredClockOneTurnBeforeNextDay:s.time,originalFood:food(),originalPopulation:stock.population.total,originalProduction:stock.production.Food,actualResidentFoodCredit:credit,originalConsumptionCarry:stock.consumptionCarry.Food??0,actualProduction:production,actualSummaryConsumption:spend,originalRegionalPriceFactor:price(),source:'Actual newGame/leave+enterRegion generated originaltown/shop; worldcell relocation is declared initialscene, not walkedjourney. Finite originalstock with declaredday0or11 ledger, not prior11days production/weather replay; originalNPCs paused nextAct1e12 to isolatesummaryproduction, healthyplayer+actualdefaultbow/string/finitecampfirelight. Original actualresidentconsumption ledger retained. No postload injection.'}}
}
