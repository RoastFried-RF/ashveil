import {expect,it} from 'vitest'
import {addWound,isMissing} from '../src/core/body'
import {player,tileAt} from '../src/core/ctx'
import {makeItem} from '../src/core/items'
import {deserialize,serialize} from '../src/core/save'
import {makeWorld} from './helpers'

it('a combat cut that actually severs the hand drops its original weapon and ring exactly once',()=>{
 const w=makeWorld('sever-original-items'),p=player(w);p.equip={main:makeItem(w,'Item.HuntingKnife'),off:makeItem(w,'Item.HuntingKnife'),ring1:makeItem(w,'Item.SealRing'),ring2:makeItem(w,'Item.SealRing')}
 const original=structuredClone(p.equip),items=tileAt(w,p.pos).items
 const result=addWound(w,p,{def:'Wound.Cut',part:'RightHand',severity:p.body.maxHp.RightHand+1,source:'감사: 실제 절단 피해',canSever:true})
 expect(result.severed).toBe(true);expect(isMissing(w,p,'RightHand')).toBe(true)
 for(const slot of ['main','ring1'] as const){expect(p.equip[slot]).toBeUndefined();expect(items.filter(i=>i.uid===original[slot]!.uid)).toEqual([original[slot]])}
 expect(p.equip.off).toEqual(original.off);expect(p.equip.ring2).toEqual(original.ring2)
 const restored=deserialize(serialize(w.s));expect(restored).toEqual(w.s)
})
it('a severed left hand releases a two-handed main weapon and left ring but keeps the right ring',()=>{
 const w=makeWorld('sever-two-hand'),p=player(w),id=w.db.all<import('../src/core/types').ItemDef>('Item').find(d=>d.twoHanded)!.id
 p.equip={main:makeItem(w,id),ring1:makeItem(w,'Item.SealRing'),ring2:makeItem(w,'Item.SealRing')};const before=structuredClone(p.equip)
 expect(addWound(w,p,{def:'Wound.Cut',part:'LeftHand',severity:p.body.maxHp.LeftHand+1,source:'감사',canSever:true}).severed).toBe(true)
 expect(p.equip.main).toBeUndefined();expect(p.equip.ring2).toBeUndefined();expect(p.equip.ring1).toEqual(before.ring1)
 expect(tileAt(w,p.pos).items.filter(i=>i.uid===before.main!.uid)).toEqual([before.main])
})
it('a damaged attached hand does not spontaneously drop its gear',()=>{
 const w=makeWorld('attached-hand'),p=player(w);p.equip={main:makeItem(w,'Item.HuntingKnife')};const weapon=p.equip.main
 addWound(w,p,{def:'Wound.Cut',part:'RightHand',severity:1,source:'감사',canSever:true})
 expect(isMissing(w,p,'RightHand')).toBe(false);expect(p.equip.main).toBe(weapon)
})
