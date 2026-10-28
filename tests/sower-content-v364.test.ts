import {expect,it} from 'vitest'
import {perform,activityStep} from '../src/core/actions'
import {addWound} from '../src/core/body'
import {killCreature} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {turnOf,tileAt} from '../src/core/ctx'
import {generateRegionLayout} from '../src/core/region-layout'
import {settleReentry} from '../src/core/game'
import {makeItem,addToBag,allItems} from '../src/core/items'
import {startMachineCare} from '../src/core/machines'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {drinkVolume} from '../src/core/wash-water'
import {waterCapacity} from '../src/core/water-vessels'
import {waterPourQuote,pourWater} from '../src/core/water-transfer'
import type {RegionLayoutDef} from '../src/core/types'
import {prisonerFixture} from './prisoner-fixture'
function scene(){const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,items:[],cont:undefined,deco:undefined,placed:undefined,room:undefined,blood:0});p.pos={x:46,y:14};p.bag=[];p.equip={};const sower=createCreature(w,'Creature.Sower',{x:47,y:14});sower.faction='player';sower.home={...sower.pos};sower.nextAct=1e12;s.creatures=[p,sower];return{w,s,p,sower}}
it('the actual new regional layout has one finite Sower and its existing surveyor, with real soil at every route point',()=>{
 const {w}=scene(),rule=w.db.creature('Creature.Sower').sower!,generated=generateRegionLayout(w,w.db.get<RegionLayoutDef>('RegionLayout.ChimneyService'))
 expect(generated.spawns.filter(s=>s.def==='Creature.Sower')).toHaveLength(1);expect(generated.spawns.filter(s=>s.def==='Creature.Surveyor')).toHaveLength(1)
 for(const p of rule.route){const terrain=w.db.terrain(generated.map.tiles[p.y*generated.map.w+p.x].t);expect(terrain.passable).toBe(true);expect(terrain.soil).toBe(true)}
})
it('actual configured capsule stock is consumed once, and death releases only the original remaining cargo/components',()=>{
 const {w,s,p,sower}=scene(),seed=sower.bag.find(i=>i.def==='Item.SowerSeedCapsule')!,fungus=sower.bag.find(i=>i.def==='Item.SettlementFungusCapsule')!,components=structuredClone(sower.body.machine!.components!)
 expect(sower.bag.filter(i=>i.def==='Item.SowerSeedCapsule').reduce((n,i)=>n+i.count,0)).toBe(8);expect(fungus.count).toBe(1);expect(components.some(i=>i.def===fungus.def)).toBe(false)
 expect(perform(w,sower,{type:'place',uid:seed.uid,dir:2}).ok).toBe(true);addWound(w,sower,{def:'Wound.Bruise',part:'Chassis',severity:1,source:'유한 초기 각인',sourceId:p.id});expect(perform(w,sower,{type:'sowerSpray',target:p.id,uid:fungus.uid}).ok).toBe(true)
 killCreature(w,sower,'원래 재고 회수 검사');const actual=[...allItems(sower),...s.map.tiles.flatMap(t=>t.items)];expect(actual.filter(i=>i.def==='Item.SowerSeedCapsule').reduce((n,i)=>n+i.count,0)).toBe(7);expect(actual.some(i=>i.def===fungus.def)).toBe(false)
 for(const source of components)expect(actual.filter(i=>i.uid===source.uid).reduce((n,i)=>n+i.count,0)).toBe(source.count)
 const before=stateHash(s);killCreature(w,sower,'반복 회수');expect(stateHash(s)).toBe(before)
})
it('an originally empty recovered4L tank keeps the same UID and conserves real poured water across save/restore',()=>{
 const {w,s,p}=scene(),tank=makeItem(w,'Item.SowerReservoir'),bottle=makeItem(w,'Item.WaterBottle');expect(addToBag(w,p,tank)).toBe(0);expect(addToBag(w,p,bottle)).toBe(0);expect(waterCapacity(w,tank)).toBe(4000);expect(drinkVolume(w,tank)).toBe(0)
 const before=stateHash(s);expect(waterPourQuote(w,p,bottle.uid,tank.uid,600).error).toBeNull();expect(stateHash(s)).toBe(before);expect(pourWater(w,p,bottle.uid,tank.uid,600)).toBeNull();expect(drinkVolume(w,tank)).toBe(600);expect(drinkVolume(w,bottle)).toBe(400)
 const restored=deserialize(serialize(s)),same=restored.creatures.find(c=>c.id===p.id)!.bag.find(i=>i.uid===tank.uid)!;expect(same.def).toBe('Item.SowerReservoir');expect(drinkVolume(w,same)).toBe(600);expect(stateHash(restored)).toBe(stateHash(s))
})
it('actual large actuator and hammer UIDs repair a damaged Sower through shared paid work, including a mid-work exact restore',()=>{
 const {w,s,p,sower}=scene(),wound=addWound(w,sower,{def:'Wound.Bruise',part:'DriveLeg1',severity:12,source:'실제 변형'}).wound,actuator=makeItem(w,'Item.LargeActuator'),hammer=makeItem(w,'Item.IronHammer');addToBag(w,p,actuator);addToBag(w,p,hammer)
 expect(startMachineCare(w,p,sower.id,'repair',actuator.uid,undefined,wound.part)).toBeNull();for(let i=0;i<5;i++)activityStep(w,p);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!,target=run.s.creatures.find(c=>c.id===sower.id)!;for(let i=0;actor.activity&&i<100;i++)activityStep(run,actor);expect(actor.activity).toBeUndefined();expect(allItems(actor).some(i=>i.uid===actuator.uid)).toBe(false);expect(allItems(actor).some(i=>i.uid===hammer.uid)).toBe(true);expect(target.body.wounds.find(i=>i.id===wound.id)?.healed??wound.severity).toBe(wound.severity)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('shared two-tile shoves stop at a blocked diagonal corner instead of moving a real body through it',()=>{
 const {w,p,sower}=scene();p.pos={x:48,y:15};tileAt(w,{x:49,y:15}).t='Terrain.KtWall';tileAt(w,{x:48,y:16}).t='Terrain.KtWall';const pos={...p.pos},hp=p.hp
 expect(perform(w,sower,{type:'sowerPush',target:p.id}).ok).toBe(true);expect(p.pos).toEqual(pos);expect(p.hp).toBe(hp-5);expect(p.body.wounds.some(wd=>wd.sourceId===sower.id)).toBe(true)
})
it('a long-abandoned machine corpse leaves its original cargo rather than manufacturing biological bones',()=>{
 const {w,s,sower}=scene();killCreature(w,sower,'원래 기계의 부패 검사');const cargo=[...allItems(sower),...tileAt(w,sower.pos).items].map(i=>({uid:i.uid,count:i.count})),left=turnOf(w);s.time+=6*28800*100;settleReentry(w,s.map,s.creatures,left)
 expect(tileAt(w,sower.pos).items.some(i=>i.def==='Item.Bones')).toBe(false);for(const source of cargo)expect(tileAt(w,sower.pos).items.filter(i=>i.uid===source.uid).reduce((n,i)=>n+i.count,0)).toBe(source.count)
})
