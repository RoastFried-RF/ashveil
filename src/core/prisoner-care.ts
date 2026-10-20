import { consumeFor, type ActResult, type Action } from './actions'
import { bodyDef, capacity } from './body'
import { knownCreatureName } from './bestiary-state'
import { isCompanion, effectiveFaction } from './companion-state'
import { log, player, turnOf, TURNS_PER_DAY, type World } from './ctx'
import { hostile } from './diplomacy'
import { canSee, hasLos } from './fov'
import { cheb } from './geom'
import { itemDef } from './items'
import { diagonalBlocked } from './path'
import { prisonerCareDef } from './prisoner-state'
import { acknowledgeRescue } from './prisoners'
import { rescuedBy } from './rescue-state'
import { wakeAfterSleep } from './sleep-state'
import type { Creature } from './types'
export function prisonerCareAccess(w:World,provider:Creature,target:Creature,allowAsleep=false):string|null{
 if(!provider.alive||!target.alive||provider.id===target.id||!w.s.creatures.includes(provider)||!w.s.creatures.includes(target)||!target.captivity&&!isCompanion(w,target)&&!rescuedBy(w,provider,target))return '돌볼 포로나 동료가 곁에 없다'
 if(bodyDef(w,target).kind!=='humanoid')return '이 몸에 맞는 돌봄이 아니다'
 if(provider.unconscious||provider.asleep||provider.captivity||capacity(w,provider,'consciousness')<.5||capacity(w,provider,'manipulation')<.2)return '깨어서 돌볼 손을 쓸 수 있어야 한다'
 if(target.unconscious||capacity(w,target,'consciousness')<.5||!allowAsleep&&target.asleep)return '깨어서 삼킬 수 있는 상대여야 한다'
 if(cheb(provider.pos,target.pos)>1||!hasLos(w,provider.pos,target.pos)||!canSee(w,provider,target.pos)||diagonalBlocked(w,provider.pos,target.pos.x-provider.pos.x,target.pos.y-provider.pos.y))return '서로 보이는 곁에서 돌봐야 한다'
 return null
}
export function feedPrisoner(w:World,provider:Creature,target:Creature,uid:number):ActResult{
 const error=prisonerCareAccess(w,provider,target);if(error)return{ok:false,tu:0,msg:error}
 const item=provider.bag.find((i)=>i.uid===uid)
 if(!item)return{ok:false,tu:0,msg:'먹일 물품이 배낭에 없다'}
 const label=itemDef(w,item).label,before={kcal:target.needs.kcal,water:target.needs.waterDeficit},result=consumeFor(w,provider,target,uid)
 if(!result.ok)return result
 const care=target.captivity??(rescuedBy(w,provider,target)?target.rescue:undefined)
 if(care){const day=Math.floor(turnOf(w)/TURNS_PER_DAY),owner=isCompanion(w,provider)?player(w).id:provider.id,prior=care.care?.[owner],record=prior?.day===day?prior:{day,kcal:0,water:0};record.kcal=Math.round((record.kcal+Math.max(0,target.needs.kcal-before.kcal))*1e6)/1e6;record.water=Math.round((record.water+Math.max(0,before.water-target.needs.waterDeficit))*1e6)/1e6;(care.care??={})[owner]=record}
 acknowledgeRescue(w,provider,target)
 target.history.push({turn:turnOf(w),kind:'care',text:`${provider.name}에게 ${label}을(를) 받아 먹었다.`})
 if(provider.id===w.s.playerId)log(w,'info',`${knownCreatureName(w,target)}에게 ${label}을(를) 먹였다.`)
 return result
}
export function wakePrisoner(w:World,provider:Creature,target:Creature):ActResult{
 const error=prisonerCareAccess(w,provider,target,true);if(error)return{ok:false,tu:0,msg:error}
 if(!target.asleep)return{ok:false,tu:0,msg:'이미 깨어 있다'}
 if(target.activity&&target.activity.kind!=='sleep')return{ok:false,tu:0,msg:'수면 이외의 활동 중이다'}
 target.activity=undefined;wakeAfterSleep(w,target)
 if(target.captivity)target.captivity.awakeUntil=turnOf(w)+prisonerCareDef(w).awakeTurns
 acknowledgeRescue(w,provider,target)
 if(provider.id===w.s.playerId)log(w,'info',`${knownCreatureName(w,target)}을(를) 조심스레 깨웠다.`)
 return{ok:true,tu:prisonerCareDef(w).wakeTurns*100}
}
/** 포박은 생리적 수면을 막지 않는다. 감시자를 무서워해 무한히 잠들지 못하는 순환을 피한다. */
export function prisonerSleepAction(w:World,c:Creature):Action|null{
 if(!c.captivity)return null
 const d=prisonerCareDef(w)
 if(!c.asleep&&!c.unconscious&&!c.activity&&(c.captivity.awakeUntil??0)<=turnOf(w)&&(c.drowsyUntil??0)<=turnOf(w)&&c.needs.fatigue>=d.sleepAt&&c.needs.bodyTemp>=35)return{type:'sleep'}
 return{type:'wait'}
}
export function captivityGuard(w:World,c:Creature,o:Creature):boolean{
 if(!c.captivity||!o.alive)return false
 const owner=w.s.creatures.find((a)=>a.id===c.captivity!.captor)
 return o.id===c.captivity.captor||effectiveFaction(w,o)===c.captivity.faction||!!owner&&!hostile(w,owner,o)
}
