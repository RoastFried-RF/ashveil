// 불 위에 있는 실제 한 회분의 읽기 전용 상태와 영양.
import {campfireAt} from './campfire'
import {capacity} from './body'
import {canSee,hasLos} from './fov'
import {cheb,type Pos} from './geom'
import {diagonalBlocked} from './path'
import {turnOf,type World} from './ctx'
import {foodSafetyDef} from './food-state'
import {isCompanion} from './companion-state'
import {itemDef} from './items'
import type {CookingBatch,Creature,ItemInst} from './types'
export const cookingRules=(w:World)=>foodSafetyDef(w).cooking
export function cookingTemperature(w:World,b:CookingBatch,ambient:number){const f=campfireAt(w,b.pos);return f&&f.uid===b.fireUid&&!f.light.off&&(f.light.fuelUntil??0)>turnOf(w)?Math.max(ambient,cookingRules(w)?.temperature??ambient):ambient}
export const cookingSignature=(w:World,source:string)=>JSON.stringify({recipe:w.db.tryGet<import('./types').ItemDef>(source)?.cooking,food:w.db.tryGet<import('./types').ItemDef>(source)?.food,result:w.db.tryGet<import('./types').ItemDef>(w.db.tryGet<import('./types').ItemDef>(source)?.cooking?.result??'')?.food,rules:cookingRules(w)})
export function cookingAccess(w:World,c:Creature,pos:Pos){
 if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return '깨어서 조리할 손을 쓸 수 있어야 한다'
 if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return '모닥불이 보이는 바로 곁으로 가야 한다'
 return null
}
export function cookingSlotError(w:World,c:Creature,pos:Pos){
 const d=cookingRules(w),fire=campfireAt(w,pos);let error=cookingAccess(w,c,pos)
 if(!error&&(!d||!fire||fire.light.off||(fire.light.fuelUntil??0)<=turnOf(w)))error='땔감이 타는 실제 모닥불이 필요하다'
 const owner=fire?.tile.placed?.owner,base=w.s.map.baseCamp
 if(!error&&owner!==c.id&&!(base&&base.owner===owner&&isCompanion(w,c)))error='사용할 수 있는 모닥불이어야 한다'
 if(!error&&(w.s.map.cooking??[]).filter(b=>b.fireUid===fire!.uid).length>=d!.capacity)error='모닥불의 조리 자리가 차 있다'
 return error
}
export function cookingQuote(w:World,c:Creature,uid:number,pos:Pos){
 const d=cookingRules(w),it=c.bag.find(i=>i.uid===uid),recipe=it&&itemDef(w,it).cooking,fire=campfireAt(w,pos)
 let error=cookingSlotError(w,c,pos)
 if(!error&&(!d||!it||it.count<1||!recipe||!itemDef(w,it).food||!w.db.item(recipe.result).food))error='배낭의 구울 음식 한 개가 필요하다'
 return{error,turns:recipe?.turns??0,fireUid:fire?.uid}
}
export function cookingStatus(w:World,b:CookingBatch){
 const f=campfireAt(w,b.pos),hot=!!f&&f.uid===b.fireUid&&!f.light.off&&(f.light.fuelUntil??0)>turnOf(w)
 const unchanged=cookingSignature(w,b.source)===b.signature
 return{ready:b.progress>=b.total,burnt:!!b.item.foodBurnt,progress:b.progress,total:b.total,hot,reason:!unchanged?'원래 조리 규칙이 바뀌었다':!hot?'원래 모닥불에 땔감이 필요하다':'',remaining:Math.max(0,b.total-b.progress)}
}
export const foodKcal=(w:World,it:ItemInst)=>(itemDef(w,it).food?.kcal??0)*(it.foodBurnt?(cookingRules(w)?.burnKcal??1):1)
