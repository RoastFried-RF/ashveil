import {describe,expect,it} from 'vitest'
import {activityStep,consumeFor} from '../src/core/actions'
import {startCraft} from '../src/core/crafting'
import {turnOf} from '../src/core/ctx'
import {boiledMealQuote} from '../src/core/boiled-meal'
import {drinkVolume} from '../src/core/wash-water'
import {serialize,deserialize} from '../src/core/save'
import {foodExposureLungDose} from '../src/core/food-exposure-state'
import type {RecipeDef} from '../src/core/types'
import {boiledMealFixture} from './boiled-meal-fixture'
import {finishBase} from './base-camp-fixture'

function setup(ml=1000,fire=true){
 const d=boiledMealFixture(ml,fire),ash=d.add('Item.TowerAsh',2)
 d.p.hands={kind:'washed',at:turnOf(d.w)}
 return {...d,ash,recipe:'Recipe.Ashcake'}
}
describe('ashcake uses the original cooking transaction',()=>{
 it('quotes without mutation, spends one dose/80ml only at completion and returns the same original bowl',()=>{
  const d=setup(),before=serialize(d.s),next=d.s.nextId
  const quote=boiledMealQuote(d.w,d.p,d.w.db.get<RecipeDef>(d.recipe))
  expect(quote).toMatchObject({error:null,plan:{ml:80,bottleUid:d.bottle.uid,vesselUid:d.bowl.uid}})
  expect(serialize(d.s)).toBe(before)
  expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull()
  for(let i=0;i<399;i++)activityStep(d.w,d.p)
  expect(d.ash.count).toBe(2);expect(d.oats.count).toBe(3);expect(drinkVolume(d.w,d.bottle)).toBe(1000);expect(d.bowl.def).toBe('Item.Bowl')
  const resumed={db:d.w.db,s:deserialize(serialize(d.s))}
  activityStep(d.w,d.p)
  const original=d.p.bag.find(i=>i.uid===d.bowl.uid)!
  expect(original).toMatchObject({def:'Item.Ashcake',uid:d.bowl.uid,quality:3,durability:81,uses:1})
  expect(d.ash.count).toBe(1);expect(d.oats.count).toBe(2);expect(drinkVolume(d.w,d.bottle)).toBe(920);expect(d.s.nextId).toBe(next)
  const person=resumed.s.creatures.find(c=>c.id===resumed.s.playerId)!
  activityStep(resumed,person);expect(serialize(resumed.s)).toBe(serialize(d.s))
  expect(consumeFor(d.w,d.p,d.p,original.uid)).toMatchObject({ok:true,tu:100})
  expect(original.def).toBe('Item.Bowl');expect(original.uid).toBe(d.bowl.uid)
  expect(d.p.foodExposureTraining?.[0].doseCount).toBe(1)
  expect(foodExposureLungDose(d.p)).toBeCloseTo(1/3)
 })
 it('refuses missing finite resources without spending the remaining originals',()=>{
  for(const missing of ['ash','oats','bowl','water','fire']){
   const d=setup(missing==='water'?79:1000,missing!=='fire')
   if(missing==='ash'||missing==='oats'||missing==='bowl')d.p.bag=d.p.bag.filter(i=>i.uid!==d[missing].uid)
   const before=serialize(d.s);expect(startCraft(d.w,d.p,d.recipe,1),missing).not.toBeNull();expect(serialize(d.s),missing).toBe(before)
  }
 })
 it('will not replace reserved ash by a different stack during a paused meal',()=>{
  const d=setup();expect(startCraft(d.w,d.p,d.recipe,1)).toBeNull();activityStep(d.w,d.p)
  d.p.bag=d.p.bag.filter(i=>i.uid!==d.ash.uid);const replacement=d.add('Item.TowerAsh',2)
  activityStep(d.w,d.p)
  expect(d.p.activity).toBeUndefined();expect(d.p.workJob?.progress).toBe(1)
  expect(d.bowl.def).toBe('Item.Bowl');expect(replacement.count).toBe(2);expect(drinkVolume(d.w,d.bottle)).toBe(1000)
  expect(startCraft(d.w,d.p,d.recipe,1)).not.toBeNull()
  finishBase(d.w,d.p);expect(replacement.count).toBe(2)
 })
})
