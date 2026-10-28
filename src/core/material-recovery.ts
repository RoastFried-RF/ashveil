import { tileAt, type World } from './ctx'
import { addToBag, makeItem, maxStack } from './items'
import type { Creature, ItemInst, MaterialCraftingDef, MaterialDef } from './types'
export interface MaterialRecoveryRow {material:string;item:string;grams:number;units:number;remainder:number}
/** 복수 슬롯의 같은 재질을 먼저 합쳐 회수율을 적용한다. 고정 부품은 회수하지 않는다. */
export function materialRecovery(w:World,it:ItemInst,rate:number):MaterialRecoveryRow[]|null{
 if(!it.stuff)return null
 const d=w.db.item(it.def),masses=new Map<string,number>()
 for(const slot of d.stuffSlots??[]){const stuff=it.stuff[slot.id]??slot.ref,parts=typeof stuff==='string'?[{material:stuff,massG:slot.volumeCm3*w.db.get<MaterialDef>(stuff).density}]:stuff;for(const part of parts)masses.set(part.material,(masses.get(part.material)??0)+part.massG)}
 const rows:MaterialRecoveryRow[]=[]
 for(const[material,mass]of masses){
  const grams=Math.floor(mass*rate*(50+(it.durability??100)/2)/10000);if(grams<=0)continue
  const m=w.db.get<MaterialDef>(material),item=m.recoveryItem??w.db.get<MaterialCraftingDef>('MaterialCrafting.Hearth').fragment,unit=m.recoveryItem?w.db.item(item).rawMaterial!.grams:undefined
  rows.push({material,item,grams,units:unit?Math.floor(grams/unit):0,remainder:unit?grams%unit:grams})
 }
 return rows
}
/** 분해한 실제 질량만 만든다. 부분 조각도 같은 원재료의 질량으로 남는다. */
export function receiveRecoveredMaterials(w:World,c:Creature,rows:MaterialRecoveryRow[]){
 const put=(it:ItemInst)=>{if(addToBag(w,c,it))tileAt(w,c.pos).items.push(it)}
 for(const row of rows){
  let units=row.units
  while(units>0){const count=Math.min(units,maxStack(w.db.item(row.item)));put(makeItem(w,row.item,count));units-=count}
  if(row.remainder){const it=makeItem(w,w.db.get<MaterialCraftingDef>('MaterialCrafting.Hearth').fragment);it.rawMaterial=row.material;it.rawGrams=row.remainder;put(it)}
 }
}
