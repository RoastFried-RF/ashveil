// 현재 실제 배급 창고에서 읽는 수급 장부. 원격 정착지 수치나 과거 장부를 만들지 않는다.
import { inBounds, player, terrainAt, tileAt, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { settlementCommodity, worldSimulationDef } from './world-simulation'

const quantize=(n:number)=>Math.round(n*1e9)/1e9
export function localSettlementSupply(w:World){
 const depot=w.s.map.residentDepot,m=w.s.overworld,p=player(w)
 if(!depot||!m||m.currentRegion!==depot.site||!inBounds(w,depot.pos)||!p.alive||p.asleep||p.unconscious||cheb(p.pos,depot.pos)>1||!hasLos(w,p.pos,depot.pos)||!canSee(w,p,depot.pos)||tileAt(w,depot.pos).t!==depot.terrain||!terrainAt(w,depot.pos).residentDepot)return null
 const stock=m.simulation?.settlements[depot.site]
 if(!stock)return null
 const population=stock.population.S+stock.population.I+stock.population.R,d=worldSimulationDef(w),foodRate=d.consumption.Food??0,fuelRate=d.consumption.Fuel??0
 const food=Math.max(0,stock.reserve.Food??0),fuel=Math.max(0,stock.reserve.Fuel??0),foodDaily=population*foodRate,totalFood=settlementCommodity(w,stock,'Food')
 return{site:depot.site,population,food,fuel,foodRate,foodPersonDays:foodRate>0?quantize(food/foodRate):null,fuelPersonDays:fuelRate>0?quantize(fuel/fuelRate):null,
  foodSettlementDays:foodDaily>0?quantize(food/foodDaily):null,marketRationFood:quantize(totalFood-food),
  status:food<=0?'empty' as const:foodDaily>0&&food<foodDaily?'low' as const:'full' as const,
  // 조회 결과를 고쳐도 원래 저장 장부는 바뀌지 않는다.
  lastSupply:stock.lastSupply?structuredClone(stock.lastSupply):undefined}
}
