import {HOOK_API_VERSION} from '../core/script-api'
import {getQuickJS,type QuickJSContext,type QuickJSHandle,type QuickJSWASMModule} from 'quickjs-emscripten'
import {Rng} from '../core/rng'
import {ITEM_WORKER_METHODS,SCRIPT_HOOKS,SCRIPT_JSON_LIMIT,SCRIPT_SOURCE_LIMIT,scriptBytes,validScriptJson,type ScriptHost,type ScriptJson,type ScriptModule,type ScriptOutcome,type ScriptRequest,type ScriptSource,type ScriptWorkerRequest,type ScriptWorkerKind,type ScriptWorkerMethod} from '../core/script-contracts'
const MEMORY_LIMIT=16*1024*1024,STACK_LIMIT=256*1024
// 고정 QuickJS2025의 인터럽트 카운터10,000을 최대5구간만 허용한다.
const INTERRUPT_LIMIT=5
const BOOTSTRAP=`'use strict';
for(const key of ['Date','performance','setTimeout','setInterval','fetch','XMLHttpRequest','WebSocket','Worker','SharedArrayBuffer','Atomics','WeakRef','FinalizationRegistry','eval'])Object.defineProperty(globalThis,key,{value:undefined,writable:false,configurable:false});
for(const key of ['random','sin','cos','tan','asin','acos','atan','atan2','sinh','cosh','tanh','asinh','acosh','atanh','cbrt','hypot','exp','expm1','log','log1p','log2','log10','pow'])Object.defineProperty(Math,key,{value:undefined,writable:false,configurable:false});
Object.freeze(Math);
globalThis.defineMod=Object.freeze(function(value){return Object.freeze(value)});
globalThis.__ashveilFreeze=function freeze(value){if(value&&typeof value==='object'){for(const key of Object.keys(value))freeze(value[key]);Object.freeze(value)}return value};
globalThis.__ashveilContext=function(data,rng){const fixed={isqrt(n){if(!Number.isSafeInteger(n)||n<0)throw Error('정수 제곱근 범위 오류');let lo=0,hi=Math.min(n,94906265);while(lo<hi){const mid=Math.floor((lo+hi+1)/2);if(mid*mid<=n)lo=mid;else hi=mid-1}return lo},mulDiv(a,b,d){if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||!Number.isSafeInteger(d)||d===0||!Number.isSafeInteger(a*b))throw Error('고정소수점 범위 오류');return Math.trunc(a*b/d)}};const cmd={log(kind,text){return{type:'log',kind,text}},addThought(target,thought){return{type:'addThought',target,thought}},adjustReputation(faction,delta){return{type:'adjustReputation',faction,delta}},applyWound(target,wound,part,severity){return{type:'applyWound',target,wound,part,severity}},spawnItem(item,count,pos,destination='floor'){return{type:'spawnItem',item,count,pos,destination}},queueEvent(event,delayTurns,pos){return{type:'queueEvent',event,delayTurns,pos}}};return Object.freeze({apiVersion:${JSON.stringify(HOOK_API_VERSION)},event:__ashveilFreeze(data.event),view:__ashveilFreeze(data.view),modState:data.state,rng:Object.freeze(rng),math:Object.freeze(fixed),cmd:Object.freeze(cmd)})};
globalThis.__ashveilSerialize=function(result,state){const value=JSON.stringify({result:result===undefined?[]:result,state});if(value.length>${SCRIPT_JSON_LIMIT})throw Error('반환 데이터 한도 초과');return value};
for(const key of ['defineMod','__ashveilFreeze','__ashveilContext','__ashveilSerialize'])Object.defineProperty(globalThis,key,{writable:false,configurable:false});
`
function unwrapGuest(result:{error?:QuickJSHandle;value?:QuickJSHandle}){if(result.error){result.error.dispose();throw Error('격리 스크립트 실패')}if(!result.value)throw Error('격리 반환 없음');return result.value}
class Handles{
 private values:QuickJSHandle[]=[]
 keep<T extends QuickJSHandle>(h:T){this.values.push(h);return h}
 dispose(){for(const h of this.values.reverse())if(h.alive)h.dispose()}
}
export async function createQuickJSScriptHost():Promise<ScriptHost>{return new QuickJSScriptHost(await getQuickJS())}
class QuickJSScriptHost implements ScriptHost{
 constructor(private readonly wasm:QuickJSWASMModule){}
 private run<T>(source:ScriptSource,body:(vm:QuickJSContext,handles:Handles,module:QuickJSHandle)=>T):{ok:true;value:T}|{ok:false;reason:string}{
  if(typeof source.source!=='string'||!source.source||scriptBytes(source.source)>SCRIPT_SOURCE_LIMIT)return{ok:false,reason:'스크립트 소스 크기 한도 초과'}
  const runtime=this.wasm.newRuntime();runtime.setMemoryLimit(MEMORY_LIMIT);runtime.setMaxStackSize(STACK_LIMIT);runtime.removeModuleLoader();let polls=0;runtime.setInterruptHandler(()=>++polls>INTERRUPT_LIMIT)
  let vm:QuickJSContext|undefined;const handles=new Handles()
  try{
   vm=runtime.newContext();const bootstrap=vm.evalCode(BOOTSTRAP,'ashveil-api.js',{type:'global',strict:true});if(bootstrap.error){bootstrap.error.dispose();return{ok:false,reason:'스크립트 API 초기화 실패'}}bootstrap.value.dispose();polls=0
   const evaluated=vm.evalCode(source.source,source.modId+'/'+source.file,{type:'module',strict:true});if(evaluated.error){evaluated.error.dispose();return{ok:false,reason:polls>INTERRUPT_LIMIT?'스크립트 연산 예산 초과':'스크립트 모듈 실행 실패'}}
   const namespace=handles.keep(evaluated.value),module=handles.keep(vm.getProp(namespace,'default'));if(vm.typeof(module)!=='object')return{ok:false,reason:'기본 defineMod 내보내기가 필요하다'}
   return{ok:true,value:body(vm,handles,module)}
  }catch{return{ok:false,reason:polls>INTERRUPT_LIMIT?'스크립트 연산 예산 초과':'스크립트 실행 또는 반환 데이터 오류'}}
  finally{handles.dispose();vm?.dispose();runtime.dispose()}
 }
 inspect(source:ScriptSource){
  const result=this.run(source,(vm,handles,module)=>{
   const checker=handles.keep(unwrapGuest(vm.evalCode(`(mod)=>{
    if(!mod||typeof mod!=='object'||mod.hooks===undefined&&mod.workers===undefined||Object.keys(mod).some(k=>!['hooks','workers'].includes(k)))throw Error('등록 형식 오류');
    const hooks=mod.hooks??{},workers=mod.workers??{};
    if(!hooks||typeof hooks!=='object'||Array.isArray(hooks)||!workers||typeof workers!=='object'||Array.isArray(workers))throw Error('등록 목록 오류');
    const names=Object.keys(hooks),workersOut=[];
    if(names.length>9||names.some(k=>!${JSON.stringify(SCRIPT_HOOKS)}.includes(k)||typeof hooks[k]!=='function'))throw Error('훅 형식 오류');
    if(Object.keys(workers).length>32||(${source.stage!==2}&&mod.workers!==undefined))throw Error('워커 단계 오류');
    for(const name of Object.keys(workers)){
     const worker=workers[name];if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(name)||!worker||typeof worker!=='object'||!['PlaceEventWorker','AIConsiderationWorker','ItemCompWorker','MapGenStepWorker'].includes(worker.kind))throw Error('워커 형식 오류');
     const allowed=worker.kind==='PlaceEventWorker'?['canFire','execute']:worker.kind==='AIConsiderationWorker'?['score']:worker.kind==='ItemCompWorker'?${JSON.stringify(ITEM_WORKER_METHODS)}:['execute'],methods=worker.kind==='ItemCompWorker'?Object.keys(worker).filter(k=>k!=='kind'):allowed;if(!methods.length||Object.keys(worker).some(k=>!['kind',...allowed].includes(k))||methods.some(k=>typeof worker[k]!=='function'))throw Error('워커 메서드 오류');
     workersOut.push({name,kind:worker.kind,methods});
    }
    return JSON.stringify({hooks:names,workers:workersOut})
   }`)))
   const checked=handles.keep(unwrapGuest(vm.callFunction(checker,vm.undefined,module))),encoded=vm.getString(checked);if(scriptBytes(encoded)>SCRIPT_JSON_LIMIT)throw Error()
   const data:unknown=JSON.parse(encoded)
   if(!validScriptJson(data)||!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(k=>!['hooks','workers'].includes(k))||!Array.isArray(data.hooks)||data.hooks.length>9||new Set(data.hooks).size!==data.hooks.length||data.hooks.some(k=>typeof k!=='string'||!SCRIPT_HOOKS.includes(k as ScriptModule['hooks'][number]))||!Array.isArray(data.workers)||data.workers.length>32||source.stage!==2&&data.workers.length)throw Error()
   const workers:NonNullable<ScriptModule['workers']>=[]
   for(const record of data.workers){
    if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).some(k=>!['name','kind','methods'].includes(k))||typeof record.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(record.name)||workers.some(w=>w.name===record.name)||!['PlaceEventWorker','AIConsiderationWorker','ItemCompWorker','MapGenStepWorker'].includes(record.kind as string)||!Array.isArray(record.methods))throw Error()
    const declared=record.methods,kind=record.kind as ScriptWorkerKind,allowed:readonly ScriptWorkerMethod[]=kind==='PlaceEventWorker'?['canFire','execute']:kind==='AIConsiderationWorker'?['score']:kind==='ItemCompWorker'?ITEM_WORKER_METHODS:['execute'];if(!declared.length||new Set(declared).size!==declared.length||declared.some(k=>!allowed.includes(k as ScriptWorkerMethod))||kind!=='ItemCompWorker'&&(declared.length!==allowed.length||allowed.some(k=>!declared.includes(k))))throw Error();workers.push({name:record.name,kind,methods:declared as ScriptWorkerMethod[]})
   }
   return{hooks:data.hooks as ScriptModule['hooks'],workers}
  })
  return result.ok?{ok:true as const,module:{...source,...result.value}}:result
 }
 invokeWorker(request:ScriptWorkerRequest):ScriptOutcome{
  if(!request.module.workers?.some(w=>w.name===request.worker&&w.methods.includes(request.method)))return{ok:false,reason:'허용하지 않는 워커 입력'}
  return this.execute(request,{worker:request.worker,method:request.method})
 }
 invoke(request:ScriptRequest):ScriptOutcome{
  if(!request.module.hooks.includes(request.hook))return{ok:false,reason:'허용하지 않는 훅 입력'}
  return this.execute(request,{hook:request.hook})
 }
 private execute(request:ScriptRequest|ScriptWorkerRequest,call:{hook:string}|{worker:string;method:string}):ScriptOutcome{
  if(!validScriptJson(request.state)||!validScriptJson(request.event)||!validScriptJson(request.view))return{ok:false,reason:'허용하지 않는 실행 입력'}
  const rng=new Rng([...request.rng]),run=this.run(request.module,(vm,handles,module)=>{
   const bag=handles.keep(vm.newObject()),bind=(name:string,f:(args:QuickJSHandle[])=>number|boolean)=>{
    const fn=vm.newFunction(name,(...args)=>{try{const value=f(args);return typeof value==='boolean'?(value?vm.true:vm.false):vm.newNumber(value)}catch{return{error:vm.newError('난수 정수 범위 오류')}}});vm.setProp(bag,name,fn);fn.dispose()
   },number=(h:QuickJSHandle|undefined)=>{if(!h||vm.typeof(h)!=='number')throw Error();const n=vm.getNumber(h);if(!Number.isSafeInteger(n))throw Error();return n}
   bind('int',args=>{const lo=number(args[0]),hi=number(args[1]);if(args.length!==2||lo< -1000000000||hi>1000000000||lo>hi)throw Error();return rng.int(lo,hi)})
   bind('chance',args=>{const p=number(args[0]);if(args.length!==1||p<0||p>10000)throw Error();return rng.int(1,10000)<=p})
   const data=handles.keep(unwrapGuest(vm.evalCode('('+JSON.stringify({event:request.event,view:request.view,state:request.state})+')'))),factory=handles.keep(vm.getProp(vm.global,'__ashveilContext')),context=handles.keep(unwrapGuest(vm.callFunction(factory,vm.undefined,data,bag))),registry=handles.keep(vm.getProp(module,'hook'in call?'hooks':'workers')),owner='hook'in call?registry:handles.keep(vm.getProp(registry,call.worker)),fn=handles.keep(vm.getProp(owner,'hook'in call?call.hook:call.method)),event=handles.keep(vm.getProp(context,'event')),result=handles.keep(unwrapGuest(vm.callFunction(fn,vm.undefined,context,event))),serialize=handles.keep(vm.getProp(vm.global,'__ashveilSerialize')),state=handles.keep(vm.getProp(context,'modState')),encoded=handles.keep(unwrapGuest(vm.callFunction(serialize,vm.undefined,result,state))),text=vm.getString(encoded)
   if(scriptBytes(text)>SCRIPT_JSON_LIMIT)throw Error()
   const decoded=JSON.parse(text)as{result:unknown;state:unknown};if(!validScriptJson(decoded.result)||!validScriptJson(decoded.state))throw Error()
   return{result:decoded.result as ScriptJson,state:decoded.state as ScriptJson,rng:[...rng.s]as typeof rng.s}
  })
  return run.ok?{ok:true,...run.value}:run
 }
}
