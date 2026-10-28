import {describe,it,expect} from 'vitest'
import fc from 'fast-check'
import {parseContentJson,ContentJsonError} from '../src/core/content-json'
import {packagesFromFiles,loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {newGame} from '../src/core/game'
import {serialize} from '../src/core/save'

describe('원문 콘텐츠 JSON의 엄격한 파싱',()=>{
 it('유효 JSON 전체 값은 표준 파서와 같은 값으로 읽는다',()=>{fc.assert(fc.property(fc.jsonValue(),value=>{const text=JSON.stringify(value);expect(parseContentJson(text)).toEqual(JSON.parse(text))}),{numRuns:250})})
 it('중복 키가 덮어쓰이기 전에 파일·실제 줄·열을 보고한다',()=>{const text='{\n  "label":"처음",\n  "label":"덮어씀"\n}';try{parseContentJson(text,'mods/demo/defs/x.json');throw Error('오류가 필요하다')}catch(error){expect(error).toBeInstanceOf(ContentJsonError);expect(error).toMatchObject({file:'mods/demo/defs/x.json',line:3,column:3});expect((error as Error).message).toContain('중복 JSON 키: "label"')}})
 it('이스케이프 표기가 다른 동일 키도 실제 중복으로 판단한다',()=>{expect(()=>parseContentJson('{"a":1,"\\u0061":2}')).toThrow('중복 JSON 키');expect(()=>parseContentJson('{"x":{"한글":1,"\\ud55c글":2}}')).toThrow('중복 JSON 키')})
 it('서로 다른 객체의 같은 키는 정상이며 키 안 쉼표/괄호/따옴표도 정확히 읽는다',()=>{const text=JSON.stringify([{a:1,'"},:[]':2},{a:3,'\\':4}]);expect(parseContentJson(text)).toEqual(JSON.parse(text))})
 it('BOM은 조용히 지우지 않고 파일 첫 위치에서 보고한다',()=>{expect(()=>parseContentJson('\ufeff{}','manifest.json')).toThrow('manifest.json:1:1: UTF-8 BOM을 제거해야 한다')})
 it.each(['',' ','{"a":1,}','[1,]','{"a" 1}','{a:1}','[1 2]','true false','01','-01','+1','.5','1.','1e','NaN','Infinity','undefined','// comment\n{}','/*x*/{}','{"a":1','[1','"unfinished','"\\q"','"\\u123"','"line\nbreak"','"control\u0000"'])('잘못된 JSON 문법을 파일 오류로 보고한다 (%j)',text=>{expect(()=>parseContentJson(text,'bad.json')).toThrow(ContentJsonError)})
 it('유한 범위를 넘는 숫자는 null 등으로 손실되기 전에 거절한다',()=>{for(const text of ['1e999','-1e999','{"weight":1e999}'])expect(()=>parseContentJson(text)).toThrow('유한 범위를 넘은 JSON 숫자')})
 it('표준 유효 숫자·음수0·유니코드와 모든 문자열 이스케이프를 보존한다',()=>{for(const text of ['-0','1.25e-3','1e308','[true,false,null]','"\\"\\\\\\/\\b\\f\\n\\r\\t\\u0000\\ud83d\\ude00"'])expect(parseContentJson(text)).toEqual(JSON.parse(text))})
 it('중첩 한도 오류를 명확하게 보고하며 RangeError를 노출하지 않는다',()=>{expect(()=>parseContentJson('['.repeat(514)+'0'+']'.repeat(514))).toThrow('JSON 중첩은512단계 이하여야 한다')})
 it('특수 객체 키를 표준 JSON의 자기 속성으로 보존하며 프로토타입은 바꾸지 않는다',()=>{const d=parseContentJson('{"__proto__":{"polluted":true},"constructor":1}') as Record<string,unknown>;expect(Object.hasOwn(d,'__proto__')).toBe(true);expect(d.constructor).toBe(1);expect(({} as Record<string,unknown>).polluted).toBeUndefined()})
})

describe('실제 콘텐츠 파일 경로의 오류 격리',()=>{
 const files=(bad:string)=>({'/content/core/manifest.json':'{"id":"core","name":"코어","version":"1"}','/mods/folder/manifest.json':'{"id":"parsed-demo","name":"오류 예제","version":"1"}','/mods/folder/defs/bad.json':bad})
 it('선택하지 않은 모드의 잘못된 JSON은 코어 시작을 막지 않는다',()=>{const pkgs=packagesFromFiles(files('[{"id":"A","id":"B"}]'));expect(loadMods(pkgs,[]).report.errors).toEqual([]);expect(loadMods(pkgs,['parsed-demo']).report.errors).toEqual([expect.stringContaining('/mods/folder/defs/bad.json:1:12: 중복 JSON 키')])})
 it('파일 전체를 원자적으로 거절하고 앞의 유효 행도 부분 추가하지 않는다',()=>{const pkgs=packagesFromFiles(files('[{"id":"First","defType":"Terrain"},{"id":"A","id":"B"}]')),d=loadMods(pkgs,['parsed-demo']);expect(d.db.has('First')).toBe(false);expect(pkgs.find(p=>p.manifest.id==='parsed-demo')!.defs).toEqual([])})
 it('올바른 다른 파일은 오류 파일 뒤에도 읽고 원래 파일/항목 위치를 유지한다',()=>{const f={...files('[0]'),'/mods/folder/defs/good.json':'[{"defType":"Trait","id":"Trait.Parsed","label":"정상","description":"설명"}]'},pkgs=packagesFromFiles(f),d=loadMods(pkgs,['parsed-demo']);expect(d.report.errors).toHaveLength(1);expect(d.db.has('Trait.Parsed')).toBe(true)})
 it('잘못된 manifest는 앱을 던져 종료하지 않고 폴더 이름의 선택 오류로 보고한다',()=>{const f=files('[]');f['/mods/folder/manifest.json']='{"id":"A","id":"B"}';const pkgs=packagesFromFiles(f);expect(pkgs.find(p=>p.manifest.id==='folder')).toBeDefined();expect(loadMods(pkgs,['folder']).report.errors).toEqual([expect.stringContaining('manifest.json:1:11: 중복 JSON 키')])})
 it('잘못된 Def/패치 최상위 모양과 null 행도 파일 단위로 거절한다',()=>{for(const bad of ['{}','null','[null]','[1]','"text"']){const pkgs=packagesFromFiles({...files(bad),'/mods/folder/patches/bad.json':bad});expect(loadMods(pkgs,['parsed-demo']).report.errors).toHaveLength(2)}})
 it('스크립트 원문은 JSON으로 해석하거나 실행하지 않는다',()=>{const source='export function register(api){ /* {"duplicate":1,"duplicate":2} */ }',pkgs=packagesFromFiles({...files('[]'),'/mods/folder/scripts/main.js':source});expect(pkgs.find(p=>p.manifest.id==='parsed-demo')!.scripts).toEqual([{file:'scripts/main.js',source}])})
 it('객체 입력을 쓰는 기존 테스트/프로그램 API도 원래 결과를 유지한다',()=>{const manifest={id:'core',name:'코어',version:'1'},defs=[{id:'Trait.Parsed',defType:'Trait',label:'정상',description:'설명'}];expect(loadMods(packagesFromFiles({'/core/manifest.json':manifest,'/core/defs/x.json':defs})).report.errors).toEqual([])})
 it('실제 모든 유효 파일의 패키지 직렬화와 전체 게임 상태는 이전 읽기와 같다',()=>{const pkgs=readPackages(),json=JSON.stringify(pkgs),oldStyle=JSON.parse(json);const current=loadMods(pkgs,[]),previous=loadMods(oldStyle,[]);expect(current.report).toEqual(previous.report);expect(serialize(newGame(current.db,{seed:'raw-json-compatibility',overworld:true}))).toBe(serialize(newGame(previous.db,{seed:'raw-json-compatibility',overworld:true})));expect(JSON.stringify(pkgs)).toBe(json)})
})
