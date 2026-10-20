import {beforeAll,describe,it,expect} from 'vitest'
import {loadMods,packagesFromFiles} from '../src/core/defs'
import {configureScriptHost,initializeScriptState} from '../src/core/script-hooks'
import {newGame} from '../src/core/game'
import {readPackages,loadDb} from '../tools/loadContent'
import {createQuickJSScriptHost} from '../src/scripting/quickjs'
import type {ScriptHost} from '../src/core/script-contracts'
let host:ScriptHost
beforeAll(async()=>{host=await createQuickJSScriptHost()})
const source='export default defineMod({hooks:{onDayStart(){return []}}})'
const pkg=(entry='scripts/main.js',stage:0|1=1)=>({manifest:{id:'script-loading',name:'검사',version:'1',scripts:{stage,entry}},defs:[],patches:[],scripts:[{file:'scripts/main.js',source}]})
describe('스크립트 모드의 문자열 로드/구성/각인 호환',()=>{
 it('진입 파일은 문자열로 수집하며 로드 단계에서 호스트 코드로 실행하지 않는다',()=>{const packages=packagesFromFiles({'mods/example/manifest.json':pkg().manifest,'mods/example/scripts/main.js':source});expect(packages[0].scripts).toEqual([{file:'scripts/main.js',source}]);const loaded=loadMods([...readPackages(),packages[0]],['script-loading']);expect(loaded.report.errors).toEqual([]);expect(loaded.db.scriptSources).toMatchObject([{modId:'script-loading',file:'scripts/main.js',source}]);expect(loaded.db.scriptHost).toBeUndefined()})
 it('선택하지 않은 스크립트는 기본 DB나 실행 상태를 만들지 않는다',()=>{const loaded=loadMods([...readPackages(),pkg()],[]);expect(loaded.db.scriptSources).toEqual([]);expect(loaded.db.loadedMods).toEqual(['core'])})
 it.each(['../outside.js','scripts/../outside.js','scripts/missing.js','scripts//main.js'])('실제 단일 진입 파일이 아닌 주소를 거절한다 (%s)',entry=>{const loaded=loadMods([...readPackages(),pkg(entry)],['script-loading']);expect(loaded.report.errors.some(e=>e.includes('진입 파일'))).toBe(true)})
 it.each(['__proto__','constructor','prototype','unsafe/id'])('예약 키/경로를 스크립트 모드 ID로 사용하지 못한다 (%s)',id=>{const mod=pkg();mod.manifest.id=id;const loaded=loadMods([...readPackages(),mod],[id]);expect(loaded.report.errors.some(e=>e.includes('스크립트 모드 ID'))).toBe(true);expect(loaded.db.scriptSources).toEqual([])})
 it('데이터 단계에서 실행 파일을 선언 없이 포함할 수 없다',()=>{const loaded=loadMods([...readPackages(),pkg('scripts/main.js',0)],['script-loading']);expect(loaded.report.errors.some(e=>e.includes('단계1'))).toBe(true)})
 it('현재 소스가 저장된 해시와 다르면 이어받기 전에 거절한다',()=>{const a=loadMods([...readPackages(),pkg()],['script-loading']);expect(configureScriptHost(a.db,host)).toEqual([]);const s=newGame(a.db,{seed:'script-hash-guard'}),changed=pkg();changed.scripts[0].source+='\n// changed';const b=loadMods([...readPackages(),changed],['script-loading']);expect(configureScriptHost(b.db,host)).toEqual([]);expect(()=>initializeScriptState({db:b.db,s})).toThrow('소스가 다르다')})
 it('제목의 인물 미리보기는 실행기 없이도 순수한 새 인물을 보여 준다',()=>{const loaded=loadDb(['sample-script-hooks']),s=newGame(loaded.db,{seed:'script-preview',scriptPreview:true});expect(s.creatures.find(c=>c.id===s.playerId)).toBeDefined();expect(s.scriptState).toBeUndefined();expect(Object.keys(s.rng).some(k=>k.startsWith('mod.'))).toBe(false)})
})
