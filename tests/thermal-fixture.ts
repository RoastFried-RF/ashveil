import { tileAt, TURNS_PER_HOUR } from '../src/core/ctx'
import { invalidateLights, updatePlayerVision } from '../src/core/fov'
import { prisonerFixture } from './prisoner-fixture'

/** Finite initial fixture: one bare living human, one existing fire, no hostile actors/fuel. */
export function thermalFixture() {
  const { w, s, p } = prisonerFixture()
  s.overworld=undefined;s.maps={};s.offCreatures={};s.creatures=[p];s.sources=[]
  s.map.kind='surface';s.map.ambient=1;s.time=5*TURNS_PER_HOUR*100
  s.weather='clear';s.weatherUntil=1e12;s.wind={x:0,y:0};s.loot=undefined
  for (const tile of s.map.tiles) Object.assign(tile,{t:'Terrain.KtWall',roof:false,seen:false,items:[]})
  for(let y=17;y<=25;y++)for(let x=17;x<=27;x++)Object.assign(tileAt(w,{x,y}),{t:'Terrain.Earth',roof:false,seen:true})
  p.pos={x:20,y:20};p.nextAct=s.time;p.statPoints=0;p.abilityPoints=0;p.bag=[];p.equip={};p.exerted=false;p.movedTurn=undefined
  Object.assign(p.needs,{bodyTemp:35.8,kcal:2500,waterDeficit:0,wetness:0,skinWetness:undefined,thermal:undefined})
  const fire={pos:{x:21,y:20},radius:8,kind:'campfire' as const}
  tileAt(w,fire.pos).t='Terrain.Campfire';s.map.lights=[fire];s.fx=[]
  invalidateLights(w);updatePlayerVision(w,p)
  return {w,s,p,fire}
}
