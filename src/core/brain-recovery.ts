// 실제 새 뇌 손상과 그 손상이 모두 아문 순간만 잇는다. 과거 상처의 최저HP를 추측하지 않는다.
import {bodyDef,partHealth} from './body'
import {rng,turnOf,type World} from './ctx'
import {rollPermanentLoss} from './permanent-loss'
import type {Creature,GrowthDef} from './types'
const rules=(w:World)=>w.db.get<GrowthDef>('Growth.Human').permanentLoss?.brain
export function recordBrainTrauma(w:World,c:Creature,part:string,wound:number){
 const r=rules(w),body=bodyDef(w,c),p=body.parts.find(p=>p.id===part)
 if(!r||!c.alive||body.kind!=='humanoid'||!p?.internal||!p.capacities?.consciousness)return
 const health=partHealth(w,c,part);if(health<=0||health>r.maxInjuryHp)return
 const existing=c.body.brainRecovery?.find(e=>e.part===part)
 if(existing)existing.lowestHp=Math.min(existing.lowestHp,health)
 else(c.body.brainRecovery??=[]).push({part,wound,at:turnOf(w),lowestHp:health})
}
export function finishBrainRecovery(w:World,c:Creature){
 if(!c.body.brainRecovery?.length||!c.alive||bodyDef(w,c).kind!=='humanoid')return
 const r=rules(w);if(!r){delete c.body.brainRecovery;return}
 const pending:NonNullable<Creature['body']['brainRecovery']>=[]
 for(const e of c.body.brainRecovery){
  if(c.body.wounds.some(wd=>wd.part===e.part)){pending.push(e);continue}
  const candidates=r.stats.filter(stat=>c.stats[stat]>1)
  if(candidates.length){const stat=rng(w,`body.permanent.${c.id}`).pick(candidates);rollPermanentLoss(w,c,{stat,chance:1},'뇌 손상 회복 후유증','brain:'+e.wound)}
 }
 if(pending.length)c.body.brainRecovery=pending;else delete c.body.brainRecovery
}
