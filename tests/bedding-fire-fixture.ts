import {clinicalDiseaseFixture} from './clinical-diseases-fixture'
import {loadMods,type PatchOp} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {perform} from '../src/core/actions'
import {startFireWork} from '../src/core/campfire'
import {finishBase} from './base-camp-fixture'
import {tileAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function beddingFireFixture(chance:number|null=1,material?:string,seed='actual-bedding-fire-0',overworld=false){
 const d=clinicalDiseaseFixture(seed,overworld),bed=tileAt(d.w,d.p.pos),bedPos={...d.p.pos},pos={x:19,y:20}
 if(chance!==null||material){
  const id='actual.bedding.fire',patches:PatchOp[]=[]
  if(chance!==null)patches.push({op:'replace',target:'BeddingContact.Hearth',path:'/fire/sparkChance',value:chance})
  if(material)patches.push({op:'add',target:'Item.Bedroll',path:'/material',value:material})
  const loaded=loadMods([...readPackages(),{manifest:{id,name:id,version:'1'},defs:[],patches}],[id]);if(loaded.report.errors.length)throw Error(loaded.report.errors.join('\n'));d.w.db=loaded.db
 }
 bed.t='Terrain.Bed';delete bed.placed;delete bed.beddingWetness;d.s.map.lights=[];d.s.storyteller.budget=-1e9;d.p.skills={};d.p.background=undefined
 d.s.map.residentBeds=[{owner:d.p.id,terrain:bed.t,pos:{...bedPos}}]
 const kit=d.add('Item.CampfireKit'),wood=d.add('Item.Wood',3),bottle=d.add('Item.WaterBottle');bottle.uses=5
 if(!perform(d.w,d.p,{type:'place',uid:kit.uid,dir:6}).ok)throw Error('actual fire kit placement')
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 const light=()=>d.s.map.lights.find(l=>l.sourceUid===kit.uid)!
 const ignite=()=>{const e=startFireWork(d.w,d.p,pos,wood.uid);if(e)throw Error(e);finishBase(d.w,d.p)}
 return{...d,bed,bedPos,pos,kit,wood,bottle,light,ignite}
}

export async function beddingFireNativeFixture(pending=false,seed='actual-bedding-fire-1'){
 const d=beddingFireFixture(null,undefined,seed)
 if(pending){
  const{playerAct}=await import('../src/core/game')
  for(const action of[{type:'wait' as const},{type:'fireWork' as const,pos:d.pos,uid:d.wood.uid},{type:'rest' as const,turns:200}]){const error=playerAct(d.w,action);if(error)throw Error(error)}
  if(!d.bed.beddingFire)throw Error('actual default source fire missing')
  const error=playerAct(d.w,{type:'rest',turns:200},1);if(error||!d.s.simulationPending)throw Error('actual pending bedding flame rest')
 }
 return d
}
