import type {RngStream} from './rng'
// 잠복/치료가 끝난 질병은 기능 능력치에 영향을 주지 않는다. 조회로 상태를 바꾸지 않는다.
import {turnOf,type World} from './ctx'
import type {Creature,DiseaseDef,Wound} from './types'
export function activeDiseases(w:World,c:Creature){
 if(w.db.body(c.body.def).kind==='mechanical')return[]
 return(c.diseases??[]).filter(s=>s.incubatesUntil<=turnOf(w)&&s.immunity<100).map(s=>({s,d:w.db.get<DiseaseDef>(s.def)}))
}
export function latentBiteClues(w:World,c:Creature){
 if(w.db.body(c.body.def).kind==='mechanical')return[]
 return(c.diseases??[]).flatMap(s=>{
  const d=w.db.get<DiseaseDef>(s.def),source=s.source
  if(!d.latentScarPain||s.immunity>=100||s.incubatesUntil<=turnOf(w)||!source?.part||source.wound===undefined)return[]
  const wound=c.body.wounds.find(wd=>wd.id===source.wound||wd.mergedIds?.includes(source.wound!))
  if(wound&&wound.healed<wound.severity)return[]
  return[{part:source.part,pain:d.latentScarPain}]
 })
}
export const latentBiteLines=(w:World,c:Creature)=>latentBiteClues(w,c).map(x=>(w.db.body(c.body.def).parts.find(p=>p.id===x.part)?.label??x.part)+' · 아문 물린 자리가 쑤신다.')
export const diseasePain=(w:World,c:Creature)=>activeDiseases(w,c).reduce((sum,{d})=>sum+(d.clinical?.pain??0),0)+latentBiteClues(w,c).reduce((sum,x)=>sum+x.pain,0)
export const diseaseEatMultiplier=(w:World,c:Creature)=>activeDiseases(w,c).reduce((mult,{d})=>mult*(d.clinical?.eatingMult??1),1)
export const diseaseCapacityMultiplier=(w:World,c:Creature,cap:string)=>activeDiseases(w,c).reduce((mult,{s,d})=>mult*(cap==='manipulation'?d.clinical?.manipulation??1:cap==='breathing'?Math.max(0,1-s.progress*(d.clinical?.breathingPerProgress??0)):1),1)
export const diseaseKey=(w:World,c:Creature)=>activeDiseases(w,c).map(({s})=>s.def+':'+s.progress).join(',')+'|'+latentBiteClues(w,c).map(x=>x.part+':'+x.pain).join(',')
export function diseaseLines(w:World,c:Creature){
 return activeDiseases(w,c).map(({s,d})=>{
  const effects:string[]=[]
  if(d.fever>0)effects.push('현재 체온 '+c.needs.bodyTemp.toFixed(1)+'°C')
  if(d.clinical?.pain)effects.push('관절통 +'+d.clinical.pain)
  if(d.clinical?.manipulation!==undefined)effects.push('조작 ×'+d.clinical.manipulation)
  if(d.clinical?.eatingMult)effects.push('먹기 시간 ×'+d.clinical.eatingMult)
  if(d.clinical?.breathingPerProgress)effects.push('호흡 ×'+Math.max(0,1-s.progress*d.clinical.breathingPerProgress).toFixed(2))
  if(d.fatalAfterTurns)effects.push('발병 후 '+Math.min(100,Math.max(0,(turnOf(w)-s.incubatesUntil)/d.fatalAfterTurns*100)).toFixed(1)+'% 경과')
  if(d.immunePerDay===0)effects.push('자연 면역 없음')
  if(d.antibioticResponse===0)effects.push('일반 항생제로 억제 불가')
  return d.label+' · 진행 '+s.progress.toFixed(1)+' / 면역 '+s.immunity.toFixed(1)+(effects.length?' · '+effects.join(' · '):'')
 })
}

/** 노출 당시의 실제 흙/무기 오염을 원래 상처에만 묶는다. */
export function recordWoundDiseaseRisk(w:World,c:Creature,wd:Wound,addedContamination:number){
 if(w.db.body(c.body.def).kind==='mechanical'||wd.internal)return
 const terrain=w.s.map.tiles[c.pos.y*w.s.map.w+c.pos.x].t
 for(const d of w.db.all<DiseaseDef>('Disease')){
  const rule=d.woundExposure;if(!rule||!rule.wounds.includes(wd.def)||wd.contam<rule.contamination||wd.severity<(c.body.maxHp[wd.part]??0)*rule.severityFraction||!rule.terrain.includes(terrain)&&addedContamination<rule.addedContamination)continue
  ;(wd.diseaseRisk??=[]).push({def:d.id})
 }
}

export function diseaseStream(key:string):RngStream{return 'body.disease.'+key as RngStream}
