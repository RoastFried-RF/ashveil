// 현재 실제 냄새를 맡을 수 있는 부패 시체만 읽는다. 지난 시간/냄새를 조회로 만들지 않는다.
import {bodyDef} from './body'
import {turnOf,type World} from './ctx'
import {cheb} from './geom'
import {smells} from './perception'
import {traitOverride} from './traits'
import type {Creature,ThoughtDef} from './types'
export function corpseOdorThoughts(w:World,c:Creature){
 if(!c.alive||bodyDef(w,c).kind!=='humanoid')return[]
 const now=turnOf(w),out:{def:string;label:string;mood:number;count:number}[]=[]
 for(const d of w.db.all<ThoughtDef>('Thought')){
  const rule=d.corpseOdor;if(!rule)continue
  const mood=rule.traitMoodKey?traitOverride(w,c,rule.traitMoodKey)??d.mood:d.mood
  if(!mood||!w.s.creatures.some(body=>!body.alive&&body.id!==c.id&&bodyDef(w,body).kind!=='mechanical'&&body.deathTurn!==undefined&&now-body.deathTurn>=rule.minAgeTurns&&cheb(c.pos,body.pos)<=rule.radius&&smells(w,c,body)))continue
  out.push({def:d.id,label:d.label,mood,count:1})
 }
 return out
}
