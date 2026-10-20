import { capacity, handCapacity } from './body'
import { knownCreatureName } from './bestiary-state'
import { effectiveFaction, followingParty } from './companion-state'
import { creatureAt, inBounds, log, player, terrainAt, turnOf, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { itemDef } from './items'
import { prostheticGrip } from './prosthetic-state'
import { diagonalBlocked } from './path'
import { hasEffect } from './traits'
import type { Creature, PrisonerEscortDef } from './types'
export const prisonerEscortDef=(w:World)=>w.db.get<PrisonerEscortDef>('PrisonerEscort.Hearth')
function freeGrip(w:World,c:Creature,hand:'Left'|'Right'){
 return !c.equip[hand==='Left'?'off':'main']&&!(c.equip.main&&itemDef(w,c.equip.main).twoHanded)&&prostheticGrip(w,c,hand)&&handCapacity(w,c,hand,true)>=.2
}
export function escortHand(w:World,actor:Creature,target:Creature):'Left'|'Right'|undefined{
 if(actor.leading)return actor.leading.target===target.id&&actor.leading.uid===target.captivity?.rope.uid&&freeGrip(w,actor,actor.leading.hand)?actor.leading.hand:undefined
 return(['Left','Right']as const).find((side)=>freeGrip(w,actor,side))
}
export function escortOrderError(w:World,actor:Creature,target:Creature,order:'escort'|'hold'):string|null{
 const cap=target.captivity
 if(!cap||cap.faction!==effectiveFaction(w,actor))return '같은 편이 포박한 사람이어야 한다'
 if(order==='hold')return !cap.anklesFree?'이미 발목까지 묶여 있다':null
 if(cap.escort)return '이미 호송 중이다'
 if(target.asleep||target.unconscious||target.activity||capacity(w,target,'consciousness')<.5||capacity(w,{...target,captivity:undefined},'moving')<.2)return '상대가 깨어서 직접 걸을 수 있어야 한다'
 if(!escortHand(w,actor,target))return '밧줄을 잡을 온전한 빈손이 하나 필요하다'
 return null
}
/** 손을 놓아도 발목이 저절로 다시 묶이지 않는다. 손목 밧줄은 원래 인물에게 남는다. */
export function endEscort(w:World,c:Creature){
 if(!c.captivity?.escort&&!w.s.creatures.some((actor)=>actor.leading?.target===c.id))return
 const all=[...w.s.creatures,...Object.values(w.s.offCreatures).flat(),...Object.values(w.s.overworld?.scenes??{}).flatMap((s)=>[...s.creatures,...Object.values(s.offCreatures).flat()])]
 for(const actor of all)if(actor.leading?.target===c.id)actor.leading=undefined
 if(c.captivity){c.captivity.escort=undefined;c.captivity.yieldTo=undefined}
 c.ai.path=undefined
}
export function finishEscortOrder(w:World,actor:Creature,target:Creature,order:'escort'|'hold'){
 endEscort(w,target)
 const cap=target.captivity!
 if(order==='hold')cap.anklesFree=undefined
 else{const hand=escortHand(w,actor,target)!;cap.anklesFree=true;cap.escort=true;cap.captor=actor.id;cap.lastCaptor={...actor.pos};actor.leading={target:target.id,uid:cap.rope.uid,hand}}
 if(actor.id===w.s.playerId)log(w,'info',`${knownCreatureName(w,target)}${order==='hold'?'의 발목을 다시 묶었다.':'의 발목을 풀고 빈손으로 밧줄을 잡았다.'}`)
}
export function escortControlError(w:World,target:Creature):string|null{
 const cap=target.captivity,actor=w.s.creatures.find((c)=>c.id===cap?.captor)
 if(!cap?.escort||!cap.anklesFree||!target.alive||!w.s.creatures.includes(target)||!actor?.alive||actor.leading?.target!==target.id||actor.leading.uid!==cap.rope.uid)return '같은 인물과 밧줄의 호송 연결이 없다'
 if(actor.asleep||actor.unconscious||['microsleep','stunned','knockedDown'].some((kind)=>hasEffect(actor,kind,turnOf(w)))||actor.captivity||capacity(w,actor,'consciousness')<.5||!freeGrip(w,actor,actor.leading.hand))return '깨어서 밧줄을 잡을 수 없다'
 if(cheb(actor.pos,target.pos)>prisonerEscortDef(w).leashRadius||!hasLos(w,actor.pos,target.pos)||!canSee(w,actor,target.pos))return '밧줄을 잡고 지켜볼 거리에서 벗어났다'
 return null
}
export function escortGoal(w:World,c:Creature):Pos|null{
 if(!c.captivity?.escort)return null
 if(escortControlError(w,c)){endEscort(w,c);if(canSee(w,player(w),c.pos))log(w,'warn',`${knownCreatureName(w,c)}의 호송 밧줄을 놓쳤다.`);return null}
 const actor=w.s.creatures.find((a)=>a.id===c.captivity!.captor)!
 if(canSee(w,c,actor.pos))c.captivity.lastCaptor={...actor.pos}
 const anchor=c.captivity.lastCaptor!
 const requested=c.captivity.yieldTo
 if(requested){
  if(cheb(c.pos,requested)===0||!inBounds(w,requested)||!terrainAt(w,requested).passable||!hasLos(w,anchor,requested)||cheb(anchor,requested)>prisonerEscortDef(w).leashRadius||creatureAt(w,requested))c.captivity.yieldTo=undefined
  else return requested
 }
 if(cheb(c.pos,anchor)<=1)return null
 return DIRS.map((d)=>({x:anchor.x+d.x,y:anchor.y+d.y})).filter((pos)=>inBounds(w,pos)&&terrainAt(w,pos).passable&&!creatureAt(w,pos)).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]??null
}
export function escortTick(w:World,actor:Creature){
 if(!actor.leading)return
 const target=w.s.creatures.find((c)=>c.id===actor.leading!.target)
 if(!target){actor.leading=undefined;return}
 if(escortControlError(w,target)){endEscort(w,target);if(canSee(w,player(w),target.pos))log(w,'warn',`${knownCreatureName(w,target)}의 호송 밧줄을 놓쳤다.`)}
}
export function letGoEscort(w:World,actor:Creature):string|null{
 const target=w.s.creatures.find((c)=>c.id===actor.leading?.target)
 if(!actor.alive||actor.asleep||actor.unconscious||actor.captivity||!target?.captivity?.escort||target.captivity.captor!==actor.id||target.captivity.rope.uid!==actor.leading?.uid)return '지금 잡고 있는 호송 밧줄이 없다'
 endEscort(w,target)
 if(actor.id===w.s.playerId)log(w,'info','호송 밧줄을 놓았다. 상대의 손목 결박은 남아 있다.')
 return null
}
/** 길을 막으면 인물의 다음 실제 차례에 비키도록 이끈다. 요청자가 즉시 밀어 옮기지 않는다. */
export function requestEscortYield(w:World,actor:Creature,target:Creature):string|null{
 if(actor.leading?.target!==target.id||escortControlError(w,target)||target.asleep||target.unconscious||target.activity||capacity(w,target,'moving')<.2)return '상대가 직접 비켜설 수 없다'
 const goal=DIRS.map((d)=>({x:target.pos.x+d.x,y:target.pos.y+d.y})).filter((pos)=>inBounds(w,pos)&&terrainAt(w,pos).passable&&!terrainAt(w,pos).water&&!terrainAt(w,pos).stairs&&!creatureAt(w,pos)&&!diagonalBlocked(w,target.pos,pos.x-target.pos.x,pos.y-target.pos.y)&&cheb(actor.pos,pos)<=prisonerEscortDef(w).leashRadius&&hasLos(w,actor.pos,pos)).sort((a,b)=>cheb(a,actor.pos)-cheb(b,actor.pos)||a.y-b.y||a.x-b.x)[0]
 if(!goal)return '밧줄 거리 안에 비켜설 빈 바닥이 없다'
 target.captivity!.yieldTo=goal;target.ai.path=undefined
 if(actor.id===w.s.playerId)log(w,'info',`${knownCreatureName(w,target)}에게 길을 비키도록 밧줄을 이끌었다.`)
 return null
}
/** 계약 동료와 실제로 밧줄을 잡은 인물이 이끄는 포로만 이동 명단에 넣는다. */
export function travellingParty(w:World):Creature[]{
 const companions=followingParty(w),captors=[player(w),...companions]
 return[...companions,...w.s.creatures.filter((c)=>c.alive&&c.captivity?.escort&&captors.some((a)=>a.id===c.captivity!.captor&&a.leading?.target===c.id))]
}
