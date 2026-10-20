import type {RngState} from './rng'
export type ScriptJson=null|boolean|number|string|ScriptJson[]|{[key:string]:ScriptJson}
export const SCRIPT_HOOKS=['modifyHitChance','onAttackResolved','onWoundInflicted','onEventFired','onEventResolved','onDayStart','onSeasonStart','onItemCrafted','onDeath']as const
export type ScriptHook=(typeof SCRIPT_HOOKS)[number]
export interface ScriptSource {modId:string;file:string;source:string;hash:string;stage?:1|2}
export type ScriptWorkerKind="PlaceEventWorker"|"AIConsiderationWorker"|"ItemCompWorker"|"MapGenStepWorker"
export const PROSTHETIC_WORKER_METHODS=['onProstheticInstalled','onProstheticRemoved','onProstheticServiced','onProstheticCharged','onProstheticBroken']as const
export type ProstheticWorkerMethod=(typeof PROSTHETIC_WORKER_METHODS)[number]
export const ITEM_WORKER_METHODS=['onConsume','onEquip','onUnequip','onCrafted','onRepair','onApplied','onMaterialConsumed',...PROSTHETIC_WORKER_METHODS]as const
export type ItemWorkerMethod=(typeof ITEM_WORKER_METHODS)[number]
export type ScriptWorkerMethod="canFire"|"execute"|"score"|ItemWorkerMethod
export interface ScriptModule extends ScriptSource {hooks:ScriptHook[];workers?:{name:string;kind:ScriptWorkerKind;methods:ScriptWorkerMethod[]}[]}
export type ScriptCall=ScriptHook|`worker.${string}.${ScriptWorkerMethod}`
export interface ScriptWorkerRequest {module:ScriptModule;worker:string;method:ScriptWorkerMethod;event:Record<string,ScriptJson>;view:Record<string,ScriptJson>;state:ScriptJson;rng:RngState}
export interface ScriptRequest {module:ScriptModule;hook:ScriptHook;event:Record<string,ScriptJson>;view:Record<string,ScriptJson>;state:ScriptJson;rng:RngState}
export type ScriptOutcome={ok:true;result:ScriptJson;state:ScriptJson;rng:RngState}|{ok:false;reason:string}
/** 플랫폼은 격리 실행만 담당한다. 명령 검증/적용과 각인 상태는 코어가 소유한다. */
export interface ScriptHost {inspect(source:ScriptSource):{ok:true;module:ScriptModule}|{ok:false;reason:string};invoke(request:ScriptRequest):ScriptOutcome;invokeWorker?(request:ScriptWorkerRequest):ScriptOutcome}
export interface ScriptState {queuedEvents?:{modId:string;event:string;at:number;mapId:string;region?:string;pos:{x:number;y:number}}[];hashes:Record<string,string>;mods:Record<string,unknown>;disabled:string[];errors:{modId:string;hook:ScriptCall;at:number;reason:string}[];lastDay?:number;lastSeason?:string;eventSequence?:number;eventRuns?:{id:number;event:string;mapId:string;region?:string;actors:number[];at:number;returnedActors?:number[]}[]}
export const SCRIPT_SOURCE_LIMIT=65536
export const SCRIPT_JSON_LIMIT=65536
export function scriptBytes(text:string){let bytes=0;for(const ch of text){const n=ch.codePointAt(0)!;bytes+=n<=0x7f?1:n<=0x7ff?2:n<=0xffff?3:4}return bytes}
export function validScriptJson(value:unknown,limit=SCRIPT_JSON_LIMIT):value is ScriptJson{
 const seen=new Set<object>()
 const visit=(v:unknown,depth:number):boolean=>{
  if(depth>20)return false
  if(v===null||typeof v==='boolean'||typeof v==='string')return true
  if(typeof v==='number')return Number.isFinite(v)
  if(typeof v!=='object'||seen.has(v))return false
  seen.add(v)
  if(Array.isArray(v))return v.length<=1024&&v.every(e=>visit(e,depth+1))
  return Object.getPrototypeOf(v)===Object.prototype&&Object.entries(v).length<=1024&&Object.entries(v).every(([k,e])=>!['__proto__','constructor','prototype'].includes(k)&&visit(e,depth+1))
 }
 if(!visit(value,0))return false
 try{return scriptBytes(JSON.stringify(value))<=limit}catch{return false}
}
