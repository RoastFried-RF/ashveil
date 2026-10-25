import {log,player,turnOf,type World} from './ctx'
import {canSee} from './fov'
import type {Creature} from './types'

/** Paused plans retain their exact history and never resume without another explicit review. */
export function pauseCompanionCarePlan(w:World,c:Creature,reason:string){
 const plan=c.companion?.carePlan
 if(!plan||!['running','waiting'].includes(plan.status))return
 plan.status='paused';plan.reason=reason;plan.updatedAt=turnOf(w)
 const observer=player(w)
 if(observer.alive&&!observer.asleep&&!observer.unconscious&&w.s.creatures.includes(c)&&(c.mapId===undefined||c.mapId===w.s.map.id)&&canSee(w,observer,c.pos))log(w,'warn',`${c.name}의 처치 순서 중단 (${plan.cursor}/${plan.steps.length} 완료): ${reason}. 남은 처치는 다시 확인해야 한다.`)
}
