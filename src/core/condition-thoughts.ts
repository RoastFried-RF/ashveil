// 현재 상태를 순수 조회한다. 조건 사고는 기억·난수·시간·UID를 만들지 않는다.
import {latentBiteClues} from './disease-state'
import {canReach} from './combat'
import {hostile} from './diplomacy'
import {capacity} from './body'
import {anatomicalMissing,bloodLoss,painStage,painTotal,tryPart} from './body'
import {innerWetness} from './thermal'
import {tileAt,turnOf,TURNS_PER_HOUR,type World} from './ctx'
import {isRaining} from './environment'
import {canSee,hasLos,lightLevel} from './fov'
import {cheb} from './geom'
import type {Creature,ThoughtDef,ThoughtRange} from './types'

export function conditionThoughts(w:World,c:Creature):string[]{
 const values:Partial<Record<ThoughtRange['metric'],number>>={}
 const read=(metric:ThoughtRange['metric'])=>{
  if(values[metric]!==undefined)return values[metric]!
  const n=c.needs,turn=turnOf(w)
  let value:number
  switch(metric){
   case 'bodyTemp':value=n.bodyTemp;break
   case 'innerWetness':value=innerWetness(w,c);break
   case 'painStage':value=painStage(painTotal(w,c));break
   case 'rest':value=100-n.fatigue;break
   case 'sleepDebt':value=n.sleepDebt??0;break
   case 'hygiene':value=w.s.hygieneEnabled===false?70:n.hygiene;break
   case 'bloodLoss':value=bloodLoss(c);break
   case 'knownInfection':case 'woundInfection':value=Math.max(0,...c.body.wounds.filter(wd=>!anatomicalMissing(w,c,wd.part)&&(metric==='woundInfection'||!wd.internal&&!tryPart(w,c,wd.part)?.internal)).map(wd=>wd.infection?.progress??0));break
   case 'fever':value=Math.max(0,...c.effects.filter(e=>e.kind==='fever'&&e.untilTurn>turn).map(e=>e.magnitude??0));break
   case 'tourniquetHours':value=Math.max(0,...Object.values(c.body.tourniquets).map(at=>Math.max(0,turn-at)/TURNS_PER_HOUR));break
   case 'frostbiteGrade':value=Math.max(0,...Object.entries(c.frostbite??{}).filter(([id])=>!anatomicalMissing(w,c,id)).map(([,f])=>f.grade));break
   case 'restFireDistance':value=c.asleep||c.activity?.kind==='rest'||c.activity?.kind==='sleep'?Math.min(Infinity,...w.s.map.lights.filter(l=>l.kind==='campfire'&&!l.off&&(l.fuelUntil===undefined||l.fuelUntil>turn)&&hasLos(w,c.pos,l.pos)).map(l=>cheb(c.pos,l.pos))):Infinity;break
   case 'ashExposure':value=isRaining(w)&&!tileAt(w,c.pos).roof?1:0;break
   case 'lightLevel':value=lightLevel(w,c.pos);break
   case 'latentBiteAche':value=latentBiteClues(w,c).length;break
   case 'adjacentThreats':value=w.s.creatures.filter(o=>o.id!==c.id&&o.alive&&!o.asleep&&!o.unconscious&&!o.captivity&&o.ai.mode!=='surrender'&&o.breakdown?.kind!=='catatonia'&&capacity(w,o,'consciousness')>=.3&&cheb(c.pos,o.pos)<=1&&hostile(w,c,o)&&canSee(w,c,o.pos)&&canReach(w,o,c)).length;break
  }
  values[metric]=value
  return value
 }
 return w.db.all<ThoughtDef>('Thought').filter(d=>d.condition?.any.some(all=>all.every(b=>{
  const value=read(b.metric)
  return (b.min===undefined||(b.minExclusive?value>b.min:value>=b.min))&&(b.max===undefined||(b.maxInclusive?value<=b.max:value<b.max))
 }))).map(d=>d.id)
}
