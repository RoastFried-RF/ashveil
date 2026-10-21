// 실제 빛/기온/유한 물로 자란다. 일정한 지하 정산도 실제 이탈 이후만 적용하고 과거 날씨를 추정하지 않는다.
import {capacity} from './body'
import {removeOne} from './items'
import type {ItemInst} from './types'
import {validCropIrrigation,recordCropIrrigation,cropIrrigationError} from './crop-contamination'
import {inBounds,tileAt,terrainAt,turnOf,log,player,type World} from './ctx'
import {ambientTemp,daylight,isRaining} from './environment'
import {canSee,hasLos} from './fov'
import {cheb,type Pos} from './geom'
import {diagonalBlocked} from './path'
import {drinkVolume,spendDrinkVolume} from './wash-water'
import {waterQuality,waterSalinity,waterSafetyDef} from './water-state'
import {isWaterVessel,waterCapacity} from './water-vessels'
import {towerSoilFertility} from './tower-consequences'
import type {Creature,MapState,WorldGenDef} from './types'
const indices=new WeakMap<MapState,number[]>()
const signature=(w:World,p:Pos)=>JSON.stringify({terrain:tileAt(w,p).t,rule:terrainAt(w,p).cultivation,gather:terrainAt(w,p).gather})
export function plantCultivation(w:World,p:Pos,seedUid:number,ownerId?:number,source?:ItemInst){
 const tile=tileAt(w,p),def=terrainAt(w,p)
 if(!def.cultivation||!def.gather||source&&cropStarterError(w,source))return false
 tile.cultivation={...(def.cultivation.substrate?{remainingCycles:def.cultivation.substrate.cycles}:{}),...(source?cropStarterDose(w,source):{}),...(ownerId!==undefined?{ownerId}:{}),terrain:tile.t,signature:signature(w,p),seedUid,growth:0,waterUnits:0,lastAt:turnOf(w)}
 delete tile.gatherAt;indices.delete(w.s.map);return true
}
/** 현재 실제 따뜻한 노지의 증발률. 정지 지도/지난 날씨는 조회하지 않는다. */
export function cultivationEvaporationRate(w:World,p:Pos){
 if(w.s.map.kind!=='surface'||tileAt(w,p).roof||ambientTemp(w,p)<=0||isRaining(w))return 0
 return w.db.all<WorldGenDef>('WorldGen')[0]?.cropEvaporationMlPerHour??0
}
export function cultivationSoilDiffusionRule(w:World,p:Pos){
 const rule=terrainAt(w,p).cultivation
 return w.s.map.kind==='surface'&&rule&&rule.needsSoil!==false&&!rule.substrate?w.db.all<WorldGenDef>('WorldGen')[0]?.cropSoilDiffusion:undefined
}
export function cultivationStatus(w:World,p:Pos){
 const tile=tileAt(w,p),state=tile.cultivation,def=terrainAt(w,p),rule=def.cultivation,gather=def.gather
 if(!state)return
 let error:string|null=null
 const total=gather?.regrowTurns??0,waterCapacityUnits=rule&&total?rule.waterMl*total:0
 const valid=(state.dormantAt===undefined||Number.isSafeInteger(state.dormantAt)&&state.dormantAt>=0&&state.dormantAt<=turnOf(w))&&(rule?.substrate?Number.isSafeInteger(state.remainingCycles)&&state.remainingCycles!>=0&&state.remainingCycles!<=rule.substrate.cycles:state.remainingCycles===undefined)&&(state.ownerId===undefined||Number.isSafeInteger(state.ownerId)&&state.ownerId>0)&&validCropIrrigation(state)&&!!rule&&!!gather&&state.terrain===tile.t&&state.signature===signature(w,p)&&Number.isSafeInteger(state.seedUid)&&state.seedUid>0&&Number.isFinite(state.growth)&&state.growth>=0&&state.growth<=total&&Number.isSafeInteger(state.waterUnits)&&state.waterUnits>=0&&state.waterUnits<=waterCapacityUnits&&Number.isSafeInteger(state.lastAt)&&state.lastAt>=0&&state.lastAt<=turnOf(w)&&(state.evaporationCarry===undefined||Number.isSafeInteger(state.evaporationCarry)&&state.evaporationCarry>=0&&state.evaporationCarry<1200)
 const light=w.s.map.kind==='surface'?daylight(w)*(w.s.map.daylightMult??1)*(tile.roof?.45:1):0,temp=ambientTemp(w,p),fertility=gather?.soilDependent?towerSoilFertility(w):1
 if(!valid)error='원래 작물과 성장 규칙을 확인해야 한다'
 else if(rule!.substrate&&state.remainingCycles===0)error='배지가 소진되었다. 실제 목재로 교체해야 한다'
 else if(state.growth>=total)error=null
 else if(light<rule!.minLight)error='작물이 자랄 실제 햇빛이 부족하다'
 else if(rule!.maxLight!==undefined&&light>rule!.maxLight)error='이 작물에는 실제 햇빛이 너무 강하다'
 else if(temp<rule!.minTemp||temp>rule!.maxTemp)error='작물이 자랄 온도 범위를 벗어났다'
 else if(fertility<=0)error='실제 토양의 비옥도가 고갈되었다'
 else if(state.waterUnits<rule!.waterMl)error='밭에 실제 물을 주어야 한다'
 const ready=valid&&(!rule!.substrate||state.remainingCycles!>0)&&state.growth>=total
 return{state,rule,gather,valid,ready,error,light,temp,fertility,total,soilDiffusion:valid?cultivationSoilDiffusionRule(w,p):undefined,evaporationMlPerHour:valid&&state.waterUnits>0?cultivationEvaporationRate(w,p):0,progress:total?Math.floor(state.growth/total*100):0,waterMl:total?state.waterUnits/total:0}
}
export function cultivationHarvestError(w:World,p:Pos):string|null{const d=cultivationStatus(w,p);return d&&!d.ready?d.error??'작물이 아직 다 자라지 않았다':null}
export function resetCultivation(w:World,p:Pos){const d=cultivationStatus(w,p);if(!d?.valid||!d.ready)return;if(d.rule!.substrate)d.state.remainingCycles!--;d.state.growth=0;d.state.lastAt=turnOf(w);delete d.state.irrigation;delete tileAt(w,p).gatherAt}
/** 한 번의 실제 경계에서 읽은 물량으로만 이동한다. 들어온 물을 같은 정산에 다시 보내지 않는다. */
function diffuseSoilWater(w:World,list:number[],now:number){
 const rule=w.db.all<WorldGenDef>('WorldGen')[0]?.cropSoilDiffusion
 if(w.s.map.kind!=='surface'||!rule?.maxMlPerEdge||now%rule.everyTurns!==0)return
 const m=w.s.map,plots=new Map<number,NonNullable<ReturnType<typeof cultivationStatus>>>(),deltas=new Map<number,number>()
 for(const i of list){const p={x:i%m.w,y:Math.floor(i/m.w)},d=cultivationStatus(w,p);if(d?.valid&&d.state.lastAt===now-1&&d.rule!.needsSoil!==false&&!d.rule!.substrate&&d.temp>0)plots.set(i,d)}
 for(const[i,a]of plots)for(const j of[i%m.w+1<m.w?i+1:-1,i+m.w]){
  const b=plots.get(j);if(!b)continue
  const [from,to,source,target]=a.waterMl>b.waterMl?[i,j,a,b]:[j,i,b,a]
  // 네 이웃에 각각 차이의1/8만 보내므로 한 번의 동시 정산이 수위를 뒤집지 않는다.
  const ml=Math.min(rule.maxMlPerEdge,Math.floor((source.waterMl-target.waterMl)/8))
  if(ml<=0)continue
  const sent=ml*source.total,received=ml*target.total,srcNext=source.state.waterUnits+(deltas.get(from)??0)-sent,dstNext=target.state.waterUnits+(deltas.get(to)??0)+received
  if(!Number.isSafeInteger(srcNext)||!Number.isSafeInteger(dstNext)||srcNext<0||dstNext>target.rule!.waterMl*target.total)continue
  deltas.set(from,(deltas.get(from)??0)-sent);deltas.set(to,(deltas.get(to)??0)+received)
 }
 for(const[i,delta]of deltas)if(delta){const s=plots.get(i)!.state;s.waterUnits+=delta;if(s.waterUnits===0)delete s.evaporationCarry}
}
export function cultivationTick(w:World){
 const m=w.s.map,now=turnOf(w)
 let list=indices.get(m);if(!list){list=m.tiles.flatMap((t,i)=>t.cultivation?[i]:[]);indices.set(m,list)}
 diffuseSoilWater(w,list,now)
 for(const i of list){
  const p={x:i%m.w,y:Math.floor(i/m.w)},d=cultivationStatus(w,p)
  if(!d?.valid||d.state.lastAt>=now)continue
  // 정지한 다른 층/지역의 지난 시간을 현재 날씨로 소급 계산하지 않는다.
  d.state.lastAt=now
  if(m.kind==='surface'&&isRaining(w)&&!tileAt(w,p).roof){const before=d.state.waterUnits,next=Math.min(d.rule!.waterMl*d.total,before+Math.round(d.rule!.rainMlPerHour*d.total/1200)),ml=(next-before)/d.total,quality=waterSafetyDef(w).sources.rain;if(!cropIrrigationError(w,d.state,quality,ml)){d.state.waterUnits=next;recordCropIrrigation(w,d.state,quality,ml)}}
  if(d.state.waterUnits>0&&d.evaporationMlPerHour>0){
   const loss=(d.state.evaporationCarry??0)+d.evaporationMlPerHour*d.total,units=Math.min(d.state.waterUnits,Math.floor(loss/1200)),carry=loss%1200
   d.state.waterUnits-=units
   if(d.state.waterUnits>0&&carry)d.state.evaporationCarry=carry;else delete d.state.evaporationCarry
  }
  if(d.state.waterUnits<=0)delete d.state.evaporationCarry
  if(d.ready)continue
  if(cultivationStatus(w,p)!.error)continue
  d.state.waterUnits-=d.rule!.waterMl;d.state.growth=Math.min(d.total,d.state.growth+d.fertility);if(d.state.waterUnits===0)delete d.state.evaporationCarry
 }
}
export function cultivationWaterQuote(w:World,c:Creature,p:Pos,uid:number,ml:number){
 const validPos=Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)&&inBounds(w,p),bottle=c.bag.find(i=>i.uid===uid),d=validPos?cultivationStatus(w,p):undefined
 let error:string|null
 if(!c.alive||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 물을 줄 손이 필요하다'
 else if(!Number.isSafeInteger(p.x)||!Number.isSafeInteger(p.y)||!inBounds(w,p)||cheb(c.pos,p)>1||!hasLos(w,c.pos,p)||!canSee(w,c,p)||diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y))error='실제로 보이는 밭 곁으로 가야 한다'
 else if(!d?.valid)error='새로 심은 실제 작물 밭이 필요하다'
 else if(d.rule!.substrate&&d.state.remainingCycles===0)error='실제 목재로 소진된 배지를 먼저 교체해야 한다'
 else if(d.ready)error='먼저 다 자란 작물을 수확해야 한다'
 else if(!bottle||bottle.count!==1||!isWaterVessel(w,bottle)||bottle.waterFrozen)error='배낭의 녹은 물 용기 하나가 필요하다'
 else if(!Number.isSafeInteger(ml)||ml<=0||!Number.isSafeInteger(drinkVolume(w,bottle))||drinkVolume(w,bottle)>waterCapacity(w,bottle)||ml>drinkVolume(w,bottle)||ml*d.total+d.state.waterUnits>d.rule!.waterMl*d.total)error='물병의 실제 물량과 밭의 빈 관수량을 확인해야 한다'
 else{const quality=waterQuality(w,bottle),salt=waterSalinity(quality);if(![quality.pathogen,quality.ash].every(n=>Number.isFinite(n)&&n>=0))error='원래 물의 실제 수질을 확인해야 한다';else if(!Number.isFinite(salt)||salt<0||salt>d.rule!.maxSalinity)error='이 작물에는 소금기가 너무 많은 물이다';else error=cropIrrigationError(w,d.state,quality,ml)}
 return{error,bottle,ml,crop:d}
}
export function waterCultivation(w:World,c:Creature,p:Pos,uid:number,ml:number):string|null{
 const q=cultivationWaterQuote(w,c,p,uid,ml);if(q.error)return q.error
 const quality=structuredClone(waterQuality(w,q.bottle!));spendDrinkVolume(w,q.bottle!,ml);q.crop!.state.waterUnits+=ml*q.crop!.total;recordCropIrrigation(w,q.crop!.state,quality,ml)
 if(c.id===w.s.playerId)log(w,'info','원래 물 용기에서 '+ml+'ml를 실제 밭에 주었다.')
 else if(canSee(w,player(w),c.pos)&&canSee(w,player(w),p))log(w,'info',(c.faction==='player'?'동료가':'주민이')+' 실제 물 용기에서 밭에 물을 주었다.')
 return null
}

/** 실제 배양 재료의 병원체/재는 배지에 그대로 남는다. */
export function cropStarterDose(w:World,source:ItemInst):Pick<import('./types').CultivationState,'irrigation'>{
 const q=source.foodWater,ml=q?.ml??0,pathogen=q?.quality.pathogen??0,ash=(source.contaminantAsh??0)+(q? q.quality.ash/waterSafetyDef(w).ashDivisor*ml/waterSafetyDef(w).exposureMl:0)
 return ml>0&&pathogen>0||ash>0?{irrigation:{ml:ml>0&&pathogen>0?ml:0,pathogenMl:ml*pathogen,ash}}:{}
}
export function cropStarterError(w:World,source:ItemInst){
 const q=source.foodWater
 if(source.contaminantAsh!==undefined&&(!Number.isFinite(source.contaminantAsh)||source.contaminantAsh<0||source.contaminantAsh>Number.MAX_SAFE_INTEGER))return '배양 재료의 실제 재 오염량을 확인해야 한다'
 if(q&&(!q.quality||![q.ml,q.quality.pathogen,q.quality.ash].every(n=>Number.isFinite(n)&&n>=0&&n<=Number.MAX_SAFE_INTEGER)))return '배양 재료의 실제 수질과 재 오염을 확인해야 한다'
 return validCropIrrigation(cropStarterDose(w,source) as import('./types').CultivationState)?null:'배양 재료의 실제 오염량을 확인해야 한다'
}
export function cultivationSubstrateQuote(w:World,c:Creature,p:Pos,uid:number){
 const d=Number.isSafeInteger(p.x)&&Number.isSafeInteger(p.y)&&inBounds(w,p)?cultivationStatus(w,p):undefined,item=c.bag.find(i=>i.uid===uid),rule=d?.rule?.substrate
 let error:string|null
 if(!c.alive||!w.s.creatures.includes(c)||c.mapId!==undefined&&c.mapId!==w.s.map.id||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)error='깨어서 배지를 교체할 손이 필요하다'
 else if(!d?.valid||!rule)error='실제 배양목이 필요하다'
 else if(cheb(c.pos,p)>1||!canSee(w,c,p)||!hasLos(w,c.pos,p)||diagonalBlocked(w,c.pos,p.x-c.pos.x,p.y-c.pos.y))error='실제로 보이는 배양목 곁으로 가야 한다'
 else if(d.state.remainingCycles!==0||d.state.growth!==0)error='모든 수확을 마친 소진 배지만 교체할 수 있다'
 else if(!item||item.def!==rule.item||!Number.isSafeInteger(item.count)||item.count<1)error='배낭에 실제 '+w.db.item(rule.item).label+' 하나가 필요하다'
 else error=cropStarterError(w,item)
 const old=d?.state.irrigation,source=!error&&item?cropStarterDose(w,item).irrigation:undefined,next=source?{ml:(old?.ml??0)+source.ml,pathogenMl:(old?.pathogenMl??0)+source.pathogenMl,ash:(old?.ash??0)+source.ash}:old
 if(!error&&next&&!validCropIrrigation({irrigation:next} as import('./types').CultivationState))error='교체 재료에서 옮을 실제 오염량을 확인해야 한다'
 return{error,crop:d,item,rule,next}
}
export function refreshCultivationSubstrate(w:World,c:Creature,p:Pos,uid:number){
 const q=cultivationSubstrateQuote(w,c,p,uid);if(q.error)return q.error
 removeOne(w,c,uid);q.crop!.state.remainingCycles=q.rule!.cycles;if(q.next)q.crop!.state.irrigation=q.next
 if(canSee(w,player(w),p))log(w,'info','실제 '+w.db.item(q.rule!.item).label+' 하나로 소진된 배지를 교체했다.')
 return null
}
