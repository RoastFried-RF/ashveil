// 02 §10 실제 국소 감염과 전신의 가장 심한 한 단계. 조회는 상태를 바꾸지 않는다.
import type {World} from './ctx'
import type {Creature,InfectionStage,RecoveryDef,Wound} from './types'
export const infectionStages=(w:World)=>w.db.get<RecoveryDef>('Recovery.Wounds').infectionStages!
export function infectionAt(w:World,progress:number):InfectionStage{
 const stages=infectionStages(w)
 let result=stages[0]!
 for(const stage of stages){if(stage.at>progress)break;result=stage}
 return result
}
export const infectionFor=(w:World,wd:Wound)=>infectionAt(w,wd.infection?.progress??0)
export const infectionSystemic=(w:World,c:Creature)=>infectionAt(w,c.body.wounds.reduce((p,wd)=>Math.max(p,wd.infection?.progress??0),0))
