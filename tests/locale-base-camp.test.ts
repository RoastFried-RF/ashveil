import{describe,it,expect}from'vitest'
import{assignBaseTask,baseOrderLabel,baseTaskStatus,startClaimBase}from'../src/core/base-camp'
import{serialize}from'../src/core/save'
import type{World}from'../src/core/ctx'
import type{ItemDef}from'../src/core/types'
import{displayBaseTaskSummary,translateBaseOrderLabel,translateBaseTaskStatus}from'../src/client/locales/base-camp'
import{translateDef}from'../src/client/locales/content'
import{baseFixture,finishBase}from'./base-camp-fixture'

function setup(){const d=baseFixture();expect(startClaimBase(d.w,d.p,d.store)).toBeNull();finishBase(d.w,d.p);return d}

describe('base work display follows actual tasks without changing the world',()=>{
 it('uses the actual hauling target and preserves every original world field',()=>{
  const{w,worker}=setup();expect(assignBaseTask(w,worker,'haul',undefined,3,'Item.Wood')).toBeNull();const before=serialize(w.s),task=w.s.map.baseCamp!.tasks[worker.id],source=baseTaskStatus(w,worker)
  expect(translateBaseTaskStatus(w,worker,source,'en')).toBe('Wood · 3 more needed to reach the target of 3')
  expect(translateBaseTaskStatus(w,worker,source,'ko')).toBe(source)
  expect(translateBaseOrderLabel(w,task,'en')).toBe('Wood · haul 3');expect(translateBaseOrderLabel(w,task,'ko')).toBe(baseOrderLabel(w,task))
  const changed=source.replace('3개가 더','4개가 더');expect(changed).not.toBe(source);expect(translateBaseTaskStatus(w,worker,changed,'en')).toBe(changed)
  expect(serialize(w.s)).toBe(before)
 })
 it('never turns a task Def ID into appraisal knowledge',()=>{
  const{w,worker}=setup(),relic=w.db.all<ItemDef>('Item').find(d=>d.relic&&d.unknownLabel)!;expect(relic).toBeDefined();expect(assignBaseTask(w,worker,'haul',undefined,1,relic.id)).toBeNull()
  const task=w.s.map.baseCamp!.tasks[worker.id],before=serialize(w.s),unknown=translateDef(relic,'unknownLabel','en'),identified=translateDef(relic,'label','en')
  for(const text of[displayBaseTaskSummary(w,task,'en'),translateBaseOrderLabel(w,task,'en'),translateBaseTaskStatus(w,worker,baseTaskStatus(w,worker),'en')]){expect(text).toContain(unknown);if(unknown!==identified)expect(text).not.toContain(identified)}
  expect(serialize(w.s)).toBe(before)
 })
 it('keeps changed external Def labels with braces and dollar signs literal',()=>{
  const{w,worker}=setup();expect(assignBaseTask(w,worker,'haul',undefined,3,'Item.Wood')).toBeNull();const task=w.s.map.baseCamp!.tasks[worker.id],original=w.db.item('Item.Wood'),foreign={...original,label:'원래 {0} $&'}
  const proxy=new Proxy(w.db,{get(target,key){if(key==='tryGet')return(id:string)=>id===original.id?foreign:target.tryGet(id);return Reflect.get(target,key)}}),view:World={...w,db:proxy},before=serialize(w.s)
  expect(translateBaseOrderLabel(view,task,'en')).toBe('원래 {0} $& · haul 3');expect(serialize(w.s)).toBe(before)
 })
 it('shows a missing saved task item without throwing or inventing it',()=>{
  const{w,worker}=setup();expect(assignBaseTask(w,worker,'haul',undefined,3,'Item.Wood')).toBeNull();const task=w.s.map.baseCamp!.tasks[worker.id];task.item='mod.missing-item'
  const before=serialize(w.s),source=baseTaskStatus(w,worker);expect(source).toContain('현재 구성')
  expect(translateBaseTaskStatus(w,worker,source,'en')).toContain('missing from the current configuration')
  expect(displayBaseTaskSummary(w,task,'en')).toBe('Missing item · 3 left to haul');expect(translateBaseOrderLabel(w,task,'en')).toBe('Missing item · haul 3');expect(serialize(w.s)).toBe(before)
 })
})
