import {conditionThoughtsFixture} from './condition-thoughts-fixture'
import {addToBag,makeItem} from '../src/core/items'
import {tileAt,turnOf} from '../src/core/ctx'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {addWound} from '../src/core/body'
import {createCreature} from '../src/core/creatures'
import {playerAct} from '../src/core/game'
export function restorationFixture(seed='restoration-success'){
 const d=conditionThoughtsFixture(seed)
 d.p.stats={str:10,agi:10,per:11,vit:10,wil:10};d.p.literacy=2;d.p.background='Bg.Scavenger'
 const add=(id:string,count=1)=>{const it=makeItem(d.w,id,count);if(addToBag(d.w,d.p,it))throw Error('initial finite restoration bag');return it}
 tileAt(d.w,{x:d.p.pos.x+1,y:d.p.pos.y}).t='Terrain.Artisan'
 const fire={x:d.p.pos.x,y:d.p.pos.y+2};tileAt(d.w,fire).t='Terrain.Campfire';d.s.map.lights=[{pos:fire,kind:'campfire',radius:6,fuelUntil:turnOf(d.w)+10000}]
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,add}
}
export function relicRepairFixture(seed='restoration-success'){
 const d=restorationFixture(seed),relic=d.add('Item.PioneerArm'),parts=d.add('Item.SmallActuator',3),hammer=d.add('Item.IronHammer')
 relic.durability=20
 return {...d,relic,parts,hammer}
}
export type RestorationPhase='bandage'|'low'|'suture'|'machine'|'relic'|'broken'|'pending'
export function restorationNativeFixture(phase:RestorationPhase){
 const d=phase==='relic'||phase==='pending'||phase==='broken'?relicRepairFixture(phase==='broken'?'restoration':'restoration-success'):restorationFixture(),initialTime=d.s.time
 const act=(a:Parameters<typeof playerAct>[1],budget?:number)=>{const e=playerAct(d.w,a,budget);if(e)throw Error(e)}
 let medicalUid:number|undefined,woundId:number|undefined,machineId:number|undefined,relicUid:number|undefined,partsUid:number|undefined,hammerUid:number|undefined,needleUid:number|undefined,appraisalTurns:number|undefined
 if(phase==='relic'||phase==='pending'||phase==='broken'){
  const x=d as ReturnType<typeof relicRepairFixture>;relicUid=x.relic.uid;partsUid=x.parts.uid;hammerUid=x.hammer.uid
  const start=d.s.time;act({type:'examine',uid:x.relic.uid});appraisalTurns=(d.s.time-start)/100
  act({type:'repair',uid:x.relic.uid},phase==='pending'?2:undefined)
 }else if(phase==='machine'){
  const machine=createCreature(d.w,'Creature.TenderDrone',{x:d.p.pos.x-1,y:d.p.pos.y});machine.faction='player';machine.nextAct=1e12;d.s.creatures.push(machine);machineId=machine.id
  const wd=addWound(d.w,machine,{def:'Wound.Stab',part:'DriveLeg1',severity:14,source:'초기 실제 기계 손상'}).wound;woundId=wd.id
  const parts=d.add('Item.SmallActuator'),hammer=d.add('Item.IronHammer');partsUid=parts.uid;hammerUid=hammer.uid
  act({type:'machineCare',target:machine.id,operation:'repair',uid:parts.uid,part:wd.part})
 }else{
  d.p.background=undefined;d.p.stats.per=phase==='low'?10:20
  const wd=addWound(d.w,d.p,{def:'Wound.Cut',part:'LeftShin',severity:2,source:'초기 실제 치료 상처'}).wound;woundId=wd.id
  const medical=d.add(phase==='suture'?'Item.Thread':'Item.Bandage',phase==='suture'?3:1);medicalUid=medical.uid
  if(phase==='suture')needleUid=d.add('Item.Needle').uid
  act({type:'treat',uid:medical.uid,woundId:wd.id})
 }
 invalidateLights(d.w);updatePlayerVision(d.w,d.p)
 return {...d,proof:{phase,initialTime,actualTurns:(d.s.time-initialTime)/100,medicalUid,woundId,machineId,relicUid,partsUid,hammerUid,needleUid,appraisalTurns,pending:phase==='pending'}}
}
