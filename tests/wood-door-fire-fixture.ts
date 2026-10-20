import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {generateRegionLayout} from '../src/core/region-layout'
import {hpMax} from '../src/core/body'
import {playerAct} from '../src/core/game'
import {perform} from '../src/core/actions'
import {makeItem,addToBag} from '../src/core/items'
import {tileAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {RegionLayoutDef} from '../src/core/types'
export function woodDoorFireFixture(chance:number|null=1,seed='wood-door-fire-proof-0'){
 const d=conditionThoughtsFixture(seed),{w,s,p}=d,layout=w.db.get<RegionLayoutDef>('RegionLayout.BlackwoodVillage'),gen=generateRegionLayout(w,layout),building=layout.buildings[0]!
 // 실제 지역 생성기가 만든 원래 집이다. 이미 살핀 유효 초기 장면이며 이전 방문/설치 턴을 실행했다는 뜻은 아니다.
 s.map=gen.map;s.maps={};s.offCreatures={};for(const r of s.map.rooms)r.discovered=true
 const doorPos={x:building.door[0],y:building.door[1]},firePos={x:doorPos.x-1,y:doorPos.y-1};p.pos={x:doorPos.x-1,y:doorPos.y-2};p.mapId=s.map.id;p.hp=hpMax(w,p);p.needs.vitamin=100
 const door=tileAt(w,doorPos)
 if(door.t!=='Terrain.WoodDoorClosed')throw Error('original generated home door')
 if(chance!==null){const id='wood-door-fire-unit',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Campfire.Hearth',path:'/wildfire/sparkChance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));w.db=loaded.db}
 const add=(id:string,count=1)=>{const it=makeItem(w,id,count);if(addToBag(w,p,it))throw Error('door materials');return it}
 const kit=add('Item.CampfireKit'),wood=add('Item.Wood',3),bottle=add('Item.WaterBottle');bottle.uses=5
 invalidateLights(w);updatePlayerVision(w,p)
 const place=perform(w,p,{type:'place',uid:kit.uid,dir:4});if(!place.ok)throw Error(place.msg)
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,a,budget);if(e)throw Error(e)}
 const ignite=()=>act({type:'fireWork',pos:firePos,uid:wood.uid})
 const approach=()=>{act({type:'move',dir:2});act({type:'move',dir:4})}
 return{...d,layout,door,doorPos,firePos,kit,wood,bottle,act,ignite,approach,add}
}

export type WoodDoorPhase='unlit'|'burning'|'opened'|'reclosed'|'burned'|'quenched'|'pending'|'pendingOpen'
export function woodDoorFireNativeFixture(phase:WoodDoorPhase){
 const d=woodDoorFireFixture(null),initialTime=d.s.time,initialDoor=d.door.t
 let firstFireId:number|undefined,startedAt:number|undefined,workTurns:number|undefined
 if(phase!=='unlit'){
  const at=d.s.time;d.ignite();workTurns=(d.s.time-at)/100
  for(let i=0;!d.door.terrainFire&&i<800;i++)d.act({type:'wait'})
  if(!d.door.terrainFire)throw Error('genuine original generated wood door did not ignite')
  firstFireId=d.door.terrainFire.id;startedAt=d.door.terrainFire.startedAt
  if(['opened','reclosed','quenched','pendingOpen'].includes(phase)){d.approach();d.act({type:'move',dir:4})}
  if(phase==='reclosed')d.act({type:'closeDoor',dir:4})
  if(phase==='quenched')d.act({type:'putOutTerrainFire',pos:d.doorPos})
  if(phase==='burned'){for(let i=0;d.door.terrainFire&&i<700;i++)d.act({type:'wait'});if(d.door.terrainFire)throw Error('original door fuel did not deplete')}
  if(phase==='pending'||phase==='pendingOpen')d.act({type:'rest',turns:20},2)
 }
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,initialDoor,firstFireId,startedAt,workTurns,layout:d.layout.id,doorPos:d.doorPos,kitUid:d.kit.uid,bottleUid:d.bottle.uid,woodBefore:3,waterBefore:1000,pending:phase==='pending'||phase==='pendingOpen'}}
}
