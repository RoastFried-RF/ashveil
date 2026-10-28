import {it,expect} from 'vitest'
import {baseFixture,finishBase} from './base-camp-fixture'
import {assignBaseTask,baseOrderProblem,baseWorkDecision,enqueueBaseTask,startBaseCraft,startClaimBase,transferBase} from '../src/core/base-camp'
import {baseCraftStock} from '../src/core/base-camp-state'
import {addToBag,makeItem} from '../src/core/items'
import {activityStep,perform} from '../src/core/actions'
import {tileAt} from '../src/core/ctx'
import {stateHash} from '../src/core/save'
function fixture(){const d=baseFixture(),{w,p,worker}=d;startClaimBase(w,p,d.store);finishBase(w,p);const other=structuredClone(worker);other.id=w.s.nextId++;other.name='두 번째 작업자';other.pos={x:19,y:21};w.s.creatures.push(other);for(const c of[worker,other]){addToBag(w,c,makeItem(w,'Item.Cloth',2));assignBaseTask(w,c,'craftStock','Recipe.Bandage',1)}return{...d,other}}
it('counts only another worker material-bound started batch as incoming, and avoids starting duplicate stock',()=>{
 const d=fixture(),{w,worker,other}=d;expect(baseCraftStock(w,other)).toMatchObject({stock:0,incoming:0,needed:1});expect(startBaseCraft(w,worker)).toBeNull();const hash=stateHash(w.s);expect(baseCraftStock(w,other)).toMatchObject({stock:0,carried:0,incoming:1,needed:0});expect(stateHash(w.s)).toBe(hash)
 expect(baseWorkDecision(w,other,[])).toBeNull();expect(other.workJob).toBeUndefined();expect(other.bag[0].count).toBe(2)
 finishBase(w,worker);const output=worker.bag.find(i=>i.def==='Item.Bandage')!;expect(baseCraftStock(w,other)).toMatchObject({stock:0,incoming:1,needed:0});expect(transferBase(w,worker,'put',output.uid)).toBeNull();expect(baseCraftStock(w,other)).toMatchObject({stock:1,incoming:0,needed:0});expect(transferBase(w,d.p,'take',output.uid)).toBeNull();expect(baseCraftStock(w,other)).toMatchObject({stock:0,incoming:0,needed:1})
})
it('invalid, unpaid or dead started work promises no finished item',()=>{
 for(const mode of['material','paid','dead']){const{w,worker,other}=fixture();startBaseCraft(w,worker);if(mode==='material')worker.bag=[];else if(mode==='paid')worker.companion!.paidUntil=Math.floor(w.s.time/100);else worker.alive=false;const hash=stateHash(w.s);expect(baseCraftStock(w,other)).toMatchObject({stock:0,incoming:0,needed:1});expect(stateHash(w.s)).toBe(hash)}
})
it('keeps a removed recipe paused and runs a valid pending recipe without throwing or inventing input',()=>{
 const d=fixture(),{w,worker,store}=d;delete w.s.map.baseCamp!.tasks[d.other.id];w.s.map.baseCamp!.tasks[worker.id].recipe='Recipe.RemovedByConfiguration';expect(baseOrderProblem(w,w.s.map.baseCamp!.tasks[worker.id])).not.toBeNull();expect(enqueueBaseTask(w,worker,{kind:'craft',recipe:'Recipe.Bandage'})).toBeNull()
 for(let n=0;n<100;n++){if(worker.activity)activityStep(w,worker);else{const d=baseWorkDecision(w,worker,[]);if(d?.action)expect(perform(w,worker,d.action).ok).toBe(true)}}
 expect(tileAt(w,store).cont!.items.find(i=>i.def==='Item.Bandage')?.count).toBe(1);expect(w.s.map.baseCamp!.queues![worker.id].some(t=>t.recipe==='Recipe.RemovedByConfiguration')).toBe(true)
})
