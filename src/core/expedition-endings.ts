// A conclusion records completed personal actions. It never simulates a future sky or response.
import {capacity} from './body'
import {hostile} from './diplomacy'
import {fmtClock,turnOf,type World} from './ctx'
import {canSee} from './fov'
import {eq} from './geom'
import {buildReport} from './report'
import {retirementDef} from './retirement'
import {sha256} from './load-hash'
import type {Creature,FieldDeviceDef} from './types'

const readBook=(c:Creature,id:string)=>!!c.booksRead?.includes(id)&&(c.literacyBooks??c.booksRead??[]).includes(id)&&!c.misreadBooks?.includes(id)
const personalNotes=(w:World,c:Creature)=>c.fieldNotes?.filter(note=>Number.isSafeInteger(note.turn)&&note.turn>=0&&note.turn<=turnOf(w)&&Number.isSafeInteger(note.deviceUid)&&note.deviceUid!==0)??[]

export function expeditionEndingQuote(w:World,c:Creature,id:string){
 const rule=retirementDef(w).endings?.find(row=>row.id===id),notes=personalNotes(w,c),now=turnOf(w)
 const relevant=notes.filter(note=>rule?.notes.includes(note.key))
 const disclosures=(w.s.overworld?.society?.disclosures??[]).filter(record=>record.source===c.id&&record.rule===rule?.disclosure&&record.turn<=now&&record.witnesses.length>0)
 const revealed=!!rule&&((!rule.revealNotes?.length&&!rule.revealBooks?.length)||!!rule.revealNotes?.some(key=>notes.some(note=>note.key===key))||!!rule.revealBooks?.some(book=>readBook(c,book)))
 const missing=rule?.notes.filter(key=>!relevant.some(note=>note.key===key))??[]
 const noteTitles=w.db.all<FieldDeviceDef>('FieldDevice').flatMap(device=>device.operations.flatMap(op=>op.effect?.note?[op.effect.note]:[]))
 const requirements=missing.map(key=>noteTitles.find(note=>note.key===key)?.title??'현장 기록 확인')
 if(rule?.disclosure&&!disclosures.length)requirements.push('원본을 실제 청중에게 공개')
 // Tower requirements are evaluated only at the named, currently occupied field site.
 const inRegion=!rule?.region||w.s.overworld?.currentRegion===rule.region
 const tower=rule?.tower&&inRegion?w.s.overworld?.towers.find(row=>row.id===rule.tower!.id):undefined
 let error:string|null=null
 if(!rule||!revealed)error='자신이 확인한 원정의 기록이 필요하다'
 else if(c.id!==w.s.playerId||!w.s.creatures.includes(c)||!c.alive||c.asleep||c.unconscious||c.captivity||capacity(w,c,'consciousness')<.5||w.s.over||w.s.simulationPending)error='깨어서 자신의 원정을 마칠 수 있어야 한다'
 else if(requirements.length)error='아직 남은 일: '+requirements.join(' · ')
 else if(!w.s.overworld?.currentRegion||!inRegion)error=rule.region?'기록을 마칠 현장으로 돌아가야 한다':'지역 안의 지상 출입구로 가야 한다'
 else if(w.s.map.kind!=='surface'||w.s.map.vessel||!w.s.map.exits.some(pos=>eq(pos,c.pos)))error='지상 출입구에 서서 원정을 마친다'
 else if(w.s.overworld.travel||c.activity)error='하던 행동을 마친 뒤 결정해야 한다'
 else if(w.s.creatures.some(other=>other.id!==c.id&&other.alive&&!other.asleep&&!other.unconscious&&(other.mapId===undefined||other.mapId===w.s.map.id)&&hostile(w,c,other)&&canSee(w,c,other.pos)))error='눈에 보이는 적의 위협에서 벗어나야 한다'
 else if(rule.tower&&(!tower||!!tower.shutdown!==rule.tower.stopped))error=rule.tower.stopped?'이 현장의 탑 정지 기록을 확인해야 한다':'이 결말은 탑을 멈추기 전의 선택이다'
 const signature=rule?sha256(JSON.stringify({rule,at:w.s.time,player:c.id,pos:c.pos,map:w.s.map.id,region:w.s.overworld?.currentRegion,notes:relevant,disclosures,tower:tower?{id:tower.id,shutdown:tower.shutdown??null}:undefined})):''
 return{rule,revealed,error,requirements,notes:relevant,disclosures,signature}
}

export function knownExpeditionEndings(w:World,c:Creature){
 return(retirementDef(w).endings??[]).map(rule=>expeditionEndingQuote(w,c,rule.id)).filter(row=>row.revealed)
}

export function finishExpedition(w:World,c:Creature,id:string,expected:string){
 const q=expeditionEndingQuote(w,c,id);if(q.error)return q.error
 if(!expected||expected!==q.signature)return '기록이나 현재 현장이 바뀌었다. 결말을 다시 확인해야 한다'
 const now=turnOf(w),rule=q.rule!
 c.history.push({turn:now,kind:'conclusion',text:`${rule.label}. ${rule.summary}`})
 const report=buildReport(w,c,'escape',rule.label)
 report.title=rule.label;report.epitaph=`떠돌이 ${c.name}. ${rule.epitaph}`
 for(const note of q.notes)report.chain.push(`[${fmtClock(note.turn)}] ${note.title}: ${note.text}`)
 if(q.disclosures.length){
  const witnesses=new Set(q.disclosures.flatMap(row=>row.witnesses)),reformers=new Set(q.disclosures.flatMap(row=>row.reformers))
  report.stats.push(`직접 원본 공개 ${q.disclosures.length}회 · 원본을 본 사람 ${witnesses.size}명 · 규정을 거부한 사람 ${reformers.size}명`)
 }
 report.stats.push(`마지막 현장: ${w.s.map.name} · ${fmtClock(now)}`)
 w.s.over={kind:'escape',turn:now,report};c.activity=undefined;w.s.simulationPending=undefined
 return null
}
