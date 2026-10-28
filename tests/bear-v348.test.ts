import {expect,it} from 'vitest'
import {aiDecide} from '../src/core/ai'
import {perform,activityStep} from '../src/core/actions'
import {abilityReady} from '../src/core/abilities'
import {capacity} from '../src/core/body'
import {wake,resolveAttack,killCreature} from '../src/core/combat'
import {hostile} from '../src/core/diplomacy'
import {calendar} from '../src/core/climate-state'
import {createCreature} from '../src/core/creatures'
import {invalidateLights} from '../src/core/fov'
import {cheb} from '../src/core/geom'
import {addToBag,itemDef,makeItem,meleeWield} from '../src/core/items'
import {startCraft} from '../src/core/crafting'
import {materialMassG} from '../src/core/materials'
import {startDissection} from '../src/core/bestiary'
import {bestiaryDef,ensureBestiary} from '../src/core/bestiary-state'
import {animalWarn,seasonalActionTU} from '../src/core/bear-state'
import {decideBear} from '../src/core/bears'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {prisonerFixture} from './prisoner-fixture'
import {playerAct} from '../src/core/game'
import {blackwoodFixture} from './blackwood-fixture'
function fixture(season='Season.Summer'){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.fx=[];s.sources=[]
 for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.Earth',roof:true,items:[],cont:undefined,cultivation:undefined})
 for(let days=0;calendar(w).season.id!==season&&days<100;days++)s.time+=28800*100
 const bear=createCreature(w,'Creature.CinderBear',{x:20,y:20});bear.home={...bear.pos};bear.needs.kcal=2000;bear.needs.waterDeficit=0;bear.needs.fatigue=10;bear.needs.bodyTemp=37;bear.asleep=false;bear.unconscious=false;bear.traits=[];bear.body.wounds=[];bear.body.missing=[];bear.met=true
 p.pos={x:26,y:20};p.nextAct=s.time;bear.nextAct=s.time+1;p.needs.nutritionDay=Math.floor(s.time/(100*28800));s.creatures=[p,bear];invalidateLights(w);return{w,s,p,bear}
}
it('warns for two actual consecutive actions without injuring the intruder; quotes and repeated same-turn attempts give no free progress',()=>{
 const {w,s,p,bear}=fixture();const before=stateHash(s);expect(hostile(w,p,bear)).toBe(false);expect(stateHash(s)).toBe(before)
 expect(aiDecide(w,bear)).toEqual({type:'animalWarn',target:p.id});expect(perform(w,bear,{type:'animalWarn',target:p.id})).toEqual({ok:true,tu:100});expect(bear.wildlifeState?.denWarning?.progress).toBe(1)
 const after=stateHash(s);expect(animalWarn(w,bear,p.id).ok).toBe(false);expect(stateHash(s)).toBe(after);expect(p.body.wounds).toHaveLength(0)
 s.time+=100;expect(perform(w,bear,aiDecide(w,bear)).ok).toBe(true);expect(bear.wildlifeState?.denWarning?.progress).toBe(2);s.time+=100
 expect(aiDecide(w,bear).type).toBe('move');expect(bear.ai.mode).toBe('hunt');expect(hostile(w,p,bear)).toBe(true)
})
it('releases a sated retreat beyond its home territory rather than chasing a healthy observer forever',()=>{
 const {w,s,p,bear}=fixture();perform(w,bear,aiDecide(w,bear));s.time+=100;perform(w,bear,aiDecide(w,bear));s.time+=100;p.pos={x:28,y:20};aiDecide(w,bear);expect(bear.ai.target).toBeUndefined();expect(bear.wildlifeState?.denWarning).toBeUndefined();expect(hostile(w,p,bear)).toBe(false)
})
it('an unobserved gap or a different original intruder restarts genuine warning progress',()=>{
 const {w,s,p,bear}=fixture();perform(w,bear,aiDecide(w,bear));s.time+=500;perform(w,bear,aiDecide(w,bear));expect(bear.wildlifeState?.denWarning?.progress).toBe(1)
 const other=createCreature(w,p.def,{x:25,y:20});s.creatures.push(other);s.time+=100;perform(w,bear,{type:'animalWarn',target:other.id});expect(bear.wildlifeState?.denWarning).toMatchObject({actor:other.id,progress:1});expect(other.id).not.toBe(p.id)
})
it('hungry spring and real provocation skip warnings but remain bounded by the original home leash',()=>{
 const {w,p,bear}=fixture('Season.Spring');bear.needs.kcal=-200;p.pos={x:28,y:20};expect(aiDecide(w,bear).type).toBe('move');expect(bear.ai.mode).toBe('hunt');expect(bear.wildlifeState?.denWarning).toBeUndefined()
 bear.needs.kcal=2000;bear.attackedBy=[p.id];expect(aiDecide(w,bear).type).toBe('move');expect(bear.ai.mode).toBe('hunt');p.pos={x:33,y:20};aiDecide(w,bear);expect(bear.ai.mode).not.toBe('hunt')
})
it('actual 30percent blood loss makes the same animal retreat using ordinary movement',()=>{
 const {w,p,bear}=fixture();p.pos={x:21,y:20};bear.body.blood=bear.body.bloodMax*.69;const distance=cheb(p.pos,bear.pos),decision=aiDecide(w,bear);expect(decision.type).toBe('move');expect(bear.ai.mode).toBe('flee');expect(perform(w,bear,decision).ok).toBe(true);expect(cheb(p.pos,bear.pos)).toBeGreaterThan(distance)
})
it('real paws, jaw and grip capacity prevent phantom fists and hand abilities',()=>{
 const {w,s,p,bear}=fixture();expect(capacity(w,bear,'manipulation')).toBe(0);expect(capacity(w,bear,'tool')).toBe(0);expect(capacity(w,bear,'claw')).toBe(1);expect(meleeWield(w,bear)?.atk.id).toBe('paw')
 bear.body.missing.push('FrontLeftLeg','FrontRightLeg');expect(capacity(w,bear,'claw')).toBe(0);expect(meleeWield(w,bear)?.atk.id).toBe('bite');const before=stateHash(s);expect(abilityReady(w,bear,'Ab.Bear.Grip')).toBeTruthy();expect(perform(w,bear,{type:'ability',id:'Ab.Bear.Grip',target:p.id}).ok).toBe(false);expect(stateHash(s)).toBe(before)
 bear.body.missing.push('Jaw');expect(meleeWield(w,bear)).toBeUndefined();expect(capacity(w,bear,'bite')).toBe(0);bear.attackedBy=[p.id];const decision=aiDecide(w,bear);expect(bear.ai.mode).toBe('flee');expect(decision.type).toBe('move');const distance=cheb(p.pos,bear.pos);expect(perform(w,bear,decision).ok).toBe(true);expect(cheb(p.pos,bear.pos)).toBeGreaterThan(distance)
})
it('the actual resolved natural attack mode is retained on its presentation event',()=>{
 const {w,s,p,bear}=fixture();p.pos={x:21,y:20};resolveAttack(w,bear,p,{mode:'bite'});expect([...s.fx].reverse().find(event=>event.k==='attack')).toMatchObject({mode:'bite',id:bear.id,target:p.id})
})
it('a real allowed food UID is consumed once with the same mouth and nutrition path',()=>{
 const {w,s,p,bear}=fixture();p.pos={x:5,y:5};bear.needs.kcal=-2000;const meat=makeItem(w,'Item.SmokedMeat',2);s.map.tiles[20*s.map.w+20].items=[meat];const uid=meat.uid,initial=bear.needs.kcal
 expect(perform(w,bear,{type:'animalEat',uid}).ok).toBe(true);expect(meat.uid).toBe(uid);expect(meat.count).toBe(1);expect(bear.needs.kcal).toBeGreaterThan(initial);expect(perform(w,bear,{type:'animalEat',uid}).ok).toBe(true);const after=stateHash(s);expect(perform(w,bear,{type:'animalEat',uid}).ok).toBe(false);expect(stateHash(s)).toBe(after)
})
it('a floor lure is the actual visible unsealed food, not a log, a closed vessel or a phantom UID',()=>{
 const {w,s,p,bear}=fixture();p.pos={x:5,y:5};bear.needs.kcal=-2000;const calls:unknown[]=[],nav={toward:(p:{x:number;y:number})=>{calls.push(p);return{type:'move',dir:2}as const},away:()=>null,ability:()=>null},rule=w.db.creature(bear.def).wildlife!,pos={x:23,y:20}
 s.log.push({turn:s.time/100,kind:'info',text:'훈제 고기 냄새가 난다'});expect(decideBear(w,bear,rule,nav,()=>({type:'wait'}))).toEqual({type:'wait'});expect(calls).toHaveLength(0)
 const meat=makeItem(w,'Item.SmokedMeat');meat.foodSealed=true;s.map.tiles[pos.y*s.map.w+pos.x].items=[meat];expect(decideBear(w,bear,rule,nav,()=>({type:'wait'}))).toEqual({type:'wait'});delete meat.foodSealed;expect(decideBear(w,bear,rule,nav,()=>({type:'wait'})).type).toBe('move');expect(calls).toEqual([pos]);expect(meat.count).toBe(1)
})
it('winter sleep uses the same finite actor, actual needs and serialized work; waking slows actual action costs once',()=>{
 const {w,s,p,bear}=fixture('Season.Winter');p.pos={x:5,y:5};expect(aiDecide(w,bear)).toEqual({type:'sleep',seasonal:true});expect(perform(w,bear,aiDecide(w,bear)).ok).toBe(true);expect(bear.activity?.seasonalSleep?.season).toBe('Season.Winter');expect(bear.asleep).toBe(true);expect(bear.needs.kcal).toBe(2000);expect(bear.needs.fatigue).toBe(10)
 const restored={db:w.db,s:deserialize(serialize(s))};for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===bear.id)!;activityStep(run,actor);wake(run,actor,'공격받음');expect(actor.asleep).toBe(false);expect(actor.activity?.seasonalSleep).toBeUndefined();const until=actor.wildlifeState!.wakeSlowUntil;expect(seasonalActionTU(run,actor,100)).toBe(200);expect(seasonalActionTU(run,actor,0)).toBe(0);wake(run,actor,'중복 깨우기');expect(actor.wildlifeState?.wakeSlowUntil).toBe(until);run.s.time+=300;expect(seasonalActionTU(run,actor,100)).toBe(100)}
 expect(stateHash(s)).toBe(stateHash(restored.s))
})
it('winter sleep cannot be requested at the wrong season, away from the real den, hungry or without the actual animal policy',()=>{
 const {w,s,p,bear}=fixture();const before=stateHash(s);expect(perform(w,bear,{type:'sleep',seasonal:true}).ok).toBe(false);expect(stateHash(s)).toBe(before);expect(perform(w,p,{type:'sleep',seasonal:true}).ok).toBe(false)
 const winter=fixture('Season.Winter');winter.bear.pos={x:24,y:20};expect(perform(winter.w,winter.bear,{type:'sleep',seasonal:true}).ok).toBe(false);winter.bear.pos={...winter.bear.home!};winter.bear.needs.kcal=-1;expect(perform(winter.w,winter.bear,{type:'sleep',seasonal:true}).ok).toBe(false)
})
it('actual scheduler turns do not end winter sleep just because fatigue reaches zero; real thirst wakes the same actor with no free calories',()=>{
 const {w,s,p,bear}=fixture('Season.Winter');p.pos={x:5,y:5};expect(perform(w,bear,{type:'sleep',seasonal:true}).ok).toBe(true);bear.needs.fatigue=0
 expect(playerAct(w,{type:'wait'})).toBeNull();expect(bear.asleep).toBe(true);expect(bear.activity?.seasonalSleep).toBeDefined();expect(bear.needs.kcal).toBeLessThan(2000)
 bear.needs.waterDeficit=2000;const next=bear.nextAct;expect(playerAct(w,{type:'wait'})).toBeNull();expect(bear.asleep).toBe(false);expect(bear.activity).toBeUndefined();expect(bear.nextAct-next).toBe(200);expect(s.creatures.filter(c=>c.def===bear.def).map(c=>c.id)).toEqual([bear.id]);expect(bear.needs.waterDeficit).toBeGreaterThanOrEqual(2000)
})
it('ordinary carrion portions and later dissection spend the same original stock and preserve the entire saved world',()=>{
 const {w,s,p,bear}=fixture();p.pos={x:22,y:21};const animal=createCreature(w,'Creature.AshhornStag',{x:21,y:20});s.creatures.push(animal);killCreature(w,animal,'검사 장면의 실제 사망');const original=animal.carcassStock!['Item.RawMeat'].original
 expect(perform(w,bear,{type:'tearCarrion',target:animal.id}).ok).toBe(true);const meat=s.map.tiles[bear.pos.y*s.map.w+bear.pos.x].items.find(i=>i.def==='Item.RawMeat')!;expect(meat.count).toBe(1);expect(animal.carcassStock!['Item.RawMeat'].remaining).toBe(original-1)
 expect(perform(w,bear,{type:'animalEat',uid:meat.uid}).ok).toBe(true);addToBag(w,p,makeItem(w,'Item.RustyKnife'));ensureBestiary(w,animal.def,p).dissected=bestiaryDef(w).autoDissectAfter;expect(startDissection(w,p,animal.id,5)).toBeNull();activityStep(w,p);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!;for(let i=0;actor.activity&&i<20;i++)activityStep(run,actor);const corpse=run.s.creatures.find(c=>c.id===animal.id)!;expect(corpse.dissected?.success).toBe(true);expect(run.s.map.tiles[corpse.pos.y*run.s.map.w+corpse.pos.x].items.filter(i=>i.def==='Item.RawMeat').reduce((n,i)=>n+i.count,0)).toBe(original-1);expect(corpse.carcassStock!['Item.RawMeat'].remaining).toBe(0)}
 expect(stateHash(s)).toBe(stateHash(restored.s))
})
it('three original kilograms of tanned bear hide become an insulated coat through the existing material work, including exact mid-work restore',()=>{
 const {w,s,p}=fixture();s.creatures=[p];p.pos={x:20,y:20};s.map.tiles[20*s.map.w+19].t='Terrain.Workbench';p.bag=[];p.recipes=['Recipe.CustomCoat'];addToBag(w,p,makeItem(w,'Item.Needle'));const hides=Array.from({length:3},()=>makeItem(w,'Item.CinderBearLeather'));for(const hide of hides)expect(addToBag(w,p,hide)).toBe(0)
 expect(startCraft(w,p,'Recipe.CustomCoat',1,{body:hides.map(hide=>({uid:hide.uid,grams:1000}))})).toBeNull();for(let i=0;i<7;i++)activityStep(w,p);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!;for(let i=0;actor.activity&&i<2000;i++)activityStep(run,actor);expect(actor.activity).toBeUndefined();const coat=actor.bag.find(i=>i.def==='Item.CustomCoat')!;expect(coat.stuff?.body).toEqual([{material:'Material.CinderBearHide',massG:3000}]);expect(materialMassG(run,coat)).toBe(3000);expect(itemDef(run,coat).apparel?.insulation).toBe(8);expect(actor.bag.some(i=>hides.some(h=>h.uid===i.uid))).toBe(false)}
 expect(stateHash(s)).toBe(stateHash(restored.s))
})
it('one real new-map hunting cache supplies separate notes even when both older manuals are already read',()=>{
 const {w,p}=blackwoodFixture(),notes=w.s.map.tiles.flatMap(tile=>tile.cont?.items??[]).filter(item=>item.def==='Item.BearProcessingNotes');expect(notes).toHaveLength(1);const note=notes[0],uid=note.uid;expect(note.count).toBe(1);expect(w.s.creatures.filter(c=>c.def==='Creature.CinderBear')).toHaveLength(1)
 // The following is a finite initial book-use fixture, not a claim of a natural campaign pickup.
 const d=fixture();d.s.creatures=[d.p];d.p.pos={x:20,y:20};d.p.booksRead=['Item.CraftManual','Item.MaterialManual'];d.p.recipes=[];d.p.literacy=2;d.p.literate=true;const book=makeItem(d.w,'Item.BearProcessingNotes');expect(addToBag(d.w,d.p,book)).toBe(0);expect(perform(d.w,d.p,{type:'read',uid:book.uid}).ok).toBe(true);for(let i=0;i<7;i++)activityStep(d.w,d.p);const restored={db:d.w.db,s:deserialize(serialize(d.s))}
 for(const run of[d.w,restored]){const actor=run.s.creatures.find(c=>c.id===d.p.id)!;for(let i=0;actor.activity&&i<3000;i++)activityStep(run,actor);expect(actor.booksRead).toContain('Item.BearProcessingNotes');expect(actor.recipes).toEqual(expect.arrayContaining(['Recipe.TanCinderBearHide','Recipe.RenderBearFat','Recipe.CustomCoat']));const before=stateHash(run.s);expect(perform(run,actor,{type:'read',uid:book.uid}).ok).toBe(false);expect(stateHash(run.s)).toBe(before)}
 expect(stateHash(d.s)).toBe(stateHash(restored.s));expect(notes[0]).toMatchObject({uid,count:1});expect(p.booksRead??[]).not.toContain('Item.BearProcessingNotes')
})
