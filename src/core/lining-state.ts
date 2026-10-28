// 실제 두 의복의 시간·부분 착탈을 공유한다. 물품이나 배낭은 만들지 않는다.
import type { World } from './ctx'
import type { Activity, Creature, ItemInst, Slot } from './types'
export function clothingSlot(w:World,c:Creature,it:ItemInst,target?:Slot):Slot|undefined{
 return target??(Object.keys(c.equip)as Slot[]).find((s)=>c.equip[s]?.uid===it.uid)??(w.db.item(it.def).slot==='chest'?'chest':undefined)
}
export function clothingPeer(w:World,c:Creature,it:ItemInst,target?:Slot){const slot=clothingSlot(w,c,it,target),peer=slot==='lining'?c.equip.chest:slot==='chest'?c.equip.lining:undefined;return peer?.uid!==it.uid?peer:undefined}
export function clothingBaseTurns(w:World,c:Creature,it:ItemInst,kind:'equip'|'unequip',target?:Slot){
 const d=w.db.item(it.def),peer=clothingPeer(w,c,it,target),slot=clothingSlot(w,c,it,target),k=kind==='equip'?0:1
 return(d.equipTurns?.[k]??1)+(peer?(w.db.item(peer.def).equipTurns?.[kind==='equip'&&slot==='chest'&&!d.apparel?.liningHost?1:k]??1):0)
}
export function clothingPairPresent(w:World,c:Creature,a:Activity){
 if(a.gearPairUid===undefined)return true
 const it=[...c.bag,...Object.values(c.equip)].find((i)=>i?.uid===a.uid)
 return !!it&&clothingPeer(w,c,it,a.slot)?.uid===a.gearPairUid
}
export function clothingRemoveSlots(c:Creature,slot:Slot):Slot[]{return(slot==='chest'||slot==='lining')&&c.equip.chest&&c.equip.lining?['chest','lining']:[slot]}
export function markClothingProgress(c:Creature,it:ItemInst,a:Activity,kind:'equip'|'unequip',left:number,originalBase=a.gearWork){
 it.half=true;it.dressProgress={kind,left,...(a.gearPairUid!==undefined?{total:originalBase}: {})}
 const peer=Object.values(c.equip).find((i)=>i?.uid===a.gearPairUid)
 if(a.gearPairUid!==undefined&&peer){peer.half=true;peer.dressProgress={kind,left,total:originalBase}}
}
export function finishClothingProgress(c:Creature,it:ItemInst,peerUid?:number){
 it.half=undefined;it.dressProgress=undefined
 if(peerUid!==undefined){const peer=[...c.bag,...Object.values(c.equip)].find((i)=>i?.uid===peerUid);if(peer){peer.half=undefined;peer.dressProgress=undefined}}
}
