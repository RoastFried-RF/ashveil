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
