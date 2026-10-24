import {carcassFood,carrionError} from './carrion'
import type {Action} from './actions'
import type {Creature,WildlifeRules} from './types'
import type {World} from './ctx'
import type {WildlifeNavigation} from './wildlife'
import {turnOf,tileAt} from './ctx'
import {bloodLoss,capacity} from './body'
import {canReach} from './combat'
import {meleeWield} from './items'
import {canSee} from './fov'
import {smells} from './perception'
import {cheb} from './geom'
import {bearHungry,seasonalSleepError} from './bear-state'
export function decideBear(w:World,c:Creature,rule:WildlifeRules,nav:WildlifeNavigation,forage:()=>Action):Action{
 const den=rule.den
 if(!den||!c.alive||c.asleep||c.unconscious||capacity(w,c,'consciousness')<.3)return{type:'wait'}
 if(!c.home)return forage()
 const origin=c.home,turn=turnOf(w),hungry=bearHungry(w,c)
 const observed=w.s.creatures.filter(other=>other.alive&&other.id!==c.id&&(w.db.body(other.body.def).kind==='humanoid'||w.db.body(other.body.def).kind==='mechanical'||w.db.creature(other.def).ai==='packHunter'&&!w.db.creature(other.def).wildlife||c.attackedBy?.includes(other.id))&&cheb(c.pos,other.pos)<=rule.threatRadius&&(canSee(w,c,other.pos)||smells(w,c,other)))
 if(bloodLoss(c)>=den.fleeBloodLoss){c.ai.target=undefined;c.ai.mode='flee';delete c.wildlifeState?.denWarning;return nav.away(observed)??(cheb(c.pos,origin)>0?nav.toward(origin):null)??{type:'wait'}}
 const target=observed.filter(other=>cheb(origin,other.pos)<=(hungry||c.attackedBy?.includes(other.id)?den.hungryLeash:den.territoryRadius)).sort((a,b)=>cheb(a.pos,c.pos)-cheb(b.pos,c.pos)||a.id-b.id)[0]
 if(target){
  if(!hungry&&!c.attackedBy?.includes(target.id)&&cheb(c.pos,target.pos)>den.warningRadius){c.ai.target=undefined;c.ai.mode='wander';return nav.toward(origin)??{type:'wait'}}
  c.ai.target=target.id;c.ai.lastSeen={...target.pos};c.ai.path=undefined
  if(!hungry&&!c.attackedBy?.includes(target.id)){
   const warning=c.wildlifeState?.denWarning
   if(warning?.actor!==target.id||turn-warning.at>1||warning.progress<den.warningTurns)return{type:'animalWarn',target:target.id}
  }
  c.ai.mode='hunt'
  // Real forepaws and jaws govern the two attack modes. Missing paws leave only the real bite.
  c.attackMode=capacity(w,c,'claw')>=.1&&(capacity(w,c,'bite')<.1||turn%2===0)?'paw':'bite'
  if(!meleeWield(w,c)){c.ai.target=undefined;c.ai.mode='flee';return nav.away(observed)??{type:'wait'}}
  const ability=capacity(w,c,'claw')>=.1?nav.ability(target,observed):null
  return ability??(canReach(w,c,target)&&meleeWield(w,c)?{type:'attack',target:target.id}:nav.toward(target.pos))??{type:'wait'}
 }
 if(c.wildlifeState?.denWarning)delete c.wildlifeState.denWarning
 c.ai.target=undefined;c.ai.mode='wander'
 if(c.needs.kcal<rule.eatBelow&&capacity(w,c,'eating')>=.1){
  const corpse=w.s.creatures.filter(other=>!other.alive&&cheb(c.pos,other.pos)<=rule.forageRadius&&cheb(origin,other.pos)<=den.hungryLeash&&canSee(w,c,other.pos)&&!!carcassFood(w,c,other)).sort((a,b)=>cheb(a.pos,c.pos)-cheb(b.pos,c.pos)||a.id-b.id)[0]
  if(corpse){if(!carrionError(w,c,corpse))return{type:'tearCarrion',target:corpse.id};const step=nav.toward(corpse.pos);if(step)return step}
 }
 // A scent comes from the actual floor UID or actual carrier, never a remembered log.
 if(hungry){
  const lure=w.s.creatures.filter(other=>other.alive&&other.id!==c.id&&other.bag.some(item=>item.count>0&&!item.missingItem&&!item.half&&!item.foodSealed&&den.lureFoodIds.includes(item.def))&&cheb(origin,other.pos)<=den.hungryLeash&&smells(w,c,other)).sort((a,b)=>cheb(a.pos,c.pos)-cheb(b.pos,c.pos)||a.id-b.id)[0]
  if(lure){const step=nav.toward(lure.pos);if(step)return step}
  for(let y=Math.max(0,c.pos.y-rule.forageRadius);y<=Math.min(w.s.map.h-1,c.pos.y+rule.forageRadius);y++)for(let x=Math.max(0,c.pos.x-rule.forageRadius);x<=Math.min(w.s.map.w-1,c.pos.x+rule.forageRadius);x++){
   const p={x,y};if(cheb(origin,p)>den.hungryLeash||!canSee(w,c,p)||!tileAt(w,p).items.some(item=>item.count>0&&!item.missingItem&&!item.half&&!item.foodSealed&&den.lureFoodIds.includes(item.def)))continue
   const step=nav.toward(p);if(step)return step
  }
 }
 if(!seasonalSleepError(w,c))return{type:'sleep',seasonal:true}
 return forage()
}
