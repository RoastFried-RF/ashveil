import type {ScriptItemDebit} from './script-item'
// 실제 원재료 UID/질량을 예약하고, 같은 슬롯의 결과 재질에 상속한다.
import { tileAt, type World } from './ctx'
import { addToBag } from './items'
import { rawStock } from './materials'
import type { Creature, MaterialBinding, MaterialPlan, MaterialSelection, RecipeDef, Stuff, WorkJob, MaterialCraftingDef } from './types'
type Fixed=WorkJob['inputs']
export function materialCandidates(w:World,c:Creature,r:RecipeDef,slotId:string,station?:string){
 const spec=r.materialInputs?.find(x=>x.slot===slotId),slot=w.db.item(r.output.item).stuffSlots?.find(x=>x.id===slotId)
 if(!spec||!slot)return []
 return c.bag.map(it=>({it,stock:rawStock(w,it)})).filter(x=>x.stock&&slot.accepts.includes(x.stock.material.category)&&(!spec.accepts||spec.accepts.includes(x.stock.material.category))&&(!spec.materials||spec.materials.includes(x.stock.material.id))&&x.stock.material.craftable!==false&&(!x.stock.material.station||r.stations?.includes(x.stock.material.station)&&(station===undefined||x.stock.material.station===station))).sort((a,b)=>a.it.uid-b.it.uid)
}
export function materialCraftQuote(w:World,c:Creature,r:RecipeDef,fixed:Fixed=[],selection?:MaterialSelection,station?:string):{error:string|null;plan?:MaterialPlan}{
 if(!r.materialInputs?.length)return Object.keys(selection??{}).length?{error:'이 제작법은 재질을 고르는 작업이 아니다'}:{error:null}
 for(const key of Object.keys(selection??{}))if(!r.materialInputs.some(x=>x.slot===key))return{error:'이 제작법에 없는 재질 칸을 골랐다'}
 const reserved=new Map<number,number>();for(const input of fixed)reserved.set(input.uid,(reserved.get(input.uid)??0)+input.count)
 const remaining=new Map(c.bag.map(it=>[it.uid,Math.max(0,(it.count-(reserved.get(it.uid)??0))*(rawStock(w,it)?.unitGrams??0))])),bindings=new Map<number,MaterialBinding>(),slots:[string,Stuff[string]][]=[]
 for(const spec of r.materialInputs){
  if(!Number.isSafeInteger(spec.grams)||spec.grams<=0)return{error:'제작법의 원재료 질량이 올바르지 않다'}
  const candidates=materialCandidates(w,c,r,spec.slot,station),chosen=selection&&Object.hasOwn(selection,spec.slot)?selection[spec.slot]:undefined
  let left=spec.grams
  const parts=new Map<string,number>()
  const take=(uid:number,grams:number)=>{
   const source=candidates.find(x=>x.it.uid===uid),available=remaining.get(uid)??0
   if(!source?.stock||!Number.isSafeInteger(grams)||grams<=0||grams>available||grams>left)return false
   const stock=source.stock,old=bindings.get(uid)
   bindings.set(uid,{uid,def:source.it.def,material:stock.material.id,unitGrams:stock.unitGrams,usedGrams:(old?.usedGrams??0)+grams});remaining.set(uid,available-grams);parts.set(stock.material.id,(parts.get(stock.material.id)??0)+grams/r.output.count);left-=grams;return true
  }
  if(chosen!==undefined){
   if(!Array.isArray(chosen))return{error:'고른 원재료 목록이 올바르지 않다'}
   for(const part of chosen)if(!part||!take(part.uid,part.grams))return{error:`${spec.label??spec.slot}: 고른 실제 원재료와 질량을 다시 확인해야 한다`}
  }else for(const candidate of candidates){const grams=Math.min(left,remaining.get(candidate.it.uid)??0);if(grams>0)take(candidate.it.uid,grams);if(!left)break}
  if(left)return{error:`${spec.label??spec.slot}: 실제 원재료가 ${left}g 부족하다`}
  slots.push([spec.slot,[...parts].map(([material,massG])=>({material,massG}))])
 }
 return{error:null,plan:{bindings:[...bindings.values()],stuff:Object.fromEntries(slots)}}
}
/** 예약한 같은 묶음/조각이어야 한다. 같은 종류의 다른 UID로 대체하지 않는다. */
export function materialPlanPresent(w:World,c:Creature,plan:MaterialPlan|undefined,fixed:Fixed=[]){
 if(!plan)return true
 if(new Set(plan.bindings.map(binding=>binding.uid)).size!==plan.bindings.length)return false
 const reserved=new Map<number,number>();for(const input of fixed)reserved.set(input.uid,(reserved.get(input.uid)??0)+input.count)
 return plan.bindings.every(binding=>{const it=c.bag.find(x=>x.uid===binding.uid),stock=it&&rawStock(w,it);return !!(it&&stock&&it.def===binding.def&&stock.material.id===binding.material&&stock.unitGrams===binding.unitGrams&&Number.isSafeInteger(binding.usedGrams)&&binding.usedGrams>0&&it.count>=(reserved.get(it.uid)??0)+Math.ceil(binding.usedGrams/binding.unitGrams))})
}
/** 고정 개수 재료를 소비한 뒤 호출한다. 남은 조각은 원래 물품을 실제로 나눈 것이다. */
export function consumeMaterialPlan(w:World,c:Creature,plan:MaterialPlan|undefined,debits?:ScriptItemDebit[]){
 if(!plan)return
 for(const binding of plan.bindings){
  const source=c.bag.find(x=>x.uid===binding.uid)!,units=Math.ceil(binding.usedGrams/binding.unitGrams),remainder=units*binding.unitGrams-binding.usedGrams,snapshot=structuredClone(source)
  debits?.push({uid:source.uid,item:source.def,countConsumed:units,usesConsumed:0,mlConsumed:0,gramsConsumed:binding.usedGrams,material:binding.material})
  source.count-=units
  if(!source.count)c.bag.splice(c.bag.indexOf(source),1)
  if(!remainder)continue
  const piece={...snapshot,def:w.db.get<MaterialCraftingDef>('MaterialCrafting.Hearth').fragment,uid:source.count>0?w.s.nextId++:snapshot.uid,count:1,rawGrams:remainder,rawMaterial:binding.material,gx:undefined,gy:undefined,rot:undefined}
  if(addToBag(w,c,piece))tileAt(w,c.pos).items.push(piece)
 }
}
