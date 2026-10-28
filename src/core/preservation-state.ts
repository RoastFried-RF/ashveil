// 실제 가공 배치의 읽기 전용 조건. 견적과 화면은 진행 시간을 정산하지 않는다.
import {turnOf,tileAt,inBounds,type World} from './ctx'
import {cheb,type Pos} from './geom'
import {hasLos} from './fov'
import {campfireAt} from './campfire'
import {regionalWindBonus} from './climate-state'
import type {CraftBatch,Creature,RecipeDef} from './types'
export const preservationSignature=(r:RecipeDef)=>JSON.stringify({preservation:r.preservation,passiveTurns:r.passiveTurns,inputs:r.inputs,output:r.output})
export function preservationFire(w:World,pos:Pos,interval=false){
 return w.s.map.lights.filter(l=>l.sourceUid!==undefined&&!l.off&&(l.fuelUntil??0)>turnOf(w)-(interval?1:0)&&cheb(l.pos,pos)<=1&&hasLos(w,pos,l.pos))
  .sort((a,b)=>a.pos.y-b.pos.y||a.pos.x-b.pos.x).map(l=>campfireAt(w,l.pos)).find(f=>!!f)
}
export function preservationError(w:World,c:Creature,r:RecipeDef){
 if(!r.preservation)return null
 if(r.preservation.method==='smoke'&&!preservationFire(w,c.pos))return '실제로 설치하고 땔감을 피운 모닥불 바로 곁이어야 한다'
 return null
}
export function preservationRate(w:World,b:CraftBatch,interval=false){
 const p=b.processing;if(!p)return{rate:1,reason:''}
 const r=w.db.tryGet<RecipeDef>(b.recipe)
 if(!r||preservationSignature(r)!==p.signature)return{rate:0,reason:'제작법이 바뀌어 원래 가공 규칙을 확인해야 한다'}
 if(!inBounds(w,b.pos))return{rate:0,reason:'원래 작업장 위치를 찾을 수 없다'}
 const now=turnOf(w)
 if(p.method==='ferment')return{rate:1,reason:''}
 if(p.method==='smoke'){
  const f=p.fire&&campfireAt(w,p.fire.pos)
  const hot=f&&f.uid===p.fire!.uid&&!f.light.off&&(f.light.fuelUntil??0)>=now&&hasLos(w,b.pos,p.fire!.pos)
  return hot?{rate:1,reason:''}:{rate:0,reason:'원래 모닥불에 실제 땔감을 더 넣어야 한다'}
 }
 const exposed=w.s.map.kind==='surface'&&!tileAt(w,b.pos).roof
 if(exposed&&['ashrain','ashstorm','ashgale'].includes(w.s.weather))return{rate:0,reason:'재를 섞은 비바람이 그칠 때까지 건조가 멈춘다'}
 const wind=exposed?Math.max(Math.abs(w.s.wind.x),Math.abs(w.s.wind.y))+regionalWindBonus(w):0
 const fire=preservationFire(w,b.pos,interval),d=r.preservation!
 if(fire||wind>=d.fastWind)return{rate:d.fastRate,reason:''}
 if(wind>0)return{rate:1,reason:''}
 return{rate:0,reason:'건조에는 실제 바람이나 피운 불이 필요하다'}
}
export function batchStatus(w:World,b:CraftBatch){
 if(!b.processing)return{remaining:Math.max(0,b.readyAt-turnOf(w)),reason:'',progress:undefined}
 const p=b.processing,remaining=Math.max(0,p.total-p.progress),condition=preservationRate(w,b)
 return{remaining,reason:remaining?condition.reason:'',progress:p.progress,total:p.total}
}
