/** Finite Node-only policy fixture. These candidate species/art are not active content. */
import {readFileSync} from 'node:fs'
import {loadMods} from '../src/core/defs'
import {createCreature} from '../src/core/creatures'
import {addToBag,makeItem} from '../src/core/items'
import {invalidateLights} from '../src/core/fov'
import {readPackages} from '../tools/loadContent'
import type {AnyDef,CreatureDef,ItemDef,SowerRules} from '../src/core/types'
import {prisonerFixture} from './prisoner-fixture'
export const sowerRule:SowerRules={route:[{x:47,y:14},{x:51,y:14},{x:51,y:20},{x:47,y:20}],waitAtWaypointTurns:1,seedItem:'Item.SowerSeedCapsule',seedEveryMoves:4,pushDistance:2,signalPart:'SensorMast',callRadius:16,callTurns:60,spray:{item:'Item.TestSowerFungus',radius:3,turns:3,concentration:.35,cooldown:20}}
const planned=JSON.parse(readFileSync('tools/content-plans/expanded-creatures-v331/core-fragment/defs/bodies-v331.json','utf8')) as AnyDef[]
const body=structuredClone(planned.find(d=>d.id==='Body.Sower')!) as import('../src/core/types').BodyDef
body.parts.find(p=>p.id==='SensorMast')!.capacities!.signal=1
body.mechanical!.repair.item='Item.SmallActuator';body.mechanical!.cell.item='Item.LowPowerCell';body.mechanical!.salvage=[{item:'Item.SmallActuator',count:2,chance:1},{item:'Item.LowPowerCell',count:1,chance:1}]
export const sowerFixtureDefs:AnyDef[]=[body,{defType:'Item',id:'Item.SowerSeedCapsule',parent:'Item.ShadeSeeds',label:'검사용 파종기 종자 캡슐'} as ItemDef,{defType:'Item',id:'Item.TestSowerFungus',parent:'Item.Charcoal',label:'검사용 유한 균 캡슐'} as ItemDef,{defType:'Creature',id:'Creature.Sower',parent:'Creature.TenderDrone',label:'검사용 파종기',body:'Body.Sower',sower:sowerRule,weightKg:1200,hpBase:360,loadout:{slots:[{items:['Item.SowerSeedCapsule'],count:[8,8]}]}} as CreatureDef]
for(const definition of sowerFixtureDefs)definition.override=true
export const sowerFixturePackage={manifest:{id:'sower-policy-fixture',name:'유한 파종기 정책 검사',version:'1'},defs:sowerFixtureDefs,patches:[]}
const loaded=loadMods([...readPackages(),sowerFixturePackage],['sower-policy-fixture']);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'))
export function sowerFixture(){
 const {w,s,p,target}=prisonerFixture();w.db=loaded.db;s.overworld=undefined;s.maps={};s.offCreatures={};s.sources=[];s.map.kind='surface';s.map.depth=0;s.map.ambient=1;s.map.daylightMult=.5;s.map.lights=[];s.map.props=[];s.map.rooms=[];s.fx=[];s.weather='clear';s.weatherUntil=1e12;p.pos={x:43,y:23};p.bag=[];p.equip={}
 for(const t of s.map.tiles)Object.assign(t,{t:'Terrain.Earth',roof:false,items:[],cont:undefined,deco:undefined,placed:undefined,room:undefined,blood:0})
 const sower=createCreature(w,'Creature.Sower',{x:47,y:14});sower.met=true;sower.home={x:47,y:14};sower.nextAct=s.time+1;s.creatures=[p,sower];invalidateLights(w)
 const fungus=makeItem(w,'Item.TestSowerFungus');if(addToBag(w,sower,fungus))throw Error('균 캡슐 검사 적재 실패')
 return{w,s,p,sower,target,fungus}
}
