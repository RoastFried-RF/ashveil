// 실제 새 사건의 당사자만 저장한다. 과거의 주체를 현재 플레이어로 추정하지 않는다.
import type {World} from './ctx'
import type {Creature,RumorSubject} from './types'
export const rumorSubject=(w:World,c:Creature):RumorSubject=>({id:c.id,name:c.name,seed:w.s.seed})
export const reputationOrigin=(w:World,c:Creature)=>({subject:rumorSubject(w,c),regionId:w.s.overworld?.currentRegion})
