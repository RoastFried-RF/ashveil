/** Resolved source beats the actor's later equipment, mode and target position. */
import {itemDef,meleeWield,wield,type Creature,type FxEvent,type World} from '../../core'
import {takeAttackObservation} from '../../core/action-observations'
import {attackStyle,equipmentSpec,type EquipmentAction} from './equipment-motion'
import {bindActionProp,type PropBinding} from './hand-presentation'
import type {Dir} from './atlas'
export function attackPresentation(w:World,c:Creature,event:Extract<FxEvent,{k:'attack'}>,facing:Dir){
 const observed=takeAttackObservation(w,event),target=w.s.creatures.find(actor=>actor.id===event.target),from=observed?.from??c.pos,to=observed?.to??target?.pos??from,dx=to.x-from.x,dy=to.y-from.y,distance=Math.hypot(dx,dy),vector={x:dx/(distance||1),y:dy/(distance||1)},direction:Dir=dx>0?'right':dx<0?'left':dy<0?'up':dy>0?'down':facing
 const prop=event.prop?equipmentSpec(w.db.item(event.prop.def),event.prop.uid):undefined,mode=prop?'use':event.throwing?'throw':event.ranged?'shoot':'attack',used=prop?undefined:observed?.wield??(event.throwing?undefined:event.ranged?wield(w,c,event.mode):meleeWield(w,c,event.mode)),item=used?.item
 const weapon=prop??(item?{...equipmentSpec(itemDef(w,item),item.uid,!!item.lit&&(item.fuel??0)>0),twoHanded:!!used?.twoHanded}:undefined)
 const propBinding:PropBinding|undefined=event.prop?bindActionProp(w,c,event.prop):undefined
 const equipment:EquipmentAction={sourceObserved:!!observed,arm:propBinding?.hand===1?'larm':propBinding?.hand===0?'rarm':used?.arm,naturalMode:event.mode??used?.atk.id,style:prop?'unarmed':attackStyle(used?.atk.family,used?.atk.damageType,weapon,!!event.ranged,!!event.throwing),slot:propBinding?propBinding.hand:weapon?(used?.arm==='larm'?1:0):null,weapon,direction,vector}
 return{mode,equipment,prop:prop?.sprite,propBinding,distance}as const
}
