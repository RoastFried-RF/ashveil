import {db,makeWorld} from './helpers'
import {changeMap,playerAct,stopActivity} from '../src/core/game'
import {player,tileAt,type World} from '../src/core/ctx'
import {addToBag,makeItem} from '../src/core/items'
import {updatePlayerVision,invalidateLights} from '../src/core/fov'
import {fieldDeviceAt,startFieldDevice} from '../src/core/field-devices'
import {activityStep} from '../src/core/actions'
import {serialize,deserialize} from '../src/core/save'
export type SourceControlPhase='ready'|'paused'|'lastTurn'|'completed'|'pending'
let template:string|undefined
export function sourceControlsFixture(phase:SourceControlPhase='ready'){
 if(!template){const w=makeWorld('source-controls-actual','Bg.Hunter',true);changeMap(w,'crypt1');template=serialize(w.s)}
 const w:World={db,s:deserialize(template)},s=w.s,p=player(w),pos=s.map.waypoints!.conduitCrack,source=s.sources!.find(s=>s.id==='conduit')!,device=fieldDeviceAt(w,pos)!
 // 초기 장비·자재/현장 옆 위치다. 이전 채석/구매/접근을 실행했다고 주장하지 않는다.
 p.pos={x:pos.x-1,y:pos.y};p.nextAct=s.time;p.traits=[]
 for(const c of s.creatures)if(c.id!==p.id){c.asleep=true;c.nextAct=s.time+28800*100}
 const hammer=makeItem(w,'Item.IronHammer'),stones=makeItem(w,'Item.Stone',4)
 for(const it of [hammer,stones])if(addToBag(w,p,it))throw Error('initial source control supplies do not fit')
 const lamp=makeItem(w,'Item.Lantern');lamp.lit=true;p.equip.off=lamp
 invalidateLights(w);updatePlayerVision(w,p)
 const proof={phase,originalActorIds:s.creatures.map(c=>c.id),originalSourceCount:source.count,source:source.id,device:device.uid,hammer:hammer.uid,stones:stones.uid,declaredInitialSupplies:true,declaredInitialLantern:lamp.uid,notClaimingPriorMiningPurchaseApproachOrDungeonTravel:true}
 const finish=()=>({w,s,p,pos,source,device,hammer,stones,proof:{...proof,initialRendererFx:s.fx.splice(0)},act:(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(w,a,budget);if(e)throw Error(e)}})
 if(phase==='ready')return finish()
 if(phase==='pending'){const e=playerAct(w,{type:'deviceWork',pos,uid:device.uid,operation:'seal'},1);if(e)throw Error(e);return finish()}
 const error=startFieldDevice(w,p,pos,device.uid,'seal');if(error)throw Error(error)
 if(phase==='lastTurn'){
  // 명시적으로 남은1턴인 별도 초기 공사다. 이전399턴을 실행했다고 주장하지 않는다.
  device.work!.progress=399;stopActivity(w,p)
 }else{
  for(let i=0;i<10;i++)activityStep(w,p)
  if(phase==='paused')stopActivity(w,p)
  if(phase==='completed')for(let i=0;p.activity&&i<500;i++)activityStep(w,p)

 }
 if(tileAt(w,pos).device!==device)throw Error('original source control changed')
 return finish()
}
