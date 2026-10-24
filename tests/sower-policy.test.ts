import {describe,it,expect} from 'vitest'
import {perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {addWound,capacity} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {tileAt,turnOf} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {invalidateLights} from '../src/core/fov'
import {gardenAlertState} from '../src/core/garden-alert'
import {playerAct,settleReentry} from '../src/core/game'
import {killCreature} from '../src/core/combat'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {sowerStatus} from '../src/core/sower'
import {placementQuote} from '../src/core/placement'
import type {CreatureDef} from '../src/core/types'
import {readPackages} from '../tools/loadContent'
import {sowerFixture,sowerFixturePackage,sowerRule} from './sower-fixture'
const seeds=(c:ReturnType<typeof sowerFixture>['sower'])=>c.bag.filter(i=>i.def===sowerRule.seedItem).reduce((n,i)=>n+i.count,0)
function hurt(scene:ReturnType<typeof sowerFixture>){const {w,p,sower}=scene;p.pos={x:47,y:15};addWound(w,sower,{def:'Wound.MachineDeformation',part:'Chassis',severity:2,source:'유한한 초기 공격 각인',sourceId:p.id});invalidateLights(w);return sower.body.wounds.at(-1)!}
function step(scene:ReturnType<typeof sowerFixture>){const a=aiDecide(scene.w,scene.sower),r=perform(scene.w,scene.sower,a);expect(r.ok,r.msg).toBe(true);scene.s.time+=r.tu;return a}
describe('finite definition-driven sowing machine policy (inactive candidate fixture)',()=>{
 it('uses four real legs and eight original capsules; queries cannot advance work or grant stock',()=>{
  const {w,s,sower}=sowerFixture();expect(w.db.body(sower.body.def).parts.filter(p=>p.qleg)).toHaveLength(4);expect(capacity(w,sower,'signal')).toBe(1);expect(seeds(sower)).toBe(8)
  const hash=stateHash(s);for(let i=0;i<5;i++)expect(sowerStatus(w,sower)).toMatchObject({moves:0,remaining:8,pending:false});expect(stateHash(s)).toBe(hash);expect(sower.sowerState).toBeUndefined()
 })
 it('pays one actual waypoint wait and counts only completed original moves before planting the same source UID',()=>{
  const scene=sowerFixture(),{w,s,sower}=scene,original=sower.bag.filter(i=>i.def===sowerRule.seedItem).map(i=>({uid:i.uid,count:i.count}))
  const waypoint=perform(w,sower,{type:'sowerWaypoint'});expect(waypoint).toEqual({ok:true,tu:100});expect(sower.sowerState!.routeIndex).toBe(1)
  const afterWait=stateHash(s);expect(perform(w,sower,{type:'sowerWaypoint'}).ok).toBe(false);expect(stateHash(s)).toBe(afterWait);s.time+=waypoint.tu
  for(let i=0;i<4;i++){expect(perform(w,sower,{type:'move',dir:2}).ok).toBe(true);s.time+=100}
  expect(sowerStatus(w,sower)).toMatchObject({moves:4,remaining:8,pending:true});const action=aiDecide(w,sower);expect(action.type).toBe('place');if(action.type!=='place')throw Error('실제 파종 선택 필요')
  const q=placementQuote(w,sower,action.uid,action.dir),hash=stateHash(s);expect(q.error).toBeNull();expect(stateHash(s)).toBe(hash)
  const power=sower.body.machine!.power;expect(perform(w,sower,action)).toEqual({ok:true,tu:100});expect(seeds(sower)).toBe(7);expect(sower.body.machine!.power).toBeLessThan(power);expect(sowerStatus(w,sower)).toMatchObject({moves:0,seedsSpent:1,pending:false})
  const plot=tileAt(w,q.p!).cultivation!;expect(plot).toMatchObject({seedUid:action.uid,ownerId:sower.id,growth:0,waterUnits:0,origin:{terrain:'Terrain.Earth'}});expect(original.some(i=>i.uid===plot.seedUid)).toBe(true)
 })
 it('never counts a wall, water, occupied tile or door opening as a completed sowing movement',()=>{
  const {w,s,sower}=sowerFixture(),p={x:48,y:14}
  for(const terrain of['Terrain.KtWall','Terrain.ShallowWater']){tileAt(w,p).t=terrain;const hash=stateHash(s);expect(perform(w,sower,{type:'move',dir:2}).ok).toBe(false);expect(stateHash(s)).toBe(hash)}
  tileAt(w,p).t='Terrain.DoorClosed';expect(perform(w,sower,{type:'move',dir:2}).ok).toBe(true);expect(sower.pos).toEqual({x:47,y:14});expect(sowerStatus(w,sower)!.moves).toBe(0)
 })
 it('continues its actual route after all eight original capsules are spent and never replenishes on repeated decisions or death',()=>{
  const scene=sowerFixture(),{w,s,sower}=scene;let plantActions=0
  for(let i=0;i<160;i++)if(step(scene).type==='place')plantActions++
  expect(plantActions).toBe(8);expect(seeds(sower)).toBe(0);expect(sowerStatus(w,sower)!.seedsSpent).toBe(8);expect(s.map.tiles.filter(t=>t.cultivation?.ownerId===sower.id)).toHaveLength(8)
  const before=stateHash(s);killCreature(w,sower,'원래 유한 재고 해체 검사');expect(seeds(sower)).toBe(0);const corpse=stateHash(s);killCreature(w,sower,'반복 해체 검사');expect(stateHash(s)).toBe(corpse);expect(before).not.toBe(corpse)
 })
 it('uses shared two-tile displacement for a real route blocker without raising regional alert',()=>{
  const scene=sowerFixture(),{w,s,p,sower}=scene;p.pos={x:48,y:14};sower.sowerState={rule:JSON.stringify(sowerRule),routeIndex:1,moves:0,seedsSpent:0,resumeAt:0,alarmWound:0};invalidateLights(w)
  expect(aiDecide(w,sower)).toEqual({type:'sowerPush',target:p.id});expect(perform(w,sower,{type:'sowerPush',target:p.id})).toEqual({ok:true,tu:100});expect(p.pos).toEqual({x:50,y:14});expect(sower.body.machine!.attacks).toBe(1);expect(gardenAlertState(w)).toBeUndefined();expect(s.creatures).toHaveLength(2)
 })
 it('reports one actual wound once and calls only the same living powered surveyor with a working antenna',()=>{
  const scene=sowerFixture(),{w,s,p,sower}=scene,wd=hurt(scene),surveyor=createCreature(w,'Creature.Surveyor',{x:52,y:14});s.creatures.push(surveyor)
  const count=s.creatures.length,action=aiDecide(w,sower);expect(action).toEqual({type:'sowerAlarm',target:p.id,wound:wd.id});expect(perform(w,sower,action)).toEqual({ok:true,tu:100});expect(gardenAlertState(w)!.level).toBe(1);expect(surveyor.surveyState!.call).toMatchObject({source:sower.id,pos:{x:47,y:14},at:turnOf(w)})
  const hash=stateHash(s);expect(perform(w,sower,action).ok).toBe(false);expect(stateHash(s)).toBe(hash);expect(s.creatures).toHaveLength(count)
  const second=createCreature(w,'Creature.Surveyor',{x:53,y:14});second.body.missing=['Antenna'];s.creatures.push(second);const wd2=addWound(w,sower,{def:'Wound.MachineDeformation',part:'Chassis',severity:2,source:'두 번째 원래 공격',sourceId:p.id});expect(wd2).toBeDefined();const next=aiDecide(w,sower);expect(next.type).toBe('sowerAlarm');perform(w,sower,next);expect(second.surveyState).toBeUndefined();expect(gardenAlertState(w)!.level).toBe(2)
 })
 it('actual existing surveyors investigate the recorded call position without learning a hidden current attacker location',()=>{
  const scene=sowerFixture(),{w,s,p,sower}=scene,wd=hurt(scene);p.pos={x:43,y:14};const surveyor=createCreature(w,'Creature.Surveyor',{x:54,y:14});s.creatures.push(surveyor);invalidateLights(w)
  expect(perform(w,sower,{type:'sowerAlarm',target:p.id,wound:wd.id}).ok).toBe(true);const recorded=structuredClone(surveyor.surveyState!.call!.pos);sower.pos={x:48,y:14};expect(aiDecide(w,surveyor).type).toBe('move');expect(surveyor.ai.dest).toEqual(recorded);expect(surveyor.ai.dest).not.toEqual(p.pos)
 })
 it('spends the single original fungus capsule on a bounded shared spore hazard and cannot spray through a wall or mint another dose',()=>{
  const scene=sowerFixture(),{w,s,p,sower,fungus}=scene;hurt(scene);tileAt(w,{x:48,y:14}).t='Terrain.KtWall';invalidateLights(w)
  expect(perform(w,sower,{type:'sowerSpray',target:p.id,uid:fungus.uid})).toEqual({ok:true,tu:100});expect(sower.bag.some(i=>i.uid===fungus.uid)).toBe(false);expect(tileAt(w,p.pos).spores).toMatchObject({until:turnOf(w)+3,conc:.35});expect(tileAt(w,{x:49,y:14}).spores).toBeUndefined()
  const hash=stateHash(s);expect(perform(w,sower,{type:'sowerSpray',target:p.id,uid:fungus.uid}).ok).toBe(false);expect(stateHash(s)).toBe(hash);expect(sower.sowerState!.lastSpray!.uid).toBe(fungus.uid)
 })
 it('restores mid-route finite stock, next actions, original UID and RNG with exact whole-world equality',()=>{
  const scene=sowerFixture(),{w,s,sower}=scene;step(scene);step(scene);step(scene);const restored={db:w.db,s:deserialize(serialize(s))}
  for(let i=0;i<35;i++){
   const original=aiDecide(w,sower),other=restored.s.creatures.find(c=>c.id===sower.id)!,action=aiDecide(restored,other);expect(action).toEqual(original);const a=perform(w,sower,original),b=perform(restored,other,action);expect(b).toEqual(a);s.time+=a.tu;restored.s.time+=b.tu;expect(stateHash(restored.s)).toBe(stateHash(s))
  }
 })
 it('runs through the real player scheduler while pending sowing progresses on actual NPC turns',()=>{
  const scene=sowerFixture(),{w,p,sower}=scene;p.pos={x:43,y:23};for(let i=0;i<10;i++)expect(playerAct(w,{type:'wait'})).toBeNull();expect(sower.sowerState).toBeDefined();expect(sower.sowerState!.seedsSpent).toBeGreaterThan(0);expect(seeds(sower)).toBeLessThan(8);expect(p.body.wounds).toEqual([])
 })
 it('pauses route work and spray cooldown with the same local combat clock while retaining real historical source timestamps',()=>{
  const scene=sowerFixture(),{w,s,p,sower,fungus}=scene;hurt(scene);perform(w,sower,{type:'sowerSpray',target:p.id,uid:fungus.uid});perform(w,sower,{type:'sowerWaypoint'});const left=turnOf(w),at=sower.sowerState!.lastSpray!.at,uid=sower.sowerState!.lastSpray!.uid,next=sower.nextAct;s.time+=360000;settleReentry(w,s.map,[sower],left)
  expect(sower.sowerState!.resumeAt-turnOf(w)).toBe(1);expect(sower.sowerState!.nextSprayAt!-turnOf(w)).toBe(20);expect(sower.sowerState!.lastSpray).toEqual({uid,at});expect(sower.nextAct-next).toBe(360000);expect(seeds(sower)).toBe(8)
 })
 it('a definition change cancels the old route contract without interpreting progress as fresh stock',()=>{
  const scene=sowerFixture(),{w,s,sower}=scene;step(scene);step(scene);const changed=structuredClone(sowerFixturePackage);(changed.defs.find(d=>d.id==='Creature.Sower')! as CreatureDef).sower!.seedEveryMoves=5
  const loaded=loadMods([...readPackages(),changed],['sower-policy-fixture']);expect(loaded.report.errors).toEqual([]);w.db=loaded.db;expect(aiDecide(w,sower)).toEqual({type:'wait'});const before=stateHash(s);expect(perform(w,sower,{type:'sowerWaypoint'}).ok).toBe(false);expect(stateHash(s)).toBe(before);expect(seeds(sower)).toBe(8)
 })
 it.each([{route:[]},{seedItem:'Item.IronScrap'},{signalPart:'Missing'},{pushDistance:3},{spray:{...sowerRule.spray,concentration:NaN}}])('rejects malformed finite machine rules %j',value=>{
  const pack=structuredClone(sowerFixturePackage),c=pack.defs.find(d=>d.id==='Creature.Sower')! as CreatureDef;c.sower={...c.sower!,...value};const loaded=loadMods([...readPackages(),pack],['sower-policy-fixture']);expect(loaded.report.errors.some(e=>e.includes('sower'))).toBe(true)
 })
 it('rejects malformed serialized work/call records without recreating a valid actor or inventory',()=>{
  const {s,sower}=sowerFixture();const raw=JSON.parse(serialize(s));raw.creatures.find((c:{id:number})=>c.id===sower.id).sowerState={rule:'{}',routeIndex:-1,moves:0,seedsSpent:0,resumeAt:0,alarmWound:0};expect(()=>deserialize(JSON.stringify(raw))).toThrow('파종기')
 })
})
