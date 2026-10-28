// 실제 재료의 병원체 노출량을 합치고 완성품 회분에 나눈다. 수분 영양을 추가하지 않는다.
import type {ItemInst} from './types'
export function mergeFoodWater(inputs:{water:ItemInst['foodWater'];count:number}[],servings=1):ItemInst['foodWater']{
 let ml=0,pathogen=0,ash=0,salt=0
 for(const row of inputs){if(!row.water||row.count<=0)continue;const amount=row.water.ml*row.count;ml+=amount;pathogen+=row.water.quality.pathogen*amount;ash+=row.water.quality.ash*amount;salt+=(row.water.quality.salinity??0)*amount}
 if(ml<=0)return
 return{ml:ml/servings,quality:{pathogen:pathogen/ml,ash:ash/ml,...(salt?{salinity:salt/ml}:{}),source:'원래 물·재료에서 옮은 오염'}}
}
