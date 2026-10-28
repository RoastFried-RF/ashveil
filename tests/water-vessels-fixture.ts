import {beddingFireFixture} from './bedding-fire-fixture'
import {perform} from '../src/core/actions'
import {fillWaterBottle} from '../src/core/water'
import {tileAt} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
export function waterVesselsFixture(filled=true,ready=true,withBucket=true,overworld=false,chance:number|null=1){
 const d=beddingFireFixture(chance,undefined,'actual-water-vessels-0',overworld),source={x:21,y:20}
 d.bed.t='Terrain.Earth';d.s.map.residentBeds=[];d.p.traumas=[];d.bottle.uses=0;delete d.bottle.water
 tileAt(d.w,source).t='Terrain.SettlementWell';d.s.map.residentWell={site:'Region.GreyCloister',terrain:'Terrain.SettlementWell',pos:{...source}}
 d.add('Item.Wood',4);d.add('Item.Cloth');d.add('Item.Wax')
 const bench=d.add('Item.WorkbenchKit');if(!perform(d.w,d.p,{type:'place',uid:bench.uid,dir:0}).ok)throw Error('actual original workbench kit')
 const bucket=withBucket?d.add('Item.WaterBucket'):undefined
 if(ready)d.ignite()
 if(filled&&bucket){const error=fillWaterBottle(d.w,d.p,bucket.uid,source);if(error)throw Error(error)}
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return{...d,bucket,source}
}

export async function waterVesselsNativeFixture(pending=false){
 const d=waterVesselsFixture(false,false,false,false,null)
 if(pending){
  const{playerAct}=await import('../src/core/game')
  for(const action of[{type:'wait' as const},{type:'fireWork' as const,pos:d.pos,uid:d.wood.uid},{type:'craft' as const,id:'Recipe.WaterBucket'}]){const error=playerAct(d.w,action);if(error)throw Error(error)}
  const bucket=d.p.bag.find(i=>i.def==='Item.WaterBucket')!
  for(const action of[{type:'fillBottle' as const,uid:bucket.uid,pos:d.source}]){const error=playerAct(d.w,action);if(error)throw Error(error)}
  const error=playerAct(d.w,{type:'waterTreatment',uid:bucket.uid,method:'boil'},1);if(error||!d.s.simulationPending)throw Error('actual pending original2L boiling')
 }
 return d
}
