// 실제로 새로 잃은 부위만 기억한다. 과거 결손/의수족 조회에는 호출하지 않는다.
import type {World} from './ctx'
import {rememberLifeEvent} from './life-memories'
import {addThought} from './thoughts'
import type {BodyPartDef,Creature} from './types'
export function rememberPartLoss(w:World,c:Creature,p:BodyPartDef){
 if(p.groups.includes('finger'))rememberLifeEvent(w,c,'fingerLoss')
 else if(p.limb&&!p.digit)rememberLifeEvent(w,c,'limbLoss')
 else addThought(w,c,'Thought.Maimed')
}
