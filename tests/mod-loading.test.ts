import {describe,it,expect} from 'vitest'
import {loadMods,type ModPackage} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'

const pack=(id:string,defs:unknown[]=[],dependencies?:string[]):ModPackage=>({manifest:{id,name:id,version:'1',dependencies},defs:defs as never,patches:[]})
const trait=(id='Trait.Contract',extra:object={})=>({defType:'Trait',id,label:'검사',description:'검사',...extra})

describe('게임 시작 전 모드 계약 검사',()=>{
  it('선택했지만 설치되지 않은 모드를 조용히 빼지 않는다',()=>{
    const {report}=loadMods(readPackages(),['absent.mod']);expect(report.errors).toContain("선택한 모드 없음 'absent.mod'")
  })
  it('중복 manifest ID를 거절한다',()=>{
    const {report}=loadMods([...readPackages(),pack('duplicate'),pack('duplicate')],['duplicate'])
    expect(report.errors.some(e=>e.includes('모드 ID 중복'))).toBe(true)
  })
  it('선택하지 않은 모드의 오류는 이번 구성에 섞지 않는다',()=>{
    const {report}=loadMods([...readPackages(),pack('disabled',[{defType:'Absent',id:'Unknown.Contract'}])],[])
    expect(report.errors).toEqual([])
  })
  it('알 수 없는 Def 타입을 오류로 보고한다',()=>{
    const {report}=loadMods([pack('core',[{defType:'Absent',id:'Unknown.Contract'}])])
    expect(report.errors.some(e=>e.includes('알 수 없는 defType'))).toBe(true)
  })
  it('의도하지 않은 Def 중복은 원래 정의를 보존하고 거절한다',()=>{
    const {db,report}=loadMods([pack('core',[trait()]),pack('duplicate',[trait(undefined,{label:'덮어쓰기'})])])
    expect(report.errors.some(e=>e.includes('Def ID 중복'))).toBe(true);expect(db.get('Trait.Contract').label).toBe('검사')
  })
  it('명시적인 전체 교체는 리포트에 기록한다',()=>{
    const {db,report}=loadMods([pack('core',[trait(undefined,{description:'원래 필드'})]),pack('override',[trait(undefined,{label:'교체',description:'새 필드',override:true})])])
    expect(report.errors).toEqual([]);expect(report.warnings.some(e=>e.includes('override'))).toBe(true)
    expect(db.get('Trait.Contract')).toMatchObject({label:'교체',description:'새 필드',_mod:'override'})
  })
  it('다른 타입의 부모를 거절한다',()=>{
    const {report}=loadMods([pack('core',[trait('Trait.Base',{abstract:true}),{defType:'Skill',id:'Skill.Child',parent:'Trait.Base',label:'잘못된 상속'}])])
    expect(report.errors.some(e=>e.includes('defType이 다름'))).toBe(true)
  })
  it('다른 모드 부모는 의존성 선언을 요구한다',()=>{
    const {report}=loadMods([pack('core'),pack('base',[trait('Trait.Base',{abstract:true})]),pack('child',[trait('Trait.Child',{parent:'Trait.Base'})])])
    expect(report.errors.some(e=>e.includes('dependencies'))).toBe(true)
  })
  it('선언한 의존 모드의 부모는 로드 순서와 상속을 지킨다',()=>{
    const {db,report}=loadMods([pack('core'),pack('zbase',[trait('Trait.Base',{abstract:true,description:'상속됨'})]),pack('achild',[{defType:'Trait',id:'Trait.Child',parent:'Trait.Base',label:'자식'}],['zbase'])])
    expect(report.errors).toEqual([]);expect(report.order).toEqual(['core','zbase','achild']);expect(db.get('Trait.Child').description).toBe('상속됨')
  })
  it('부모를 패치한 다른 모드가 원래 정의 모드 의존성을 바꾸지 않는다',()=>{
    const base=pack('abase',[trait('Trait.Base',{abstract:true})]),child=pack('zchild',[{defType:'Trait',id:'Trait.Child',parent:'Trait.Base',label:'자식'}],['abase'])
    const patch=pack('middle',[],['abase']);patch.patches=[{op:'replace',target:'Trait.Base',path:'/description',value:'수정'}]
    const {db,report}=loadMods([pack('core'),base,patch,child]);expect(report.errors).toEqual([]);expect(db.get('Trait.Child').description).toBe('수정')
  })
})
