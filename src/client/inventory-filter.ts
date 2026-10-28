import {itemDef,itemLabel,type ItemInst,type World,type RecipeDef} from '../core'

export type InventoryGroup='all'|'food'|'medical'|'gear'|'material'
export const inventorySearchKey=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ko').replace(/\s+/gu,'')
const recipeInputs=new WeakMap<World['db'],Set<string>>()
function materials(w:World){
 let ids=recipeInputs.get(w.db)
 if(!ids){ids=new Set(w.db.all<RecipeDef>('Recipe').flatMap(r=>r.inputs.map(i=>i.item)));recipeInputs.set(w.db,ids)}
 return ids
}
/** Filters describe actual capabilities and loaded recipes, without touching the world. */
export function inventoryMatches(w:World,it:ItemInst,group:InventoryGroup,query:string,displayLabel?:string){
 const d=itemDef(w,it),q=inventorySearchKey(query)
 const category=group==='all'||(group==='food'?!!d.food||!!d.drink:group==='medical'?d.category==='medical'||d.category==='drug'||!!d.medical||!!d.toolTags?.includes('needle'):group==='gear'?!!d.slot||!!d.attacks:!!d.rawMaterial||!!d.rawFragment||materials(w).has(d.id))
 return category&&(!q||inventorySearchKey(itemLabel(w,it)).includes(q)||displayLabel!==undefined&&inventorySearchKey(displayLabel).includes(q))
}
