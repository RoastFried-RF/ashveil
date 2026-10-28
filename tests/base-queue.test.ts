import {it,expect} from 'vitest'
import {baseFixture,finishBase} from './base-camp-fixture'
import {assignBaseTask,baseWorkDecision,editBaseQueue,enqueueBaseTask,startBaseCraft,startClaimBase,transferBase} from '../src/core/base-camp'
import {activityStep,perform} from '../src/core/actions'
import {addToBag,makeItem} from '../src/core/items'
import {tileAt} from '../src/core/ctx'
import {commandCompanion} from '../src/core/companions'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {findPath} from '../src/core/path'
import {dirIndex} from '../src/core/geom'
function fixture(){const d=baseFixture();expect(startClaimBase(d.w,d.p,d.store)).toBeNull();finishBase(d.w,d.p);return d}
function stock(d:ReturnType<typeof fixture>,count:number){const item=makeItem(d.w,'Item.Cloth',count);addToBag(d.w,d.p,item);expect(transferBase(d.w,d.p,'put',item.uid)).toBeNull();return item}
function work(d:ReturnType<typeof fixture>,steps:number){for(let n=0;n<steps;n++){
 if(d.worker.activity){activityStep(d.w,d.worker);continue}
 const decision=baseWorkDecision(d.w,d.worker,[])
 if(decision?.action)expect(perform(d.w,d.worker,decision.action).ok,JSON.stringify(decision)).toBe(true)
 else if(decision?.goal){const step=findPath(d.w,d.worker.pos,decision.goal,{selfId:d.worker.id,avoidCreatures:true})?.[0];if(step)expect(perform(d.w,d.worker,{type:'move',dir:dirIndex(step.x-d.worker.pos.x,step.y-d.worker.pos.y)}).ok).toBe(true)}
}}
it('finishes and deposits the current real batch before executing a queued recipe from the same finite stock',()=>{
 const d=fixture(),{w,worker,store}=d;stock(d,4);expect(assignBaseTask(w,worker,'craft','Recipe.Rope',1)).toBeNull();expect(enqueueBaseTask(w,worker,{kind:'craft',recipe:'Recipe.Bandage',batches:1})).toBeNull()
 const pending=w.s.map.baseCamp!.queues![worker.id][0];expect(w.s.map.baseCamp!.tasks[worker.id].recipe).toBe('Recipe.Rope');expect(tileAt(w,store).cont!.items.find(i=>i.def==='Item.Cloth')!.count).toBe(4)
 work(d,130)
 expect(w.s.map.baseCamp!.tasks[worker.id]).toMatchObject({id:pending.id,recipe:'Recipe.Bandage',remaining:0});expect(w.s.map.baseCamp!.queues?.[worker.id]).toBeUndefined()
 const items=tileAt(w,store).cont!.items;expect(items.find(i=>i.def==='Item.Rope')?.count).toBe(1);expect(items.find(i=>i.def==='Item.Bandage')?.count).toBe(1);expect(items.some(i=>i.def==='Item.Cloth')).toBe(false)
})
it('reorders or removes pending work without spending materials or losing a partial active job; stale edits are atomic',()=>{
 const d=fixture(),{w,worker}=d;addToBag(w,worker,makeItem(w,'Item.Cloth',2));assignBaseTask(w,worker,'craft','Recipe.Rope',1);startBaseCraft(w,worker);for(let n=0;n<5;n++)activityStep(w,worker)
 enqueueBaseTask(w,worker,{kind:'craft',recipe:'Recipe.Bandage'});enqueueBaseTask(w,worker,{kind:'gather',item:'Item.Wood'});const ids=w.s.map.baseCamp!.queues![worker.id].map(t=>t.id),progress=structuredClone(worker.workJob),activity=structuredClone(worker.activity)
 expect(editBaseQueue(w,worker,ids[1],'up')).toBeNull();expect(w.s.map.baseCamp!.queues![worker.id].map(t=>t.id)).toEqual(ids.slice().reverse());expect(worker.workJob).toEqual(progress);expect(worker.activity).toEqual(activity)
 const hash=stateHash(w.s);expect(editBaseQueue(w,worker,999999,'remove')).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 expect(editBaseQueue(w,worker,ids[0],'remove')).toBeNull();const restored=deserialize(serialize(w.s));expect(stateHash(restored)).toBe(stateHash(w.s))
 expect(commandCompanion(w,{...worker,activity:undefined},'hold')).not.toBeNull() // copied actors cannot be commanded
})
it('skips an unstarted job blocked on missing materials and performs another real pending job',()=>{
 const d=fixture(),{w,worker,store}=d;stock(d,2);assignBaseTask(w,worker,'craft','Recipe.RoastMeat',1);enqueueBaseTask(w,worker,{kind:'craft',recipe:'Recipe.Bandage'})
 work(d,90);expect(tileAt(w,store).cont!.items.find(i=>i.def==='Item.Bandage')?.count).toBe(1);expect(tileAt(w,store).cont!.items.some(i=>i.def==='Item.RawMeat')).toBe(false)
 expect(w.s.map.baseCamp!.tasks[worker.id].recipe).toBe('Recipe.RoastMeat')
})
it('caps the pending queue without consuming IDs on failure and cancels all pending orders on a new companion command',()=>{
 const d=fixture(),{w,worker}=d;for(let n=0;n<8;n++)expect(enqueueBaseTask(w,worker,{kind:'guard'})).toBeNull();const hash=stateHash(w.s);expect(enqueueBaseTask(w,worker,{kind:'guard'})).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
 expect(commandCompanion(w,worker,'hold')).toBeNull();expect(w.s.map.baseCamp!.queues?.[worker.id]).toBeUndefined();expect(worker.bag).toEqual([])
})
