/** UI selection only. Keep original UIDs, ordering and Core's actual use validation. */
import {foodServings,itemDef,supplyItems,type Creature,type HotbarRef,type ItemDef,type ItemInst,type World} from '../core'
type ItemRef=Extract<HotbarRef,{kind:'item'}>
function candidates(w:World,c:Creature,ref:ItemRef){
 const definition=w.db.tryGet<ItemDef>(ref.def);if(!definition)return[]
 const includeHeld=!!definition.throwable,items=[...supplyItems(c),...(includeHeld?[c.equip.main,c.equip.off].filter((item):item is ItemInst=>!!item&&!item.half):[])]
 return items.filter(item=>{
  if(item.def!==ref.def||item.missingItem||item.count<=0||ref.fletchingDamaged!==undefined&&!!item.fletchingDamaged!==ref.fletchingDamaged)return false
  const def=itemDef(w,item)
  if(def.food&&foodServings(w,item)<=0)return false
  return !(def.drink||def.drug||def.medical||def.purifier||def.refuel)||(item.uses??1)>0
 })
}
export function quickbarItem(w:World,c:Creature,ref:ItemRef){return candidates(w,c,ref).sort((a,b)=>(a.freshness??100)-(b.freshness??100)||a.uid-b.uid)[0]}
/** Count usable stacks/bottles, as the existing HUD does, rather than inventing doses. */
export function quickbarCount(w:World,c:Creature,ref:ItemRef){return candidates(w,c,ref).reduce((total,item)=>total+item.count,0)}
