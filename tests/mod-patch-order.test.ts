import {describe,it,expect} from 'vitest'
import {loadMods,packagesFromFiles,type ModPackage,type PatchOp} from '../src/core/defs'

const trait=(id:string,extra:object={})=>({defType:'Trait',id,label:id,description:'원래',...extra})
const pkg=(id:string,defs:unknown[]=[],patches:PatchOp[]=[],dependencies?:string[]):ModPackage=>({manifest:{id,name:id,version:'1',dependencies},defs:defs as never,patches})
const patch=(target:string,value:string,extra:object={}):PatchOp=>({op:'replace',target,path:'/description',value,...extra})

describe('모든 원본을 모은 뒤 결정된 순서로 패치한다',()=>{
  it('앞 모드의 패치도 뒤 모드에 정의된 원본을 찾는다',()=>{
    const {db,report}=loadMods([pkg('core'),pkg('a-first',[],[patch('Trait.Later','먼저 패치')]),pkg('z-later',[trait('Trait.Later')])])
    expect(report.errors).toEqual([]);expect(db.get('Trait.Later').description).toBe('먼저 패치')
  })
  it('원본 수집 뒤에도 모드 순서와 파일 안의 순서를 지킨다',()=>{
    const {db,report}=loadMods([pkg('z-last',[trait('Trait.Later')],[patch('Trait.Later','마지막')]),pkg('core'),pkg('a-first',[],[patch('Trait.Later','첫째'),patch('Trait.Later','둘째')])])
    expect(report.errors).toEqual([]);expect(report.order).toEqual(['core','a-first','z-last']);expect(db.get('Trait.Later').description).toBe('마지막');expect(report.patched).toBe(3)
  })
  it('추상 부모를 수정하면 뒤 모드의 자식도 상속한다',()=>{
    const {db,report}=loadMods([pkg('core'),pkg('a-patch',[],[patch('Trait.Base','부모 수정')]),pkg('z-defs',[trait('Trait.Base',{abstract:true}),{defType:'Trait',id:'Trait.Child',parent:'Trait.Base',label:'자식'}])])
    expect(report.errors).toEqual([]);expect(db.get('Trait.Child').description).toBe('부모 수정');expect(db.has('Trait.Base')).toBe(false)
  })
  it('모든 원본 수집은 자식의 자체 값을 덮어쓰지 않는다',()=>{
    const {db,report}=loadMods([pkg('core'),pkg('a-patch',[],[patch('Trait.Base','부모 수정')]),pkg('z-defs',[trait('Trait.Base',{abstract:true}),trait('Trait.Child',{parent:'Trait.Base',description:'자식 자체'})])])
    expect(report.errors).toEqual([]);expect(db.get('Trait.Child').description).toBe('자식 자체')
  })
  it('전체 교체를 수집한 뒤 패치해 교체 원본에도 변경을 적용한다',()=>{
    const {db,report}=loadMods([pkg('core',[trait('Trait.Shared')]),pkg('a-patch',[],[patch('Trait.Shared','최종 패치')]),pkg('z-override',[trait('Trait.Shared',{override:true,description:'교체 원본'})])])
    expect(report.errors).toEqual([]);expect(db.get('Trait.Shared').description).toBe('최종 패치')
  })
  it('ifDefExists는 뒤 모드의 원본도 인식한다',()=>{
    const {db,report}=loadMods([pkg('core',[trait('Trait.Target')]),pkg('a-patch',[],[patch('Trait.Target','조건 충족',{ifDefExists:'Trait.Later'})]),pkg('z-defs',[trait('Trait.Later')])])
    expect(report.errors).toEqual([]);expect(report.patched).toBe(1);expect(db.get('Trait.Target').description).toBe('조건 충족')
  })
  it('없는 조건 Def는 패치를 건너뛰고 잘못된 대상을 찾지 않는다',()=>{
    const {report}=loadMods([pkg('core'),pkg('conditional',[],[patch('Trait.AbsentTarget','생략',{ifDefExists:'Trait.AbsentCondition'})])])
    expect(report.errors).toEqual([]);expect(report.patched).toBe(0)
  })
  it('설치되어도 비활성인 모드는 Def 조건을 충족하지 않는다',()=>{
    const {db,report}=loadMods([pkg('core',[trait('Trait.Target')]),pkg('active',[],[patch('Trait.Target','조건 충족',{ifDefExists:'Trait.Disabled'})]),pkg('disabled',[trait('Trait.Disabled')])],['active'])
    expect(report.errors).toEqual([]);expect(db.get('Trait.Target').description).toBe('원래')
  })
  it('파일 입력의 삽입 순서와 무관하게 경로 사전순으로 적용한다',()=>{
    const files={
      '/mods/core/manifest.json':{id:'core',name:'core',version:'1'},
      '/mods/core/defs/traits.json':[trait('Trait.Target')],
      '/mods/core/patches/z.json':[patch('Trait.Target','마지막')],
      '/mods/core/patches/a.json':[patch('Trait.Target','첫째')],
    }
    const forward=loadMods(packagesFromFiles(files)),reverse=loadMods(packagesFromFiles(Object.fromEntries(Object.entries(files).reverse())))
    expect(forward.report.errors).toEqual([]);expect(reverse.report).toEqual(forward.report)
    expect(reverse.db.get('Trait.Target')).toEqual(forward.db.get('Trait.Target'));expect(forward.db.get('Trait.Target').description).toBe('마지막')
  })
})
