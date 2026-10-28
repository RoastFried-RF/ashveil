import {it,expect}from'vitest'
import{prisonerFixture}from'./prisoner-fixture'
import{db}from'./helpers'
import{humanSurfaceState}from'../src/client/render/human-state'
import{makeItem}from'../src/core/items'
import{isMissing}from'../src/core/body'
import{stateHash}from'../src/core/save'
import{turnOf}from'../src/core/ctx'
import type{ProstheticDef}from'../src/core/types'
it.each(db.all<ProstheticDef>('Prosthetic'))('a real $id never resurrects flesh at its installed root',rule=>{
 const{w,p}=prisonerFixture(),root=rule.targets[0],item=makeItem(w,rule.item);p.body.missing=[root];p.body.prosthetics={[root]:{def:rule.id,item,installedAt:turnOf(w),servicedAt:turnOf(w),powerUntil:turnOf(w)+1000}};const before=stateHash(w.s),surface=humanSurfaceState(w,p,w.db.body(p.body.def).parts.map(p=>p.id))!
 expect(isMissing(w,p,root)).toBe(false);expect(surface.parts[root]).toMatchObject({flesh:false,present:true,replacement:{uid:item.uid,root,def:rule.id}});expect(stateHash(w.s)).toBe(before)
})
it('hand-only loss leaves the original forearm, and partial cuirass dressing keeps the actual UID/coverage',()=>{
 const{w,p}=prisonerFixture();p.body.missing=['LeftHand'];const armour=makeItem(w,'Item.CrawlerCuirass');armour.half=true;armour.dressProgress={kind:'equip',left:1,total:2};p.equip={chest:armour};const before=stateHash(w.s),s=humanSurfaceState(w,p,['Chest','Abdomen','Pelvis','LeftForearm','LeftHand'])!
 expect(s.parts.LeftHand.present).toBe(false);expect(s.parts.LeftForearm.flesh).toBe(true);expect(s.clothing).toEqual([expect.objectContaining({uid:armour.uid,def:armour.def,slot:'chest',parts:['Chest','Abdomen'],half:true,progress:{kind:'equip',left:1,total:2}})]);expect(stateHash(w.s)).toBe(before)
})
it('unsupported anatomical owner IDs do not borrow another body part',()=>{const{w,p}=prisonerFixture();expect(humanSurfaceState(w,p,['UnknownArm'])).toBeUndefined()})
