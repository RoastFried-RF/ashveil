/** Finite, declared six-form field. Natural body and real gather stock; no post-title writes. */
import {makeWorld} from './helpers'
import {player,tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {makeItem} from '../src/core/items'
export function rockFixture(night=false){
 const w=makeWorld('rocks-original-397','Bg.Hunter'),s=w.s,p=player(w)
 s.time=(night?22:12)*1200*100;s.map.kind='surface';s.map.name=night?'바위 여섯 형태 · 밤':'바위 여섯 형태 · 낮';s.map.ambient=0;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.map.exits=[];s.map.links=[];s.creatures=[p];s.maps={};s.offCreatures={};s.storyteller.budget=-1e9;s.weather='clear';s.weatherUntil=s.time+1e9;s.fx=[]
 p.pos={x:20,y:20};p.bag=[];p.nextAct=s.time;p.activity=undefined;p.asleep=false;p.unconscious=false
 Object.assign(p.needs,{kcal:3000,waterDeficit:0,fatigue:10,bodyTemp:37,nutritionDay:Math.floor(turnOf(w)/28800)})
 p.equip.main=makeItem(w,'Item.Torch');p.equip.main.lit=night
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,items:[],placed:undefined,room:undefined,deco:undefined,blood:0,seen:false,observed:undefined,gatherAt:undefined})
 // Several separated natural coordinate hashes exercise all six variants. Only the east rock is adjacent.
 const positions=[{x:21,y:20}]
 for(const y of [16,18,22,24])for(const x of [16,18,22,24])positions.push({x,y})
 for(const pos of positions)tileAt(w,pos).t='Terrain.Rock'
 invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,target:{x:21,y:20},positions}
}
