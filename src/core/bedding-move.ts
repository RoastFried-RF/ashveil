import {beddingLiceState,beddingScorch,beddingWetness} from './camping'
// 고정 침구를 실제 물품으로 포장→소지/운반→기존 설치 행동. 조회/중단은 침구를 만들지 않는다.
import { channelTurns } from './action-time'
import { capacity } from './body'
import { creatureAt, inBounds, log, terrainAt, tileAt, turnOf, type World } from './ctx'
import { hasLos, invalidateLights } from './fov'
import { cheb, eq, type Pos } from './geom'
import { addToBag, findItem, makeItem } from './items'
import { residentPreparingRest } from './resident-rest'
import { diagonalBlocked } from './path'
import type { Activity, BeddingMoveDef, Creature } from './types'
export const beddingMoveDef = (w:World) => w.db.tryGet<BeddingMoveDef>('BeddingMove.Hearth')
function inspectFurniture(w:World,c:Creature,pos:Pos,checkSpace:boolean){
  const d=beddingMoveDef(w),out={error:null as string|null,turns:0,furniture:undefined as Activity['furniture']}
  if(!d||!inBounds(w,pos)||cheb(c.pos,pos)>1||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y)){out.error='침구 곁으로 가야 한다';return out}
  const tile=tileAt(w,pos),terrain=terrainAt(w,pos),bed=w.s.map.residentBeds?.find((b)=>eq(b.pos,pos)&&!b.packedUid&&b.terrain===tile.t),owner=bed?.owner??tile.placed?.owner,occupant=creatureAt(w,pos)
  if(tile.beddingFire){out.error='타는 침구의 불을 먼저 꺼야 한다';return out}
  if(!c.alive||c.unconscious||c.asleep||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2){out.error='침구를 옮길 몸 상태가 아니다';return out}
  if(!terrain.bedding||terrain.bedding.portable){out.error='옮길 수 있는 고정 침구가 아니다';return out}
  if(owner!==undefined&&owner!==c.id){out.error='다른 사람의 침구다';return out}
  if(occupant&&occupant.id!==c.id){out.error='누군가 침구를 쓰고 있다';return out}
  const item=d.items.find((id)=>w.db.item(id).place===tile.t)
  if(!item||!tile.placed&&!bed){out.error='이 침구의 물품을 확인할 수 없다';return out}
  if(tile.placed&&(tile.placed.item.def!==item||tile.placed.item.count!==1)){out.error='침구의 실제 물품이 달라졌다';return out}
  const n=channelTurns(w,c,d.packTurns)
  if(n===null){out.error='몸 상태 때문에 침구를 포장할 수 없다';return out}
  // 공간 탐색은 요청/완료 때 한다. 매 작업 턴에 전체 배낭/난수 상태를 복제할 필요가 없다.
  if(checkSpace){
    const shadow={db:w.db,s:{...w.s,nextId:-1,rng:structuredClone(w.s.rng)}},probe=tile.placed?structuredClone(tile.placed.item):makeItem(shadow,item),copy={...c,bag:structuredClone(c.bag)}
    if(addToBag(shadow,copy,probe)){out.error='침구를 넣을 배낭 공간이 없다';return out}
  }
  out.turns=n;out.furniture={terrain:tile.t,item,base:tile.placed?.base??bed?.base??d.defaultFloor,uid:tile.placed?.item.uid,owner};return out
}
export const furnitureQuote=(w:World,c:Creature,pos:Pos)=>inspectFurniture(w,c,pos,true)
export function startFurniturePack(w:World,c:Creature,pos:Pos):string|null{
  const q=furnitureQuote(w,c,pos)
  if(q.error)return q.error
  if(c.activity)return '하던 일을 마친 뒤 침구를 포장해야 한다'
  c.activity={kind:'packFurniture',remaining:q.turns,total:q.turns,target:{...pos},furniture:q.furniture,label:'침구 포장',woundCount:c.body.wounds.length};return null
}
export function furniturePackStep(w:World,c:Creature):boolean{
  const act=c.activity!,q=inspectFurniture(w,c,act.target!,act.remaining<=0),f=act.furniture
  if(q.error||!f||!q.furniture||JSON.stringify(q.furniture)!==JSON.stringify(f)){
    if(c.id===w.s.playerId)log(w,'warn',`침구 포장 중단: ${q.error??'쓰던 침구가 바뀌었다'}.`)
    c.activity=undefined;if(c.residentSite)delayResidentBedding(w,c);return true
  }
  if(act.remaining>0)return false
  const tile=tileAt(w,act.target!),bed=w.s.map.residentBeds?.find((b)=>b.owner===c.id&&eq(b.pos,act.target!)&&!b.packedUid),item=tile.placed?.item??makeItem(w,f.item)
  const wet=beddingWetness(tile);if(wet>0){item.wetness??={};item.wetness.torso=wet}
  const scorch=beddingScorch(tile);if(scorch>0)item.beddingScorch=scorch
  const lice=beddingLiceState(tile);if(lice)item.beddingLice={...lice}
  addToBag(w,c,item);tile.t=f.base;tile.placed=undefined;delete tile.beddingWetness;delete tile.beddingScorch;delete tile.beddingLice
  if(bed){bed.base=f.base;bed.packedUid=item.uid}
  invalidateLights(w);c.activity=undefined
  if(c.id===w.s.playerId)log(w,'info',`${w.db.item(f.item).label}을(를) 포장했다. 배낭의 같은 침구를 다시 설치할 수 있다.`)
  return true
}
export function recordBeddingPlacement(w:World,c:Creature,uid:number,pos:Pos){
  const bed=w.s.map.residentBeds?.find((b)=>b.owner===c.id&&b.packedUid===uid)
  if(!bed)return
  const tile=tileAt(w,pos)
  bed.pos={...pos};bed.terrain=tile.t;bed.base=tile.placed?.base;bed.packedUid=undefined;c.residentBedTarget=undefined;c.residentReturning=true
}
export function delayResidentBedding(w:World,c:Creature){c.residentBedMoveAfter=turnOf(w)+(beddingMoveDef(w)?.retryTurns??1);c.residentBedTarget=undefined}
export function residentBeddingGoal(w:World,c:Creature){
  const d=beddingMoveDef(w),fire=w.s.map.residentHearth,bed=w.s.map.residentBeds?.find((b)=>b.owner===c.id)
  if(!d||!fire||!bed||c.id===w.s.playerId||!c.alive||c.activity||c.unconscious||c.asleep||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2||c.residentSite!==w.s.overworld?.currentRegion||c.residentSite!==fire.site||(c.residentBedMoveAfter??0)>turnOf(w))return null
  if(bed.packedUid){const item=findItem(c,bed.packedUid);return item&&d.items.includes(item.def)?{kind:'carry' as const,pos:fire.pos,uid:bed.packedUid}:null}
  if(!residentPreparingRest(w,c)||c.needs.bodyTemp>d.coldAt||cheb(bed.pos,fire.pos)<=d.warmRadius)return null
  return{kind:'pack' as const,pos:bed.pos,uid:undefined}
}
export function beddingSiteAvailable(w:World,c:Creature,pos:Pos):boolean{
  if(!inBounds(w,pos)||!hasLos(w,c.pos,pos)||cheb(c.pos,pos)<=1&&diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return false
  const tile=tileAt(w,pos),t=terrainAt(w,pos),occ=creatureAt(w,pos)
  return t.passable&&!t.water&&!t.stairs&&!t.container&&!t.station&&!t.bedding&&!t.residentDepot&&!t.residentWell&&!!tile.roof&&!tile.placed&&!tile.items.length&&!occ&&!w.s.map.exits.some((p)=>eq(p,pos))&&!w.s.creatures.some((o)=>o.home&&eq(o.home,pos))
}
export function residentBeddingSites(w:World,c:Creature):Pos[]{
  const d=beddingMoveDef(w),fire=w.s.map.residentHearth
  if(!d||!fire||cheb(c.pos,fire.pos)>d.approachRadius||!hasLos(w,c.pos,fire.pos))return[]
  const out:Pos[]=[]
  for(let y=fire.pos.y-d.warmRadius;y<=fire.pos.y+d.warmRadius;y++)for(let x=fire.pos.x-d.warmRadius;x<=fire.pos.x+d.warmRadius;x++){const pos={x,y};if(beddingSiteAvailable(w,c,pos))out.push(pos)}
  return out.sort((a,b)=>cheb(a,fire.pos)-cheb(b,fire.pos)||cheb(a,c.home??c.pos)-cheb(b,c.home??c.pos)||a.y-b.y||a.x-b.x)
}
