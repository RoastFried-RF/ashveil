// Personal evidence only: no remote current states, writer-only truth or generated knowledge.
import {turnOf,type World} from './ctx'
import {speciesDissections} from './bestiary-state'
import type {BestiaryEntryDef,Creature,KnowledgeDef} from './types'

export function researchThreads(w:World,c:Creature){
 const rules=w.db.get<KnowledgeDef>('Knowledge.Human').research??[],now=turnOf(w)
 const read=(id:string)=>!!c.booksRead?.includes(id)&&(c.literacyBooks??c.booksRead??[]).includes(id)&&!c.misreadBooks?.includes(id)
 const notes=c.fieldNotes?.filter(note=>Number.isSafeInteger(note.turn)&&note.turn>=0&&note.turn<=now&&Number.isSafeInteger(note.deviceUid)&&note.deviceUid!==0)??[]
 return rules.map(thread=>{
  const steps=thread.steps.map(step=>{
   const books=(step.books??[]).filter(read),field=notes.filter(note=>step.notes?.includes(note.key))
   const dissected=(step.dissections??[]).flatMap(id=>{
    const entry=w.db.tryGet<BestiaryEntryDef>(id)
    if(!entry||entry.defType!=='BestiaryEntry'||!entry.creatures.length)return[]
    const count=speciesDissections(w,entry.creatures[0]!,c)
    return Number.isSafeInteger(count)&&count>0?[entry]:[]
   })
   const disclosures=step.disclosure?(w.s.overworld?.society?.disclosures??[]).filter(record=>record.rule===step.disclosure&&record.source===c.id&&record.turn<=now&&record.witnesses.length):[]
   const found=books.length+new Set(field.map(note=>note.key)).size+dissected.length+(disclosures.length?1:0),total=(step.books?.length??0)+(step.notes?.length??0)+(step.dissections?.length??0)+(step.disclosure?1:0),confirmed=total>0&&found===total
   return{id:step.id,confirmed,found,total,label:confirmed?step.label:'아직 맞추지 못한 기록',text:confirmed?step.text:undefined,sources:[...books.map(id=>({kind:'book' as const,label:w.db.item(id).label})),...field.map(note=>({kind:'field' as const,label:note.title})),...dissected.map(entry=>({kind:'dissection' as const,label:entry.label})),...(disclosures.length?[{kind:'witness' as const,label:`직접 원본 공개 ${disclosures.length}회`}]:[])]}
  })
  return{id:thread.id,label:thread.label,steps,confirmed:steps.filter(step=>step.confirmed).length,total:steps.length,found:steps.some(step=>step.found>0)}
 }).filter(thread=>thread.found)
}
