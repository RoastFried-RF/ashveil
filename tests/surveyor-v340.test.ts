import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {capacity} from '../src/core/body'
import {killCreature} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {startCraft} from '../src/core/crafting'
import {tileAt,turnOf} from '../src/core/ctx'
import {loadMods} from '../src/core/defs'
import {canSee,invalidateLights,sightRange} from '../src/core/fov'
import {gardenAlertState} from '../src/core/garden-alert'
import {playerAct} from '../src/core/game'
import {addToBag,allItems,hasEyeProtection,makeItem,meleeWield} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {surveyError} from '../src/core/surveyor'
import {towerGardenAlert} from '../src/core/tower-consequences'
import {studyBook} from '../src/core/skills'
import type {ItemDef} from '../src/core/types'
import {readPackages} from '../tools/loadContent'
import {prisonerFixture} from './prisoner-fixture'
function scene(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='surface';s.map.depth=0;s.map.ambient=1;s.map.daylightMult=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12;p.pos={x:50,y:20};p.bag=[];p.equip={}
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,items:[],cont:undefined,deco:undefined,placed:undefined,room:undefined,blood:0})
 const surveyor=createCreature(w,'Creature.Surveyor',{x:52,y:26});surveyor.met=true;surveyor.home={x:52,y:23};surveyor.nextAct=s.time+1;s.creatures=[p,surveyor];invalidateLights(w);return{w,s,p,surveyor}
}
it('the actual tripod has three powered legs, a separate antenna, no human hands and no direct weapon',()=>{
 const {w,surveyor,p}=scene();expect(w.db.body(surveyor.body.def).parts.filter(p=>p.qleg)).toHaveLength(3);expect(capacity(w,surveyor,'moving')).toBe(1);expect(capacity(w,surveyor,'manipulation')).toBe(0);expect(capacity(w,p,'signal')).toBe(0);expect(meleeWield(w,surveyor)).toBeUndefined();surveyor.body.missing=['DriveLeg1'];expect(capacity(w,surveyor,'moving')).toBeCloseTo(.8);surveyor.body.missing=['DriveLeg1','DriveLeg2','DriveLeg3'];expect(capacity(w,surveyor,'moving')).toBe(0)
})
it('three genuine consecutive work turns pay actual power and report exactly once; a mid-report save restores the same whole world',()=>{
 const {w,s,p,surveyor}=scene(),power=surveyor.body.machine!.power;expect(perform(w,surveyor,{type:'survey',target:p.id})).toMatchObject({ok:true,tu:0});expect(gardenAlertState(w)).toBeUndefined();expect(activityStep(w,surveyor)).toBe(false);const hash=stateHash(s);expect(activityStep(w,surveyor)).toBe(false);expect(stateHash(s)).toBe(hash);s.time+=100;expect(activityStep(w,surveyor)).toBe(false);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){run.s.time+=100;const c=run.s.creatures.find(c=>c.id===surveyor.id)!;expect(activityStep(run,c)).toBe(true);expect(c.activity).toBeUndefined();expect(c.body.machine!.power).toBeCloseTo(power-.3);expect(c.body.machine!.attacks??0).toBe(0);expect(towerGardenAlert(run)).toBe(1);expect(gardenAlertState(run)!.events).toEqual([{at:turnOf(run),source:surveyor.id,target:p.id,sourcePos:{x:52,y:26},targetPos:{x:50,y:20},level:1}]);const before=stateHash(run.s);expect(perform(run,c,{type:'survey',target:p.id}).ok).toBe(false);expect(stateHash(run.s)).toBe(before)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('lost actual line of sight interrupts spent work instead of adding nonconsecutive observations into a free report',()=>{
 const {w,s,p,surveyor}=scene();perform(w,surveyor,{type:'survey',target:p.id});activityStep(w,surveyor);s.time+=100;activityStep(w,surveyor);tileAt(w,{x:51,y:23}).t='Terrain.KtWall';invalidateLights(w);expect(canSee(w,surveyor,p.pos)).toBe(false);s.time+=100;expect(activityStep(w,surveyor)).toBe(true);expect(surveyor.surveyState!.lastInterrupted).toMatchObject({progress:2,target:p.id});expect(gardenAlertState(w)).toBeUndefined();tileAt(w,{x:51,y:23}).t='Terrain.Earth';invalidateLights(w);s.time+=100;expect(perform(w,surveyor,{type:'survey',target:p.id}).ok).toBe(true);expect(surveyor.activity!.remaining).toBe(3)
})
it('a saved partial report after an unobserved clock gap must do three new consecutive turns rather than silently finishing the old observation',()=>{
 const {w,s,p,surveyor}=scene();perform(w,surveyor,{type:'survey',target:p.id});activityStep(w,surveyor);s.time+=100;activityStep(w,surveyor);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){run.s.time+=5000;const c=run.s.creatures.find(c=>c.id===surveyor.id)!;expect(activityStep(run,c)).toBe(false);expect(c.surveyState!.lastInterrupted?.progress).toBe(2);expect(c.surveyState!.progress).toBe(1);expect(towerGardenAlert(run)).toBe(0);for(let n=0;n<2;n++){run.s.time+=100;activityStep(run,c)}expect(towerGardenAlert(run)).toBe(1)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('missing antenna, actual power loss and a target outside the actual watch area fail without a spent UID, turn or RNG',()=>{
 const {w,s,p,surveyor}=scene();for(const mode of['antenna','power','outside']){surveyor.body.missing=mode==='antenna'?['Antenna']:[];surveyor.body.machine!.power=mode==='power'?0:100;p.pos=mode==='outside'?{x:43,y:20}:{x:50,y:20};const before=stateHash(s);expect(perform(w,surveyor,{type:'survey',target:p.id}).ok).toBe(false);expect(stateHash(s)).toBe(before)}
})
it('consecutive observation still requires genuine power and an intact antenna on every work turn',()=>{
 const {w,s,p,surveyor}=scene();perform(w,surveyor,{type:'survey',target:p.id});activityStep(w,surveyor);s.time+=100;surveyor.body.missing=['Antenna'];expect(activityStep(w,surveyor)).toBe(true);expect(surveyor.surveyState!.progress).toBe(0);expect(towerGardenAlert(w)).toBe(0)
})
it('a changed observation-work definition cancels the original in-flight report instead of silently reinterpreting its spent progress',()=>{
 const {w,s,p,surveyor}=scene();perform(w,surveyor,{type:'survey',target:p.id});activityStep(w,surveyor);const modified=loadMods([...readPackages(),{manifest:{id:'changed-survey',name:'관찰 노동 변경',version:'1'},defs:[],patches:[{op:'replace',target:'Creature.Surveyor',path:'/survey/reportTurns',value:4}]}],['changed-survey']);expect(modified.report.errors).toEqual([]);w.db=modified.db;s.time+=100;expect(activityStep(w,surveyor)).toBe(true);expect(surveyor.activity).toBeUndefined();expect(gardenAlertState(w)).toBeUndefined();expect(surveyor.surveyState!.lastInterrupted?.progress).toBe(1)
})
it('real AI chooses observation at working distance and three actual player waits report once without any direct attack',()=>{
 const {w,s,p,surveyor}=scene();expect(aiDecide(w,surveyor)).toEqual({type:'survey',target:p.id});for(let n=0;n<3;n++)expect(playerAct(w,{type:'wait'})).toBeNull();expect(towerGardenAlert(w)).toBe(1);expect(surveyor.body.machine!.attacks??0).toBe(0);expect(p.body.wounds).toEqual([]);expect(s.creatures).toHaveLength(2)
})
it('real short-range optical flash reduces sight for only the actual two turns, charges power and cannot be spammed',()=>{
 const {w,s,p,surveyor}=scene();p.pos={x:52,y:25};const range=sightRange(w,p),power=surveyor.body.machine!.power;expect(perform(w,surveyor,{type:'sensorFlash'}).ok).toBe(true);expect(sightRange(w,p)).toBe(Math.max(1,Math.round(range*.2)));expect(surveyor.body.machine!.power).toBeCloseTo(power-.1);expect(surveyor.body.machine!.attacks??0).toBe(0);const before=stateHash(s);expect(perform(w,surveyor,{type:'sensorFlash'}).ok).toBe(false);expect(stateHash(s)).toBe(before);s.time+=200;expect(sightRange(w,p)).toBe(range);expect(p.body.wounds).toEqual([])
})
it('actual undamaged eye protection blocks flash while an unavailable optical mast cannot flash through its absence',()=>{
 const {w,s,p,surveyor}=scene();p.pos={x:52,y:25};const protection=w.db.all<ItemDef>('Item').find(i=>i.apparel?.eyeProtection)!;expect(protection).toBeDefined();p.equip.head=makeItem(w,protection.id);const range=sightRange(w,p);expect(perform(w,surveyor,{type:'sensorFlash'}).ok).toBe(true);expect(sightRange(w,p)).toBe(range);s.time+=1200;surveyor.body.missing=['SensorMast'];const before=stateHash(s);expect(perform(w,surveyor,{type:'sensorFlash'}).ok).toBe(false);expect(stateHash(s)).toBe(before)
})
it('the passive policy never falls back to a punch even when an unpowered or damaged tripod cannot escape',()=>{
 const {w,p,surveyor}=scene();p.pos={x:52,y:25};expect(aiDecide(w,surveyor)).toEqual({type:'sensorFlash'});surveyor.body.machine!.power=0;expect(aiDecide(w,surveyor)).toEqual({type:'wait'});expect(perform(w,surveyor,{type:'attack',target:p.id}).ok).toBe(false)
})
it('the dedicated noncombat policy still obeys the same real mechanical controller-fault loop and restores its next original movement',()=>{
 const {w,s,surveyor}=scene();surveyor.body.machine!.errorLoop={until:turnOf(w)+20,action:{type:'move',dir:2}};const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const c=run.s.creatures.find(c=>c.id===surveyor.id)!;for(let n=0;n<3;n++){const action=aiDecide(run,c);expect(action).toEqual({type:'move',dir:2});expect(perform(run,c,action).ok).toBe(true);run.s.time+=100}expect(c.pos).toEqual({x:55,y:26});expect(c.body.machine!.attacks??0).toBe(0)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('its real original component UIDs move into the corpse once and do not mint a second set on repeated death',()=>{
 const {w,s,surveyor}=scene(),components=structuredClone(surveyor.body.machine!.components!);expect(components.filter(i=>i.def==='Item.SurveyLens').reduce((n,i)=>n+i.count,0)).toBe(1);killCreature(w,surveyor,'선언한 실제 기계 검사 사망');expect(surveyor.body.machine!.components).toEqual([]);const hash=stateHash(s);killCreature(w,surveyor,'두 번째 사망 처리');expect(stateHash(s)).toBe(hash);const actual=[...surveyor.bag,...tileAt(w,surveyor.pos).items];for(const it of components)expect(actual.filter(i=>i.uid===it.uid).reduce((n,i)=>n+i.count,0)).toBe(it.count)
})
it('actual recovered lens and wire UIDs make a single pair of goggles through learned work, then real dressing provides eye protection',()=>{
 const {w,s,p,surveyor}=scene();killCreature(w,surveyor,'선언한 원래 부품 회수 검사 사망');p.pos={x:51,y:26};expect(perform(w,p,{type:'search',target:surveyor.id}).ok).toBe(true);while(p.activity)activityStep(w,p)
 for(const source of [...surveyor.bag])expect(perform(w,p,{type:'lootTake',uid:source.uid}).ok).toBe(true)
 const lens=p.bag.find(i=>i.def==='Item.SurveyLens')!,wire=p.bag.find(i=>i.def==='Item.AntennaWire')!;expect(lens).toBeDefined();expect(wire.count).toBe(2);studyBook(w,p,'Item.CraftManual');tileAt(w,{x:50,y:26}).t='Terrain.Workbench'
 for(const id of['Item.Leather','Item.Thread','Item.Charcoal','Item.Needle','Item.Tongs'])expect(addToBag(w,p,makeItem(w,id))).toBe(0)
 expect(startCraft(w,p,'Recipe.OpticalGoggles',1)).toBeNull();for(let n=0;n<25;n++)activityStep(w,p);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!;for(let n=0;actor.activity&&n<2000;n++)activityStep(run,actor);const goggles=allItems(actor).filter(i=>i.def==='Item.OpticalGoggles');expect(goggles).toHaveLength(1);expect(allItems(actor).some(i=>i.uid===lens.uid)).toBe(false);expect(allItems(actor).find(i=>i.uid===wire.uid)?.count).toBe(1);expect(hasEyeProtection(run,actor)).toBe(false);expect(perform(run,actor,{type:'equip',uid:goggles[0].uid,slot:'head'}).ok).toBe(true);while(actor.activity)activityStep(run,actor);expect(actor.equip.head?.uid).toBe(goggles[0].uid);expect(hasEyeProtection(run,actor)).toBe(true);actor.equip.head!.durability=0;expect(hasEyeProtection(run,actor)).toBe(false);actor.equip.head!.durability=100;actor.equip.head!.half=true;expect(hasEyeProtection(run,actor)).toBe(false)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it.each([{antenna:'AbsentPart'},{flashSightMult:NaN},{keepDistance:[2,8]},{reportTurns:0},{patrol:[]}])('malformed physical surveillance rules %j are rejected by the actual content loader',value=>{
 const result=loadMods([...readPackages(),{manifest:{id:'invalid-survey',name:'검사',version:'1'},defs:[],patches:Object.entries(value).map(([key,value])=>({op:'replace' as const,target:'Creature.Surveyor',path:'/survey/'+key,value}))}],['invalid-survey']);expect(result.report.errors.some(e=>e.includes('survey'))).toBe(true)
})
it('surveillance quotes are read-only even when an active report has been saved mid-work',()=>{
 const {w,s,p,surveyor}=scene();perform(w,surveyor,{type:'survey',target:p.id});activityStep(w,surveyor);const before=stateHash(s);for(let n=0;n<4;n++)expect(surveyError(w,surveyor,p)).toBeNull();expect(stateHash(s)).toBe(before)
})
