import {describe,it,expect} from 'vitest'
import {prisonerFixture} from './prisoner-fixture'
import {makeItem} from '../src/core/items'
import {perform,type Action} from '../src/core/actions'
import {serialize} from '../src/core/save'
import {startActionObservation,takeActionObservations} from '../src/core/action-observations'

describe('optional action observations',()=>{
 it('preserves complete serialized state and action results when observation is enabled',()=>{
  const a=prisonerFixture(),b=prisonerFixture()
  for(const fixture of[a,b]){fixture.p.bag=[];fixture.p.bag.push(makeItem(fixture.w,'Item.RustyKnife'))}
  expect(serialize(a.s)).toBe(serialize(b.s));const stop=startActionObservation(b.w)
  const actions:Action[]=[{type:'face',dir:4},{type:'drop',uid:a.p.bag[0].uid},{type:'wait'},{type:'move',dir:0}]
  for(const action of actions){expect(perform(a.w,a.p,action)).toEqual(perform(b.w,b.p,action));expect(serialize(a.s)).toBe(serialize(b.s))}
  const events=takeActionObservations(b.w);expect(events.map(e=>e.action.type)).toEqual(actions.map(a=>a.type));expect(events.find(e=>e.action.type==='drop')?.item?.def).toBe('Item.RustyKnife');expect(takeActionObservations(a.w)).toEqual([]);stop()
 })
 it('does not report rejected actions or retain observations after disposal',()=>{
  const{w,p}=prisonerFixture(),stop=startActionObservation(w)
  expect(perform(w,p,{type:'drop',uid:987654321}).ok).toBe(false);expect(takeActionObservations(w)).toEqual([])
  perform(w,p,{type:'wait'});stop();expect(takeActionObservations(w)).toEqual([])
  perform(w,p,{type:'wait'});expect(takeActionObservations(w)).toEqual([])
 })
 it('bounds long fast-forward sessions without adding records to the save',()=>{
  const{w,p}=prisonerFixture(),stop=startActionObservation(w)
  for(let n=0;n<200;n++)perform(w,p,{type:'wait'})
  expect(takeActionObservations(w)).toHaveLength(64);expect(serialize(w.s)).not.toContain('observation');stop()
 })
 it('keeps the primary action while observing many subsequent NPC actions',()=>{
  const{w,p}=prisonerFixture(),npc=w.s.creatures.find(c=>c.id!==p.id)!,stop=startActionObservation(w)
  p.bag=[];const knife=makeItem(w,'Item.RustyKnife');p.bag.push(knife)
  expect(perform(w,p,{type:'drop',uid:knife.uid}).ok).toBe(true)
  for(let n=0;n<100;n++)perform(w,npc,{type:'wait'})
  const events=takeActionObservations(w);expect(events).toHaveLength(64);expect(events.some(e=>e.id===p.id&&e.action.type==='drop')).toBe(true);expect(events.some(e=>e.id===npc.id)).toBe(true);stop()
 })
})

it('observes original pocket consumption without changing state or borrowing another identical item',()=>{
 const a=prisonerFixture(),b=prisonerFixture()
 for(const{w,p}of[a,b]){p.bag=[];p.equip={};const belt=makeItem(w,'Item.LeatherBelt'),food=makeItem(w,'Item.Jerky');food.gx=0;food.gy=0;belt.contents=[food];p.equip.belt=belt}
 const uid=a.p.equip.belt!.contents![0].uid;startActionObservation(b.w)
 expect(perform(a.w,a.p,{type:'consume',uid})).toEqual(perform(b.w,b.p,{type:'consume',uid}));expect(serialize(a.s)).toBe(serialize(b.s));const event=takeActionObservations(b.w).find(e=>e.action.type==='consume')!;expect(event.item).toMatchObject({uid,def:'Item.Jerky'});expect(b.p.equip.belt!.contents).toEqual([]);expect(serialize(a.s)).toBe(serialize(b.s))
})
it.each(['half','broken']as const)('does not read inaccessible %s belt contents into action observation',state=>{
 const{w,p}=prisonerFixture();p.bag=[];p.equip={};const belt=makeItem(w,'Item.LeatherBelt'),food=makeItem(w,'Item.Jerky');food.gx=0;food.gy=0;belt.contents=[food];if(state==='half')belt.half=true;else belt.durability=0;p.equip.belt=belt;const before=serialize(w.s);startActionObservation(w);expect(perform(w,p,{type:'consume',uid:food.uid}).ok).toBe(false);expect(takeActionObservations(w)).toEqual([]);expect(serialize(w.s)).toBe(before)
})
