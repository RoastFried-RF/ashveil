import {expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {aiDecide} from '../src/core/ai'
import {calendar} from '../src/core/climate-state'
import {startGather} from '../src/core/crafting'
import {createCreature} from '../src/core/creatures'
import {hostile} from '../src/core/diplomacy'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {observedGatherAvailable} from '../src/core/gather-state'
import {playerAct} from '../src/core/game'
import {DIRS} from '../src/core/geom'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {mapAppearance,displayTile} from '../src/client/map-memory'
import {forageArt} from '../src/client/render/forage-art'
import {cropArt} from '../src/client/render/crop-art'
import {blackwoodFixture} from './blackwood-fixture'
import {prisonerFixture} from './prisoner-fixture'

function scene(){
 const {w,s,p}=prisonerFixture();s.overworld=undefined;s.map.kind='dungeon';s.map.ambient=1;s.map.lights=[];s.fx=[];s.creatures=[p];p.pos={x:20,y:20};p.body.missing=[];p.body.wounds=[];p.asleep=false;p.unconscious=false;p.needs.bodyTemp=37;p.activity=undefined
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:true,items:[],blood:0,icy:false,cultivation:undefined,gatherAt:undefined,observed:undefined,seen:false})
 const pos={x:21,y:20},tile=tileAt(w,pos);tile.t='Terrain.WildShadeRoots';tile.v=3;invalidateLights(w);updatePlayerVision(w,p);return{w,s,p,pos,tile}
}
it('a real wild clump harvest uses12work turns, preserves mid-work save state and consumes the original stock once',()=>{
 const {w,s,p,pos,tile}=scene();expect(tile.observed?.gatherAvailable).toBe(true);expect(startGather(w,p,pos,1)).toBeNull();for(let i=0;i<5;i++)activityStep(w,p);const copy={db:w.db,s:deserialize(serialize(s))}
 for(const run of[w,copy]){const actor=run.s.creatures[0];for(let i=0;actor.activity&&i<20;i++)activityStep(run,actor);updatePlayerVision(run,actor);const plant=tileAt(run,pos);expect(actor.bag.filter(i=>i.def==='Item.ShadeRoot').reduce((n,i)=>n+i.count,0)).toBe(2);expect(plant.observed?.gatherAvailable).toBe(false);expect(forageArt(run.db.terrain(plant.t),plant)?.state).toBe('spent');expect(plant.cultivation).toBeUndefined();const before=stateHash(run.s);expect(startGather(run,actor,pos,1)).not.toBeNull();expect(stateHash(run.s)).toBe(before)}
 expect(stateHash(s)).toBe(stateHash(copy.s))
})
it('unseen regrowth retains the last real spent observation until the original clump is seen again',()=>{
 const {w,s,p,pos,tile}=scene();tile.gatherAt=turnOf(w)+1;updatePlayerVision(w,p);const spent=forageArt(w.db.terrain(tile.t),tile)!;expect(spent.state).toBe('spent');p.pos={x:5,y:5};updatePlayerVision(w,p);s.time+=100;updatePlayerVision(w,p);expect(s.visible).not.toContain(pos.y*s.map.w+pos.x)
 const before=stateHash(s),appearance=mapAppearance(w),remembered=displayTile(tile,appearance.terrain[pos.y*s.map.w+pos.x]!,false);expect(forageArt(w.db.terrain(remembered.t),remembered)).toEqual(spent);expect(stateHash(s)).toBe(before)
 p.pos={x:20,y:20};updatePlayerVision(w,p);const mature=forageArt(w.db.terrain(tile.t),tile)!;expect(mature.state).toBe('mature');expect(mature.variant).toBe(spent.variant);expect(mature.scale).toBe(spent.scale)
})
it('a saved last observation, rather than a live crop clock or hidden current terrain, determines the remembered source frame',()=>{
 const {w,s,tile}=scene();tile.observed!.gatherAvailable=false;const observed=structuredClone(tile.observed),d=w.db.terrain(tile.t);s.visible=[];const before=serialize(s)
 const input={observed,v:tile.v,get gatherAt():never{throw Error('hidden regrowth read')},get t():never{throw Error('hidden terrain read')}}
 for(let i=0;i<4;i++)expect(forageArt(d,input)?.state).toBe('spent');expect(serialize(s)).toBe(before);const copy=deserialize(before);expect(copy.map.tiles.find(t=>t.observed?.terrain==='Terrain.WildShadeRoots')?.observed).toEqual(observed)
})
it('bare summer bushes cannot advertise ripe berries outside summer or before their original regrowth deadline',()=>{
 const {w,s,p,pos,tile}=scene();tile.t='Terrain.AshBerryBush';let tries=0;while(calendar(w).season.id!=='Season.Summer'&&tries++<200)s.time+=28800*100;expect(calendar(w).season.id).toBe('Season.Summer');updatePlayerVision(w,p);expect(forageArt(w.db.terrain(tile.t),tile)?.state).toBe('mature');tile.gatherAt=turnOf(w)+1;updatePlayerVision(w,p);expect(tile.observed?.gatherAvailable).toBe(false);s.time+=100;updatePlayerVision(w,p);expect(tile.observed?.gatherAvailable).toBe(true)
 while(calendar(w).season.id==='Season.Summer')s.time+=28800*100;updatePlayerVision(w,p);expect(tile.observed?.gatherAvailable).toBe(false);expect(observedGatherAvailable(w,pos)).toBe(false)
})
it('unknown older observations do not invent mature fruit and natural art does not replace actual cultivated plot stages',()=>{
 const {w,tile}=scene();delete tile.observed!.gatherAvailable;expect(forageArt(w.db.terrain(tile.t),tile)?.state).toBe('unknown');const plot=w.db.terrain('Terrain.ShadePlot');expect(forageArt(plot,tile)).toBeUndefined();expect(cropArt(plot,tile,true,turnOf(w))).toBeDefined();expect(w.db.item('Item.ShadeSeeds').place).toBe('Terrain.ShadePlot')
})
it('only the five forest wildlife food patches become wild clumps; the village crop plot remains cultivated',()=>{
 const {w}=blackwoodFixture();for(const[x,y]of[[6,6],[10,9],[16,6],[11,18],[15,23]])expect(tileAt(w,{x,y}).t).toBe('Terrain.WildShadeRoots');expect(tileAt(w,{x:24,y:27}).t).toBe('Terrain.ShadePlot');expect(w.db.terrain('Terrain.ShadePlot').cultivation).toBeDefined();expect(w.db.terrain('Terrain.WildShadeRoots').cultivation).toBeUndefined()
})
it('a real12turn harvest continues while an unprovoked nearby deer flees instead of treating it as a new combat threat',()=>{
 const {w,s,p,pos}=scene(),animal=createCreature(w,'Creature.AshhornStag',{x:24,y:20});animal.body.wounds=[];animal.body.missing=[];animal.traits=[];animal.needs.bodyTemp=37;animal.needs.kcal=2000;animal.asleep=false;animal.unconscious=false;s.creatures.push(animal);updatePlayerVision(w,p);expect(hostile(w,p,animal)).toBe(false);expect(playerAct(w,{type:'gather',pos})).toBeNull();expect(p.activity).toBeUndefined();expect(p.bag.filter(i=>i.def==='Item.ShadeRoot').reduce((n,i)=>n+i.count,0)).toBe(2);expect(hostile(w,p,animal)).toBe(false);expect(animal.pos).not.toEqual({x:24,y:20})
})
it('a cornered deer becomes a genuine combat threat for its actual defense and stops threatening once it can flee',()=>{
 const {w,s,p}=scene(),animal=createCreature(w,'Creature.AshhornStag',{x:21,y:20});animal.body.wounds=[];animal.body.missing=[];animal.traits=[];animal.asleep=false;animal.unconscious=false;s.creatures.push(animal)
 for(const d of DIRS){const pos={x:animal.pos.x+d.x,y:animal.pos.y+d.y};if(pos.x!==p.pos.x||pos.y!==p.pos.y)tileAt(w,pos).t='Terrain.KtWall'}invalidateLights(w);expect(hostile(w,p,animal)).toBe(false);expect(aiDecide(w,animal)).toEqual({type:'attack',target:p.id});expect(hostile(w,p,animal)).toBe(true);tileAt(w,{x:22,y:20}).t='Terrain.Earth';invalidateLights(w);const escape=aiDecide(w,animal);expect(escape.type).toBe('move');expect(perform(w,animal,escape).ok).toBe(true);expect(hostile(w,p,animal)).toBe(false)
})
it('real provocation, boars and predators remain dangerous; neutral prey does not silently change faction or RNG',()=>{
 const {w,s,p}=scene(),deer=createCreature(w,'Creature.AshhornStag',{x:21,y:20}),boar=createCreature(w,'Creature.Tuskhog',{x:25,y:20}),hound=createCreature(w,'Creature.AshHound',{x:26,y:20});s.creatures.push(deer,boar,hound);const before=stateHash(s);expect(hostile(w,deer,hound)).toBe(true);expect(hostile(w,hound,deer)).toBe(true);expect(hostile(w,p,boar)).toBe(true);expect(hostile(w,p,deer)).toBe(false);expect(stateHash(s)).toBe(before);expect(perform(w,p,{type:'attack',target:deer.id}).ok).toBe(true);expect(deer.attackedBy).toContain(p.id);expect(hostile(w,p,deer)).toBe(true)
})
