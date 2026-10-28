// 이 경로는 원래 물품의 성공한 실제 소비를 코어가 확인한 뒤에만 호출한다.
import {rng,type World} from './ctx'
import {allowedScriptCommands,applyScriptCommands,scriptWoundDepth} from './script-commands'
import {disableScriptCall,initializeScriptState,scriptContextView} from './script-hooks'
import {validScriptJson,type ScriptCall,type ScriptJson,type ItemWorkerMethod,type ProstheticWorkerMethod,PROSTHETIC_WORKER_METHODS} from './script-contracts'
import type {Creature,ItemInst,Slot} from './types'
export interface ScriptItemDebit {uid:number;item:string;countConsumed:number;usesConsumed:number;mlConsumed:number;gramsConsumed:number;material?:string}
export function hasItemWorkerMethod(w:World,method:ItemWorkerMethod){return w.db.scriptModules.some(m=>m.workers?.some(r=>r.kind==='ItemCompWorker'&&r.methods.includes(method)))}
export function runItemAppliedWorker(w:World,provider:Creature,patient:Creature,item:ScriptItemDebit,details:Record<string,ScriptJson>){
 if(item.countConsumed<=0&&item.usesConsumed<=0&&item.mlConsumed<=0&&item.gramsConsumed<=0)return
 const ref=w.db.item(item.item).compWorker;if(ref)runItemWorker(w,'onApplied',ref,provider,patient,{...details,...item})
}
export function runItemMaterialWorker(w:World,c:Creature,item:ScriptItemDebit,details:Record<string,ScriptJson>){
 if(item.countConsumed<=0&&item.usesConsumed<=0&&item.mlConsumed<=0&&item.gramsConsumed<=0)return
 const ref=w.db.item(item.item).compWorker;if(ref)runItemWorker(w,'onMaterialConsumed',ref,c,c,{...details,...item})
}
export function runItemConsumptionWorker(w:World,ref:string,provider:Creature,consumer:Creature,item:{uid:number;item:string;countConsumed:number;usesConsumed:number;mlConsumed:number}){
 if(item.countConsumed<=0&&item.usesConsumed<=0&&item.mlConsumed<=0)return
 runItemWorker(w,'onConsume',ref,provider,consumer,item)
}
export function runItemLifecycleWorker(w:World,method:'onEquip'|'onUnequip'|'onCrafted'|'onRepair'|ProstheticWorkerMethod,c:Creature,item:Pick<ItemInst,'uid'|'def'>,details:Record<string,ScriptJson>={}){
 const ref=w.db.item(item.def).compWorker;if(ref)runItemWorker(w,method,ref,c,c,{...details,uid:item.uid,item:item.def})
}
export function equipmentSnapshot(c:Creature){return(Object.keys(c.equip)as Slot[]).flatMap(slot=>{const it=c.equip[slot];return it?[{slot,uid:it.uid,def:it.def,half:!!it.half}]:[]})}
export function runEquipmentWorkers(w:World,c:Creature,before:ReturnType<typeof equipmentSnapshot>){
 const after=equipmentSnapshot(c)
 for(const old of before)if(!after.some(now=>now.slot===old.slot&&now.uid===old.uid))runItemLifecycleWorker(w,'onUnequip',c,old,{slot:old.slot})
 for(const now of after)if(!now.half&&!before.some(old=>old.slot===now.slot&&old.uid===now.uid&&!old.half))runItemLifecycleWorker(w,'onEquip',c,now,{slot:now.slot})
}
function runItemWorker(w:World,method:ItemWorkerMethod,ref:string,provider:Creature,consumer:Creature,item:Record<string,ScriptJson>){
 const pastFact=method==='onApplied'||method==='onMaterialConsumed'||PROSTHETIC_WORKER_METHODS.some(m=>m===method)
 if(!w.s.creatures.includes(provider)||!w.s.creatures.includes(consumer)||!pastFact&&(!provider.alive||!consumer.alive))return
 const [modId,name]=ref.split(':'),module=w.db.scriptModules.find(m=>m.modId===modId)
 if(!module||!w.db.scriptHost?.invokeWorker||!module.workers?.some(r=>r.name===name&&r.kind==='ItemCompWorker'&&r.methods.includes(method)))return
 const call:ScriptCall=`worker.${name}.${method}`,key=modId+':'+call;if(w.s.scriptState?.disabled.includes(key))return
 const state=w.s.scriptState?.mods[modId]??{},event={...item,actorId:provider.id,ownerId:consumer.id,providerId:provider.id}as Record<string,ScriptJson>,{targets,view}=scriptContextView(w,event),stream=`mod.${modId}.${call}`as const,prior=w.s.rng[stream],shadow:World={db:w.db,s:{...w.s,rng:{...w.s.rng,...(prior?{[stream]:[...prior]}:{})}}}
 const fail=(reason:string)=>{initializeScriptState(w);disableScriptCall(w,modId,call,reason)}
 if(!validScriptJson(state)){fail('저장된 아이템 워커 데이터 형식 오류');return}
 const outcome=w.db.scriptHost.invokeWorker({module,worker:name,method,event,view,state,rng:rng(shadow,stream).s})
 if(!outcome.ok){fail(outcome.reason);return}
 if(!validScriptJson(outcome.state)||!validScriptJson(outcome.result)){fail('아이템 워커 반환 데이터 형식 오류');return}
 const commands=allowedScriptCommands(w,outcome.result,targets,scriptWoundDepth(w));if(!commands){fail('허용하지 않는 아이템 워커 명령 또는 대상');return}
 initializeScriptState(w);w.s.scriptState!.mods[modId]=outcome.state;w.s.rng[stream]=[...outcome.rng];applyScriptCommands(w,commands,modId)
}
