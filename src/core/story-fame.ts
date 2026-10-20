// 새로 실제 끝낸 승리만 기록한다. 구형 각인의 과거 처치/인구를 명성으로 역산하지 않는다.
import {clamp,player,turnOf,TURNS_PER_DAY,type World} from './ctx'
import {storyDirectorRule} from './story-director'
import type {Creature} from './types'
export function recordStoryVictory(w:World,target:Creature,depletedSources:readonly string[],playerContribution:boolean){
 const state=w.s.storyteller.director,rule=storyDirectorRule(w)?.fame,now=turnOf(w)
 if(!state||!rule||!playerContribution||target.alive||target.deathTurn!==now||!w.s.creatures.includes(target)||!player(w).alive||target.id===w.s.playerId)return
 const awards:{key:string;amount:number}[]=[]
 for(const award of rule.awards){
  if(award.creatures?.includes(target.def))awards.push({key:award.key+':person:'+target.id,amount:award.amount})
  if(award.source)for(const id of depletedSources){const source=w.s.sources?.find(s=>s.id===id&&s.kind!=='residents'&&s.deployed&&s.count===0&&s.floors.includes(w.s.map.id));if(source)awards.push({key:award.key+':source:'+id,amount:award.amount})}
 }
 if(!awards.length)return
 const fame=state.fame??={value:0,lastDecayAt:now,credited:[]}
 for(const award of awards)if(!fame.credited.includes(award.key)){fame.credited.push(award.key);fame.value=clamp(fame.value+award.amount,0,100)}
}
export function storyFameTick(w:World){
 const fame=w.s.storyteller.director?.fame,rule=storyDirectorRule(w)?.fame,now=turnOf(w)
 if(!fame||!rule||now<fame.lastDecayAt)return
 const weeks=Math.floor((now-fame.lastDecayAt)/(7*TURNS_PER_DAY));if(!weeks)return
 fame.value=Math.max(0,fame.value-weeks*rule.weeklyDecay);fame.lastDecayAt+=weeks*7*TURNS_PER_DAY
}
