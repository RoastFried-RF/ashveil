/** Reviewed Def fields only. A changed/foreign Def retains its own source text. */
import english from './en-content.json'
import itemEnglish from './en-item-content.json'
import type {Language} from './message'
import {translate} from './message'

type Field = 'label' | 'description' | 'unknownLabel' | 'unknownDescription'
type DisplayDef = {id:string; label?:string; description?:string; unknownLabel?:string; unknownDescription?:string}
type GuardedText={source:string;text:string}
type Entry = Partial<Record<Field, GuardedText>> & {attacks?:Record<string,GuardedText>;waterSources?:Record<string,GuardedText>;waterBands?:Record<string,GuardedText>;waterTreatments?:Record<string,GuardedText>}
const baseline:Readonly<Record<string,Entry>>=english, details:Readonly<Record<string,Entry>>=itemEnglish
const messages:Readonly<Record<string, Entry>> = Object.fromEntries([...new Set([...Object.keys(baseline),...Object.keys(details)])].map(id=>[id,{...baseline[id],...details[id]}]))

export function translateDef(def:DisplayDef, field:Field, language:Language):string {
  const source = def[field] ?? ''
  if (language !== 'en' || !Object.hasOwn(messages, def.id)) return source
  const entry = messages[def.id][field]
  return entry?.source === source ? entry.text : source
}

/** Nested attack names retain the same ID + original-text boundary as Def fields. */
export function translateItemAttack(id:string,attack:{id?:string;label:string},language:Language):string {
  if(language!=='en'||!attack.id||!Object.hasOwn(messages,id))return attack.label
  const entries=messages[id].attacks,entry=entries&&Object.hasOwn(entries,attack.id)?entries[attack.id]:undefined
  return entry?.source===attack.label?entry.text:attack.label
}

type WaterDisplayDef={id:string;sources:Record<string,{source?:string}>;riskBands:{at:number;label:string}[]}
export function translateWaterBand(def:WaterDisplayDef,label:string,language:Language):string{
  if(language!=='en'||!Object.hasOwn(messages,def.id))return label
  return Object.entries(messages[def.id].waterBands??{}).find(([at,entry])=>entry.source===label&&def.riskBands.some(b=>b.at===Number(at)&&b.label===entry.source))?.[1].text??label
}
export function translateWaterSource(def:WaterDisplayDef,source:string,language:Language):string{
  if(language!=='en'||!Object.hasOwn(messages,def.id))return source
  const parts=source.split(' · '),entry=Object.entries(messages[def.id].waterSources??{}).find(([key,value])=>value.source===parts[0]&&def.sources[key]?.source===value.source)?.[1]
  const treatments=Object.values(messages[def.id].waterTreatments??{})
  if((!entry&&!['깨끗한 물','물'].includes(parts[0]))||parts.slice(1).some(part=>!treatments.some(t=>t.source===part)))return source
  return[entry?.text??translate(parts[0],language),...parts.slice(1).map(part=>treatments.find(t=>t.source===part)!.text)].join(' · ')
}
