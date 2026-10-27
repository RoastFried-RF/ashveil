import {describe,it,expect} from 'vitest'
import {prisonerFixture} from './prisoner-fixture'
import {makeItem,addToBag} from '../src/core/items'
import {perform} from '../src/core/actions'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights} from '../src/core/fov'
describe('general throw rejects before transferring its original physical piece',()=>{
 for(const source of ['equip','bag','pocket']as const)for(const blocked of ['range','wall','fraction','outside','nan','infinity']as const)it(source+' '+blocked+' leaves the entire state and UID allocator identical',()=>{
  const{w,p,s}=prisonerFixture();p.bag=[];p.equip={};const item=makeItem(w,source==='equip'?'Item.RustyKnife':'Item.Stone',source==='equip'?1:3)
  if(source==='equip')p.equip.main=item
  else if(source==='bag')expect(addToBag(w,p,item)).toBe(0)
  else{const belt=makeItem(w,'Item.LeatherBelt');item.gx=0;item.gy=0;belt.contents=[item];p.equip.belt=belt}
  let target={x:p.pos.x+7,y:p.pos.y}
  if(blocked==='wall'){target={x:p.pos.x+3,y:p.pos.y};s.map.tiles[p.pos.y*s.map.w+p.pos.x+1].t='Terrain.KtWall';invalidateLights(w)}
  if(blocked==='fraction')target={x:p.pos.x+.5,y:p.pos.y}
  if(blocked==='outside')target={x:-1,y:p.pos.y}
  if(blocked==='nan')target={x:NaN,y:p.pos.y}
  if(blocked==='infinity')target={x:Infinity,y:p.pos.y}
  const before=serialize(s);expect(perform(w,p,{type:'throw',uid:item.uid,target}).ok).toBe(false);expect(serialize(s)).toBe(before);expect(serialize(deserialize(serialize(s)))).toBe(before)
 })
 it('successful one-piece transfer still splits exactly once, lands and preserves the original stack grid',()=>{
  const{w,p,s}=prisonerFixture();p.bag=[];p.equip={};const item=makeItem(w,'Item.Stone',3);expect(addToBag(w,p,item)).toBe(0);const grid={gx:item.gx,gy:item.gy},next=s.nextId,target={x:p.pos.x,y:p.pos.y}
  expect(perform(w,p,{type:'throw',uid:item.uid,target})).toEqual({ok:true,tu:100});expect(item).toMatchObject({...grid,count:2});const piece=s.map.tiles[target.y*s.map.w+target.x].items.find(i=>i.uid===next)!;expect(piece).toMatchObject({def:item.def,count:1});expect(s.nextId).toBe(next+1);expect(serialize(deserialize(serialize(s)))).toBe(serialize(s))
 })
})

it('does not bypass the original worn-apparel removal work or close its inventory context on rejection',()=>{
 const{w,p,s}=prisonerFixture();p.bag=[];p.equip={chest:makeItem(w,'Item.LeatherCoat')};const before=serialize(s);expect(perform(w,p,{type:'throw',uid:p.equip.chest!.uid,target:p.pos})).toMatchObject({ok:false,tu:0});expect(serialize(s)).toBe(before)
})
it('closes the original carried-bag context only after a successful whole-container transfer',()=>{
 const{w,p,s}=prisonerFixture();p.bag=[];p.equip={};const bag=makeItem(w,'Item.LeatherBelt'),stone=makeItem(w,'Item.Stone');stone.gx=0;stone.gy=0;bag.contents=[stone];expect(addToBag(w,p,bag)).toBe(0);s.loot={kind:'bag',id:bag.uid,pos:{...p.pos}};const before=serialize(s);expect(perform(w,p,{type:'throw',uid:bag.uid,target:{x:100,y:100}}).ok).toBe(false);expect(serialize(s)).toBe(before);expect(perform(w,p,{type:'throw',uid:bag.uid,target:p.pos}).ok).toBe(true);expect(s.loot).toBeUndefined();expect(s.map.tiles[p.pos.y*s.map.w+p.pos.x].items.find(i=>i.uid===bag.uid)!.contents).toEqual([stone])
})
