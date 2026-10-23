import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {playerAct} from '../src/core/game'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {cultivationStatus} from '../src/core/cultivation'
import {nextWeatherBlock} from '../src/core/environment'
import {serialize,deserialize} from '../src/core/save'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import type {Action} from '../src/core/actions'
import type {MapState} from '../src/core/types'

/** 유한 초기 장면만 선언한다. 이후에는 실제 심기/관수/계단/휴식을 사용한다. */
export function surfaceCultivationFixture(nearRipe=false){
 const d=clinicalDiseaseFixture('surface-cultivation-312',true),pos={x:21,y:20},source=d.s.map
 source.name='고원 밭 · 돌아올 때까지의 날씨';source.daylightMult=1;source.lights=[];d.s.storyteller.budget=-1e9
 d.s.weatherUntil=nextWeatherBlock(turnOf(d.w));d.s.overworld!.weatherCells={};d.p.background=undefined;d.p.skills={};d.p.hotbar=Array(10).fill(null);d.p.facing=2
 d.s.log=[{turn:turnOf(d.w),kind:'info',text:'밭 곁 창고의 유한 초기 장면. 귀리 종자3개·관수용 오염수1000ml·횃불1개를 가지고 시작한다.'}]
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)tileAt(d.w,{x,y}).roof=false
 const annexId='crop-annex',annex:MapState={id:annexId,name:'밭 곁 지하 창고',kind:'dungeon',depth:1,ambient:0,w:9,h:9,tiles:Array.from({length:81},()=>({t:'Terrain.KtFloor',v:0,roof:true,blood:0,items:[]})),exits:[],links:[{pos:{x:3,y:3},to:source.id,toPos:{x:20,y:21},label:'밭으로 돌아가는 계단'}],rooms:[],props:[],lights:[]}
 tileAt(d.w,{x:20,y:21}).t='Terrain.StairsDown';annex.tiles[3*9+3].t='Terrain.StairsUp';source.links=[...source.links.filter(l=>l.pos.x!==20||l.pos.y!==21),{pos:{x:20,y:21},to:annexId,toPos:{x:3,y:3},label:'밭 곁 지하 창고 계단'}];d.s.maps[annexId]=annex;d.s.offCreatures[annexId]=[]
 const seeds=d.add('Item.OatSeed',3),water=d.add('Item.WaterBottle'),torch=d.add('Item.Torch');water.uses=5;water.water={pathogen:60,ash:20,source:'초기 밭에 줄 유한 오염수1000ml'}
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!
 const crop=()=>cultivationStatus({db:w.db,s:{...s,map:s.map.id===source.id?s.map:s.maps[source.id]}},pos)!
 const act=(action:Action,budget?:number)=>{const error=playerAct(w,action,budget);if(error)throw Error(error)}
 act({type:'equip',uid:torch.uid});act({type:'toggleLight',uid:torch.uid});act({type:'place',uid:seeds.uid,dir:2});act({type:'waterCrop',pos,uid:water.uid,ml:1000})
 // 유한 수확 직전 장면이다. 이전143970성장턴/관수를 실행했다고 주장하지 않는다.
 if(nearRipe){crop().state.growth=crop().total-30;crop().state.waterUnits=100*crop().rule!.waterMl;crop().state.lastAt=turnOf(w)}
 s.log=s.log.filter(v=>v.kind!=='flavor');s.fx=[];invalidateLights(w);updatePlayerVision(w,p)
 return{w,s,p,pos,sourceId:source.id,annexId,seedsUid:seeds.uid,waterUid:water.uid,act,crop,proof:{seed:s.seed,nearRipeDeclared:nearRipe,sourceId:source.id,annexId,seedUid:seeds.uid,waterUid:water.uid,torchUid:torch.uid,actualInitialTorchEquipAndIgnition:true,initialCrop:structuredClone(crop().state),initialWeather:{weather:s.weather,until:s.weatherUntil,wind:s.wind},physicalStairs:[{x:20,y:21},{x:3,y:3}],limits:'Finite initial 7x7 open soil, one healthy original player, OatSeed3, polluted bottle1000ml and Torch1, authored connected9x9 cellar. Actual initial Core equip/ignite/plant/water. NearRipe declares30growth turns remaining/finite100-turn water; no past5days replay claim. No postload state/time/RNG injection.'}}
}
