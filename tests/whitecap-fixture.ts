import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {playerAct} from '../src/core/game'
import {tileAt,turnOf,type World} from '../src/core/ctx'
import {serialize,deserialize} from '../src/core/save'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {cultivationStatus} from '../src/core/cultivation'
import type {Action} from '../src/core/actions'
export type WhitecapPhase='materials'|'crafted'|'dry'|'watered'|'nearRipe'|'exhausted'|'refreshed'|'pending'
export function whitecapFixture(phase:WhitecapPhase='materials',contaminated=false){
 const d=clinicalDiseaseFixture('whitecap-physical-dark-culture',false),pos={x:21,y:20}
 d.s.storyteller.budget=-1e9;d.p.facing=2;d.s.map.kind='dungeon';d.s.map.depth=1;d.s.map.name='어두운 관로의 배양 구획';d.s.map.ambient=0;d.s.map.lights=[]
 for(let y=17;y<=23;y++)for(let x=17;x<=23;x++)Object.assign(tileAt(d.w,{x,y}),{t:'Terrain.KtFloor',roof:false})
 const wood=d.add('Item.Wood',2),cloth=d.add('Item.Cloth'),cap=d.add('Item.Whitecap'),water=d.add('Item.WaterBottle'),torch=d.add('Item.Torch')
 water.uses=5;water.water={pathogen:0,ash:0,source:'처음 소지한 실제 담수'}
 if(contaminated){cap.contaminantAsh=.4;cap.foodWater={ml:20,quality:{pathogen:2,ash:0,source:'실제 초기 버섯의 오염'}}}
 const w:World={db:d.w.db,s:deserialize(serialize(d.s))},s=w.s,p=s.creatures.find(c=>c.id===s.playerId)!
 invalidateLights(w);updatePlayerVision(w,p)
 const act=(a:Action,budget?:number)=>{const error=playerAct(w,a,budget);if(error)throw Error(error)}
 // 실제 유한 횃불을 손에 장비하고 점화한다. 인공 빛은 버섯의 햇빛 수치로 세지 않는다.
 act({type:'equip',uid:torch.uid});act({type:'toggleLight',uid:torch.uid})
 if(phase!=='materials')act({type:'craft',id:'Recipe.WhitecapCulture'})
 const culture=()=>p.bag.find(i=>i.def==='Item.WhitecapCulture'),crop=()=>cultivationStatus(w,pos)!
 const cultureUid=culture()?.uid
 if(!['materials','crafted'].includes(phase))act({type:'place',uid:cultureUid!,dir:2})
 if(['watered','nearRipe','exhausted','refreshed','pending'].includes(phase))act({type:'waterCrop',pos,uid:water.uid,ml:400})
 // 실제 남은3성장턴/마지막 한 배지 회차만 초기 조건으로 선언한다. 이전28797성장턴/3회 수확 이력은 만들지 않는다.
 if(['nearRipe','exhausted','refreshed'].includes(phase)){crop().state.growth=crop().total-3;crop().state.remainingCycles=1;crop().state.lastAt=turnOf(w)}
 if(['exhausted','refreshed'].includes(phase)){for(let i=0;i<3;i++)act({type:'wait'});act({type:'gather',pos})}
 if(phase==='refreshed')act({type:'refreshCropSubstrate',pos,uid:wood.uid})
 if(phase==='pending')act({type:'rest',turns:20},1)
 return{w,s,p,pos,act,woodUid:wood.uid,clothUid:cloth.uid,capUid:cap.uid,waterUid:water.uid,torchUid:torch.uid,cultureUid,culture,crop,proof:{phase,declaredDungeonAndPhysicalKit:true,actualTorchEquipAndIgnite:true,declaredRemainingThreeGrowthTurns:['nearRipe','exhausted','refreshed'].includes(phase),declaredOneRemainingSubstrateCycle:['nearRipe','exhausted','refreshed'].includes(phase),noClaimOfEarlierGrowthOrHarvest:true,rendererFx:s.fx.splice(0)}}
}
