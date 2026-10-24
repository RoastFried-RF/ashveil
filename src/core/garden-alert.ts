/** Actual bounded reports raise the same regional garden alert, never reinforcements. */
import {turnOf,type World} from './ctx'
import type {Pos} from './geom'
import type {Creature,GardenAlertState} from './types'

export function gardenAlertState(w:World,p=w.s.map.worldCell??w.s.overworld?.position):GardenAlertState|undefined{
 return w.s.overworld&&p?w.s.overworld.gardenAlerts?.[p.x+','+p.y]:w.s.map.gardenAlert
}
export function recordGardenReport(w:World,source:Creature,target:Creature){
 const p=w.s.map.worldCell??w.s.overworld?.position
 const state=w.s.overworld&&p?((w.s.overworld.gardenAlerts??={})[p.x+','+p.y]??={level:0,events:[]}):(w.s.map.gardenAlert??={level:0,events:[]})
 if(state.level>=3)return false
 state.level++;state.events.push({at:turnOf(w),source:source.id,target:target.id,sourcePos:{...source.pos},targetPos:{...target.pos},level:state.level});state.events=state.events.slice(-32);return true
}
export function reportedGardenAlert(w:World,p?:Pos){return gardenAlertState(w,p)?.level??0}
