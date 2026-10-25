/** Read-only surface ownership for the next human paperdoll. Never fills a missing limb. */
import {anatomicalMissing,apparelItems,armorDurability,itemDef,partDamage,partEff,prostheticAt,prostheticEfficiency,type Creature,type Slot,type World} from '../../core'
export interface HumanSurfaceState {
 id:string;flesh:boolean;present:boolean;damage:number;efficiency:number
 replacement?:{root:string;def:string;uid:number;sprite:string;durability:number;efficiency:number}
}
export interface HumanClothingState {
 uid:number;def:string;slot:Slot;layer:number;groups:string[];parts:string[]
 durability:Record<string,number>;half:boolean;progress?:{kind:'equip'|'unequip';left:number;total?:number}
}
/** The art supplies exact anatomical IDs; aliases or unknown anatomy do not borrow flesh. */
export function humanSurfaceState(w:World,c:Creature,owners:readonly string[]){
 const body=w.db.body(c.body.def),ids=new Set(body.parts.map(p=>p.id));if(body.kind!=='humanoid'||owners.some(id=>!ids.has(id)))return
 const parts:Record<string,HumanSurfaceState>={}
 for(const id of owners){
  const missing=anatomicalMissing(w,c,id),replacement=prostheticAt(w,c,id)
  parts[id]={id,flesh:!missing&&!replacement,present:!missing||!!replacement,damage:Math.max(0,Math.min(1,partDamage(c,id)/Math.max(1,c.body.maxHp[id]??1))),efficiency:partEff(w,c,id),...(replacement?{replacement:{root:replacement.root,def:replacement.state.def,uid:replacement.state.item.uid,sprite:itemDef(w,replacement.state.item).sprite,durability:replacement.state.item.durability??100,efficiency:prostheticEfficiency(w,c,replacement.root,replacement.state)}}:{})}
 }
 const slots=new Map(Object.entries(c.equip).filter((entry):entry is[string,NonNullable<typeof entry[1]>]=>!!entry[1]).map(([slot,item])=>[item.uid,slot as Slot]))
 const clothing:HumanClothingState[]=apparelItems(w,c).map(({it,def})=>{
  // Match the authoritative armor path's primary surface tag, not a guessed clothing name.
  const covered=owners.filter(id=>{const tag=body.parts.find(p=>p.id===id)!.groups[0];return !!tag&&def.apparel!.groups.includes(tag)&&parts[id].present})
  return{uid:it.uid,def:it.def,slot:slots.get(it.uid)!,layer:def.apparel!.layer,groups:[...def.apparel!.groups],parts:covered,durability:Object.fromEntries(covered.map(id=>[id,armorDurability(it,id)])),half:!!it.half,...(it.dressProgress?{progress:{...it.dressProgress}}:{})}
 }).sort((a,b)=>a.layer-b.layer||a.slot.localeCompare(b.slot)||a.uid-b.uid)
 return{body:c.body.def,parts,clothing}
}
