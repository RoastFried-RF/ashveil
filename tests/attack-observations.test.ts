import {describe,it,expect} from 'vitest'
import {startActionObservation,takeAttackObservation} from '../src/core/action-observations'
import {makeItem,addToBag,wield} from '../src/core/items'
import {playerAct} from '../src/core/game'
import {perform} from '../src/core/actions'
import {resolveAttack} from '../src/core/combat'
import {serialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {attackPresentation} from '../src/client/render/attack-presentation'
import type {FxEvent} from '../src/core/types'
import {prisonerFixture} from './prisoner-fixture'
function fixture(){
 const d=prisonerFixture(),{w,s,p,target}=d;s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p,target];s.sources=[];s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.weather='clear';s.weatherUntil=1e12
 for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.KtFloor',roof:true,seen:true,items:[]})
 p.bag=[];p.equip={main:makeItem(w,'Item.Hatchet'),off:makeItem(w,'Item.Javelin')};target.pos={x:20,y:23};target.nextAct=s.time+1e9;target.met=true;target.reactPolicy='none';target.equip={};target.bag=[];s.fx=[];invalidateLights(w);updatePlayerVision(w,p);return d
}
const attacks=(s:ReturnType<typeof fixture>['s'])=>s.fx.filter((e):e is Extract<FxEvent,{k:'attack'}>=>e.k==='attack'&&e.id===s.playerId)
describe('optional resolved attack observations',()=>{
 it('keeps the complete FX/state/RNG/UID results identical with and without observation',()=>{
  const a=fixture(),b=fixture();expect(serialize(a.s)).toBe(serialize(b.s));startActionObservation(b.w)
  const uid=a.p.equip.off!.uid
  expect(playerAct(a.w,{type:'throwAttack',uid,target:a.target.id})).toBeNull();expect(playerAct(b.w,{type:'throwAttack',uid,target:b.target.id})).toBeNull();expect(serialize(a.s)).toBe(serialize(b.s))
  const event=attacks(b.s)[0],source=takeAttackObservation(b.w,event)!
  expect(source.wield).toMatchObject({arm:'larm',throwing:true,item:{uid,def:'Item.Javelin'}});expect(wield(b.w,b.p)?.item?.def).toBe('Item.Hatchet');expect(takeAttackObservation(b.w,event)).toBeUndefined();expect(takeAttackObservation(a.w,attacks(a.s)[0])).toBeUndefined();expect(serialize(a.s)).toBe(serialize(b.s))
 })
 it('links successive sources to the exact event, including a new physical projectile UID split from a stack',()=>{
  const{w,s,p,target}=fixture(),javelin=p.equip.off!.uid,stones=makeItem(w,'Item.Stone',3);addToBag(w,p,stones);startActionObservation(w)
  expect(playerAct(w,{type:'throwAttack',uid:javelin,target:target.id})).toBeNull();expect(playerAct(w,{type:'throwAttack',uid:stones.uid,target:target.id})).toBeNull();const events=attacks(s);expect(events).toHaveLength(2)
  const second=takeAttackObservation(w,events[1])!,first=takeAttackObservation(w,events[0])!
  expect(first.wield).toMatchObject({arm:'larm',item:{uid:javelin}});expect(second.wield).toMatchObject({arm:'rarm',item:{def:'Item.Stone',count:1}});expect(second.wield.item!.uid).not.toBe(stones.uid);expect(s.map.tiles[target.pos.y*s.map.w+target.pos.x].items.some(i=>i.uid===second.wield.item!.uid)).toBe(true);expect(stones.count).toBe(2)
 })
 it('keeps the original knife after the actual strike breaks it and later wield selects a fist',()=>{
  const{w,s,p,target}=fixture();target.pos={x:20,y:21};const knife=makeItem(w,'Item.RustyKnife');knife.durability=.001;p.equip={main:knife};startActionObservation(w)
  expect(perform(w,p,{type:'attack',target:target.id}).ok).toBe(true);expect(knife.durability).toBe(0)
  const before=serialize(s),view=attackPresentation(w,p,attacks(s)[0],'up');expect(view.equipment.weapon).toMatchObject({id:knife.def,uid:knife.uid});expect(view.equipment.sourceObserved).toBe(true);expect(view.equipment.arm).toBe('rarm');expect(serialize(s)).toBe(before)
 })
 it('uses the actual effective attack family and isolated snapshots rather than a later equipped attack',()=>{
  const{w,s,p,target}=fixture();target.pos={x:20,y:21};const original=w.db.item('Item.Hatchet').attacks![0],attack={...original,id:'test-actual-thrust',family:'spear',damageType:'stab'as const};startActionObservation(w)
  resolveAttack(w,p,target,{wield:{atk:attack,item:p.equip.main,arm:'larm',twoHanded:false}});const source=takeAttackObservation(w,attacks(s)[0])!;expect(source.wield.atk).toMatchObject({family:'spear',damageType:'stab'});source.wield.atk.label='snapshot only';source.wield.item!.quality=5;expect(original.label).not.toBe('snapshot only');expect(p.equip.main!.quality).not.toBe(5)
 })
 it('retains the release direction and source after the participants and equipment move',()=>{
  const{w,s,p,target}=fixture();startActionObservation(w);const uid=p.equip.off!.uid;expect(playerAct(w,{type:'throwAttack',uid,target:target.id})).toBeNull();p.pos={x:21,y:20};target.pos={x:25,y:20};p.equip.main=makeItem(w,'Item.RustyKnife');const before=serialize(s),view=attackPresentation(w,p,attacks(s)[0],'right')
  expect(view.equipment).toMatchObject({arm:'larm',slot:1,direction:'down',vector:{x:0,y:1},weapon:{uid,kind:'polearm'}});expect(view.distance).toBe(3);expect(serialize(s)).toBe(before)
 })
 it('disposal/restart clears old sources and historical throws never borrow a remaining unrelated weapon',()=>{
  const{w,s,p,target}=fixture(),stop=startActionObservation(w);expect(playerAct(w,{type:'throwAttack',uid:p.equip.off!.uid,target:target.id})).toBeNull();const event=attacks(s)[0];stop();expect(takeAttackObservation(w,event)).toBeUndefined();startActionObservation(w);const view=attackPresentation(w,p,event,'down');expect(view.equipment.sourceObserved).toBe(false);expect(view.equipment.weapon).toBeUndefined()
 })
})
