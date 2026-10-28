import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {tileAt} from '../src/core/ctx'
import {beddingLiceTick} from '../src/core/bedding-lice'
import {finishWash} from '../src/core/food-safety'
import {addEffect} from '../src/core/traits'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function beddingLiceFixture(chance:number|null=1,seed='actual-bedding-lice-0',carrier=true){
 const d=clinicalDiseaseFixture(seed,false),bedPos={...d.p.pos},bed=tileAt(d.w,bedPos)
 if(chance!==null){const id='actual.bedding.lice',loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches:[{op:'replace',target:'BeddingContact.Hearth',path:'/lice/contactChance',value:chance}]}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db}
 bed.t='Terrain.Bed';delete bed.placed;delete bed.beddingWetness;d.s.map.lights=[];d.s.storyteller.budget=-1e9;d.p.skills={};d.p.background=undefined;d.s.map.residentBeds=[{owner:d.p.id,terrain:bed.t,pos:{...bedPos}}]
 const bottles=Array.from({length:6},()=>{const i=d.add('Item.WaterBottle');i.uses=5;return i})
 if(carrier)addEffect(d.p,'lice',Number.MAX_SAFE_INTEGER)
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const deposit=()=>{d.p.activity={kind:'rest',remaining:200,label:'실제 누운 휴식'};d.s.time+=100;beddingLiceTick(d.w);d.p.activity=undefined;if(!bed.beddingLice)throw Error('original carrier contact missing');return bed.beddingLice}
 const washBody=()=>{d.p.pos={x:21,y:20};d.p.activity=undefined;if(!finishWash(d.w,d.p))throw Error('actual body wash water missing')}
 return{...d,bed,bedPos,bottles,deposit,washBody}
}

export async function beddingLiceNativeFixture(pending=false,seed='actual-bedding-lice-1377'){
 const d=beddingLiceFixture(null,seed,false)
 d.p.needs.hygiene=0;d.s.time=2879900;d.p.nextAct=d.s.time
 if(pending){
  const{playerAct}=await import('../src/core/game')
  for(const action of[{type:'wait' as const},{type:'rest' as const,turns:200},{type:'move' as const,dir:2},{type:'wash' as const},{type:'move' as const,dir:6}]){const error=playerAct(d.w,action);if(error)throw Error(error)}
  const error=playerAct(d.w,{type:'rest',turns:400},1);if(error||!d.s.simulationPending)throw Error('actual pending original bedding exposure')
 }
 return d
}
