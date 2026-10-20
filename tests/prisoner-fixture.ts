import { player, tileAt, type World } from '../src/core/ctx'
import { ensureSociety } from '../src/core/diplomacy'
import { invalidateLights } from '../src/core/fov'
import { newGame } from '../src/core/game'
import { addToBag, makeItem } from '../src/core/items'
import { db } from './helpers'
const template=newGame(db,{seed:'prisoner-test',background:'Bg.Hunter',overworld:true})
export function prisonerFixture(count=1){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w),target=s.creatures.find((c)=>c.def==='Creature.Reaver')!
 s.creatures=[p,target];s.time=12*1200*100;s.storyteller.budget=-1e9;s.map.ambient=1;s.map.lights=[];ensureSociety(w)!.reputation.reavers=-70
 for(const c of s.creatures){c.nextAct=s.time;c.hp=95;c.age=undefined;c.traits=[];c.background=undefined;c.traumas=[];c.effects=[];c.body.wounds=[];c.body.missing=[];c.body.blood=c.body.bloodMax;c.asleep=false;c.unconscious=false;c.activity=undefined;c.stats={str:10,agi:10,per:10,vit:10,wil:10};c.bag=[];c.equip={};Object.assign(c.needs,{kcal:1000,waterDeficit:0,fatigue:10,stress:0,sleepDebt:0,bodyTemp:37,wetness:0,protein:100,vitamin:100,ash:0})}
 p.pos={x:20,y:20};target.pos={x:21,y:20};target.home={x:25,y:20};target.ai.mode='surrender';target.ai.path=undefined;target.ai.mev=[]
 for(let y=17;y<=24;y++)for(let x=17;x<=27;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:true,items:[]})
 tileAt(w,p.pos).t='Terrain.Campfire';w.s.map.lights=[{pos:{...p.pos},radius:8,kind:'campfire'}];invalidateLights(w)
 const rope=makeItem(w,'Item.Rope',count);rope.quality=3;rope.dirty=true;addToBag(w,p,rope)
 return{w,s,p,target,rope}
}
