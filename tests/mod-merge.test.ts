import {describe,it,expect} from 'vitest'
import {applyPatch,loadMods,type PatchOp} from '../src/core/defs'
import {loadDb,readPackages} from '../tools/loadContent'

const merge=(value:unknown,path=''):PatchOp=>({op:'merge',target:'Trait.Merge',path,value})
describe('상속과 패치의 배열/삭제/객체 교체 계약',()=>{
  it('실제 예제는 기존 네 성향을 보존하고 선택자 예제와 합성한다',()=>{
    const base=loadDb([]).db.event('Event.ReaverPatrol').director!.profiles
    const {db,report}=loadDb(['sample-merge']);expect(report.errors).toEqual([])
    const profiles=db.event('Event.ReaverPatrol').director!.profiles;expect(profiles.slice(0,4)).toEqual(base);expect(profiles[4]).toMatchObject({key:'long-rest',restHours:72})
    const both=loadDb(['sample-selector','sample-merge']);expect(both.report.errors).toEqual([])
    const combined=both.db.event('Event.ReaverPatrol').director!.profiles;expect(combined.find(p=>p.key==='quiet')!.restHours).toBe(60);expect(combined.find(p=>p.key==='long-rest')!.restHours).toBe(72)
  })
  it('일반 배열은 합치지 않고 교체한다',()=>{
    const d={rows:[1,2]};expect(applyPatch(d,merge({rows:[3]}))).toBeNull();expect(d.rows).toEqual([3])
  })
  it('삭제 뒤 앞/뒤 추가를 정해진 순서로 적용하고 새 사본을 만든다',()=>{
    const source={rows:[{id:'a',value:1},{id:'b',value:2}]},d=structuredClone(source),first={id:'first',value:3},last={id:'last',value:4}
    expect(applyPatch(d,merge({rows:{$remove:[{id:'a'}],$prepend:[first],$append:[last]}}))).toBeNull()
    expect(d.rows.map(r=>r.id)).toEqual(['first','b','last']);d.rows[0].value=100;expect(first.value).toBe(3);expect(source.rows).toEqual([{id:'a',value:1},{id:'b',value:2}])
  })
  it('값 삭제는 객체의 키 순서와 관계없고 id 삭제는 같은 원래 항목을 찾는다',()=>{
    const d={rows:[{a:1,b:2},{id:'entry',extra:4},'keep','remove']}
    expect(applyPatch(d,merge({rows:{$remove:[{b:2,a:1},{id:'entry'},'remove']}}))).toBeNull();expect(d.rows).toEqual(['keep'])
  })
  it('없는 배열 필드에는 빈 원본에서 추가한다',()=>{
    const d:Record<string,unknown>={};expect(applyPatch(d,merge({rows:{$append:[1]}}))).toBeNull();expect(d.rows).toEqual([1])
  })
  it('null은 중첩 키를 삭제하고 다른 키를 보존한다',()=>{
    const d:Record<string,unknown>={config:{removed:1,kept:2},other:3};expect(applyPatch(d,merge({config:{removed:null}}))).toBeNull();expect(d).toEqual({config:{kept:2},other:3})
    expect(applyPatch(d,merge(null,'/config'))).toBeNull();expect(d).toEqual({other:3})
  })
  it('$inherit false는 그 객체만 교체하고 제어 키를 결과에 남기지 않는다',()=>{
    const d={config:{old:1,nested:{old:2}},other:3};expect(applyPatch(d,merge({config:{$inherit:false,nested:{new:4}}}))).toBeNull();expect(d).toEqual({config:{nested:{new:4}},other:3})
  })
  it.each([{$append:'bad'},{$prepend:null},{$remove:{}},{$append:[],other:1},{$inherit:true}])('잘못된 병합 지시는 실패하고 원본을 보존한다 (%j)',value=>{
    const d={rows:[1,2]},before=structuredClone(d);expect(applyPatch(d,merge(value,'/rows'))).not.toBeNull();expect(d).toEqual(before)
  })
  it('배열 지시를 실제 객체에 적용할 수 없다',()=>{
    const d={config:{old:1}};expect(applyPatch(d,merge({$append:[1]},'/config'))).not.toBeNull();expect(d).toEqual({config:{old:1}})
  })
  it('실제 생물의 상속도 같은 배열/삭제 규칙을 쓴다',()=>{
    const {db,report}=loadMods([...readPackages(),{manifest:{id:'inheritance',name:'검사',version:'1'},patches:[],defs:[
      {defType:'Creature',id:'Creature.MergeParent',parent:'Creature.Reaver',abstract:true,description:'부모 설명',diseaseImmune:['Disease.GreyFever']},
      {defType:'Creature',id:'Creature.MergeChild',parent:'Creature.MergeParent',description:null,diseaseImmune:{$remove:['Disease.GreyFever'],$append:['Disease.GreyFever']}},
    ]as never}],['inheritance'])
    expect(report.errors).toEqual([]);expect(db.creature('Creature.MergeChild').diseaseImmune).toEqual(['Disease.GreyFever']);expect(db.creature('Creature.MergeChild')).not.toHaveProperty('description');expect(db.has('Creature.MergeParent')).toBe(false)
  })
  it('잘못된 상속 병합은 예외 대신 오류로 보고하고 자손도 실행하지 않는다',()=>{
    const {db,report}=loadMods([...readPackages(),{manifest:{id:'bad-merge',name:'검사',version:'1'},patches:[],defs:[
      {defType:'Creature',id:'Creature.BadMerge',parent:'Creature.Reaver',diseaseImmune:{$append:'bad'}},
      {defType:'Creature',id:'Creature.BadMergeChild',parent:'Creature.BadMerge'},
    ]as never}],['bad-merge'])
    expect(report.errors.some(e=>e.includes('상속 병합 오류'))).toBe(true);expect(db.has('Creature.BadMerge')).toBe(false);expect(db.has('Creature.BadMergeChild')).toBe(false)
  })
})
