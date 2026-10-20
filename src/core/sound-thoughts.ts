// 실제 음향 전파를 통과한 의식 있는 청자만 잠깐의 기계음 인지를 저장한다.
import {bodyDef} from './body'
import {isCompanion} from './companion-state'
import {turnOf,type World} from './ctx'
import {traitOverride} from './traits'
import type {Creature,ThoughtDef} from './types'
export function recordHeardThoughts(w:World,c:Creature,source:Creature|undefined){
 if(!source||!source.alive||!w.s.creatures.includes(source)||isCompanion(w,source)||!c.alive||c.asleep||c.unconscious||bodyDef(w,c).kind!=='humanoid')return
 const now=turnOf(w),defs=w.db.all<ThoughtDef>('Thought').filter(d=>d.heardSound?.faction===source.faction&&d.heardSound.bodyKind===bodyDef(w,source).kind)
 if(!defs.length)return
 const rows=(c.heardThoughts??[]).filter(row=>row.until>now&&w.db.tryGet<ThoughtDef>(row.def)?.heardSound)
 for(const d of defs){const row=rows.find(row=>row.def===d.id),until=now+d.heardSound!.recentTurns;if(row)row.until=until;else rows.push({def:d.id,until})}
 c.heardThoughts=rows
}
export function heardSoundThoughts(w:World,c:Creature){
 const now=turnOf(w),out:{def:string;label:string;mood:number;count:number}[]=[],seen=new Set<string>()
 for(const row of c.heardThoughts??[]){
  const d=w.db.tryGet<ThoughtDef>(row.def)
  if(row.until<=now||!d?.heardSound||seen.has(d.id))continue
  seen.add(d.id);const mood=d.heardSound.traitMoodKey?traitOverride(w,c,d.heardSound.traitMoodKey)??d.mood:d.mood
  out.push({def:d.id,label:d.label,mood,count:1})
 }
 return out
}
