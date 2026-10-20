import { newGame } from '../src/core/game'
import { createCreature } from '../src/core/creatures'
import { player, type World } from '../src/core/ctx'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { ensureSociety } from '../src/core/diplomacy'
import { db } from './helpers'
const template=newGame(db,{seed:'kinship-witness',background:'Bg.Hunter',overworld:true})
export function kinshipFixture(chief=false){
 const w:World={db,s:structuredClone(template)},s=w.s,p=player(w)
 s.map={id:'kin-conduit',kind:'dungeon',name:'관로 목격 검증',depth:2,ambient:1,w:32,h:16,tiles:Array.from({length:512},()=>({t:'Terrain.KtFloor',v:0,roof:true,blood:0,items:[]})),exits:[],links:[{pos:{x:29,y:12},to:'surface',toPos:{x:1,y:1},label:'관로 출구'}],rooms:[],props:[],lights:[]};s.maps={};s.offCreatures={};s.sources=[];s.storyteller.budget=-1e9
 p.pos={x:16,y:8};const victim=createCreature(w,chief?'Creature.ShadeChief':'Creature.Shade',{x:17,y:8}),witness=createCreature(w,'Creature.Shade',{x:18,y:8}),second=createCreature(w,'Creature.Shade',{x:18,y:9});s.creatures=[p,victim,witness,second]
 for(const c of s.creatures){c.asleep=false;c.unconscious=false;c.body.wounds=[];c.traits=[];c.effects=[];c.activity=undefined;c.hp=95;c.bag=[];c.equip={};c.age=undefined;c.room=0;c.home={x:18,y:8};c.ai.mode='idle';c.ai.mev=[];c.nextAct=s.time;Object.assign(c.needs,{bodyTemp:37,kcal:2000,waterDeficit:0,fatigue:10,sleepDebt:0,stress:0})}
 ensureSociety(w);invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,victim,witness,second}
}
