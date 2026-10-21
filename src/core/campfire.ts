// 직접 설치한 불은 실제 목재와 점화 노동을 쓰며, 떠나 있어도 연료 시각은 흐른다.
import { channelTurns } from './action-time'
import { baseCampDef, baseTaskActive } from './base-camp-state'
import { capacity } from './body'
import { isCompanion } from './companion-state'
import { inBounds, log, tileAt, turnOf, type World } from './ctx'
import { canSee, hasLos, invalidateLights } from './fov'
import { cheb, DIRS, eq, type Pos } from './geom'
import { diagonalBlocked } from './path'
import { traumaHandleFire } from './trauma'
import {recordResidentUse} from './world-simulation'
import type { CampfireDef, Creature, ItemInst, MapState } from './types'
export const campfireDef=(w:World)=>w.db.get<CampfireDef>('Campfire.Hearth')
export function campfireAt(w:World,pos:Pos){
 if(!inBounds(w,pos))return undefined
 const d=campfireDef(w),tile=tileAt(w,pos)
 if(tile.t!==d.terrain||tile.placed?.item.def!==d.kit)return undefined
 const light=w.s.map.lights.find((l)=>eq(l.pos,pos)&&l.sourceUid===tile.placed!.item.uid)
 return light?{tile,light,uid:tile.placed!.item.uid}:undefined
}
export const fireTurnsLeft=(w:World,pos:Pos)=>{const f=campfireAt(w,pos);return f&&!f.light.off?Math.max(0,(f.light.fuelUntil??0)-turnOf(w)):0}
export function recordCampfirePlacement(w:World,c:Creature,it:ItemInst,pos:Pos,base:string){
 const d=w.db.tryGet<CampfireDef>('Campfire.Hearth');if(!d||it.def!==d.kit)return
 tileAt(w,pos).placed={base,item:{...it,count:1,gx:undefined,gy:undefined,rot:undefined},owner:c.id}
 w.s.map.lights.push({pos:{...pos},radius:d.radius,kind:'campfire',sourceUid:it.uid,fuelUntil:turnOf(w),off:true})
 if(c.id!==w.s.playerId&&c.residentSite&&c.residentSite===w.s.overworld?.currentRegion)c.residentCookingFire={map:w.s.map.id,region:c.residentSite,pos:{...pos},uid:it.uid}
}
export function expireCampfires(w:World,map:MapState=w.s.map){
 let changed=false
 for(const light of map.lights)if(light.sourceUid!==undefined){
  const tile=map.tiles[light.pos.y*map.w+light.pos.x]
  if(!light.off&&((light.fuelUntil??0)<=turnOf(w)||tile?.placed?.item.uid!==light.sourceUid&&(tile?.beacon?.uid!==light.sourceUid||!w.db.terrain(tile.t).beacon))){light.off=true;changed=true}
 }
 if(changed&&map===w.s.map)invalidateLights(w)
}
export function campfireAccessError(w:World,c:Creature,pos:Pos){
 if(!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||capacity(w,c,'manipulation')<.2)return '깨어서 불을 다룰 손을 쓸 수 있어야 한다'
 const fire=campfireAt(w,pos)
 if(!fire||cheb(c.pos,pos)>1||!canSee(w,c,pos)||!hasLos(w,c.pos,pos)||diagonalBlocked(w,c.pos,pos.x-c.pos.x,pos.y-c.pos.y))return '직접 설치한 실제 모닥불 바로 곁이어야 한다'
 const base=w.s.map.baseCamp,owner=fire.tile.placed!.owner
 return owner===c.id||base&&base.owner===owner&&isCompanion(w,c)&&cheb(pos,base.store)<=baseCampDef(w).radius?null:'이 모닥불을 관리할 권한이 없다'
}
export function fireWorkQuote(w:World,c:Creature,pos:Pos,woodUid:number){
 const d=campfireDef(w),fire=campfireAt(w,pos),wood=c.bag.find((i)=>i.uid===woodUid),hot=fireTurnsLeft(w,pos)>0
 let error=campfireAccessError(w,c,pos)
 if(!error&&(!wood||wood.def!==d.fuel||wood.count<1))error='배낭의 실제 땔감이 필요하다'
 if(!error&&fireTurnsLeft(w,pos)+d.fuelTurns>d.maxFuelTurns)error='이미 넣어 둘 수 있는 연료 한도에 도달했다'
 const wet=Math.max(0,...Object.values(wood?.wetness??{})),turns=channelTurns(w,c,(hot?d.stokeTurns:d.igniteTurns)*(wet>=d.wetAt?d.wetMultiplier:1))
 if(!error&&turns===null)error='몸 상태로 불을 피울 수 없다'
 return{error,turns:turns??0,uid:fire?.uid,hot}
}
export function startFireWork(w:World,c:Creature,pos:Pos,woodUid:number,baseOrder?:number):string|null{
 if(c.activity)return '하던 일을 먼저 마쳐야 한다'
 const q=fireWorkQuote(w,c,pos,woodUid);if(q.error)return q.error
 if(baseOrder!==undefined&&!baseTaskActive(w,c,baseOrder,false))return '유효한 불 관리 배정이 없다'
 c.activity={kind:'fire',remaining:q.turns,total:q.turns,target:{...pos},uid:woodUid,fireUid:q.uid,fireHot:q.hot,baseOrder,label:q.hot?'실제 땔감 넣기':'마찰로 불 피우기',woundCount:c.body.wounds.length};return null
}
export function fireWorkStep(w:World,c:Creature):boolean{
 const a=c.activity!,q=fireWorkQuote(w,c,a.target!,a.uid!)
 if(q.error||q.uid!==a.fireUid||a.baseOrder!==undefined&&!baseTaskActive(w,c,a.baseOrder,false)){c.activity=undefined;return true}
 // 불씨가 사라졌다면 짧은 땔감 넣기로 다시 켜지 못한다. 실제 점화 작업을 다시 한다.
 if(a.fireHot&&!q.hot){a.fireHot=false;a.remaining=q.turns;a.total=q.turns;a.label='꺼진 불 다시 피우기';return false}
 if(a.remaining>0)return false
 const fuel=c.bag.find((i)=>i.uid===a.uid)!
 recordResidentUse(w,c,fuel.def,1)
 if(--fuel.count===0)c.bag=c.bag.filter((i)=>i.uid!==fuel.uid)
 const f=campfireAt(w,a.target!)!,d=campfireDef(w)
 f.light.fuelUntil=Math.max(turnOf(w),f.light.fuelUntil??0)+d.fuelTurns;f.light.off=false
 traumaHandleFire(w,c)
 invalidateLights(w);c.activity=undefined
 if(c.id===w.s.playerId)log(w,'info','실제 땔감을 태워 모닥불을 살렸다. 연료가 다하면 꺼진다.')
 return true
}
export function extinguishCampfire(w:World,c:Creature,pos:Pos):string|null{
 const error=campfireAccessError(w,c,pos);if(error)return error
 const f=campfireAt(w,pos)!;if(fireTurnsLeft(w,pos)<=0)return '이미 꺼진 불이다'
 f.light.off=true;f.light.fuelUntil=turnOf(w);invalidateLights(w);return null
}
export function nearbyCampfires(w:World,c:Creature){return[{x:0,y:0},...DIRS].map((d)=>({x:c.pos.x+d.x,y:c.pos.y+d.y})).filter((p)=>!!campfireAt(w,p)&&canSee(w,c,p)&&hasLos(w,c.pos,p))}
