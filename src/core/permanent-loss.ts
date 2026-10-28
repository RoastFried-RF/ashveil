// 새로 관찰한 연속 굶주림과 실제 면역 회복만 영구 능력치 변화의 원인이 된다.
import {bodyDef,hpMax,energyMax} from './body'
import {log,rng,turnOf,type World} from './ctx'
import {hungerStage} from './nutrition-state'
import type {Creature,GrowthDef,PermanentLossRule,Stats} from './types'
const rules=(w:World)=>w.db.get<GrowthDef>('Growth.Human').permanentLoss
const labels:Record<keyof Stats,string>={str:'근력',agi:'민첩',vit:'활력',per:'지각',wil:'의지'}
export function rollPermanentLoss(w:World,c:Creature,rule:PermanentLossRule,reason:string,source:string):boolean{
 if(!c.alive||bodyDef(w,c).kind!=='humanoid'||c.stats[rule.stat]<=1||c.permanentChanges?.some(x=>x.source===source)||!rng(w,`body.permanent.${c.id}`).chance(rule.chance))return false
 const before=c.stats[rule.stat];c.stats[rule.stat]=Math.max(1,before-1);c.hp=Math.min(c.hp,hpMax(w,c));c.needs.energy=Math.min(c.needs.energy,energyMax(w,c))
 const at=turnOf(w),text=reason+' 때문에 '+labels[rule.stat]+(rule.stat==='wil'?'가':'이')+' 영구적으로 1 줄었다.'
 ;(c.permanentChanges??=[]).push({at,stat:rule.stat,before,after:c.stats[rule.stat],reason,source});c.history.push({turn:at,kind:'permanentLoss',text})
 if(c.id===w.s.playerId)log(w,'warn',text)
 return true
}
export function severeHunger(w:World,c:Creature):boolean{const r=rules(w)?.starvation;return !!r&&hungerStage(w,c)>=r.stage}
export function observeSevereHunger(w:World,c:Creature,severeBefore:boolean){
 const r=rules(w)?.starvation,n=c.needs,now=turnOf(w)
 if(!r||!c.alive||bodyDef(w,c).kind!=='humanoid'||!severeHunger(w,c)){delete n.starvationEpisode;return}
 let e=n.starvationEpisode
 if(e?.lastAt===now)return
 if(!e||e.lastAt!==now-1||!severeBefore)e=n.starvationEpisode={since:severeBefore?now-1:now,lastAt:now}
 else e.lastAt=now
 if(e.rolledAt!==undefined||now-e.since<=r.turns)return
 e.rolledAt=now;rollPermanentLoss(w,c,r.rule,'오래 이어진 심한 굶주림','starvation:'+e.since)
}
export function diseaseRecoveryLoss(w:World,c:Creature,disease:string,startedAt:number){
 const r=rules(w)?.diseases[disease];if(r)rollPermanentLoss(w,c,r,w.db.get(disease).label+' 회복 후유증','disease:'+disease+':'+startedAt)
}
