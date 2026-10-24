import type {Action,World,Activity} from '../../core'
import {itemDef} from '../../core'
import {takeActionObservations} from '../../core/action-observations'
import {actionMotions} from './action-motion-map'
import type {ActionPose,MotionName} from './character-motion'
import type {Dir} from './atlas'

export interface ActionPresentation {machineTask?:'sow'|'spray'|'alarm';actor:number;kind:ActionPose;prop?:string;direction?:Dir}
function actionMotion(w:World,action:Action,actor:World['s']['creatures'][number]):ActionPose|null{
 if(action.type!=='ability')return actionMotions[action.type]
 const ability=w.db.ability(action.id)
 if(ability.stance)return'block'
 if(ability.attack&&actor.equip.main&&itemDef(w,actor.equip.main).ranged)return'shoot'
 // Melee abilities already emit the authoritative attack FX.
 if(ability.attack||ability.lunge||ability.sweep)return null
 return ability.burst||ability.grab?'attack':'use'
}
export function takeActionPresentations(w:World,resolvedAttacks:ReadonlySet<number>=new Set()){
 const latest=new Map<number,ActionPresentation>()
 for(const observation of takeActionObservations(w)){
  const actor=w.s.creatures.find(c=>c.id===observation.id)
  if(!actor||actor.id!==w.s.playerId&&(!w.s.visible.includes(actor.pos.y*w.s.map.w+actor.pos.x)||observation.at<w.s.time-100))continue
  let kind=actionMotion(w,observation.action,actor);if(!kind)continue
  if(kind==='shoot'){
   if(observation.activity==='reload'||observation.activity==='magazineReload')kind='work'
   else continue // Actual release uses attack FX, including NPC and channeled shots.
  }
  if(kind==='attack'&&resolvedAttacks.has(actor.id))continue
  const dx=observation.target?observation.target.x-actor.pos.x:0,dy=observation.target?observation.target.y-actor.pos.y:0
  let direction:Dir|undefined=dx>0?'right':dx<0?'left':dy<0?'up':dy>0?'down':undefined
  const sower=w.db.creature(actor.def).sower,machineTask=sower?(observation.action.type==='place'&&observation.item?.def===sower.seedItem?'sow':observation.action.type==='sowerSpray'?'spray':observation.action.type==='sowerAlarm'?'alarm':undefined):undefined
  if(machineTask)direction=actor.facing===0?'up':actor.facing===4?'down':actor.facing<4?'right':'left'
  latest.set(actor.id,{actor:actor.id,kind,direction,machineTask,prop:observation.item&&!sower&&!w.db.creature(actor.def).wildlife?itemDef(w,observation.item).sprite:undefined})
 }
 return[...latest.values()]
}

/** Visible continuous activities reuse physical families, not new game rules. */
const activityMotions={
 survey:'work',
 rescueDrag:'work',clearBrush:'work',magazineReload:'work',firearmCare:'work',pryContainer:'work',excavate:'work',ransom:'interact',ransomWait:'idle',washBedding:'work',brewTea:'work',gatherNeedles:'work',foodMeal:'use',openFood:'work',respirator:'use',waterRescue:'work',beaconWork:'work',parasiteRemoval:'use',boatCare:'work',discloseEvidence:'interact',deviceWork:'work',machineCare:'work',gearSwap:'use',fire:'work',claimBase:'interact',recruitInvite:'interact',recruit:'interact',recruitWait:'idle',struggle:'hurt',prisoner:'work',pray:'use',rest:'idle',sleep:'sleep',search:'interact',examine:'use',press:'use',equip:'use',unequip:'use',treat:'work',aim:'shoot',strip:'work',read:'use',cook:'work',dry:'idle',drawMap:'work',drawWorldMap:'work',craft:'work',repair:'work',salvage:'work',gather:'work',gearCare:'work',reload:'work',wash:'use',water:'work',prosthetic:'work',travel:'walk',breakIce:'work',collectSnow:'work',medicate:'work',taste:'use',dissect:'work',careWait:'idle',diagnose:'work',dose:'work',washHands:'use',teach:'interact',lessonWait:'idle',warm:'idle',packFurniture:'work',
}as const satisfies Record<Activity['kind'],MotionName>
export function activityMotion(activity:Activity|undefined):MotionName|null{return activity?activityMotions[activity.kind]:null}
