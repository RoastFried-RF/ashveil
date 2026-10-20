import type {World} from './ctx'
import {isRaining} from './environment'
import {itemDef} from './items'
import type {ItemInst} from './types'

/** 실제 경과가 확인된 재비 노출만 적용한다. 추가 난수/물품을 만들지 않는다. */
export function exposeFletching(w:World,it:ItemInst,exposed:boolean,elapsed:number){
 if(elapsed>0&&exposed&&!it.missingItem&&itemDef(w,it).fletching&&isRaining(w))it.fletchingDamaged=true
}
