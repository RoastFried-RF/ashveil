import { suitableDrink } from './water-state'
// 현지 NPC는 같은 제작·포박·해방·급식 행동을 쓴다. 개인 재고 밖의 물품은 만들지 않는다.
import type { Action } from './actions'
import { multiTurnFactor } from './action-time'
import { bodyDef, capacity } from './body'
import { effectiveFaction } from './companion-state'
import { craftError } from './crafting'
import type { World } from './ctx'
import { hostile } from './diplomacy'
import { foodFreshness } from './food-state'
import { itemDef } from './items'
import { prisonerCareAccess } from './prisoner-care'
import { prisonerDef } from './prisoner-state'
import { prisonerAccess, prisonerQuote } from './prisoners'
import { rescueCaptor } from './rescue-state'
import type { Creature, NpcCustodyDef, RecipeDef } from './types'

export const npcCustodyDef=(w:World)=>w.db.get<NpcCustodyDef>('NpcCustody.Hearth')
export function npcCustodyAction(w:World,c:Creature,threats:Creature[]):Action|null{
 const d=npcCustodyDef(w)
 if(!d.roles.includes(w.db.creature(c.def).ai)||!c.alive||c.asleep||c.unconscious||c.captivity||c.activity||bodyDef(w,c).kind!=='humanoid'||['flee','surrender','calm'].includes(c.ai.mode)||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return null
 if(threats.some((o)=>o.alive&&!o.unconscious&&!o.asleep&&!o.captivity&&o.ai.mode!=='surrender'))return null
 const nearby=w.s.creatures.filter((o)=>o.id!==c.id&&o.alive&&!prisonerAccess(w,c,o))
 // 같은 편의 실제 포박자를 확인하고 해방한다. 외교적으로 중립인 타인의 포로를 빼앗지 않는다.
 const ally=nearby.find((o)=>o.captivity&&(effectiveFaction(w,c)===effectiveFaction(w,o)||c.faction===o.faction)&&!hostile(w,c,o)&&rescueCaptor(w,c,o)&&!prisonerQuote(w,c,o,'release').error)
 if(ally)return{type:'prisoner',operation:'release',target:ally.id}
 const target=nearby.find((o)=>!o.captivity&&hostile(w,c,o)&&(o.unconscious||o.ai.mode==='surrender'&&!o.asleep&&!o.activity))
 if(target){
  const rope=c.bag.find((i)=>i.def===prisonerDef(w).rope&&i.count>0&&(i.durability??100)>0)
  if(rope&&!prisonerQuote(w,c,target,'bind',rope.uid).error)return{type:'prisoner',operation:'bind',target:target.id,ropeUid:rope.uid}
  const recipe=w.db.get<RecipeDef>(d.ropeRecipe)
  if(!rope&&(!c.workJob||c.workJob.kind==='craft'&&c.workJob.recipe===recipe.id)&&multiTurnFactor(w,c)<=4&&!craftError(w,c,recipe))return{type:'craft',id:recipe.id}
 }
 for(const patient of nearby){
  if(patient.captivity?.faction!==effectiveFaction(w,c)||prisonerCareAccess(w,c,patient))continue
  if(patient.needs.waterDeficit>=d.drinkAbove&&c.needs.waterDeficit<d.drinkAbove){
   const water=c.bag.find((i)=>itemDef(w,i).drink&&!itemDef(w,i).drink!.alcohol&&(i.uses??1)>0&&!i.waterFrozen&&suitableDrink(w,i))
   if(water)return{type:'feedPrisoner',target:patient.id,uid:water.uid}
  }
  if(patient.needs.kcal<d.careBelowKcal&&c.needs.kcal>=d.careBelowKcal){
   const food=c.bag.find((i)=>itemDef(w,i).food&&!itemDef(w,i).food!.raw&&!i.foodFrozen&&foodFreshness(i)>=d.minFreshness)
   if(food)return{type:'feedPrisoner',target:patient.id,uid:food.uid}
  }
 }
 return null
}
