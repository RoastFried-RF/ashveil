import type {CharDef} from './atlas'
import {rigSpecFrameKeys} from './rig-spec'
export interface AtlasManifest {
 sheets:Record<string,string>
 frames:Record<string,[string,number,number,number,number]>
 chars:Record<string,CharDef>
 anims:Record<string,{frames:string[];fps:number}>
 sheetSizes?:Record<string,[number,number]>
 characterSheetHistory?:string[]
}
/** Whole original sheets: keep common terrain/equipment/FX; select only current body models. */
export function atlasPlan(m:AtlasManifest,iconNames:readonly string[],characterNames:readonly string[]){
 const characterSheets=new Set<string>(),required=new Set<string>(),fallback=new Set<string>(),retired=new Set(m.characterSheetHistory??[])
 const clips=(c:CharDef)=>[c.walk,c.idle,c.attack,...Object.values(c.attackVariants??{}),...Object.values(c.motions??{})]
 for(const c of Object.values(m.chars)){
  for(const block of clips(c))if(block)for(const keys of Object.values(block))for(const key of keys){const rect=m.frames[key];if(rect)characterSheets.add(rect[0])}
  if(c.portrait&&m.frames[c.portrait])characterSheets.add(m.frames[c.portrait][0])
  if(c.rig)for(const key of rigSpecFrameKeys(c.rig)){const rect=m.frames[key];if(rect)characterSheets.add(rect[0])}
 }
 for(const sheet of Object.keys(m.sheets))if(!characterSheets.has(sheet)&&!retired.has(sheet))required.add(sheet)
 const frame=(key:string)=>{const rect=m.frames[key];if(rect)required.add(rect[0])}
 const body=(name:string)=>{
  const c=m.chars[name];if(!c)return false
  for(const clip of clips(c))if(clip)for(const keys of Object.values(clip))keys.forEach(frame)
  if(c.portrait)frame(c.portrait)
  if(c.rig)rigSpecFrameKeys(c.rig).forEach(frame)
  return true
 }
 const need=(name:string,preferBody=false)=>{
  if(preferBody&&body(name))return
  if(m.frames[name])frame(name)
  else if(m.anims[name])m.anims[name].frames.forEach(frame)
  else if(!body(name)&&!preferBody)fallback.add(name)
 }
 for(const animation of Object.values(m.anims))animation.frames.forEach(frame)
 iconNames.forEach(name=>need(name));characterNames.forEach(name=>need(name,true))
 const sheets=[...required].sort(),estimatedDecodedBytes=sheets.reduce((n,key)=>{const size=m.sheetSizes?.[key];return n+(size?size[0]*size[1]*4:0)},0)
 return{sheets,fallback:[...fallback].sort(),estimatedDecodedBytes}
}
