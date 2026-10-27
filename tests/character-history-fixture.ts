/** Two finite maps and an explicit legacy saved-frame appearance, not a newly authored model. */
import {prisonerFixture} from './prisoner-fixture'
import {createCreature} from '../src/core/creatures'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function characterHistoryFixture(){
 const{w,s,p}=prisonerFixture();s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.weather='clear';s.weatherUntil=1e12;s.fx=[]
 Object.assign(s.map,{id:'surface',layout:undefined,kind:'surface',depth:0,ambient:1,daylightMult:1,lights:[],props:[],rooms:[],exits:[],links:[{pos:{x:20,y:20},to:'crypt1',toPos:{x:20,y:20},label:'까마귀 장면'}],name:'원화 수명 · 현재와 옛 모습'})
 for(const tile of s.map.tiles)Object.assign(tile,{t:'Terrain.Earth',roof:false,seen:true,items:[],cont:undefined,placed:undefined,deco:undefined,room:undefined,blood:0,icy:false,snow:0,cultivation:undefined,gatherAt:undefined,gatherStock:undefined})
 s.map.tiles[20*s.map.w+20].t='Terrain.StairsDown';p.pos={x:20,y:20};p.mapId='surface';p.bag=[];p.equip={};p.activity=undefined
 const surveyor=createCreature(w,'Creature.Surveyor',{x:23,y:20}),legacy=createCreature(w,'Creature.TenderDrone',{x:20,y:23}),crow=createCreature(w,'Creature.AshCrow',{x:23,y:20})
 legacy.sprite='tender_drone_w_down0'
 for(const c of[surveyor,legacy,crow]){c.met=true;c.mapId=c===crow?'crypt1':'surface';c.home={...c.pos};c.nextAct=1e12;c.asleep=false;c.unconscious=false;c.activity=undefined}
 s.creatures=[p,surveyor,legacy]
 const below=structuredClone(s.map);Object.assign(below,{id:'crypt1',depth:1,kind:'dungeon',ambient:1,name:'원화 수명 · 다른 몸',links:[{pos:{x:20,y:20},to:'surface',toPos:{x:20,y:20},label:'원래 장면'}]});below.tiles[20*below.w+20].t='Terrain.StairsUp';s.maps.crypt1=below;s.offCreatures.crypt1=[crow]
 invalidateLights(w);updatePlayerVision(w,p);return{w,s,p,legacy,surveyor,crow}
}
