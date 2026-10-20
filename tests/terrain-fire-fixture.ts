import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {hpMax} from '../src/core/body'
import {tileAt} from '../src/core/ctx'
import {makeItem,addToBag} from '../src/core/items'
import {perform} from '../src/core/actions'
import {playerAct} from '../src/core/game'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
export function terrainFireFixture(chance:number|null=1,seed='terrain-fire-proof'){
 const d=conditionThoughtsFixture(seed),{w,s,p}=d;p.hp=hpMax(w,p);p.needs.vitamin=100;s.map.lights=[]
 const firePos={x:p.pos.x-1,y:p.pos.y},treePos={x:p.pos.x-2,y:p.pos.y},secondPos={x:p.pos.x-3,y:p.pos.y}
 for(let y=p.pos.y-5;y<=p.pos.y+5;y++)for(let x=p.pos.x-5;x<=p.pos.x+5;x++){const t=tileAt(w,{x,y});if(t){t.t='Terrain.Earth';t.roof=false;t.items=[];delete t.placed}}
 const tree=tileAt(w,treePos),second=tileAt(w,secondPos);tree.t='Terrain.Tree';second.t='Terrain.Tree'
 if(chance!==null){const id='actual-terrain-fire',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'Campfire.Hearth',path:'/wildfire/sparkChance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));w.db=loaded.db}
 const add=(id:string,count=1)=>{const it=makeItem(w,id,count);if(addToBag(w,p,it))throw Error('terrainfire materials');return it}
 const kit=add('Item.CampfireKit'),wood=add('Item.Wood',3),bottle=add('Item.WaterBottle');bottle.uses=5
 // 원래 유효 초기 설치를 실제 설치 게이트웨이로 구성한다. 그 전에 설치 턴을 실행했다는 주장은 아니다.
 if(!perform(w,p,{type:'place',uid:kit.uid,dir:6}).ok)throw Error('originalfire placement')
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 const ignite=()=>act({type:'fireWork',pos:firePos,uid:wood.uid})
 return{...d,tree,second,treePos,secondPos,firePos,kit,wood,bottle,add,act,ignite}
}

export type TerrainFirePhase='unlit'|'burning'|'spread'|'burned'|'extinguished'|'pending'|'uiExtinguish'
export function terrainFireNativeFixture(phase:TerrainFirePhase,seed='terrain-fire-proof-1'){
 const d=terrainFireFixture(null,seed),initialTime=d.s.time,initialBottleUid=d.bottle.uid
 let firstFireId:number|undefined,firstFireAt:number|undefined
 if(phase!=='unlit'){
  d.ignite()
  for(let i=0;!d.tree.terrainFire&&i<120;i++)for(let j=0;j<10;j++)d.act({type:'wait'})
  if(!d.tree.terrainFire)throw Error('default actual source did not ignite original tree')
  firstFireId=d.tree.terrainFire.id;firstFireAt=d.tree.terrainFire.startedAt
  if(phase==='spread'){
   for(let i=0;!d.second.terrainFire&&d.tree.terrainFire&&i<70;i++)for(let j=0;j<10;j++)d.act({type:'wait'})
   if(!d.second.terrainFire)throw Error('default original tree did not spread before depletion')
  }
  if(phase==='burned'){
   for(let i=0;d.tree.terrainFire&&i<70;i++)for(let j=0;j<10;j++)d.act({type:'wait'})
   if(d.tree.t!=='Terrain.Earth')throw Error('original tree did not deplete')
  }
  if(phase==='extinguished'||phase==='uiExtinguish'){
   for(const dir of [0,6,6])d.act({type:'move',dir})
   if(phase==='extinguished')d.act({type:'putOutTerrainFire',pos:d.treePos})
  }
  if(phase==='pending')d.act({type:'rest',turns:20},2)
 }
 updatePlayerVision(d.w,d.p)
 return{...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,firstFireId,firstFireAt,initialWood:3,initialBottleMl:1000,initialBottleUid,kitUid:d.kit.uid,treePos:d.treePos,secondPos:d.secondPos,pending:phase==='pending',defaultSparkChance:.02}}
}
