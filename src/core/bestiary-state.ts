import { canSee } from './fov'
import { createBody } from './body'
// 도감의 단계·종 공유·수치 범위. 표시 조회는 상태/RNG를 바꾸지 않는다.
import { player, type World } from './ctx'
import { effectiveStat } from './traits'
import type { BestiaryDef, BestiaryEntryDef, BestiaryRecord, Creature } from './types'
export const bestiaryDef=(w:World)=>w.db.get<BestiaryDef>('Bestiary.Human')
const indexes=new WeakMap<World['db'],Map<string,BestiaryEntryDef>>()
export function bestiaryEntry(w:World,creature:string):BestiaryEntryDef|undefined {
 let map=indexes.get(w.db)
 if(!map){map=new Map();for(const d of w.db.all<BestiaryEntryDef>('BestiaryEntry'))for(const id of d.creatures)map.set(id,d);indexes.set(w.db,map)}
 return map.get(creature)
}
export function bestiaryRecords(w:World,creature:string,observer=player(w)):BestiaryRecord[]{const records=observer.id===w.s.playerId?w.s.knowledge.bestiary:observer.bestiary??{};return (bestiaryEntry(w,creature)?.creatures??[creature]).map((id)=>records[id]).filter((b):b is BestiaryRecord=>!!b)}
export function bestiaryKnown(w:World,id:string,observer=player(w)):boolean {
 return bestiaryRecords(w,id,observer).some((b)=>(b.observeTurns??b.seen)>0||(b.encounters??0)>0||b.survived===true||b.survived===undefined&&b.fought>0||b.killed>0||(b.dissected??0)>0||!!b.literature?.length)
}
export function bestiaryStage(w:World,creature:string,observer=player(w)):number {
 const all=bestiaryRecords(w,creature,observer),d=bestiaryDef(w)
 if(all.some((b)=>b.literature?.length))return 4
 if(all.some((b)=>(b.dissected??0)>0))return 3
 if(all.some((b)=>b.survived===true||b.killed>0||b.survived===undefined&&b.fought>0))return 2
 if(all.some((b)=>(b.observeTurns??b.seen)>=d.observeTurns||(b.encounters??0)>=d.encounterCount))return 1
 return 0
}
export function ensureBestiary(w:World,id:string,observer=player(w)):BestiaryRecord {
 const records=observer.id===w.s.playerId?w.s.knowledge.bestiary:(observer.bestiary??={})
 return records[id]??=( {seen:0,fought:0,killed:0,observeTurns:0,encounters:0,survived:false} )
}
export function knownCreatureName(w:World,c:Creature):string {
 const entry=bestiaryEntry(w,c.def)
 if(c.id===w.s.playerId||c.met||!entry||bestiaryStage(w,c.def)>0)return c.name
 const visible=canSee(w,player(w),c.pos),silhouette=entry.silhouette.replace(/의 실루엣$/u,'')
 return bestiaryKnown(w,c.def)||visible?(visible&&c.biteCarrier?'입에 거품 문 ':'')+silhouette:'정체 모를 존재'
}
export function bestiaryRange(w:World,observer:Creature,value:number,stage:number,step=100):[number,number]|null {
 if(stage===0)return null
 if(stage>=3)return [value,value]
 const d=bestiaryDef(w),keen=observer.traits.includes('Trait.KeenEyed')?d.keenRange:0
 const width=Math.max(0,d.rangeWidth[stage-1]*(1-(effectiveStat(w,observer,'per')-10)*d.perRange)-keen)
 return [Math.max(0,Math.round(value*(1-width)/step)*step),Math.max(step,Math.round(value*(1+width)/step)*step)]
}
export function learnBestiary(w:World,entryId:string,source:string,observer=player(w)) {
 const entry=w.db.get<BestiaryEntryDef>(entryId)
 for(const id of entry.creatures){const b=ensureBestiary(w,id,observer);if(!(b.literature??=[]).includes(source))b.literature.push(source)}
}
export function speciesDissections(w:World,creature:string,observer=player(w)):number{return bestiaryRecords(w,creature,observer).reduce((sum,b)=>sum+(b.dissected??0),0)}
export function bestiaryProgress(w:World,creature:string,observer=player(w)):string {
 const stage=bestiaryStage(w,creature,observer),all=bestiaryRecords(w,creature,observer),d=bestiaryDef(w)
 if(stage===0)return `관찰${Math.max(0,...all.map((b)=>b.observeTurns??b.seen))}/${d.observeTurns}턴 · 조우${Math.max(0,...all.map((b)=>b.encounters??0))}/${d.encounterCount}회`
 if(stage===1)return '다음: 교전 뒤 살아서 벗어나거나 상대를 쓰러뜨리기'
 if(stage===2)return '다음: 사체 해부 성공'
 if(stage===3)return `해부 성공${speciesDissections(w,creature,observer)}/${d.autoDissectAfter}회 · 다음: 관련 문헌`
 return '문헌으로 습성과 행동을 익혔다'
}

function referenceSpecimen(w:World,id:string,observer:Creature) {
 const stage=bestiaryStage(w,id,observer),records=bestiaryRecords(w,id,observer)
 const ordered=records.filter((b)=>b.specimen).sort((a,b)=>(b.dissected??0)-(a.dissected??0))
 const exact=ordered.find((b)=>b.specimen!.def===id)?.specimen
 if(exact)return exact
 if(stage<4&&ordered[0]?.specimen)return ordered[0].specimen
 const def=w.db.creature(id),body=createBody(w.db.body(def.body),def)
 return {def:id,blood:body.bloodMax,maxHp:body.maxHp}
}
export function bestiaryDetails(w:World,id:string,observer=player(w)):string[] {
 const entry=bestiaryEntry(w,id),stage=bestiaryStage(w,id,observer)
 if(stage===0)return bestiaryKnown(w,id,observer)?[entry?.silhouette??'정체를 모른다',bestiaryProgress(w,id,observer)]:['아직 관찰하지 못했다']
 const def=w.db.creature(id),lines=[`S${stage} · ${['','관찰','전투','해부','문헌'][stage]}`]
 {const range=bestiaryRange(w,observer,referenceSpecimen(w,id,observer).blood,stage)!;lines.push(`혈액 ${range[0]===range[1]?range[0]:`약 ${range[0]}~${range[1]}`}ml`)}
 lines.push(`이동 ${def.moveTU<100?'빠름':def.moveTU>100?'느림':'보통'}`)
 if(def.naturalAttack)lines.push(`공격 수단: ${def.naturalAttack.label}${stage>=2?` · ${ {cut:'베기',stab:'찌르기',blunt:'타격',bite:'물기',burn:'화상',gunshot:'총상'}[def.naturalAttack.damageType]}`:''}`)
 if(stage>=2 && def.damageTaken){const weak=Object.entries(def.damageTaken).filter(([,n])=>n>1).map(([kind])=>({cut:'베기',stab:'찌르기',blunt:'타격',bite:'물기',burn:'화상',gunshot:'총상'})[kind as import('./types').DamageType]);if(weak.length)lines.push(`약점 피해: ${weak.join(', ')}`)}
 lines.push(...(def.bestiary??[]).slice(0,Math.min(3,stage)))
 if(stage>=4)lines.push(...entry?.facts??[])
 lines.push(bestiaryProgress(w,id,observer));return lines
}
export function bestiaryBody(w:World,id:string,observer=player(w)):string[] {
 const stage=bestiaryStage(w,id,observer)
 if(!stage)return []
 const sample=referenceSpecimen(w,id,observer),body=w.db.body(w.db.creature(sample.def).body)
 return body.parts.filter((p)=>stage>=3||!p.internal).map((p)=>{
  const max=sample.maxHp[p.id]??p.hp,range=bestiaryRange(w,observer,max,stage,1)!
  return `${p.parent?'↳ ':''}${p.label}${p.internal?' (내부)':''} · HP ${range[0]===range[1]?range[0]:`${range[0]}~${range[1]}`}${stage>=3&&p.artery?` · 동맥${p.artery}ml/턴`:''}`
 })
}

/** 상대의 내부 HP/출혈 계수는 해부 전 기록에 직접 공개하지 않는다. 판정 공식은 유지한다. */
export function bestiaryCombatDetails(w:World,target:Creature,lines:string[]):string[] {
 if(target.id===w.s.playerId||bestiaryStage(w,target.def)>=3)return lines
 const stage=bestiaryStage(w,target.def)
 return lines.flatMap((line)=>{
  if(/^(HP |심각도 |출혈 |→ .* 관통)/u.test(line))return []
  if(line.startsWith('골절 판정'))return ['골절 판정: (피해 − 뼈 강도) × 8']
  if(stage<2&&line.startsWith('부위:'))return ['부위 적중: 겉으로 보이는 위치']
  return [line]
 })
}
