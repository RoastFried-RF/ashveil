import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {inDeepWater} from '../src/core/aquatic-state'
import {aquaticTick} from '../src/core/aquatic'
import {startDissection} from '../src/core/bestiary'
import {bestiaryDef,ensureBestiary} from '../src/core/bestiary-state'
import {bodyTick,capacity} from '../src/core/body'
import {ageCarcass} from '../src/core/carcass'
import {calendar} from '../src/core/climate-state'
import {attackPreyError,canReach,killCreature,pickPart} from '../src/core/combat'
import {startCraft} from '../src/core/crafting'
import {foodKcal} from '../src/core/cooking-state'
import {createCreature} from '../src/core/creatures'
import {tileAt,turnOf} from '../src/core/ctx'
import {hostile} from '../src/core/diplomacy'
import {flightReady,flightTick} from '../src/core/flight'
import {ageFood} from '../src/core/food-safety'
import {gatherStockCount} from '../src/core/gather-stock'
import {playerAct} from '../src/core/game'
import {DIRS} from '../src/core/geom'
import {addToBag,allItems,makeItem,meleeWield} from '../src/core/items'
import {metabolismRate} from '../src/core/nutrition'
import {metabolicSize} from '../src/core/nutrition-state'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {studyBook} from '../src/core/skills'
import {thermalState,wetnessTick} from '../src/core/thermal'
import {addEffect} from '../src/core/traits'
import {calorieAbsorption} from '../src/core/water-state'
import {prisonerFixture} from './prisoner-fixture'

function scene(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='surface';s.map.ambient=1;s.map.daylightMult=1;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12;s.storyteller.budget=-1e9;p.pos={x:20,y:20};p.bag=[];p.equip={};p.traits=[];p.effects=[];p.body.wounds=[];p.body.missing=[];p.activity=undefined;p.asleep=false;p.unconscious=false
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,blood:0,items:[],cont:undefined,placed:undefined,cultivation:undefined,gatherStock:undefined,gatherAt:undefined,icy:false,deco:undefined,room:undefined})
 const bird=createCreature(w,'Creature.AshCrow',{x:30,y:20});s.creatures=[p,bird];bird.met=true;bird.body.wounds=[];bird.body.missing=[];bird.effects=[];bird.asleep=false;bird.unconscious=false;bird.home={...bird.pos}
 for(const c of s.creatures){c.nextAct=s.time;Object.assign(c.needs,{nutritionDay:Math.floor(turnOf(w)/28800),kcal:1000,waterDeficit:0,bodyTemp:37,fatigue:10,protein:100,vitamin:100,hygiene:100,energy:100,scurvy:0,wetness:0})}
 return{w,s,p,bird}
}
it('flight uses two real wings while ground hopping uses two real legs; humans have no imaginary peck or flight organs',()=>{
 const {w,p,bird}=scene();expect(capacity(w,p,'flight')).toBe(0);expect(capacity(w,p,'peck')).toBe(0);bird.body.missing=['LeftWing'];expect(capacity(w,bird,'moving')).toBe(1);expect(capacity(w,bird,'flight')).toBe(.5);expect(flightReady(w,bird)).toBe(false);expect(perform(w,bird,{type:'takeFlight'}).ok).toBe(false);bird.body.missing=['LeftLeg','RightLeg'];expect(capacity(w,bird,'moving')).toBe(0);expect(capacity(w,bird,'flight')).toBe(1)
})
it('real low flight crosses outdoor trees/water and pays energy, while architecture/landing barriers keep failed actions unspent',()=>{
 const {w,s,bird}=scene();tileAt(w,{x:31,y:20}).t='Terrain.Tree';tileAt(w,{x:32,y:20}).t='Terrain.DeepFenWater';expect(perform(w,bird,{type:'takeFlight'}).ok).toBe(true);expect(bird.needs.energy).toBe(97);expect(perform(w,bird,{type:'fly',dir:2}).ok).toBe(true);expect(perform(w,bird,{type:'fly',dir:2}).ok).toBe(true);expect(bird.pos).toEqual({x:32,y:20});expect(bird.needs.energy).toBe(93);const hash=stateHash(s);expect(perform(w,bird,{type:'land'}).ok).toBe(false);expect(stateHash(s)).toBe(hash);expect(perform(w,bird,{type:'fly',dir:2}).ok).toBe(true);expect(perform(w,bird,{type:'land'}).ok).toBe(true);expect(bird.flight).toBeUndefined();expect(perform(w,bird,{type:'takeFlight'}).ok).toBe(true);tileAt(w,{x:34,y:20}).roof=true;const next=stateHash(s);expect(perform(w,bird,{type:'fly',dir:2}).ok).toBe(false);expect(stateHash(s)).toBe(next)
})
it('flying over water does not apply ground immersion, but wing failure falls at the actual tile and restores genuine water exposure',()=>{
 const {w,bird}=scene();tileAt(w,{x:31,y:20}).t='Terrain.DeepFenWater';perform(w,bird,{type:'takeFlight'});perform(w,bird,{type:'fly',dir:2});expect(inDeepWater(w,bird)).toBe(false);wetnessTick(w,bird);aquaticTick(w,bird);expect(bird.needs.wetness).toBe(0);expect(bird.aquatic).toBeUndefined();bird.body.missing=['LeftWing'];flightTick(w,bird);expect(bird.pos).toEqual({x:31,y:20});expect(bird.flight).toBeUndefined();expect(bird.body.wounds.some(wd=>wd.source.includes('추락'))).toBe(true);expect(inDeepWater(w,bird)).toBe(true);wetnessTick(w,bird);expect(bird.needs.wetness).toBe(100)
})
it('actual flight duration expires into a controlled landing on the same dry ground without creating an injury',()=>{
 const {w,s,bird}=scene();perform(w,bird,{type:'takeFlight'});s.time=bird.flight!.landAt*100;flightTick(w,bird);expect(bird.flight).toBeUndefined();expect(bird.pos).toEqual({x:30,y:20});expect(bird.body.wounds).toEqual([])
})
it('healthy humans cannot be pecked, physically unconscious intact eyes can, and original face cover or missing eyes stops that attack',()=>{
 const {w,s,p,bird}=scene();bird.pos={x:21,y:20};const attack=meleeWield(w,bird)!.atk,before=stateHash(s);expect(perform(w,bird,{type:'attack',target:p.id}).ok).toBe(false);expect(stateHash(s)).toBe(before);addEffect(p,'stunned',turnOf(w)+100);bodyTick(w,p,false);expect(p.unconscious).toBe(true);expect(attackPreyError(w,p,attack)).toBeNull();expect(canReach(w,bird,p)).toBe(true);p.equip.head=makeItem(w,'Item.Hood');expect(attackPreyError(w,p,attack)).not.toBeNull();p.equip.head.half=true;expect(attackPreyError(w,p,attack)).toBeNull();delete p.equip.head.half;p.equip.head.durability=0;expect(attackPreyError(w,p,attack)).toBeNull();p.body.missing=['LeftEye','RightEye'];expect(attackPreyError(w,p,attack)).not.toBeNull()
})
it('eye preference multiplies the shared real anatomy sampler for a downed target without a forced eye hit',()=>{
 const {w,p,bird}=scene();p.unconscious=true;const attack=meleeWield(w,bird)!.atk;let eyes=0,other=0
 for(let n=0;n<400;n++){const hit=pickPart(w,bird,p,{attack}).part;if(hit.capacities?.sight)eyes++;else other++}expect(eyes).toBeGreaterThan(40);expect(other).toBeGreaterThan(40)
})
it('the real weak beak can actually wound an exposed unconscious body through the shared strength and integer damage calculation',()=>{
 const {w,p,bird}=scene();bird.pos={x:21,y:20};p.unconscious=true;let attacks=0
 while(p.body.wounds.length===0&&attacks<12){expect(perform(w,bird,{type:'attack',target:p.id}).ok).toBe(true);attacks++}
 expect(p.body.wounds.length).toBeGreaterThan(0);expect(p.hp).toBeLessThan(95);expect(bird.stats.str).toBe(2)
})
it('a grounded cornered scavenger still refuses to punch a healthy human',()=>{
 const {w,p,bird}=scene();w.s.map.kind='dungeon';bird.pos={x:21,y:20};for(const d of DIRS){const pos={x:bird.pos.x+d.x,y:bird.pos.y+d.y};if(pos.x!==p.pos.x||pos.y!==p.pos.y)tileAt(w,pos).t='Terrain.KtWall'}expect(aiDecide(w,bird)).toEqual({type:'wait'})
})
it('a crow hunting another unconscious person does not become an enemy of an uninvolved observer; actual provocation remains hostile',()=>{
 const {w,s,p,bird}=scene(),victim=createCreature(w,'Creature.Reaver',{x:31,y:20});s.creatures.push(victim);victim.unconscious=true;bird.ai.mode='hunt';bird.ai.target=victim.id;const before=stateHash(s)
 expect(hostile(w,p,bird)).toBe(false);expect(hostile(w,bird,p)).toBe(false);expect(hostile(w,bird,victim)).toBe(true);expect(stateHash(s)).toBe(before);bird.attackedBy=[p.id];expect(hostile(w,p,bird)).toBe(true)
})
it('one real berry is consumed and four remain on the same original bush for the player, including a mid-work save/restore',()=>{
 const {w,s,p,bird}=scene();while(calendar(w).season.id!=='Season.Summer')s.time+=28800*100;bird.needs.kcal=0;tileAt(w,bird.pos).t='Terrain.AshBerryBush';expect(perform(w,bird,{type:'animalBrowse',pos:bird.pos}).ok).toBe(true);for(let n=0;n<5;n++)activityStep(w,bird);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const b=run.s.creatures.find(c=>c.id===bird.id)!;for(let n=0;b.activity&&n<20;n++)activityStep(run,b);expect(b.needs.kcal).toBe(50);expect(gatherStockCount(run,b.pos)).toBe(4);const reset=tileAt(run,b.pos).gatherStock!.regrowAt;const actor=run.s.creatures.find(c=>c.id===p.id)!;actor.pos={x:31,y:20};expect(perform(run,actor,{type:'gather',pos:b.pos}).ok).toBe(true);for(let n=0;actor.activity&&n<30;n++)activityStep(run,actor);expect(actor.bag.find(i=>i.def==='Item.AshBerry')?.count).toBe(4);expect(tileAt(run,b.pos).gatherAt).toBe(reset)}
 expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('tearing a physical meat UID creates twenty25g portions and preserves original age, salt and contamination per total mass',()=>{
 const {w,s,bird}=scene(),meat=makeItem(w,'Item.RawMeat'),uid=meat.uid;Object.assign(meat,{freshness:55,foodThawed:true,foodSaltGrams:2,contaminantAsh:.4,foodWater:{ml:40,quality:{pathogen:.5,ash:0,source:'선언한 원래 오염'}}});tileAt(w,bird.pos).items=[meat];expect(perform(w,bird,{type:'tearFood',uid}).ok).toBe(true);const pieces=tileAt(w,bird.pos).items[0];expect(pieces).toMatchObject({uid,def:'Item.CarrionMorsel',count:20,freshness:55,foodThawed:true});expect(w.db.item(pieces.def).weight*pieces.count).toBe(.5);expect(pieces.foodSaltGrams!*20).toBe(2);expect(pieces.contaminantAsh!*20).toBeCloseTo(.4);expect(pieces.foodWater!.ml*20).toBe(40);const before=bird.needs.kcal,dose=foodKcal(w,pieces);expect(perform(w,bird,{type:'animalEat',uid}).ok).toBe(true);expect(pieces.count).toBe(19);expect(bird.needs.kcal-before).toBe(dose*calorieAbsorption(w,bird));expect(deserialize(serialize(s)).map.tiles[bird.pos.y*s.map.w+bird.pos.x].items[0].uid).toBe(uid)
})
it('scavenged carcass portions and later dissection share one original stock and restore to the same whole world',()=>{
 const {w,s,p,bird}=scene(),animal=createCreature(w,'Creature.AshhornStag',{x:30,y:21});s.creatures.push(animal);killCreature(w,animal,'선언한 검사 사체의 실제 사망');const original=animal.carcassStock!['Item.RawMeat'].original;expect(perform(w,bird,{type:'tearCarrion',target:animal.id}).ok).toBe(true);expect(animal.carcassStock!['Item.RawMeat'].remaining).toBe(original-1);p.pos={x:31,y:21};ensureBestiary(w,animal.def,p).dissected=bestiaryDef(w).autoDissectAfter;addToBag(w,p,makeItem(w,'Item.RustyKnife'));expect(startDissection(w,p,animal.id,5)).toBeNull();activityStep(w,p);const restored={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,restored]){const actor=run.s.creatures.find(c=>c.id===p.id)!;for(let n=0;actor.activity&&n<10;n++)activityStep(run,actor);const corpse=run.s.creatures.find(c=>c.id===animal.id)!;expect(corpse.dissected?.success).toBe(true);expect(tileAt(run,corpse.pos).items.filter(i=>i.def==='Item.RawMeat').reduce((n,i)=>n+i.count,0)).toBe(original-1);expect(tileAt(run,bird.pos).items.find(i=>i.def==='Item.CarrionMorsel')?.count).toBe(20);expect(corpse.carcassStock!['Item.RawMeat'].remaining).toBe(0);const before=stateHash(run.s);expect(perform(run,run.s.creatures.find(c=>c.id===bird.id)!,{type:'tearCarrion',target:corpse.id}).ok).toBe(false);expect(stateHash(run.s)).toBe(before)}expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('death-drop meat and the still-unopened carcass use the same finite animal stock; actual hourly decay survives separation',()=>{
 const {w,s,bird}=scene(),animal=createCreature(w,'Creature.AshHound',{x:31,y:20});s.creatures.push(animal);killCreature(w,animal,'선언한 실제 검사 사망');const stock=animal.carcassStock!['Item.RawMeat'],dropped=tileAt(w,animal.pos).items.filter(i=>i.def==='Item.RawMeat').reduce((n,i)=>n+i.count,0);expect(stock.remaining+dropped).toBe(stock.original)
 const stag=createCreature(w,'Creature.AshhornStag',{x:30,y:21});s.creatures.push(stag);killCreature(w,stag,'선언한 실제 검사 사망');const sample=makeItem(w,'Item.RawMeat');s.time+=120000;ageFood(w,sample,20,1200);ageCarcass(w,stag,20,turnOf(w));expect(stag.carcassStock!['Item.RawMeat'].freshness).toBe(sample.freshness);expect(perform(w,bird,{type:'tearCarrion',target:stag.id}).ok).toBe(true);expect(tileAt(w,bird.pos).items.find(i=>i.def==='Item.CarrionMorsel')!.freshness).toBe(sample.freshness)
})
it('bird drinking consumes20ml of real adjacent water and baseline water metabolism follows its actual species scale',()=>{
 const {w,p,bird}=scene();tileAt(w,{x:31,y:20}).t='Terrain.ShallowWater';bird.needs.waterDeficit=100;expect(perform(w,bird,{type:'animalDrink'}).ok).toBe(true);expect(bird.needs.waterDeficit).toBe(80);const human=metabolismRate(w,p,thermalState(w,p)),small=metabolismRate(w,bird,thermalState(w,bird));expect(small.waterHour/human.waterHour).toBeCloseTo(metabolicSize(w,bird),8)
})
it('real threat-driven takeoff and the next flight movement survive a midair save without changing the next world',()=>{
 const {w,s,p,bird}=scene();bird.pos={x:23,y:20};expect(hostile(w,p,bird)).toBe(false);expect(playerAct(w,{type:'wait'})).toBeNull();expect(bird.flight).toBeDefined();const restored={db:w.db,s:deserialize(serialize(s))};for(const run of[w,restored])expect(playerAct(run,{type:'wait'})).toBeNull();expect(bird.pos).not.toEqual({x:23,y:20});expect(stateHash(restored.s)).toBe(stateHash(s))
})
it('original harvested feather bundles have realistic mass and are actually consumed by the existing arrow recipe',()=>{
 const {w,s,p,bird}=scene();bird.pos={x:20,y:21};killCreature(w,bird,'선언한 깃털 검사 사체');ensureBestiary(w,bird.def,p).dissected=bestiaryDef(w).autoDissectAfter;addToBag(w,p,makeItem(w,'Item.RustyKnife'));expect(startDissection(w,p,bird.id,1)).toBeNull();activityStep(w,p);const feathers=tileAt(w,bird.pos).items.filter(i=>i.def==='Item.CrowFeathers');expect(feathers).toHaveLength(3);expect(feathers.reduce((n,i)=>n+w.db.item(i.def).weight*i.count,0)).toBeLessThan(w.db.creature(bird.def).weightKg!);for(const it of feathers)expect(perform(w,p,{type:'lootTake',uid:it.uid}).ok).toBe(true);studyBook(w,p,'Item.CraftManual');tileAt(w,{x:21,y:20}).t='Terrain.Workbench';for(const id of['Item.Wood','Item.IronScrap','Item.Thread'])addToBag(w,p,makeItem(w,id));expect(startCraft(w,p,'Recipe.Arrows',1)).toBeNull();for(let n=0;p.activity&&n<1000;n++)activityStep(w,p);expect(allItems(p).filter(i=>i.def==='Item.Arrow').reduce((n,i)=>n+i.count,0)).toBe(5);expect(allItems(p).filter(i=>i.def==='Item.CrowFeathers').reduce((n,i)=>n+i.count,0)).toBe(2);expect(s.creatures.find(c=>c.id===bird.id)!.carcassStock!['Item.CrowFeathers'].remaining).toBe(0)
})
