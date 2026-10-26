import {describe,expect,it} from 'vitest'
import {bindActionProp,presentationHands,utilityPropLength} from '../src/client/render/hand-presentation'
import {takeActionPresentations} from '../src/client/render/action-presentation'
import {startActionObservation} from '../src/core/action-observations'
import {perform} from '../src/core/actions'
import {makeItem} from '../src/core/items'
import {serialize} from '../src/core/save'
import {db} from './helpers'
import {prisonerFixture} from './prisoner-fixture'

describe('actual utility-prop hand ownership',()=>{
 it.each(['RightUpperArm','RightForearm','RightHand'])('uses the intact left chain after %s loss without changing the world',part=>{
  const{w,p}=prisonerFixture();p.body.missing=[part];const water=makeItem(w,'Item.WaterBottle'),before=serialize(w.s)
  expect(bindActionProp(w,p,water)).toEqual({uid:water.uid,def:water.def,hand:1});expect(serialize(w.s)).toBe(before)
 })
 it('does not treat a visible hand with no functional fingers as a grip',()=>{
  const{w,p}=prisonerFixture();p.body.missing=['RightThumb','RightIndex','RightMiddle','RightRing','RightPinky']
  expect(presentationHands(w,p)[0].hold).toBe(false);expect(bindActionProp(w,p,makeItem(w,'Item.WaterBottle')).hand).toBe(1)
 })
 it('keeps hook support distinct from holding and respects a powered arm stopping',()=>{
  const{w,p}=prisonerFixture();p.body.missing=['RightHand'];const hook=makeItem(w,'Item.HookHand')
  const prosthetics:NonNullable<typeof p.body.prosthetics>=p.body.prosthetics={RightHand:{def:'Prosthetic.HookHand',item:hook,installedAt:0,servicedAt:0}};expect(presentationHands(w,p)[0]).toEqual({hold:false,support:true});expect(bindActionProp(w,p,hook).hand).toBe(1)
  const arm=makeItem(w,'Item.PioneerArm');prosthetics.RightHand={def:'Prosthetic.PioneerArm',item:arm,installedAt:0,servicedAt:0,powerUntil:0};expect(presentationHands(w,p)[0]).toEqual({hold:false,support:false})
  prosthetics.RightHand.powerUntil=w.s.time/100+100;expect(presentationHands(w,p)[0].hold).toBe(true)
 })
 it('pins an actually held offhand object to that hand and never borrows a missing grip',()=>{
  const{w,p}=prisonerFixture(),torch=makeItem(w,'Item.Torch');p.equip.off=torch
  expect(bindActionProp(w,p,torch).hand).toBe(1);p.body.missing=['LeftHand'];expect(bindActionProp(w,p,torch).hand).toBeNull()
 })
 it('a lost last portion keeps its accepted original UID instead of finding another item by sprite',()=>{
  const{w,p}=prisonerFixture();p.bag=[];p.body.missing=['RightHand'];const food=makeItem(w,'Item.Jerky');p.bag.push(food);startActionObservation(w)
  expect(perform(w,p,{type:'consume',uid:food.uid}).ok).toBe(true);expect(p.bag.some(i=>i.uid===food.uid)).toBe(false)
  const before=serialize(w.s),cue=takeActionPresentations(w)[0];expect(cue.propBinding).toEqual({uid:food.uid,def:food.def,hand:1,consume:true});expect(serialize(w.s)).toBe(before)
 })
 it('food portions and medicine keep a hand-sized silhouette while explicit source lengths remain authoritative',()=>{
  expect(utilityPropLength(db.item('Item.Jerky'))).toBe(4);expect(utilityPropLength(db.item('Item.WaterBottle'))).toBe(10);const food=db.item('Item.Jerky');expect(utilityPropLength({...food,heldSprite:{grip:[.5,.5],axisDegrees:0,length:7}})).toBe(7)
 })
 it('neither absent hands nor a hand occupied by a lead acquire another virtual grip',()=>{
  const{w,p}=prisonerFixture();p.body.missing=['RightHand','LeftHand'];expect(bindActionProp(w,p,makeItem(w,'Item.WaterBottle')).hand).toBeNull()
  p.body.missing=['RightHand'];p.leading={target:2,uid:1,hand:'Left'};expect(bindActionProp(w,p,makeItem(w,'Item.WaterBottle')).hand).toBeNull()
 })
})
