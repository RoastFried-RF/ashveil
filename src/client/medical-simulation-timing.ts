/** Client pacing only; Core receives its existing deterministic TU boundary. */
import {TU_PER_TURN,player,type World} from '../core'
import {isMedicalActivity} from './render/medical-presentation'
export function medicalSimulationTiming(w:World,speed:number,starting=false){
 if(speed===0)return{untilTU:undefined,delayMs:0}
 const p=player(w),visible=w.s.creatures.filter(c=>c.alive&&(c.id===p.id||w.s.visible.includes(c.pos.y*w.s.map.w+c.pos.x))),active=visible.some(c=>isMedicalActivity(c.activity)),waiting=visible.some(c=>c.companion?.carePlan?.status==='waiting')
 return{untilTU:starting||active||waiting?w.s.time+TU_PER_TURN:undefined,delayMs:active?140/speed:0}
}
