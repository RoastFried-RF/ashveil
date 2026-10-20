import { inBounds, terrainAt, tileAt, type World } from './ctx'
import { capacity } from './body'
import { hostile } from './diplomacy'
import { canSee } from './fov'
import { cheb } from './geom'
import type { BaseCampDef, Creature } from './types'
export const baseCampDef=(w:World)=>w.db.get<BaseCampDef>('BaseCamp.Hearth')
/** 실제로 끝낸 배정 제작만 센다. 취소/다른 지도/바뀐 명령은 완료로 세지 않는다. */
export function recordBaseCraft(w:World,c:Creature){
 const task=w.s.map.baseCamp?.tasks[c.id]
 if(task?.kind==='craft'&&task.id===c.workJob?.baseOrder&&task.recipe===c.workJob.recipe)task.remaining=Math.max(0,task.remaining-1)
}
export function baseTaskActive(w:World,c:Creature,order:number,needsRemaining=true){
 const base=w.s.map.baseCamp,task=base?.tasks[c.id]
 return !!base&&c.alive&&!c.asleep&&!c.unconscious&&!c.captivity&&capacity(w,c,'consciousness')>=.5&&base.owner===w.s.playerId&&task?.id===order&&(!needsRemaining||task.remaining>0)&&c.companion?.status==='employed'&&c.companion.order==='defend'&&c.companion.employer===base.owner&&inBounds(w,base.store)&&terrainAt(w,base.store).id===baseCampDef(w).storeTerrain&&tileAt(w,base.store).placed?.item.uid===base.storeUid&&!w.s.creatures.some((o)=>o.alive&&!o.asleep&&!o.unconscious&&!o.captivity&&o.ai.mode!=='surrender'&&hostile(w,c,o)&&canSee(w,c,o.pos))
}
export function baseCraftActive(w:World,c:Creature){
 const base=w.s.map.baseCamp,task=base?.tasks[c.id]
 return !!base&&task?.kind==='craft'&&task.id===c.workJob?.baseOrder&&task.recipe===c.workJob.recipe&&cheb(c.pos,base.store)<=baseCampDef(w).radius&&baseTaskActive(w,c,task.id)
}
export function clearBaseTask(w:World,c:Creature){
 const base=w.s.map.baseCamp,old=base?.tasks[c.id]
 if(!old)return
 if(c.activity?.baseOrder===old.id)c.activity=undefined
 if(c.workJob?.baseOrder===old.id){if(c.activity?.kind==='craft')c.activity=undefined;c.workJob=undefined}
 delete base!.tasks[c.id]
}

export function refreshBaseLogistics(w:World,item?:string){const base=w.s.map.baseCamp;if(!base)return;const stock=tileAt(w,base.store).cont?.items??[];for(const task of Object.values(base.tasks))if(['haul','gather'].includes(task.kind)&&task.targetStock!==undefined&&(!item||task.item===item))task.remaining=Math.max(0,task.targetStock-stock.filter((i)=>i.def===task.item).reduce((n,i)=>n+i.count,0))}
