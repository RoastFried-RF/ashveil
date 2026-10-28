// 같은 물 용기의 형태와 실제 용량. 빈 용기를 조회해서 물이나 물품을 만들지 않는다.
import type {World} from './ctx'
import type {ItemDef,ItemInst,WaterQuality} from './types'
export function waterVesselForDef(d:ItemDef){
 // 구형 물병 모드는 uses×한 모금으로 용량을 바꾼다. 기존 계약을 새 메타데이터로 덮지 않는다.
 if(['Item.WaterBottle','Item.DirtyWaterBottle'].includes(d.id))return{capacityMl:(d.uses??5)*(d.drink?.water??200),clean:d.waterVessel?.clean??'Item.WaterBottle',dirty:d.waterVessel?.dirty??'Item.DirtyWaterBottle'}
 return d.waterVessel
}
export const waterVessel=(w:World,it:ItemInst)=>waterVesselForDef(w.db.item(it.def))
export const isWaterVessel=(w:World,it:ItemInst)=>!!waterVessel(w,it)
export const waterCapacity=(w:World,it:ItemInst)=>waterVessel(w,it)?.capacityMl??0
export function waterVesselForm(w:World,it:ItemInst,quality?:WaterQuality){
 const vessel=waterVessel(w,it)
 if(vessel)it.def=quality&&quality.pathogen>0?vessel.dirty:vessel.clean
 if(!quality){it.uses=0;delete it.water;delete it.waterSettlesAt;delete it.waterFrozen}
}
