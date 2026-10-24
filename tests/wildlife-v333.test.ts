import {expect,it} from 'vitest'
import {aiDecide} from '../src/core/ai'
import {activityStep,perform} from '../src/core/actions'
import {addWound,capacity} from '../src/core/body'
import {hostile} from '../src/core/diplomacy'
import {calendar} from '../src/core/climate-state'
import {pickPart} from '../src/core/combat'
import {createCreature} from '../src/core/creatures'
import {invalidateLights} from '../src/core/fov'
import {cheb,DIRS} from '../src/core/geom'
import {makeItem,meleeWield} from '../src/core/items'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {wildlifeMudArmor,wildlifeTick,wildlifeThreats} from '../src/core/wildlife'
import {playerAct} from '../src/core/game'
import {blackwoodFixture} from './blackwood-fixture'
import {prisonerFixture} from './prisoner-fixture'
function fixture(id='Creature.AshhornStag'){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.fx=[];p.pos={x:5,y:5}
 for(let y=10;y<32;y++)for(let x=10;x<35;x++)Object.assign(s.map.tiles[y*s.map.w+x],{t:'Terrain.Earth',roof:true,icy:false,items:[],gatherAt:undefined,cultivation:undefined})
 while(calendar(w).season.id==='Season.Summer')s.time+=28800*100
 const animal=createCreature(w,id,{x:20,y:20});animal.home={...animal.pos};animal.body.wounds=[];animal.body.missing=[];animal.needs.bodyTemp=37;animal.needs.kcal=2000;animal.needs.waterDeficit=0;animal.needs.fatigue=10;animal.traits=[];animal.asleep=false;animal.unconscious=false;s.creatures=[p,animal];invalidateLights(w);return{w,s,p,animal}
}
it('a shy herbivore flees an adjacent bleeding unconscious human instead of inheriting the rat prey branch',()=>{
 const {w,p,animal}=fixture();p.pos={x:19,y:20};p.unconscious=true;const before=cheb(p.pos,animal.pos),decision=aiDecide(w,animal);expect(decision.type).toBe('move');expect(perform(w,animal,decision).ok).toBe(true);expect(cheb(p.pos,animal.pos)).toBeGreaterThan(before);expect(animal.ai.mode).toBe('flee')
})
it('a blocked stag uses real anatomy for defense; broken antlers fall back to hooves and no legs means no phantom fists',()=>{
 const {w,s,p,animal}=fixture();p.pos={x:19,y:20}
 for(const d of DIRS){const at={x:animal.pos.x+d.x,y:animal.pos.y+d.y};if(at.x!==p.pos.x||at.y!==p.pos.y)s.map.tiles[at.y*s.map.w+at.x].t='Terrain.KtWall'}
 expect(aiDecide(w,animal)).toEqual({type:'attack',target:p.id});expect(meleeWield(w,animal)?.atk.id).toBe('antlers');animal.body.missing.push('Antlers');expect(capacity(w,animal,'tool')).toBe(0);expect(meleeWield(w,animal)?.atk.id).toBe('hooves');animal.body.missing.push('FrontLeftLeg','FrontRightLeg','HindLeftLeg','HindRightLeg');expect(meleeWield(w,animal)).toBeUndefined()
})
it('mouth feeding consumes one original allowed floor unit and changes real nutrition without a human hand',()=>{
 const {w,s,animal}=fixture();animal.needs.kcal=-500;const meat=makeItem(w,'Item.RawMeat'),root=makeItem(w,'Item.ShadeRoot',2),tile=s.map.tiles[20*s.map.w+20];tile.items=[meat,root];const before=stateHash(s)
 expect(capacity(w,animal,'manipulation')).toBe(0);expect(perform(w,animal,{type:'animalEat',uid:meat.uid}).ok).toBe(false);expect(stateHash(s)).toBe(before);expect(perform(w,animal,{type:'animalEat',uid:root.uid}).ok).toBe(true);expect(root.count).toBe(1);expect(animal.needs.kcal).toBe(-200);expect(tile.items.find(i=>i.uid===root.uid)).toBe(root)
})
it('actual grazing persists mid-work, consumes the finite mature plant once, and restores to exactly the same whole state',()=>{
 const {w,s,animal}=fixture();animal.needs.kcal=-500;const pos={x:21,y:20},tile=s.map.tiles[pos.y*s.map.w+pos.x];tile.t='Terrain.ShadePlot';expect(perform(w,animal,{type:'animalBrowse',pos}).ok).toBe(true);for(let i=0;i<5;i++)activityStep(w,animal)
 const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===animal.id)!;for(let i=0;actor.activity&&i<30;i++)activityStep(run,actor);expect(actor.activity).toBeUndefined();expect(actor.needs.kcal).toBe(100);expect(actor.bag).toHaveLength(0);expect(run.s.map.tiles[pos.y*run.s.map.w+pos.x].gatherAt).toBeGreaterThan(0);const before=stateHash(run.s);expect(perform(run,actor,{type:'animalBrowse',pos}).ok).toBe(false);expect(stateHash(run.s)).toBe(before)}
 expect(stateHash(s)).toBe(stateHash(restored.s))
})
it('a genuine perceived threat interrupts grazing before any crop or calorie is consumed',()=>{
 const {w,s,p,animal}=fixture(),pos={x:21,y:20};animal.needs.kcal=-500;s.map.tiles[pos.y*s.map.w+pos.x].t='Terrain.ShadePlot';expect(perform(w,animal,{type:'animalBrowse',pos}).ok).toBe(true);activityStep(w,animal);p.pos={x:19,y:20};activityStep(w,animal);expect(animal.activity).toBeUndefined();expect(animal.needs.kcal).toBe(-500);expect(s.map.tiles[pos.y*s.map.w+pos.x].gatherAt).toBeUndefined()
})
it('a natural mouth can drink actual adjacent water; a human cannot bypass its missing hands with the animal action',()=>{
 const {w,s,p,animal}=fixture();animal.needs.waterDeficit=1000;s.map.tiles[20*s.map.w+21].t='Terrain.ShallowWater';expect(perform(w,animal,{type:'animalDrink'}).ok).toBe(true);expect(animal.needs.waterDeficit).toBeLessThan(1000);const before=stateHash(s);expect(perform(w,p,{type:'animalDrink'}).ok).toBe(false);expect(stateHash(s)).toBe(before)
})
it('a hurt forager keeps fighting; mud is acquired on a real mud tile and only exposed real rain washes it',()=>{
 const {w,s,p,animal}=fixture('Creature.Tuskhog');p.pos={x:19,y:20};addWound(w,animal,{def:'Wound.Cut',part:'FrontRightLeg',severity:3,source:'선언한 초기 상처',sourceId:p.id});expect(aiDecide(w,animal).type).toBe('attack');expect(animal.ai.mode).toBe('hunt');expect(animal.ai.morale).toBeGreaterThan(w.db.creature(animal.def).morale)
 const tile=s.map.tiles[20*s.map.w+20];expect(perform(w,animal,{type:'wallow'}).ok).toBe(false);tile.t='Terrain.Mud';expect(perform(w,animal,{type:'wallow'}).ok).toBe(true);expect(wildlifeMudArmor(w,animal)).toEqual({sharp:8,blunt:5});s.map.kind='surface';s.weather='ashrain';wildlifeTick(w,animal);expect(animal.wildlifeState!.mudRainRemaining).toBe(60);tile.roof=false;for(let i=0;i<60;i++)wildlifeTick(w,animal);expect(wildlifeMudArmor(w,animal)).toBeUndefined()
})
it('tusk attacks prefer legs through the shared part sampler and perception/armor reads leave the world untouched',()=>{
 const {w,p,animal}=fixture('Creature.Tuskhog'),atk=w.db.creature(animal.def).naturalAttack!;p.pos={x:19,y:20};let weighted=0,normal=0
 const start=serialize(w.s)
 for(let i=0;i<400;i++){const part=pickPart(w,animal,p,{attack:atk}).part;if(['lleg','rleg'].includes(part.region))weighted++}
 w.s=deserialize(start)
 for(let i=0;i<400;i++){const part=pickPart(w,animal,p).part;if(['lleg','rleg'].includes(part.region))normal++}
 expect(weighted).toBeGreaterThan(normal+35);const before=stateHash(w.s);wildlifeThreats(w,animal);wildlifeMudArmor(w,animal);expect(stateHash(w.s)).toBe(before)
})
it('the real forest entry creates five finite animals and a submap round trip preserves the original actor IDs',()=>{
 const {w,p}=blackwoodFixture(),species=new Set(['Creature.AshhornStag','Creature.Tuskhog']),original=w.s.creatures.filter(c=>species.has(c.def)).map(c=>c.id).sort((a,b)=>a-b)
 expect(original).toHaveLength(5);expect(new Set(original).size).toBe(5);p.pos={x:40,y:30};expect(playerAct(w,{type:'stairs'})).toBeNull();expect(w.s.map.id).toBe('seed-vault');w.s.creatures.find(c=>c.id===w.s.playerId)!.pos={...w.s.map.links.find(l=>l.to==='surface')!.pos};expect(playerAct(w,{type:'stairs'})).toBeNull();expect(w.s.map.id).toBe('surface');expect(w.s.creatures.filter(c=>species.has(c.def)).map(c=>c.id).sort((a,b)=>a-b)).toEqual(original)
})
it('foragers and hunting hounds are not treated as the same friendly herd',()=>{
 const {w,animal}=fixture(),hound=createCreature(w,'Creature.AshHound',{x:21,y:20});w.s.creatures.push(hound);expect(hostile(w,animal,hound)).toBe(true);expect(hostile(w,hound,animal)).toBe(true)
})
it('the per-actor seeded AI stream and ongoing decisions restore to exactly the same next world',()=>{
 const {w,animal}=fixture();for(let i=0;i<4;i++)expect(playerAct(w,{type:'wait'})).toBeNull();expect(w.s.rng[`ai.wildlife.${animal.id}`]).toBeDefined();const restored={db:w.db,s:deserialize(serialize(w.s))}
 for(let i=0;i<8;i++)for(const run of[w,restored])expect(playerAct(run,{type:'wait'})).toBeNull()
 expect(stateHash(restored.s)).toBe(stateHash(w.s))
})
it('salted plant bait increases real water loss and losing the mouth stops eating without stopping a conscious escape',()=>{
 const {w,s,p,animal}=fixture();animal.needs.waterDeficit=1000;const root=makeItem(w,'Item.ShadeRoot',2);root.foodSaltGrams=5;s.map.tiles[20*s.map.w+20].items=[root];expect(perform(w,animal,{type:'animalEat',uid:root.uid}).ok).toBe(true);expect(animal.needs.waterDeficit).toBeGreaterThan(1000);expect(root.count).toBe(1);animal.body.missing.push('Jaw');const before=stateHash(s);expect(perform(w,animal,{type:'animalEat',uid:root.uid}).ok).toBe(false);expect(stateHash(s)).toBe(before);p.pos={x:19,y:20};expect(aiDecide(w,animal).type).toBe('move')
})
