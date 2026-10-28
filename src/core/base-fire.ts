import type { Action } from './actions'
import { approachBaseStore, baseStoreError, transferBase } from './base-camp'
import { baseCampDef, baseTaskActive } from './base-camp-state'
import { campfireAt, campfireDef, fireTurnsLeft, fireWorkQuote } from './campfire'
import { creatureAt, inBounds, terrainAt, tileAt, type World } from './ctx'
import { canSee, hasLos } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { diagonalBlocked, findPath } from './path'
import type { Creature } from './types'
export function baseFireDecision(w:World,c:Creature):{action?:Action;goal?:Pos}|null{
 const base=w.s.map.baseCamp,task=base?.tasks[c.id]
 if(!base||task?.kind!=='fire'||!baseTaskActive(w,c,task.id,false))return null
 const fire=task.firePos&&campfireAt(w,task.firePos)
 if(!fire||fire.uid!==task.fireUid||fire.tile.placed!.owner!==base.owner||cheb(task.firePos!,base.store)>baseCampDef(w).radius)return{action:{type:'wait'}}
 task.remaining=Math.max(0,(task.fireTarget??campfireDef(w).workerTarget)-fireTurnsLeft(w,task.firePos!))
 if(!task.remaining)return null
 const fuel=c.bag.find((i)=>i.def===campfireDef(w).fuel&&i.count>0)
 if(!fuel){
  if(baseStoreError(w,c))return{goal:approachBaseStore(w,c)}
  const stock=tileAt(w,base.store).cont?.items.find((i)=>i.def===campfireDef(w).fuel&&i.count>0)
  return stock&&!transferBase(w,c,'take',stock.uid,1,true)?{action:{type:'baseTransfer',direction:'take',uid:stock.uid,count:1}}:{action:{type:'wait'}}
 }
 const q=fireWorkQuote(w,c,task.firePos!,fuel.uid)
 if(!q.error)return{action:{type:'fireWork',pos:task.firePos!,uid:fuel.uid,baseOrder:task.id}}
 if(cheb(c.pos,task.firePos!)<=1&&hasLos(w,c.pos,task.firePos!)&&canSee(w,c,task.firePos!)&&!diagonalBlocked(w,c.pos,task.firePos!.x-c.pos.x,task.firePos!.y-c.pos.y))return{action:{type:'wait'}}
 const goal=DIRS.map((d)=>({x:task.firePos!.x+d.x,y:task.firePos!.y+d.y})).filter((p)=>inBounds(w,p)&&terrainAt(w,p).passable&&(!creatureAt(w,p)||creatureAt(w,p)!.id===c.id)&&canSee(w,c,p)&&hasLos(w,p,task.firePos!)&&!diagonalBlocked(w,p,task.firePos!.x-p.x,task.firePos!.y-p.y)&&!!findPath(w,c.pos,p,{avoidCreatures:true,selfId:c.id,maxNodes:1200})).sort((a,b)=>cheb(c.pos,a)-cheb(c.pos,b)||a.y-b.y||a.x-b.x)[0]
 return goal?{goal}:{action:{type:'wait'}}
}
export function baseFireStatus(w:World,c:Creature){const task=w.s.map.baseCamp!.tasks[c.id],fire=task.firePos&&campfireAt(w,task.firePos);if(!fire||fire.uid!==task.fireUid)return '배정한 실제 모닥불이 없거나 바뀌었다';const left=fireTurnsLeft(w,task.firePos!);return c.activity?.kind==='fire'?`실제 불 관리 ${c.activity.remaining}턴 남음`:left>=(task.fireTarget??campfireDef(w).workerTarget)?`연료 약${Math.floor(left/20)}분 남음`:'실제 땔감을 나르고 불을 관리한다'}
