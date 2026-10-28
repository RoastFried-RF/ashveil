/** Read-only attachment choices. Accepted actions and their costs remain in Core. */
import {handCapacity,prostheticGrip,prostheticSupport,type Creature,type World,type ItemDef} from '../../core'
export type HandSlot=0|1
export interface PropBinding {uid:number;def:string;hand:HandSlot|null;consume?:boolean}
export function utilityPropLength(def:ItemDef){return def.heldSprite?.length??(def.food?4:def.drug?3:10)}
export function presentationHands(w:World,c:Creature){
 const read=(side:'Right'|'Left')=>{const capacity=handCapacity(w,c,side);return{hold:capacity>0&&prostheticGrip(w,c,side),support:capacity>0&&(prostheticSupport(w,c,side)??capacity)>0}}
 return[read('Right'),read('Left')]as const
}
export function bindActionProp(w:World,c:Creature,item:{uid:number;def:string}):PropBinding{
 const hands=presentationHands(w,c),held=c.equip.main?.uid===item.uid?0:c.equip.off?.uid===item.uid?1:undefined
 // A hand that cannot grip does not acquire a tool merely because a cutout exists.
 const hand=held!==undefined?(hands[held].hold?held:null):hands[0].hold?0:hands[1].hold?1:null
 return{uid:item.uid,def:item.def,hand}
}
