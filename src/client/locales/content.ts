/** Reviewed Def fields only. A changed/foreign Def retains its own source text. */
import english from './en-content.json'
import type {Language} from './message'

type Field = 'label' | 'description' | 'unknownLabel'
type DisplayDef = {id:string; label?:string; description?:string; unknownLabel?:string}
type Entry = Partial<Record<Field, {source:string; text:string}>>
const messages:Readonly<Record<string, Entry>> = english

export function translateDef(def:DisplayDef, field:Field, language:Language):string {
  const source = def[field] ?? ''
  if (language !== 'en' || !Object.hasOwn(messages, def.id)) return source
  const entry = messages[def.id][field]
  return entry?.source === source ? entry.text : source
}
