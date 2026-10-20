import {mapWorlds} from './journey'
import {ambientTemp} from './environment'
import {rotRate} from './food-state'
import {turnOf,tileAt,TURNS_PER_HOUR,type World} from './ctx'
import {preservationFire,preservationRate,preservationSignature} from './preservation-state'
import type {Creature,RecipeDef,WorkJob,CraftBatch,ItemInst} from './types'
export function preparePreservation(w:World,c:Creature,r:RecipeDef,inputs:WorkJob['inputs']):CraftBatch['processing']{
 if(!r.preservation)return
 const fire=r.preservation.method==='smoke'?preservationFire(w,c.pos):undefined
 return{method:r.preservation.method,progress:0,total:r.passiveTurns!,lastAt:turnOf(w),signature:preservationSignature(r),inputs:inputs.map(i=>({...i})),...(r.preservation.vessel?{vessel:structuredClone(c.bag.find(it=>inputs.some(i=>i.uid===it.uid)&&it.def===r.preservation!.vessel)!)}:{}),...(fire?{fire:{pos:{...fire.light.pos},uid:fire.uid}}:{})}
}
/** 각 실제 턴의 직전 환경 구간을 한 번만 센다. 긴 건너뛰기를 현재 날씨로 소급 채우지 않는다. */
export function preservationTick(w:World){
 const maps=[w.s.map,...Object.values(w.s.maps),...Object.values(w.s.overworld?.scenes??{}).flatMap(s=>[s.map,...Object.values(s.maps)])]
 if(!maps.some(m=>m.batches?.some(b=>b.processing)))return
 const now=turnOf(w)
 for(const local of mapWorlds(w))for(const b of local.s.map.batches??[]){
  const p=b.processing;if(!p||p.lastAt>=now)continue
  const r=local.db.tryGet<RecipeDef>(b.recipe)
  const {rate}=preservationRate(local,b,true)
  // Only observed consecutive intervals count; paused raw ingredients keep spoiling.
  if(now===p.lastAt+1){
   if(r){
    const wet=local.s.map.kind==='surface'&&!tileAt(local,b.pos).roof&&['ashrain','ashstorm'].includes(local.s.weather)
    const it:ItemInst={uid:b.id,def:r.output.item,count:r.output.count,freshness:b.freshness,foodThawed:b.foodThawed,foodWet:b.foodWet,foodLeftover:b.foodLeftover,foodBurnt:b.foodBurnt}
    const definitions=p.progress>=p.total||rate>0?[local.db.item(r.output.item)]:p.inputs.map(i=>local.db.item(i.def)).filter(d=>d.food)
    const decay=Math.max(0,...definitions.map(d=>rotRate(local,it,d,ambientTemp(local),wet)))/TURNS_PER_HOUR
    b.freshness=Math.max(0,(b.freshness??100)-decay)
   }
   p.progress=Math.min(p.total,p.progress+rate)
  }
  p.lastAt=now
 }
}
