/** A real resolved attack can be noticed even if it misses or armor absorbs it. */
import {capacity} from './body'
import {turnOf,type World} from './ctx'
import {canSee} from './fov'
import {machineReady} from './machine-state'
import type {Creature,SowerRules,SowerState} from './types'
export const initialSowerState=(rule:SowerRules):SowerState=>({rule:JSON.stringify(rule),routeIndex:0,moves:0,seedsSpent:0,resumeAt:0,alarmWound:0})
export function observeSowerAssault(w:World,source:Creature,target:Creature){
 const rule=w.db.creature(target.def).sower
 if(!rule||!target.alive||target.unconscious||target.asleep||!machineReady(w,target)||capacity(w,target,'consciousness')<.3||source.id===target.id)return
 if(target.sowerState&&target.sowerState.rule!==JSON.stringify(rule))return
 const state=target.sowerState??=initialSowerState(rule)
 state.assault={serial:(state.assault?.serial??0)+1,at:turnOf(w),...(canSee(w,target,source.pos)?{seen:{id:source.id,pos:{...source.pos}}}:{})}
}
