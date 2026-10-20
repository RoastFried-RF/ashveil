import {describe,it,expect} from 'vitest'
import {applyPatch,loadMods,type PatchOp} from '../src/core/defs'
import {loadDb} from '../tools/loadContent'
import {newGame} from '../src/core/game'
import {storyPressureQuote} from '../src/core/story-director'
import {stateHash} from '../src/core/save'
import {turnOf,TURNS_PER_HOUR,type World} from '../src/core/ctx'

const op=(operation:PatchOp['op'],path:string,value?:unknown,position?:PatchOp['position']):PatchOp=>({op:operation,target:'Trait.Contract',path,value,position})

describe('식별자로 배열을 패치하고 실패한 변경은 남기지 않는다',()=>{
  it('실제 선택형 예제는 quiet만60시간으로 바꾸고 정확한 휴식 경계를 따른다',()=>{
    const {db,report}=loadDb(['sample-selector']);expect(report.errors).toEqual([])
    const w:World={db,s:newGame(db,{seed:'selector-rest-boundary',storyteller:'quiet'})},director=w.s.storyteller.director!
    w.s.time=10000000;director.lastMajorAt=turnOf(w)-60*TURNS_PER_HOUR+1;director.budgetTenths=2000;director.tension=0
    const profile=db.event('Event.ReaverPatrol').director!.profiles.find(p=>p.key==='quiet')!;expect(profile.restHours).toBe(60)
    expect(db.event('Event.ReaverPatrol').director!.profiles.find(p=>p.key==='gradual')!.restHours).toBe(36)
    const before=stateHash(w.s);expect(storyPressureQuote(w).reason).toBe('큰 사건 뒤 쉬는 중이다');expect(stateHash(w.s)).toBe(before)
    w.s.time+=100;expect(storyPressureQuote(w).reason).toBeNull()
  })
  it('앞에 항목이 삽입되어도 id 선택자는 같은 원래 항목을 고친다',()=>{
    for(const prefix of[[],[{id:'inserted',value:99}]]){
      const d={rows:[...prefix,{id:'a',value:1},{id:'b',value:2}]}
      expect(applyPatch(d,op('replace','/rows/[id=b]/value',8))).toBeNull()
      expect(d.rows.find(r=>r.id==='b')?.value).toBe(8);expect(d.rows.find(r=>r.id==='a')?.value).toBe(1)
    }
  })
  it('문자열/숫자/불리언 식별 필드를 찾는다',()=>{
    const d={rows:[{key:'hello',value:1},{key:7,value:2},{key:true,value:3}]}
    for(const key of['hello','7','true'])expect(applyPatch(d,op('replace',`/rows/[key=${key}]/value`,9))).toBeNull()
    expect(d.rows.map(r=>r.value)).toEqual([9,9,9])
  })
  it('기준 항목 전후에 명시적으로 삽입한다',()=>{
    const d={rows:[{id:'anchor'}]}
    expect(applyPatch(d,op('add','/rows/[id=anchor]',{id:'before'},'before'))).toBeNull()
    expect(applyPatch(d,op('add','/rows/[id=anchor]',{id:'after'},'after'))).toBeNull()
    expect(d.rows.map(r=>r.id)).toEqual(['before','anchor','after'])
  })
  it('선택한 항목의 병합/삭제도 같은 식별자를 사용한다',()=>{
    const d={rows:[{id:'a',value:1,other:2},{id:'b',value:2}]}
    expect(applyPatch(d,op('merge','/rows/[id=a]',{value:8}))).toBeNull();expect(d.rows[0]).toEqual({id:'a',value:8,other:2})
    expect(applyPatch(d,op('remove','/rows/[id=b]'))).toBeNull();expect(d.rows).toHaveLength(1)
  })
  it.each([
    op('replace','/rows/[id=absent]/value',1),op('replace','/rows/[id=duplicate]/value',1),
    op('add','/rows/[id=duplicate]',{id:'new'},'after'),op('add','/rows/[id=unique]',{id:'new'}),
    op('replace','/rows/[id=unique]/value',1,'before'),
    ...['-1','1.5','01','NaN','Infinity','100000000000000000000','100'].map(key=>op('add','/rows/'+key,1)),
    op('replace','/rows/-',1),op('remove','/rows/-'),op('merge','/rows/-',{}),
  ])('잘못된 선택자/인덱스는 원본을 보존한다 (%j)',patch=>{
    const d={rows:[{id:'duplicate',value:1},{id:'duplicate',value:2},{id:'unique',value:3}]},before=structuredClone(d)
    expect(applyPatch(d,patch)).not.toBeNull();expect(d).toEqual(before)
  })
  it('중간 객체를 만들다가 실패해도 그 객체를 남기지 않는다',()=>{
    const d={original:1},before=structuredClone(d)
    expect(applyPatch(d,op('add','/created/__proto__/polluted',true))).not.toBeNull();expect(d).toEqual(before)
    expect(applyPatch(d,op('merge','/created/leaf',undefined))).not.toBeNull();expect(d).toEqual(before)
  })
  it('배열 경계를 넘는 add는 빈 슬롯이나 잘못된 위치를 만들지 않는다',()=>{
    const d={rows:[1,2]};expect(applyPatch(d,op('add','/rows/3',9))).not.toBeNull();expect(d.rows).toEqual([1,2])
    expect(applyPatch(d,op('add','/rows/2',3))).toBeNull();expect(applyPatch(d,op('add','/rows/-',4))).toBeNull();expect(d.rows).toEqual([1,2,3,4])
  })
  it('RFC6901 이스케이프와 빈 키를 구별한다',()=>{
    const d={'a/b':{'~key':1},'':2}
    expect(applyPatch(d,op('replace','/a~1b/~0key',7))).toBeNull();expect(applyPatch(d,op('replace','/',8))).toBeNull();expect(d).toEqual({'a/b':{'~key':7},'':8})
  })
  it.each(['rows/0','/bad~2key','/bad~','/__proto__/polluted','/constructor/prototype/polluted'])('잘못된 경로를 거절한다 (%s)',path=>{
    const d={};expect(applyPatch(d,op('add',path,1))).not.toBeNull();expect(d).toEqual({});expect(({} as Record<string,unknown>).polluted).toBeUndefined()
  })
  it('다음 패치는 실패한 이전 변경이 없는 원본에서 시작한다',()=>{
    const {db,report}=loadMods([{manifest:{id:'core',name:'core',version:'1'},defs:[{defType:'Trait',id:'Trait.Contract',label:'검사',description:'원래'}],patches:[op('add','/created/__proto__/polluted',true),op('replace','/description','정상 변경')]}])
    expect(report.errors).toHaveLength(1);expect(report.patched).toBe(1);expect(db.get('Trait.Contract').description).toBe('정상 변경');expect(db.get('Trait.Contract')).not.toHaveProperty('created')
  })
})
