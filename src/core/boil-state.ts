// 물 끓이기의 원래 자원/열원과 남은 시간에 대한 읽기 전용 검사.
import {turnOf,tileAt,type World} from './ctx'
import {hasLos} from './fov'
import {cheb,eq} from './geom'
import {findItem,itemDef} from './items'
import {waterBatches,waterQuality,waterResourcePlan,waterResourceValid,waterSafetyDef,waterTreatmentSignature} from './water-state'
import {waterTreatmentError} from './water'
import {masteryStage} from './skills'
import type {Creature} from './types'
type Heat=NonNullable<Creature['boilJob']>['heat']
export const boilSignature=(w:World,it?:import('./types').ItemInst)=>waterTreatmentSignature(w,it,'boil')
export function boilHeat(w:World,c:Creature):Heat|undefined{
 const light=w.s.map.lights.filter(l=>!l.off&&l.kind!=='torch'&&(l.sourceUid===undefined||(l.fuelUntil??0)>turnOf(w))&&cheb(c.pos,l.pos)<=6&&hasLos(w,c.pos,l.pos)).sort((a,b)=>Number(a.sourceUid===undefined)-Number(b.sourceUid===undefined)||cheb(a.pos,c.pos)-cheb(b.pos,c.pos)||a.pos.y-b.pos.y||a.pos.x-b.pos.x)[0]
 if(light)return{map:w.s.map.id,pos:{...light.pos},sourceUid:light.sourceUid,kind:light.kind,terrain:tileAt(w,light.pos).t}
 const held=[c.equip.main,c.equip.off].find(i=>i?.lit&&(i.fuel??0)>0&&(itemDef(w,i).light?.warmth??0)>=15)
 return held?{map:w.s.map.id,held:held.uid}:undefined
}
export function boilHeatPresent(w:World,c:Creature,h:Heat){
 if(h.map!==w.s.map.id)return false
 if(h.held!==undefined)return[c.equip.main,c.equip.off].some(i=>!!i&&i.uid===h.held&&i.lit&&(i.fuel??0)>0&&(itemDef(w,i).light?.warmth??0)>=15)
 if(h.sourceUid!==undefined&&h.pos){const tile=tileAt(w,h.pos);if(tile.placed?.item.uid!==h.sourceUid&&tile.beacon?.uid!==h.sourceUid)return false}
 if(!h.pos||tileAt(w,h.pos).t!==h.terrain||cheb(c.pos,h.pos)>6||!hasLos(w,c.pos,h.pos))return false
 return w.s.map.lights.some(l=>eq(l.pos,h.pos!)&&l.kind===h.kind&&l.sourceUid===h.sourceUid&&!l.off&&(l.sourceUid===undefined||(l.fuelUntil??0)>turnOf(w)))
}
export function waterBoilQuote(w:World,c:Creature,uid:number,factor:number){
 const it=findItem(c,uid),d=waterSafetyDef(w).treatments.boil,j=c.boilJob,heat=j?.heat??boilHeat(w,c),batches=it?waterBatches(w,it):1
 let error=waterTreatmentError(w,c,it,'boil')
 if(!error&&it?.count!==1)error='원래 물병 하나를 확인해야 한다'
 if(!error&&(!Number.isFinite(factor)||factor>4||factor<=0))error='몸 상태 때문에 정수할 수 없다'
 if(!error&&(!heat||!boilHeatPresent(w,c,heat)))error='원래 끓이던 열원 곁으로 가야 한다'
 const fuels=j?.fuels??(j?.fuelUid!==undefined?[{uid:j.fuelUid,count:batches}]:waterResourcePlan(c,d.fuel,batches)),tools=j?.tools??(j?.toolUid!==undefined?[{uid:j.toolUid,count:batches}]:waterResourcePlan(c,d.tool,batches,true)),fuel=fuels?.length?c.bag.find(i=>i.uid===fuels[0].uid):undefined,tool=tools?.length?c.bag.find(i=>i.uid===tools[0].uid):undefined
 if(!error&&(!waterResourceValid(c,d.fuel,fuels,batches)||!waterResourceValid(c,d.tool,tools,batches,true)))error='원래 끓이기 연료와 도구가 필요하다'
 const quality=it&&waterQuality(w,it)
 if(!error&&j&&(j.uid!==uid||j.sourceDef!==it!.def||j.uses!==it!.uses||JSON.stringify(j.quality)!==JSON.stringify(quality)||j.signature!==boilSignature(w,it)||(j.batches??1)!==batches))error='원래 물·양·수질이나 끓이기 규칙이 바뀌었다. 먼저 취소하자'
 const turns=j?.remaining??Math.max(1,Math.ceil(d.turns*batches*factor*(1-masteryStage(w,c,'survival')*.05)))
 return{error,it,quality,heat,fuel,tool,fuels,tools,batches,turns,total:j?.total??turns}
}
export function cancelBoil(c:Creature){if(c.activity?.kind==='water'&&c.activity.waterTreatment==='boil')c.activity=undefined;c.boilJob=undefined}
