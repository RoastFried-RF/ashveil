// 정비는 실제 지도 설비와 원래 부품/도구에 묶는다. 멈춘 작업은 설비에 남는다.
import {recordSourceContractWork} from './source-contracts'
import { initializeBeacons } from './beacons'
import { channelTurns } from './action-time'
import { capacity } from './body'
import { setTowerOutput, stopTower } from './climate-state'
import { witnessPropertyCrime } from './diplomacy'
import { inBounds, log, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos, invalidateLights } from './fov'
import { cheb, DIRS, type Pos } from './geom'
import { allItems, findItem, itemDef, removeOne } from './items'
import { diagonalBlocked } from './path'
import { emitNoise } from './perception'
import { drinkVolume, spendDrinkVolume } from './wash-water'
import { waterQuality, waterSalinity } from './water-state'
import type { Creature, FieldDeviceDef, FieldDeviceOperation, FieldDeviceState, FieldDeviceWork, ItemInst, RegionLayoutDef, RegionSiteDef } from './types'

/** 최초 배치와 구형 지도 재방문에서 한 번만 초기화한다. 조회 함수에서는 호출하지 않는다. */
export function initializeFieldDevices(w:World){
  initializeSourceControls(w)
  initializeLegacyDevices(w)
  initializeBeacons(w)
  for(const tile of w.s.map.tiles){const id=w.db.terrain(tile.t).device;if(id&&!tile.device)tile.device={uid:w.s.nextId++,def:id,completed:[],installed:[],waterUsed:0}}
}

/** 실제 관로가 연결된 지도에서 기존 동쪽 석벽 한 칸만 사용한다. 방/주민/물품은 다시 만들지 않는다. */
export function initializeSourceControls(w:World){
  for(const d of w.db.all<FieldDeviceDef>('FieldDevice')){
    const rule=d.placement
    if(!rule||w.s.map.id!==rule.mapId||w.s.overworld&&w.s.overworld.currentRegion!==rule.region||!w.s.sources?.some(source=>source.id===rule.source&&source.floors.includes(rule.mapId))||w.s.map.tiles.some(tile=>tile.device?.def===d.id||w.db.terrain(tile.t).device===d.id))continue
    const map=w.s.map,candidates=[]as {x:number;y:number}[]
    for(let y=1;y<map.h-1;y++)for(let x=2;x<map.w-1;x++){
      const tile=map.tiles[y*map.w+x],west=map.tiles[y*map.w+x-1]
      if(tile.t!==rule.wall||west.t!==rule.floor||tile.device||tile.placed||tile.cont||tile.items.length||map.links.some(l=>l.pos.x===x&&l.pos.y===y)||w.s.creatures.some(c=>c.alive&&c.mapId===map.id&&c.pos.x===x&&c.pos.y===y))continue
      candidates.push({x,y})
    }
    candidates.sort((a,b)=>b.x-a.x||Math.abs(a.y-map.h/2)-Math.abs(b.y-map.h/2)||a.y-b.y)
    const pos=candidates[0];if(!pos)continue
    const tile=tileAt(w,pos);tile.t=rule.terrain
    // 고정 시설은 음수 ID 영역을 쓴다. 새 현장이 물품/인물의 기존 ID 스트림을 밀지 않는다.
    const scenes=[w.s,...Object.values(w.s.overworld?.scenes??{})];let least=0
    for(const scene of scenes){for(const m of [scene.map,...Object.values(scene.maps)])for(const t of m.tiles)if(t.device)least=Math.min(least,t.device.uid);for(const source of scene.sources??[])if(source.closed)least=Math.min(least,source.closed.deviceUid)}
    tile.device={uid:least-1,def:d.id,completed:[],installed:[],waterUsed:0}
    ;(map.waypoints??={})[rule.waypoint]={...pos};invalidateLights(w)
  }
}

/** 구형 각인의 원래 방/주민/바닥 물품을 다시 생성하지 않고, 명시된 빈 바닥만 보완한다. */
function initializeLegacyDevices(w:World){
  const id=w.s.overworld?.currentRegion,layout=id&&w.db.tryGet<RegionSiteDef>(id)?.layout,d=layout&&w.db.get<RegionLayoutDef>(layout)
  if(!d||d.mapId!==w.s.map.id)return
  if(w.s.map.layout&&w.s.map.layout!==d.id)return
  for(const row of d.legacyObjects??[]){
    const pos={x:row.pos[0],y:row.pos[1]},key=`${d.id}:${row.key}`
    if(!inBounds(w,pos)||w.s.map.layoutUpgrades?.includes(key))continue
    const tile=tileAt(w,pos)
    if(!row.from.includes(tile.t)||tile.placed||tile.cont||w.s.creatures.some(c=>c.alive&&cheb(c.pos,pos)===0))continue
    tile.t=row.terrain
    invalidateLights(w)
    ;(w.s.map.layoutUpgrades??=[]).push(key)
    for(const light of d.lights??[])if(light.pos[0]===pos.x&&light.pos[1]===pos.y&&!w.s.map.lights.some(l=>l.pos.x===pos.x&&l.pos.y===pos.y&&l.kind===light.kind))w.s.map.lights.push({pos:{...pos},radius:light.radius,kind:light.kind})
  }
  for(const link of d.links){
    const row=d.legacyObjects?.find(row=>row.pos[0]===link.pos[0]&&row.pos[1]===link.pos[1]),pos={x:link.pos[0],y:link.pos[1]}
    if(!row||!inBounds(w,pos)||!w.s.map.layoutUpgrades?.includes(`${d.id}:${row.key}`)||tileAt(w,pos).t!==row.terrain||!w.db.terrain(row.terrain).stairs||w.s.map.links.some(l=>l.pos.x===pos.x&&l.pos.y===pos.y))continue
    w.s.map.links.push({pos,to:link.to,toPos:{x:link.at[0],y:link.at[1]},label:w.db.terrain(row.terrain).label})
  }
}
export function fieldDeviceAt(w:World,pos:Pos){return inBounds(w,pos)?tileAt(w,pos).device:undefined}
export function fieldDeviceDef(w:World,device:FieldDeviceState){return w.db.get<FieldDeviceDef>(device.def)}
const usableTool=(w:World,i:ItemInst,tag:string)=>!!itemDef(w,i).toolTags?.includes(tag)&&(i.durability??100)>0&&i.count>0
const usableWater=(w:World,i:ItemInst)=>!!itemDef(w,i).drink&&!itemDef(w,i).drink!.alcohol&&!i.waterFrozen&&waterQuality(w,i).ash===0&&waterSalinity(waterQuality(w,i))===0
function access(w:World,c:Creature,pos:Pos,device:FieldDeviceState|undefined,uid:number){
  if(!device||device.uid!==uid||w.db.terrain(tileAt(w,pos).t).device!==device.def)return '그 설비가 이곳에 없다'
  if(!w.s.creatures.includes(c))return '정비하는 사람이 이 지도에 없다'
  if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.1)return '깨어서 손을 쓸 수 있어야 한다'
  if(cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return '보이는 설비 바로 곁에서 작업해야 한다'
  return null
}
function operationError(w:World,c:Creature,device:FieldDeviceState,op:FieldDeviceOperation){
  if(device.completed.includes(op.id))return '이미 마친 작업이다'
  if(op.requires.some(id=>!device.completed.includes(id)))return '먼저 끝내야 할 정비가 남아 있다'
  if(op.books?.some(id=>!c.booksRead?.includes(id)||!(c.literacyBooks??c.booksRead??[]).includes(id)||c.misreadBooks?.includes(id)))return '필요한 정비 기록을 온전히 읽고 이해해야 한다'
  if(op.hold?.some(id=>!c.bag.some(it=>it.def===id&&it.count>0&&(it.durability??100)>0)))return '원래 인가 증표를 실제로 가지고 있어야 한다'
  if(op.energyCost!==undefined&&(device.energy??0)<op.energyCost)return '장착한 전원셀의 남은 전력이 부족하다'
  if(op.outdoorsCalm&&['ashstorm','ashgale'].includes(w.s.weather))return '거센 바람과 재폭풍이 잦아들어야 첨탑에서 작업할 수 있다'
  for(const prerequisite of op.devices??[]){const map=prerequisite.map===w.s.map.id?w.s.map:w.s.maps[prerequisite.map];if(!map?.tiles.some(tile=>tile.device?.def===prerequisite.def&&tile.device.completed.includes(prerequisite.operation)))return '연결된 실제 설비의 선행 정비를 끝내야 한다'}
  if(op.effect?.stopTower){const tower=w.s.overworld?.towers.find(t=>t.id===op.effect!.stopTower);if(!tower||tower.shutdown||tower.output<=0||!w.db.get<import('./types').ClimateDef>('Climate.Hearth').towerStop)return '연결된 탑은 이미 멈췄거나 정지 규정을 확인할 수 없다'}
  const seal=op.effect?.sealSource
  if(seal&&(w.s.overworld&&w.s.overworld.currentRegion!==seal.region||!w.s.sources?.some(source=>source.id===seal.source&&source.floors.includes(w.s.map.id)&&!source.closed)))return '연결된 실제 공급원은 이미 막혔거나 이 장소에 없다'
  if(op.effect?.selfTerrain&&w.db.terrain(op.effect.selfTerrain).device!==device.def)return '완료 후에도 같은 기구의 현장을 보존해야 한다'
  const change=op.effect?.towerOutput
  if(change&&!w.s.overworld?.towers.some(t=>t.id===change.tower))return '연결된 대기처리탑을 찾을 수 없다'
  for(const tile of op.effect?.tiles??[]){const pos={x:tile.pos[0],y:tile.pos[1]};if(!inBounds(w,pos)||tileAt(w,pos).t!==tile.from)return '연결된 원래 문과 기구의 상태가 바뀌었다'}
  return null
}
function bind(w:World,c:Creature,op:FieldDeviceOperation):{work?:FieldDeviceWork;error:string|null}{
  const remaining=new Map(c.bag.map(i=>[i.uid,i.count])),supplies:FieldDeviceWork['supplies']=[]
  for(const row of op.materials){
    let left=row.count
    for(const it of c.bag){if(it.def!==row.item||(it.durability??100)<=0)continue;const count=Math.min(left,remaining.get(it.uid)??0);if(!count)continue;supplies.push({uid:it.uid,def:it.def,count});remaining.set(it.uid,(remaining.get(it.uid)??0)-count);left-=count;if(!left)break}
    if(left)return{error:`${w.db.item(row.item).label} ${left}개가 부족하다`}
  }
  const tool=op.tool?allItems(c).find(i=>usableTool(w,i,op.tool!)&&(remaining.get(i.uid)??i.count)>0):undefined
  if(op.tool&&!tool)return{error:`쓸 수 있는 ${op.tool} 도구가 필요하다`}
  const water=op.waterMl?c.bag.find(i=>usableWater(w,i)&&drinkVolume(w,i)>=op.waterMl!&&(remaining.get(i.uid)??0)>0):undefined
  if(op.waterMl&&!water)return{error:`한 병에 재가 섞이지 않은 물 ${op.waterMl}ml가 필요하다`}
  // 같은 묶음의 중복 행은 하나의 실제 예약으로 합친다.
  const merged=new Map<number,FieldDeviceWork['supplies'][number]>()
  for(const row of supplies){const prev=merged.get(row.uid);if(prev)prev.count+=row.count;else merged.set(row.uid,{...row})}
  const held=op.hold?.map(def=>({def,uid:c.bag.find(it=>it.def===def&&it.count>0&&(it.durability??100)>0)!.uid}))
  if(held?.some(it=>(remaining.get(it.uid)??0)<1))return{error:'인가 증표를 소모 부품으로 쓸 수 없다'}
  return{error:null,work:{signature:JSON.stringify(op),owner:c.id,operation:op.id,total:op.turns,progress:0,supplies:[...merged.values()],toolUid:tool?.uid,held,water:water?{uid:water.uid,def:water.def,ml:op.waterMl!}:undefined}}
}
function bindingsError(w:World,c:Creature,op:FieldDeviceOperation,work:FieldDeviceWork){
  if(work.owner!==c.id||work.operation!==op.id)return '다른 사람 또는 다른 작업의 예약이 남아 있다'
  if(work.signature!==JSON.stringify(op))return '설비 지침이 바뀌었다. 예약을 해제한 뒤 다시 확인해야 한다'
  if(op.hold?.some(def=>!work.held?.some(row=>row.def===def))||work.held?.some(row=>!c.bag.some(it=>it.uid===row.uid&&it.def===row.def&&it.count>0&&(it.durability??100)>0)))return '예약한 원래 인가 증표가 없어졌다'
  const reserved=new Map(work.supplies.map(row=>[row.uid,row.count]))
  for(const row of work.supplies){const it=c.bag.find(i=>i.uid===row.uid);if(!it||it.def!==row.def||it.count<row.count||(it.durability??100)<=0)return '예약한 원래 부품이 없어졌거나 부족하다'}
  if(op.tool){const it=work.toolUid===undefined?undefined:findItem(c,work.toolUid);if(!it||!usableTool(w,it,op.tool)||it.count<=(reserved.get(it.uid)??0))return '예약한 원래 도구를 쓸 수 없다'}
  if(op.waterMl){const row=work.water,it=row&&c.bag.find(i=>i.uid===row.uid);if(!row||!it||it.def!==row.def||row.ml!==op.waterMl||!usableWater(w,it)||drinkVolume(w,it)<row.ml||it.count<=(reserved.get(it.uid)??0))return '예약한 원래 물병의 물이 부족하거나 얼고 오염되었다'}
  return null
}
export function fieldDeviceQuote(w:World,c:Creature,pos:Pos,uid:number,operation:string){
  const device=fieldDeviceAt(w,pos),def=device&&fieldDeviceDef(w,device),op=def?.operations.find(o=>o.id===operation)
  let error=access(w,c,pos,device,uid)
  if(!error&&!op)error='알 수 없는 설비 정비다'
  if(!error)error=operationError(w,c,device!,op!)
  const old=device?.work,bound=!error?(old?{work:old,error:bindingsError(w,c,op!,old)}:bind(w,c,op!)):undefined
  if(!error)error=bound?.error??null
  const work=bound?.work,remaining=work?Math.max(0,work.total-work.progress):op?.turns??0,turns=channelTurns(w,c,remaining)
  if(!error&&turns===null)error='몸 상태 때문에 정비를 할 수 없다'
  return{device,def,op,work,remaining,turns:turns??0,error}
}
export function startFieldDevice(w:World,c:Creature,pos:Pos,uid:number,operation:string):string|null{
  const q=fieldDeviceQuote(w,c,pos,uid,operation);if(q.error)return q.error
  q.device!.work=q.work!
  c.activity={kind:'deviceWork',target:{...pos},deviceUid:uid,deviceDef:q.device!.def,deviceOperation:operation,deviceMap:w.s.map.id,deviceProgress:q.work!.progress,remaining:q.turns,total:q.turns,label:`${q.def!.label} — ${q.op!.label}`}
  return null
}
export function cancelFieldDevice(w:World,c:Creature,pos:Pos,uid:number):string|null{
  const device=fieldDeviceAt(w,pos),error=access(w,c,pos,device,uid);if(error)return error
  if(!device!.work||device!.work.owner!==c.id)return '취소할 자신의 정비가 없다'
  device!.work=undefined
  if(c.activity?.kind==='deviceWork'&&c.activity.deviceUid===uid)c.activity=undefined
  return null
}
export function fieldDeviceStep(w:World,c:Creature):boolean{
  const a=c.activity,pos=a?.target
  if(!a||!pos||a.deviceUid===undefined||!a.deviceOperation){c.activity=undefined;return true}
  const q=fieldDeviceQuote(w,c,pos,a.deviceUid,a.deviceOperation),device=q.device,work=device?.work
  const error=a.deviceMap!==w.s.map.id||a.deviceDef!==device?.def?'원래 지도와 설비를 떠났다':q.error??(!work?'예약한 설비 작업이 사라졌다':null)
  if(error){if(c.id===w.s.playerId)log(w,'warn',`${a.label} 중단: ${error}. 진행과 예약은 설비에 남는다.`);c.activity=undefined;return true}
  const crime=q.op!.crime,key=`device:${device!.uid}:${q.op!.id}`
  if(q.op!.noise&&((a.elapsed??1)-1)%q.op!.noise.intervalTurns===0)emitNoise(w,pos,q.op!.noise.radius,c.id)
  if(crime)witnessPropertyCrime(w,c,pos,key,device!.uid,crime)
  work!.progress=Math.min(work!.total,(a.deviceProgress??0)+(work!.total-(a.deviceProgress??0))*((a.total??1)-Math.max(0,a.remaining))/(a.total??1))
  if(a.remaining>0)return false
  // 모든 조건을 다시 확인한 뒤 실제 원본 부품과 물을 한 번만 쓴다.
  for(const row of work!.supplies)for(let i=0;i<row.count;i++)device!.installed.push(removeOne(w,c,row.uid)!)
  if(work!.water){const it=c.bag.find(i=>i.uid===work!.water!.uid)!;device!.waterUsed+=spendDrinkVolume(w,it,work!.water.ml)}
  for(const tile of q.op!.effect?.tiles??[])tileAt(w,{x:tile.pos[0],y:tile.pos[1]}).t=tile.to
  if(q.op!.effect?.tiles?.length){invalidateLights(w);if(crime)witnessPropertyCrime(w,c,pos,key,device!.uid,crime)}
  const seal=q.op!.effect?.sealSource
  if(seal){const source=w.s.sources!.find(source=>source.id===seal.source)!;source.closed={at:turnOf(w),by:c.id,mapId:w.s.map.id,deviceUid:device!.uid}}
  if(q.op!.effect?.selfTerrain){tileAt(w,pos).t=q.op!.effect.selfTerrain;invalidateLights(w)}
  const change=q.op!.effect?.towerOutput;if(change)setTowerOutput(w,change.tower,change.value)
  if(q.op!.effect?.stopTower)stopTower(w,q.op!.effect.stopTower)
  if(q.op!.effect?.energy!==undefined||q.op!.energyCost!==undefined)device!.energy=Math.max(0,(device!.energy??0)+(q.op!.effect?.energy??0)-(q.op!.energyCost??0))
  const note=q.op!.effect?.note
  if(note&&!c.fieldNotes?.some(n=>n.key===note.key))(c.fieldNotes??=[]).push({...note,turn:turnOf(w),deviceUid:device!.uid,site:w.s.overworld?.currentRegion})
  device!.completed.push(q.op!.id);recordSourceContractWork(w,c,pos,device!.uid,q.op!.id);device!.work=undefined;c.activity=undefined
  if(c.id===w.s.playerId){log(w,'good',`${q.def!.label}: ${q.op!.label}을(를) 마쳤다.`);if(note)log(w,'info',`${note.title}: ${note.text}`)}
  return true
}
export function nearbyFieldDevices(w:World,c:Creature){return[{x:0,y:0},...DIRS].map(d=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).flatMap(pos=>{const device=fieldDeviceAt(w,pos);return device&&canSee(w,c,pos)?[{pos,device,def:fieldDeviceDef(w,device)}]:[]})}
