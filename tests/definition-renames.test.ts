import{describe,it,expect}from'vitest'
import{resolveDefinitionRenames}from'../src/core/definition-renames'
import{loadMods,type ModPackage}from'../src/core/defs'
import type{TerrainDef}from'../src/core/types'
const target:TerrainDef={defType:'Terrain',id:'Test.Target',label:'목적지',passable:true,opaque:false,moveMult:1,sprites:['floor']}
const pkg=(renames:Record<string,string>,id='core'):ModPackage=>({manifest:{id,name:id,version:'1'},defs:id==='core'?[structuredClone(target)]:[],patches:[],renames})
const resolve=(p:ModPackage[])=>{const errors:string[]=[],result=resolveDefinitionRenames(p,[target],errors);return{errors,result}}
describe('활성 패키지 rename의 실제 사전/사슬 검증',()=>{
 it('명시적 단일 ID와 여러 단계 사슬을 실제 목적지로 평탄화한다',()=>{const r=resolve([pkg({'Old.A':'Old.B','Old.B':target.id})]);expect(r.errors).toEqual([]);expect(r.result).toEqual({'Old.A':target.id,'Old.B':target.id})})
 it('여러 모드가 같은 원본/목적지를 선언하면 같은 한 이행이다',()=>{const r=resolve([pkg({'Old.A':target.id}),pkg({'Old.A':target.id},'other')]);expect(r.errors).toEqual([]);expect(r.result).toEqual({'Old.A':target.id})})
 it('다른 목적지를 선언한 충돌은 조용히 마지막 승자로 고르지 않는다',()=>{const r=resolve([pkg({'Old.A':target.id}),pkg({'Old.A':'Different.Target'},'other')]);expect(r.errors.some(e=>e.includes('충돌'))).toBe(true)})
 it('부재 최종 목적지를 추측하거나 새 정의로 생성하지 않는다',()=>{const r=resolve([pkg({'Old.A':'Unknown.Target'})]);expect(r.errors).toContain('Unknown.Target: rename 목적지 정의가 없다');expect(r.result).toEqual({})})
 it('순환 경로/자기 순환은 명확히 거절한다',()=>{for(const renames of([{'Old.A':'Old.B','Old.B':'Old.A'},{'Old.A':'Old.A'}]as Record<string,string>[]))expect(resolve([pkg(renames)]).errors.some(e=>e.startsWith('rename 순환:'))).toBe(true)})
 it('현재 정의도 남아 있는 원본은 바꾸지 않고 오류로 보고한다',()=>{expect(resolve([pkg({[target.id]:'Old.A'})]).errors.some(e=>e.includes('현재 존재하는 정의'))).toBe(true)})
 it('잘못된 사전/키/값은 예외 대신 콘텐츠 오류다',()=>{for(const value of[[],3,null,{'':'Test.Target'},{'Old.A':3},JSON.parse('{"__proto__":"Test.Target"}')]){const p=pkg(value as never);expect(resolve([p]).errors.length).toBeGreaterThan(0)}})
 it('긴 만 단계 사슬도 재귀 스택 없이 처리한다',()=>{const renames:Record<string,string>={};for(let i=0;i<10000;i++)renames['Old.'+i]=i===9999?target.id:'Old.'+(i+1);const r=resolve([pkg(renames)]);expect(r.errors).toEqual([]);expect(Object.keys(r.result)).toHaveLength(10000);expect(r.result['Old.0']).toBe(target.id)})
 it('원래 입력을 고치지 않고 반환 사전은 별도 소유한다',()=>{const p=pkg({'Old.A':target.id}),before=structuredClone(p),r=resolve([p]);r.result['Old.A']='caller';expect(p).toEqual(before)})
 it('꺼진 모드의 사전은 현재 DB 이행/해시에 들어가지 않는다',()=>{const base=pkg({}),extra=pkg({'Old.A':target.id},'extra'),a=loadMods([base,extra],[]),b=loadMods([base],[]);expect(a.report.errors).toEqual([]);expect(a.db.definitionRenames).toEqual({});expect(a.db.loadHash).toBe(b.db.loadHash)})
 it('같은 완성 정의라도 실제 활성 이행 사전이 바뀌면 해시가 바뀐다',()=>{const a=loadMods([pkg({'Old.A':target.id})],[]),b=loadMods([pkg({'Old.B':target.id})],[]);expect(a.report.errors).toEqual([]);expect(b.report.errors).toEqual([]);expect(a.db.loadHash).not.toBe(b.db.loadHash);expect(a.db.terrain(target.id)).toEqual(b.db.terrain(target.id))})
})
