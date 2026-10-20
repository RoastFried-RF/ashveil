import {describe,it,expect} from 'vitest'
import {loadMods,type ModPackage} from '../src/core/defs'
import {HOOK_API_VERSION,supportsHookApi} from '../src/core/script-api'
import {readPackages} from '../tools/loadContent'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
function mod(api?:unknown):ModPackage{return{manifest:{id:'api-check',name:'API 검사',version:'1',scripts:{stage:1,entry:'scripts/main.js',...(api===undefined?{}:{api:api as string})}},defs:[],patches:[],scripts:[{file:'scripts/main.js',source:'export default defineMod({hooks:{onDayStart(ctx){ctx.modState.version=ctx.apiVersion;return []}}})'}]}}
describe('선택한 스크립트의 별도 훅 API 범위',()=>{
 it.each([HOOK_API_VERSION,'^1.0.0','~1.4.0','>=1.0.0 <2.0.0','<1.0.0 || >=1.4.0 <=1.4.0','*'])('호환 범위 %s의 실제 진입 파일을 수집한다',api=>{const l=loadMods([...readPackages(),mod(api)],['api-check']);expect(l.report.errors).toEqual([]);expect(l.db.scriptSources).toHaveLength(1)})
 it.each(['1.0.0','^2.0.0','~1.0.0','<1.4.0','>1.4.0','>=1.5.0 <2.0.0','~1.3.0','','^1','1.x','01.1.0','* || nope','>=1.0.0 ||',null,1])('호환하지 않거나 모호한 범위 %s는 실행 전에 거절한다',api=>{const l=loadMods([...readPackages(),mod(api)],['api-check']);expect(l.report.errors.some(e=>e.includes('scripts.api'))).toBe(true);expect(l.db.scriptSources).toEqual([])})
 it('선택하지 않은 모드의 호환하지 않는 API는 현재 판에 관여하지 않는다',()=>{expect(loadMods([...readPackages(),mod('^999.0.0')],[]).report.errors).toEqual([])})
 it('API 요구 범위만 바뀌어도 저장된 구성의 내용 해시가 달라진다',()=>{const a=loadMods([...readPackages(),mod('^1.0.0')],['api-check']),b=loadMods([...readPackages(),mod('^1.1.0')],['api-check']);expect(a.db.scriptSources[0].source).toBe(b.db.scriptSources[0].source);expect(a.db.scriptSources[0].hash).not.toBe(b.db.scriptSources[0].hash)})
 it('0.x 캐럿 상한과 틸드/비교식의 경계를 정확히 구분한다',()=>{expect(supportsHookApi('^0.2.3','0.2.9')).toBe(true);expect(supportsHookApi('^0.2.3','0.3.0')).toBe(false);expect(supportsHookApi('^0.0.3','0.0.4')).toBe(false);expect(supportsHookApi('~1.1.0','1.2.0')).toBe(false)})
 it('실제 격리 컨텍스트는 읽기 전용 현재 API 버전을 제공한다',async()=>{const l=loadMods([...readPackages(),mod('^1.1.0')],['api-check']),host=await createQuickJSScriptHost(),i=host.inspect(l.db.scriptSources[0]);expect(i.ok).toBe(true);if(!i.ok)throw Error(i.reason);const result=host.invoke({module:i.module,hook:'onDayStart',event:{},view:{},state:{},rng:[1,2,3,4]});expect(result).toMatchObject({ok:true,state:{version:HOOK_API_VERSION}})})
})
