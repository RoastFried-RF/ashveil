// Production intent is a saved job; raw materials and outputs remain ordinary physical items.
import {campfireAt}from'./campfire'
import {turnOf,tileAt,type World}from'./ctx'
import {readyFood}from'./open-food-state'
import {freshnessBand}from'./food-state'
import {residentProvisionDef}from'./resident-provisions'
import {foodKcal}from'./cooking-state'
import {foodServings}from'./food-vessels'
import {projectThermalState,type ThermalActivity}from'./thermal'
import {itemDef,equipError,equipDisplacements}from'./items'
import {canSee,hasLos}from'./fov'
import type{Creature,RecipeDef,Slot}from'./types'
import type{Pos}from'./geom'

export const residentWorkshopRules=(w:World)=>residentProvisionDef(w)?.workshop
export const workshopFoodKcal=(w:World,c:Creature)=>c.bag.reduce((n,i)=>n+(readyFood(w,c,i)&&!['spoiled','rotten'].includes(freshnessBand(w,i))?foodKcal(w,i)*foodServings(w,i)*i.count:0),0)
/** Ingredients reserved for the next batch cannot also satisfy the worker's personal pantry. */
export function workshopReserveKcal(w:World,c:Creature){const rule=residentWorkshopRules(w),r=rule&&w.db.tryGet<RecipeDef>(rule.recipe),inputs=new Set(r?.inputs.map(i=>i.item)??[]);return workshopFoodKcal(w,{...c,bag:c.bag.filter(i=>!inputs.has(i.def))})}
export function residentWorkshopActor(w:World,c:Creature){
 const rule=residentWorkshopRules(w)
 return!!rule&&c.id!==w.s.playerId&&c.alive&&w.s.creatures.includes(c)&&!!c.home&&!!c.residentSite&&c.residentSite===w.s.overworld?.currentRegion&&c.traderSite===c.residentSite&&c.faction===rule.faction
}
export function residentWorkshopOrder(w:World,c:Creature){
 const q=c.residentWorkshopOrder,rule=residentWorkshopRules(w)
 return residentWorkshopActor(w,c)&&q&&q.site===c.residentSite&&q.recipe===rule!.recipe&&q.rule===JSON.stringify(rule)&&q.at<=turnOf(w)?q:undefined
}
export function residentWorkshopProduct(w:World,c:Creature){
 const rule=residentWorkshopRules(w);if(!rule)return
 return c.bag.find(i=>i.workshopMade?.worker===c.id&&i.workshopMade.site===c.residentSite&&i.workshopMade.recipe===rule.recipe&&i.workshopMade.def===i.def&&i.count===1&&readyFood(w,c,i)&&freshnessBand(w,i)==='fresh')
}
export function residentWorkshopRecipe(w:World,c:Creature){
 const rule=residentWorkshopRules(w)
 if(!rule||!residentWorkshopOrder(w,c)||residentWorkshopProduct(w,c)||c.needs.kcal<500||c.needs.fatigue>=60||workshopReserveKcal(w,c)<rule.reserveKcal)return
 return w.db.tryGet<RecipeDef>(rule.recipe)
}
/** Only an actual ordinary craft at this worker's own finite fire receives the maker record. */
export function residentWorkshopCraftMarker(w:World,c:Creature,id:string){
 const job=c.workJob,r=residentWorkshopRecipe(w,c)
 if(r?.id!==id||job?.recipe!==id||!job.mealPlan||campfireAt(w,job.mealPlan.firePos)?.tile.placed?.owner!==c.id)return
 return{site:c.residentSite!,recipe:id}
}
/** Compare the same public forecast; only propose an ordinary swap of already owned clothes. */
export function residentWorkshopClothing(w:World,c:Creature,pos:Pos,activity:ThermalActivity){
 if(!residentWorkshopActor(w,c)||c.activity||c.workJob||c.asleep||c.unconscious||c.captivity||c.companion||c.rescue||c.breakdown)return
 const score=(actor:Creature)=>{const q=projectThermalState(w,actor,activity,pos);return Math.max(q.low-q.feels,q.feels-q.high,0)}
 const current=score(c),choices=[]
 if(current<.5)return
 for(const it of c.bag){
  const d=itemDef(w,it),slot=d.slot as Slot|undefined
  if(d.category!=='apparel'||!d.apparel||!slot||d.slot==='ring'||it.count!==1||equipError(w,c,it.uid,slot))continue
  const equip={...c.equip};for(const old of equipDisplacements(w,c,it,slot))delete equip[old.slot];equip[slot]=it
  const improvement=current-score({...c,equip});if(improvement>=.5)choices.push({uid:it.uid,slot,improvement})
 }
 choices.sort((a,b)=>b.improvement-a.improvement||a.uid-b.uid)
 const q=choices[0];return q?{type:'equip'as const,uid:q.uid,slot:q.slot}:undefined
}
export function residentWorkshopRestClothing(w:World,c:Creature){
 if(c.needs.fatigue<60&&c.needs.bodyTemp>=36.5&&c.needs.bodyTemp<=38)return
 const bed=c.needs.fatigue>=60?w.s.map.residentBeds?.find(b=>b.owner===c.id&&!b.packedUid&&canSee(w,c,b.pos)&&hasLos(w,c.pos,b.pos)&&tileAt(w,b.pos).t===b.terrain):undefined
 return residentWorkshopClothing(w,c,bed?.pos??c.pos,bed?'sleep':'rest')
}
