import {describe,it,expect} from 'vitest'
import {quickbarItem,quickbarCount} from '../src/client/quickbar-items'
import {makeItem} from '../src/core/items'
import {perform} from '../src/core/actions'
import {serialize} from '../src/core/save'
import {prisonerFixture} from './prisoner-fixture'
const ref=(def:string)=>({kind:'item'as const,def})
describe('usable original quick-slot items',()=>{
 it('skips an earlier empty bottle while preserving it and the next full bottle UID',()=>{
  const{w,p}=prisonerFixture();p.bag=[];const empty=makeItem(w,'Item.WaterBottle'),full=makeItem(w,'Item.WaterBottle');empty.uses=0;p.bag=[empty,full];const before=serialize(w.s)
  expect(quickbarItem(w,p,ref(full.def))).toBe(full);expect(quickbarCount(w,p,ref(full.def))).toBe(1);expect(serialize(w.s)).toBe(before)
 })
 it('moves to the next real bottle after its final dose and reports zero when all are empty',()=>{
  const{w,p}=prisonerFixture();const a=makeItem(w,'Item.WaterBottle'),b=makeItem(w,'Item.WaterBottle');a.uses=1;b.uses=1;p.bag=[a,b]
  expect(perform(w,p,{type:'consume',uid:a.uid}).ok).toBe(true);expect(quickbarItem(w,p,ref(a.def))).toBe(b);expect(a.uses).toBe(0)
  expect(perform(w,p,{type:'consume',uid:b.uid}).ok).toBe(true);expect(quickbarItem(w,p,ref(b.def))).toBeUndefined();expect(quickbarCount(w,p,ref(b.def))).toBe(0);expect(p.bag.map(i=>i.uid)).toEqual([a.uid,b.uid])
 })
 it('keeps partial doses and leaves freezing/use restrictions to the existing action',()=>{
  const{w,p}=prisonerFixture(),water=makeItem(w,'Item.WaterBottle');water.uses=.25;water.waterFrozen=true;p.bag=[water];const before=serialize(w.s)
  expect(quickbarItem(w,p,ref(water.def))).toBe(water);expect(quickbarCount(w,p,ref(water.def))).toBe(1);expect(perform(w,p,{type:'consume',uid:water.uid}).ok).toBe(false);expect(serialize(w.s)).toBe(before)
 })
 it('keeps freshness ordering and real belt access while excluding a closed sack',()=>{
  const{w,p}=prisonerFixture(),a=makeItem(w,'Item.Jerky',2),b=makeItem(w,'Item.Jerky'),belt=makeItem(w,'Item.LeatherBelt'),sack=makeItem(w,'Item.Sack');a.freshness=20;b.freshness=90;belt.contents=[a];sack.contents=[makeItem(w,'Item.Jerky',3)];p.equip={belt};p.bag=[b,sack]
  expect(quickbarItem(w,p,ref(a.def))).toBe(a);expect(quickbarCount(w,p,ref(a.def))).toBe(3);belt.half=true;expect(quickbarItem(w,p,ref(a.def))).toBe(b);expect(quickbarCount(w,p,ref(a.def))).toBe(1)
 })
 it('includes actual held throwables and preserves separate damaged-ammunition references',()=>{
  const{w,p}=prisonerFixture(),javelin=makeItem(w,'Item.Javelin'),good=makeItem(w,'Item.Arrow',2),bad=makeItem(w,'Item.Arrow',3);bad.fletchingDamaged=true;p.equip={off:javelin};p.bag=[good,bad]
  expect(quickbarItem(w,p,ref(javelin.def))).toBe(javelin);expect(quickbarCount(w,p,ref(javelin.def))).toBe(1);expect(quickbarItem(w,p,{...ref(good.def),fletchingDamaged:true})).toBe(bad);expect(quickbarCount(w,p,{...ref(good.def),fletchingDamaged:false})).toBe(2)
 })
 it('spent purifier charges do not mask another original tank and missing references stay empty',()=>{
  const{w,p}=prisonerFixture(),a=makeItem(w,'Item.CullerPurifierTank'),b=makeItem(w,'Item.CullerPurifierTank');a.uses=0;b.uses=2;p.bag=[a,b]
  expect(quickbarItem(w,p,ref(a.def))).toBe(b);expect(quickbarCount(w,p,ref(a.def))).toBe(1);expect(quickbarCount(w,p,ref('Item.AbsentQuickbarReference'))).toBe(0)
 })
})
