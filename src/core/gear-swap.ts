import {equipmentSnapshot,runEquipmentWorkers} from './script-item'
// 기존 장비를 실제로 벗은 뒤 새 장비를 입는다. 잠시 내려놓은 물품도 지도에 실재한다.
import { channelTurns } from './action-time'
import { capacity } from './body'
import { clamp, inBounds, log, tileAt, type World } from './ctx'
import { hasLos } from './fov'
import { ageLooseGear } from './gear-weather'
import { cheb } from './geom'
import { addToBag, equip, equipDisplacements, equipError, gridAdd, itemDef, slotFor } from './items'
import { clothingBaseTurns, finishClothingProgress, markClothingProgress } from './lining-state'
import { diagonalBlocked } from './path'
import type { Activity, Creature, ItemInst, Slot } from './types'
function offWork(w:World,it:ItemInst){
 const d=itemDef(w,it),base=d.equipTurns?.[1]??1,p=it.dressProgress
 if(!it.half)return base
 if(!p||!Number.isFinite(p.left)||p.left<0)return base/2
 const total=p.total??d.equipTurns?.[p.kind==='equip'?0:1]??1
 return base*clamp(p.kind==='unequip'?p.left/Math.max(total,1e-9):1-p.left/Math.max(total,1e-9),0,1)
}
export function gearSwapQuote(w:World,c:Creature,uid:number,target?:Slot){
 const incoming=c.bag.find((i)=>i.uid===uid),slot=incoming&&(target??slotFor(w,c,itemDef(w,incoming))),old=incoming&&slot?equipDisplacements(w,c,incoming,slot):[]
 let error=incoming&&slot?equipError(w,c,uid,slot):'배낭의 장착할 물품이 없다'
 const pair=(slot==='chest'||slot==='lining')&&c.equip.chest&&c.equip.lining,handled=pair?[{slot:'chest' as const,item:c.equip.chest!},{slot:'lining' as const,item:c.equip.lining!}]:old
 const full=handled.reduce((n,e)=>n+(itemDef(w,e.item).equipTurns?.[1]??1),0),work=handled.reduce((n,e)=>n+offWork(w,e.item),0),turns=channelTurns(w,c,work)
 if(!error&&(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.1||turns===null))error='몸 상태로 장비를 갈아입을 수 없다'
 const peer=slot==='lining'?c.equip.chest:slot==='chest'&&incoming&&itemDef(w,incoming).apparel?.liningHost?c.equip.lining:undefined,peerSlot=slot==='lining'?'chest' as const:'lining' as const
 return{needed:old.length>0,error,slot:slot||undefined,old,full,work,turns:turns??0,retained:peer?{slot:peerSlot,uid:peer.uid}:undefined}
}
export function startGearSwap(w:World,c:Creature,uid:number,target?:Slot):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=gearSwapQuote(w,c,uid,target);if(q.error)return q.error
 if(!q.needed)return '교체할 기존 장비가 없다'
 c.activity={kind:'gearSwap',uid,slot:q.slot,remaining:q.turns,total:q.turns,gearWork:q.work,woundCount:c.body.wounds.length,label:'기존 장비 벗기',gearSwap:{slot:q.slot!,mapId:w.s.map.id,phase:'remove',old:q.old.map((e)=>({slot:e.slot,uid:e.item.uid})),dropped:[],removeFull:q.full,retained:q.retained}}
 return null
}
function retainedPresent(c:Creature,a:Activity){const peer=a.gearSwap!.retained;return!peer||c.equip[peer.slot]?.uid===peer.uid}
/** 같은 지도에서 실제 남아 있는 같은 물품만 회수한다. 없는 물품을 다시 만들지 않는다. */
function returnDropped(w:World,c:Creature,a:Activity){
 const s=a.gearSwap!;if(!c.alive||s.mapId!==w.s.map.id)return 0
 let returned=0
 for(const ref of s.dropped){
  if(!inBounds(w,ref.pos)||cheb(c.pos,ref.pos)>1||!hasLos(w,c.pos,ref.pos)||diagonalBlocked(w,c.pos,ref.pos.x-c.pos.x,ref.pos.y-c.pos.y))continue
  const tile=tileAt(w,ref.pos),it=tile.items.find((i)=>i.uid===ref.uid);if(!it)continue
  const shadow={db:w.db,s:{...w.s,nextId:-1}},grid={items:structuredClone(c.bag),w:10,h:6}
  if(gridAdd(shadow,grid,structuredClone(it)))continue
  ageLooseGear(w,it,ref.pos)
  if(!addToBag(w,c,it)){tile.items.splice(tile.items.indexOf(it),1);returned++}
 }
 return returned
}
function removeProgress(w:World,c:Creature,a:Activity){
 const s=a.gearSwap!,left=(a.gearWork??s.removeFull)*Math.max(0,a.remaining)/Math.max(1,a.total??1),clothing=(s.slot==='chest'||s.slot==='lining')&&c.equip.chest&&c.equip.lining
 if(clothing){const selected=c.equip[s.slot]!,peer=c.equip[s.slot==='chest'?'lining':'chest']!;markClothingProgress(c,selected,{...a,gearPairUid:peer.uid},'unequip',left,s.removeFull);return}
 for(const ref of s.old){const it=c.equip[ref.slot];if(it?.uid!==ref.uid)continue;const base=itemDef(w,it).equipTurns?.[1]??1;it.half=true;it.dressProgress={kind:'unequip',left:base*left/Math.max(s.removeFull,1e-9)}}
}
export function cancelGearSwap(w:World,c:Creature,a:Activity){
 const s=a.gearSwap;if(!s)return
 const incoming=c.bag.find((i)=>i.uid===a.uid)
 if(s.phase==='remove'){
  if((a.elapsed??0)>0&&retainedPresent(c,a)&&s.old.every((ref)=>c.equip[ref.slot]?.uid===ref.uid))removeProgress(w,c,a)
 }else if(c.alive&&(a.elapsed??0)>0&&incoming&&retainedPresent(c,a)&&!equipDisplacements(w,c,incoming,s.slot).length&&!equipError(w,c,incoming.uid,s.slot)){
  const original=clothingBaseTurns(w,c,incoming,'equip',s.slot)
  if(!equip(w,c,incoming.uid,s.slot,false))markClothingProgress(c,incoming,{...a,gearPairUid:s.retained?.uid},'equip',(a.gearWork??original)*Math.max(0,a.remaining)/Math.max(1,a.total??1),original)
 }
 returnDropped(w,c,a)
}
function abort(w:World,c:Creature,a:Activity){cancelGearSwap(w,c,a);c.activity=undefined;return true}
export function gearSwapStep(w:World,c:Creature):boolean{
 const a=c.activity!,s=a.gearSwap!,incoming=c.bag.find((i)=>i.uid===a.uid)
 if(!incoming||s.mapId!==w.s.map.id||!retainedPresent(c,a)||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'manipulation')<.1||channelTurns(w,c,1)===null)return abort(w,c,a)
 const displaced=equipDisplacements(w,c,incoming,s.slot)
 if(s.phase==='remove'){
  if(displaced.length!==s.old.length||!s.old.every((ref)=>displaced.some((e)=>e.slot===ref.slot&&e.item.uid===ref.uid))||equipError(w,c,incoming.uid,s.slot))return abort(w,c,a)
  a.remaining--;a.elapsed=(a.elapsed??0)+1
  if(a.remaining>0)return false
  const before=equipmentSnapshot(c)
  for(const ref of s.old){const it=c.equip[ref.slot]!;delete c.equip[ref.slot];it.half=undefined;it.dressProgress=undefined;delete it.gx;delete it.gy;delete it.rot;tileAt(w,c.pos).items.push(it);s.dropped.push({uid:it.uid,pos:{...c.pos}})}
  runEquipmentWorkers(w,c,before)
  if(!c.alive||c.unconscious||c.asleep){c.activity=undefined;return true}
  if(s.retained){const it=c.equip[s.retained.slot]!,base=itemDef(w,it).equipTurns?.[0]??1;it.half=true;it.dressProgress={kind:'equip',left:base,total:base}}
  const base=clothingBaseTurns(w,c,incoming,'equip',s.slot),turns=channelTurns(w,c,base)
  s.phase='wear';a.elapsed=0;a.gearWork=base
  if(turns===null)return abort(w,c,a)
  a.remaining=turns;a.total=turns;a.label=`${itemDef(w,incoming).label} 입기`;return false
 }
 if(displaced.length||equipError(w,c,incoming.uid,s.slot))return abort(w,c,a)
 a.remaining--;a.elapsed=(a.elapsed??0)+1
 if(a.remaining>0)return false
 const before=equipmentSnapshot(c)
 if(equip(w,c,incoming.uid,s.slot,false))return abort(w,c,a)
 finishClothingProgress(c,incoming,s.retained?.uid);runEquipmentWorkers(w,c,before);const returned=returnDropped(w,c,a);c.activity=undefined
 if(c.id===w.s.playerId)log(w,'info',`기존 장비를 벗은 뒤 새 장비로 갈아입었다. ${returned===s.dropped.length?'벗은 물품을 곁에서 배낭으로 챙겼다.':'놓았던 물품을 다시 확인해야 한다.'}`)
 return true
}
