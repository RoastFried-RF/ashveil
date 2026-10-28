// 04§14. 동물은 사기와 실제 상대 학습만 사용하며 인간 사고를 만들지 않는다.
import {hostile} from './diplomacy'
import {canSee} from './fov'
import {cheb,eq,type Pos} from './geom'
import {itemDef,lightSource} from './items'
import {knownCreatureName} from './bestiary-state'
import {log,player,turnOf,type World} from './ctx'
import type {Creature} from './types'
export function animalFearRules(w:World,c:Creature){const kind=w.db.body(c.body.def).kind;return kind==='humanoid'||kind==='mechanical'?undefined:w.db.creature(c.def).fireFear}
function torchThreats(w:World,c:Creature,from=c.pos){
 const d=animalFearRules(w,c);if(!d)return[]
 const viewer=from===c.pos?c:{...c,pos:from}
 return w.s.creatures.filter(o=>{if(!o.alive||o.id===c.id||cheb(from,o.pos)>d.radius||!hostile(w,c,o)||!canSee(w,viewer,o.pos))return false;const source=lightSource(w,o);return !!source&&!!itemDef(w,source.it).light?.openFlame})
}
export function animalRememberedThreats(w:World,c:Creature){
 if(!animalFearRules(w,c))return[]
 const now=turnOf(w),ids=new Set(c.animalFear?.filter(e=>e.until>now).map(e=>e.actor)??[])
 return ids.size?w.s.creatures.filter(o=>o.alive&&ids.has(o.id)&&hostile(w,c,o)&&canSee(w,c,o.pos)):[]
}
export function animalFearPenalty(w:World,c:Creature){const d=animalFearRules(w,c);return d?(torchThreats(w,c).length?d.torchPenalty:0)+(animalRememberedThreats(w,c).length?d.memoryPenalty:0):0}
export function expireAnimalFear(w:World,c:Creature){if(!c.animalFear)return;const now=turnOf(w);c.animalFear=c.animalFear.filter(e=>e.until>now);if(!c.animalFear.length)delete c.animalFear}
function remember(w:World,c:Creature,actor:number){
 const d=animalFearRules(w,c);if(!d)return false
 const now=turnOf(w),fresh=!c.animalFear?.some(e=>e.actor===actor&&e.until>now),list=(c.animalFear??[]).filter(e=>e.actor!==actor&&e.until>now)
 list.push({actor,until:now+d.memoryTurns});if(list.length>d.maxMemories)list.splice(0,list.length-d.maxMemories);c.animalFear=list;return fresh
}
export function learnTorchRetreat(w:World,c:Creature,from:Pos){
 const d=animalFearRules(w,c);if(!d||!c.alive||c.ai.mode!=='flee'||eq(from,c.pos))return
 const sources=torchThreats(w,c,from).filter(o=>cheb(c.pos,o.pos)>cheb(from,o.pos));let show=false
 for(const source of sources){
  const fresh=remember(w,c,source.id)
  for(const mate of w.s.creatures){
   if(mate.id===c.id||!mate.alive||mate.faction!==c.faction||cheb(mate.pos,c.pos)>d.packRadius||!animalFearRules(w,mate))continue
   const pack=c.room!==undefined&&c.room===mate.room||c.home&&mate.home&&eq(c.home,mate.home)
   if(pack&&canSee(w,mate,from)&&canSee(w,mate,source.pos))remember(w,mate,source.id)
  }
  if(fresh&&canSee(w,player(w),c.pos)&&canSee(w,player(w),source.pos))show=true
 }
 if(show)log(w,'info',knownCreatureName(w,c)+'이(가) 횃불을 피해 물러선다.')
}
