// 휴식 R=100−피로. 실제 수면 부채가 있으면 가장 나쁜 단계다(03 §6).
import type {World} from './ctx'
import type {Creature,FatigueDef} from './types'
export const fatigueDef=(w:World)=>w.db.get<FatigueDef>('Fatigue.Survival')
export function fatigueAt(w:World,fatigue:number,debt=0){
 const d=fatigueDef(w)
 const index=debt>d.debtAbove?-1:d.stages.findIndex(b=>100-fatigue>=b.minRest)
 return d.stages[index<0?d.stages.length-1:index]!
}
export const fatigueBand=(w:World,c:Creature)=>fatigueAt(w,c.needs.fatigue,c.needs.sleepDebt??0)

export const fatigueStage=(w:World,c:Creature)=>fatigueDef(w).stages.indexOf(fatigueBand(w,c))
