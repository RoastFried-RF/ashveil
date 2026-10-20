import {beforeAll,describe,it,expect} from 'vitest'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import {hashString,seedState} from '../src/core/rng'
import {validScriptJson,type ScriptHost,type ScriptModule,type ScriptRequest} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
function moduleFor(code:string){const source={modId:'runtime-test',file:'scripts/main.js',source:code,hash:String(hashString(code))},checked=host.inspect(source);if(!checked.ok)throw Error(checked.reason);return checked.module}
function request(module:ScriptModule):ScriptRequest{return{module,hook:'onDayStart',event:{day:3},view:{player:{id:1},creatures:[{id:1},{id:2}]},state:{visits:0},rng:seedState('script-runtime-test','world.mod.runtime-test')}}
function run(body:string){const module=moduleFor('export default defineMod({hooks:{onDayStart(ctx,event){'+body+'}}})');return host.invoke(request(module))}
describe('고정 QuickJS 격리 스크립트 실행기',()=>{
 it('실제 ES모듈 훅의 명령과 사본 상태만 반환하고 요청 객체를 보존한다',()=>{const module=moduleFor('export default defineMod({hooks:{onDayStart(ctx,event){ctx.modState.visits++;return [ctx.cmd.log("info","방문 "+event.day)]}}})'),input=request(module),before=structuredClone(input),result=host.invoke(input);expect(result).toMatchObject({ok:true,result:[{type:'log',kind:'info',text:'방문 3'}],state:{visits:1}});expect(input).toEqual(before)})
 it('모드 난수는 복사본에서 결정적이며 다른 입력 난수를 전진시키지 않는다',()=>{const module=moduleFor('export default defineMod({hooks:{onDayStart(ctx){return [ctx.rng.int(1,100),ctx.rng.chance(1000)]}}})'),input=request(module),before=structuredClone(input.rng),a=host.invoke(input),b=host.invoke(input);expect(a).toEqual(b);expect(a.ok).toBe(true);if(a.ok)expect(a.rng).not.toEqual(before);expect(input.rng).toEqual(before)})
 it('시간·호스트 파일/네트워크/타이머/기본 난수·비결정 수학이 제공되지 않는다',()=>{expect(run('return [typeof Date,typeof performance,typeof fetch,typeof process,typeof require,typeof setTimeout,typeof SharedArrayBuffer,typeof Atomics,typeof Math.random,typeof Math.sin,typeof Math.pow,typeof Math.asinh,typeof Math.acosh,typeof Math.atanh,typeof Math.cbrt,typeof Math.hypot]')).toMatchObject({ok:true,result:Array(16).fill('undefined')})})
 it('읽기 전용 상태/사건을 바꾸면 실행을 거절하고 호스트 객체를 보존한다',()=>{expect(run('ctx.view.player.id=99;return []').ok).toBe(false);expect(run('event.day=99;return []').ok).toBe(false);expect(run('ctx.view.creatures.push({id:4});return []').ok).toBe(false)})
 it('등록한 API의 불변 보호를 해제할 수 없다',()=>{expect(run('globalThis.__ashveilContext=()=>({view:{}});return []').ok).toBe(false);expect(run('Math.random=()=>.5;return []').ok).toBe(false)})
 it('정수 제곱근과 고정소수점 계산을 실제 격리 환경에서 제공한다',()=>{expect(run('return [ctx.math.isqrt(0),ctx.math.isqrt(15),ctx.math.isqrt(81),ctx.math.mulDiv(19,5,2)]')).toMatchObject({ok:true,result:[0,3,9,47]})})
 it('모듈 등록 단계의 무한 루프도 연산 예산으로 중단한다',()=>{const result=host.inspect({modId:'bad',file:'scripts/main.js',source:'while(true){};export default defineMod({hooks:{}})',hash:'bad'});expect(result).toMatchObject({ok:false,reason:'스크립트 연산 예산 초과'})})
 it('호출의 무한 루프와 재귀를 중단하고 다음 정상 호출은 독립적으로 실행한다',()=>{expect(run('while(true){}')).toMatchObject({ok:false,reason:'스크립트 연산 예산 초과'});expect(run('function again(){return again()}return again()').ok).toBe(false);expect(run('return [7]')).toMatchObject({ok:true,result:[7]})})
 it('호스트 모듈과 원격 URL을 가져오지 않는다',()=>{for(const spec of['node:fs','https://example.invalid/module.js']){const checked=host.inspect({modId:'bad-import',file:'scripts/main.js',source:'import value from '+JSON.stringify(spec)+';export default defineMod({hooks:{}})',hash:'bad'});expect(checked.ok).toBe(false)}})
 it('오류 객체의 속성/직렬화 코드를 호스트 오류 처리에서 실행하지 않는다',()=>{for(const body of ['throw Object.defineProperty({},"stack",{get(){while(true){}}})','throw {toJSON(){while(true){}}}'])expect(run(body).ok).toBe(false);expect(run('return [9]')).toMatchObject({ok:true,result:[9]})})
 it('모듈 전체의 숨은 상태는 다음 훅 호출에 남지 않는다',()=>{const module=moduleFor('let hidden=0;export default defineMod({hooks:{onDayStart(){return [++hidden]}}})');expect(host.invoke(request(module))).toMatchObject({ok:true,result:[1]});expect(host.invoke(request(module))).toMatchObject({ok:true,result:[1]})})
 it('64KiB를 넘는 저장 상태/출력을 거절한다',()=>{expect(run('ctx.modState.text="가".repeat(30000);return []').ok).toBe(false);expect(run('return ["x".repeat(70000)]').ok).toBe(false)})
 it('메모리를 과도하게 할당하는 호출이 실패해도 다음 실행기를 보존한다',()=>{expect(run('return [new Array(100000000).fill("payload")]').ok).toBe(false);expect(run('return [8]')).toMatchObject({ok:true,result:[8]})})
 it.each(['return [ctx.rng.int(4,1)]','return [ctx.rng.int(0,1.5)]','return [ctx.rng.chance(10001)]','return [ctx.math.mulDiv(1,2,0)]'])('잘못된 정수 API 입력을 거절한다 (%s)',body=>{expect(run(body).ok).toBe(false)})
 it.each(['export default {}','export default defineMod({hooks:{invented(){}}})','export default defineMod({hooks:{onDayStart:3}})','export default defineMod({hooks:{},workers:{}})'])('지원하지 않는 등록을 거절한다 (%s)',source=>{expect(host.inspect({modId:'bad',file:'scripts/main.js',source,hash:'bad'}).ok).toBe(false)})
 it('검증되지 않은 JSON/별칭 순환/프로토타입 키를 거절한다',()=>{expect(validScriptJson(JSON.parse('{"__proto__":{}}'))).toBe(false);expect(validScriptJson({n:Infinity})).toBe(false);const value:Record<string,unknown>={};value.self=value;expect(validScriptJson(value)).toBe(false)})
})
