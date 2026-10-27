/** Finite initial coastal channel, original launched hull/crew. No post-load fixture writes. */
import {watercraftFixture} from './watercraft-fixture'
import {launchBoat} from '../src/core/journey'
import {turnOf} from '../src/core/ctx'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {seaRoute} from '../src/core/marine-state'
export function seaRouteFixture(mode:'wind'|'storm'|'unknown'){
 const d=watercraftFixture();if(launchBoat(d.w,d.p,d.hull.uid))throw Error('original hull launch')
 const from={x:5,y:5},to={x:7,y:5};d.m.position={...from};d.s.map.worldCell={...from};d.m.worldObservations={};d.s.weather='clear';d.s.wind={x:0,y:0};d.s.weatherUntil=1e12;d.s.storyteller.budget=-1e9
 for(let y=3;y<=7;y++)for(let x=4;x<=8;x++){
  const i=y*d.m.w+x,cell=d.m.cells[i];cell.sea=x>4&&x<8&&y>3&&y<7
  d.m.weatherCells![`${x},${y}`]={weather:'clear',wind:{x:0,y:0},until:1e12}
  if(mode!=='unknown'||x===from.x&&y===from.y)d.m.worldObservations[i]={at:turnOf(d.w),source:'survey',cell:{altitude:cell.altitude,temperature:cell.temperature,veil:cell.veil,biome:cell.biome,sea:cell.sea}}
 }
 d.m.weatherCells!['6,5']={weather:mode==='storm'?'ashstorm':'clear',wind:{x:mode==='wind'?-40:0,y:0},until:1e12}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p);d.s.fx=[]
 const route=seaRoute(d.w,from,to);if(!route)throw Error('finite sea path')
 return{...d,from,to,route}
}
