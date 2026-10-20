// 격리 VM의 반환값을 실제 세계에 적용하기 전에 목록 전체를 검증한다.
import {addWound,bodyDef,isMissing} from './body'
import {clamp,log,turnOf,type World} from './ctx'
import {ensureSociety,factionDef,reputation} from './diplomacy'
import {cheb,type Pos} from './geom'
import {gridSpot,makeItem,maxStack,type Grid} from './items'
import {placeEventRule,supportsQueuedPlaceEvent} from './place-event-rules'
import {addThought} from './thoughts'
import type {ScriptJson} from './script-contracts'
import type {LogEntry} from './types'
export type ScriptCommand={type:'log';kind:LogEntry['kind'];text:string}|{type:'addThought';target:number;thought:string}|{type:'adjustReputation';faction:string;delta:number}|{type:'applyWound';target:number;wound:string;part:string;severity:number}|{type:'spawnItem';item:string;count:number;pos:Pos;destination:'floor'|'container';slot?:{gx:number;gy:number;rot?:boolean}}|{type:'queueEvent';event:string;delayTurns:number;pos:Pos}
const chainBudgets=new WeakMap<World['s'],{remaining:number}>()
const LOG_KINDS=['info','combat','warn','danger','flavor','good']
const integer=(v:unknown,lo:number,hi:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi
function position(w:World,v:ScriptJson|undefined,targets:Set<number>):v is {x:number;y:number}{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['x','y'].includes(k))||!integer(v.x,0,w.s.map.w-1)||!integer(v.y,0,w.s.map.h-1))return false
 return w.s.creatures.some(c=>c.alive&&targets.has(c.id)&&cheb(c.pos,{x:v.x as number,y:v.y as number})<=1)
}
export function allowedScriptCommands(w:World,value:ScriptJson,targets:Set<number>,woundDepth:number):ScriptCommand[]|null{
 if(!Array.isArray(value)||value.length>32||value.length>(chainBudgets.get(w.s)?.remaining??64))return null
 const out:ScriptCommand[]=[],places=new Map<string,number>(),grids=new Map<string,Grid>();let queued=w.s.scriptState?.queuedEvents?.length??0
 for(const entry of value){
  if(!entry||typeof entry!=='object'||Array.isArray(entry))return null
  const keys=Object.keys(entry)
  if(entry.type==='log'){
   if(keys.some(k=>!['type','kind','text'].includes(k))||typeof entry.kind!=='string'||!LOG_KINDS.includes(entry.kind)||typeof entry.text!=='string'||!entry.text||entry.text.length>600)return null
   out.push({type:'log',kind:entry.kind as LogEntry['kind'],text:entry.text})
  }else if(entry.type==='addThought'){
   if(keys.some(k=>!['type','target','thought'].includes(k))||typeof entry.target!=='number'||!Number.isSafeInteger(entry.target)||!targets.has(entry.target)||!w.s.creatures.some(c=>c.id===entry.target&&c.alive)||typeof entry.thought!=='string'||w.db.tryGet(entry.thought)?.defType!=='Thought')return null
   out.push({type:'addThought',target:entry.target,thought:entry.thought})
  }else if(entry.type==='adjustReputation'){
   if(keys.some(k=>!['type','faction','delta'].includes(k))||!w.s.overworld||typeof entry.faction!=='string'||!factionDef(w,entry.faction)||!integer(entry.delta,-10,10))return null
   out.push({type:'adjustReputation',faction:entry.faction,delta:entry.delta})
  }else if(entry.type==='applyWound'){
   const c=typeof entry.target==='number'?w.s.creatures.find(c=>c.id===entry.target&&c.alive&&targets.has(c.id)):undefined
   if(keys.some(k=>!['type','target','wound','part','severity'].includes(k))||woundDepth>=4||!c||typeof entry.wound!=='string'||w.db.tryGet(entry.wound)?.defType!=='Wound'||typeof entry.part!=='string'||!bodyDef(w,c).parts.some(p=>p.id===entry.part)||isMissing(w,c,entry.part)||!integer(entry.severity,1,100))return null
   out.push({type:'applyWound',target:c.id,wound:entry.wound,part:entry.part,severity:entry.severity})
  }else if(entry.type==='spawnItem'){
   const def=typeof entry.item==='string'&&w.db.tryGet(entry.item)?.defType==='Item'?w.db.item(entry.item):undefined
   if(keys.some(k=>!['type','item','count','pos','destination'].includes(k))||!def||!integer(entry.count,1,Math.min(100,maxStack(def)))||!position(w,entry.pos,targets)||!['floor','container'].includes(entry.destination as string))return null
   const destination=entry.destination as 'floor'|'container',tile=w.s.map.tiles[entry.pos.y*w.s.map.w+entry.pos.x],items=destination==='container'?tile.cont?.opened?tile.cont.items:undefined:tile.items
   if(!items||destination==='floor'&&!w.db.terrain(tile.t).passable)return null
   const key=destination+':'+entry.pos.x+','+entry.pos.y,added=(places.get(key)??0)+1;if(items.length+added>128)return null;places.set(key,added)
   let slot:{gx:number;gy:number;rot?:boolean}|undefined
   if(destination==='container'){
    const [gw,gh]=w.db.terrain(tile.t).lootGrid??[6,4],g=grids.get(key)??{items:structuredClone(items),w:gw,h:gh};grids.set(key,g)
    const found=gridSpot(w,g,def);if(!found)return null;slot={gx:found[0],gy:found[1],rot:found[2]||undefined};g.items.push({uid:-out.length-1,def:def.id,count:entry.count,...slot})
   }
   out.push({type:'spawnItem',item:def.id,count:entry.count,pos:{...entry.pos},destination,slot})
  }else if(entry.type==='queueEvent'){
   if(keys.some(k=>!['type','event','delayTurns','pos'].includes(k))||typeof entry.event!=='string'||!supportsQueuedPlaceEvent(w,entry.event)||!integer(entry.delayTurns,1,28800)||!position(w,entry.pos,targets)||++queued>32)return null
   const rule=placeEventRule(w,entry.event);if(w.s.map.kind!=='surface'||!rule||!w.s.map.waypoints?.[rule.origin.waypoint]||!w.db.terrain(w.s.map.tiles[entry.pos.y*w.s.map.w+entry.pos.x].t).passable)return null
   out.push({type:'queueEvent',event:entry.event,delayTurns:entry.delayTurns,pos:{...entry.pos}})
  }else return null
 }
 return out
}
const woundDepths=new WeakMap<World['s'],number>()
export const scriptWoundDepth=(w:World)=>woundDepths.get(w.s)??0
export function applyScriptCommands(w:World,commands:ScriptCommand[],modId:string){
 const prior=chainBudgets.get(w.s),budget=prior??{remaining:64};if(!prior)chainBudgets.set(w.s,budget);budget.remaining-=commands.length
 try{for(const cmd of commands){
  if(cmd.type==='log')log(w,cmd.kind,cmd.text)
  else if(cmd.type==='addThought')addThought(w,w.s.creatures.find(c=>c.id===cmd.target)!,cmd.thought)
  else if(cmd.type==='adjustReputation')ensureSociety(w)!.reputation[cmd.faction]=clamp(reputation(w,cmd.faction)+cmd.delta,-100,100)
  else if(cmd.type==='applyWound'){
   const depth=scriptWoundDepth(w);woundDepths.set(w.s,depth+1)
   try{addWound(w,w.s.creatures.find(c=>c.id===cmd.target)!,{def:cmd.wound,part:cmd.part,severity:cmd.severity,source:'선택한 모드의 상처: '+modId})}finally{if(depth)woundDepths.set(w.s,depth);else woundDepths.delete(w.s)}
  }else if(cmd.type==='spawnItem'){
   const tile=w.s.map.tiles[cmd.pos.y*w.s.map.w+cmd.pos.x],items=cmd.destination==='floor'?tile.items:tile.cont!.items
   items.push({...makeItem(w,cmd.item,cmd.count),...(cmd.slot??{})})
  }else{
   const saved=w.s.scriptState!,queue=saved.queuedEvents??=[];queue.push({modId,event:cmd.event,at:turnOf(w)+cmd.delayTurns,mapId:w.s.map.id,region:w.s.overworld?.currentRegion,pos:{...cmd.pos}})
  }
 }
 }finally{if(!prior)chainBudgets.delete(w.s)}
}
