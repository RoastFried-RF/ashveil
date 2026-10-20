// 현재 실제 관수에서 작물로 옮은 몫만 기록한다. 과거 관수/오염은 추정하지 않는다.
import {tileAt,type World} from './ctx'
import type {Pos} from './geom'
import type {CultivationState,ItemInst,WaterQuality,WorldGenDef} from './types'
import {waterSafetyDef} from './water-state'
const validDose=(q:NonNullable<CultivationState['irrigation']>)=>[q.ml,q.pathogenMl,q.ash].every(n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER)&&(q.ml>0||q.pathogenMl===0)
export function validCropIrrigation(state:CultivationState){return state.irrigation===undefined||validDose(state.irrigation)}
function nextDose(w:World,state:CultivationState,quality:WaterQuality,ml:number){
 const rule=w.db.all<WorldGenDef>('WorldGen')[0]?.cropIrrigationTransfer
 if(!rule||ml<=0)return
 const volume=quality.pathogen>0?ml*rule.pathogenFraction:0,pathogenMl=quality.pathogen*volume,ash=quality.ash/waterSafetyDef(w).ashDivisor*ml/waterSafetyDef(w).exposureMl*rule.ashFraction
 if(pathogenMl<=0&&ash<=0)return
 const q=state.irrigation??{ml:0,pathogenMl:0,ash:0};return{ml:q.ml+volume,pathogenMl:q.pathogenMl+pathogenMl,ash:q.ash+ash}
}
export function cropIrrigationError(w:World,state:CultivationState,quality:WaterQuality,ml:number){const next=nextDose(w,state,quality,ml);return next&&!validDose(next)?'관수에서 옮을 실제 오염량을 확인해야 한다':null}
export function recordCropIrrigation(w:World,state:CultivationState,quality:WaterQuality,ml:number){
 const next=nextDose(w,state,quality,ml);if(next&&validDose(next))state.irrigation=next
}
export function cropHarvestContaminants(w:World,p:Pos,count:number):{ash?:number;water?:ItemInst['foodWater']}{
 const q=tileAt(w,p).cultivation?.irrigation
 if(!q||count<=0)return{}
 return{...(q.ash>0?{ash:q.ash/count}:{}),...(q.ml>0&&q.pathogenMl>0?{water:{ml:q.ml/count,quality:{pathogen:q.pathogenMl/q.ml,ash:0,source:'실제 관수에서 작물로 옮은 오염'}}}:{})}
}
