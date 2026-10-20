// 실제 잠든 턴의 품질/침구/내의 젖음을 관찰하고 기상 때 한 번 기억한다.
import {terrainAt,type World} from './ctx'
import {innerWetness} from './thermal'
import {addThought} from './thoughts'
import type {Creature,ThoughtDef} from './types'
const QUALITY_SCALE=1000000
export function observeSleep(w:World,c:Creature,quality:number){
 if(c.faction!=='player'||!c.asleep||c.activity?.kind!=='sleep')return
 const o=c.sleepObservation??={turns:0,qualityMicros:0,ground:false,maxInnerWetness:0}
 o.turns++;o.qualityMicros+=Math.round(quality*QUALITY_SCALE)
 o.ground ||= !terrainAt(w,c.pos).bedding
 o.maxInnerWetness=Math.max(o.maxInnerWetness,innerWetness(w,c))
}
export function finishSleepMemories(w:World,c:Creature){
 const o=c.sleepObservation;delete c.sleepObservation
 if(!o||o.turns<=0||!c.alive||c.faction!=='player')return
 for(const d of w.db.all<ThoughtDef>('Thought')){
  const qualifies=d.sleepEvent==='quality'?o.qualityMicros>=Math.round(d.minSleepQuality!*QUALITY_SCALE)*o.turns:d.sleepEvent==='ground'?o.ground:d.sleepEvent==='wet'?o.maxInnerWetness>=d.minSleepWetness!:false
  if(qualifies)addThought(w,c,d.id)
 }
}
