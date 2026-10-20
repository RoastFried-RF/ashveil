import {describe,it,expect} from 'vitest'
import {bountyContractsFixture} from './bounty-contracts-fixture'
import {initializeSettlement} from '../src/core/settlements'
import {registerResidentSource,sourceContains,sourceLivingCount} from '../src/core/population-sources'
import {killCreature} from '../src/core/combat'
import {initializeStoryDirector} from '../src/core/story-director'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {turnOf,type World} from '../src/core/ctx'
import {settlementSourcesNativeFixture} from './settlement-sources-fixture'
import {dirIndex} from '../src/core/geom'

const setup=()=>{const d=bountyContractsFixture(),site=d.m.sites.find(site=>site.id===d.m.currentRegion)!,source=d.s.sources!.find(source=>source.kind==='residents')!;return{...d,site,source}}

describe('새로 물리화한 정착지 인원의 원래 명단',()=>{
  it('실제 고용/해고 입력은 같은 명단에서 동행 중인 인원만 제외한다',()=>{
    const d=settlementSourcesNativeFixture('meeting'),at=d.s.time,count=d.source.count
    d.act({type:'hireCompanion',target:d.guard.id});expect(d.s.time-at).toBe(100);expect(d.source.count).toBe(count-1);expect(d.source.members).toEqual(d.proof.originalRoster);expect(d.p.money).toBe(1000-d.quote.fee)
    d.act({type:'dismissCompanion',target:d.guard.id});expect(d.s.time-at).toBe(200);expect(d.source.count).toBe(count);expect(d.source.members).toEqual(d.proof.originalRoster);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
  })
  it('마지막 현지 인원의 실제 전투 사망은 적 공급원 승리 명성을 만들지 않는다',()=>{
    const d=settlementSourcesNativeFixture('lastResident')
    for(let i=0;d.guard.alive&&i<30;i++)d.act({type:'move',dir:dirIndex(Math.sign(d.guard.pos.x-d.p.pos.x),Math.sign(d.guard.pos.y-d.p.pos.y))})
    expect(d.guard.alive).toBe(false);expect(d.source.count).toBe(0);expect(d.s.storyteller.director!.fame!.value).toBe(0)
  })
  it('실제 생성된 현지 인원의 ID와 소유 세력만 등록한다',()=>{
    const d=setup();expect(d.source).toBeDefined();const people=d.s.creatures.filter(c=>c.id!==d.p.id&&c.faction===d.site.faction)
    expect(d.source.members).toEqual(people.map(c=>c.id));expect(d.source.count).toBe(people.length);expect(d.source.cap).toBe(people.length)
    expect(d.source.faction).toBe(d.site.faction);expect(d.source.floors).toEqual([d.s.map.id]);expect(d.source.deployed).toBe(true);expect(d.source.members).not.toContain(d.p.id)
  })
  it('다시 초기화해도 몸/UID/난수/장부/명단을 늘리지 않는다',()=>{
    const d=setup(),before=stateHash(d.s);initializeSettlement(d.w);initializeSettlement(d.w);expect(stateHash(d.s)).toBe(before)
  })
  it('기록된 명단을 현재 조회로 교체하지 않는다',()=>{
    const d=setup(),before=stateHash(d.s);registerResidentSource(d.w,d.site,[]);registerResidentSource(d.w,d.site,[d.p]);expect(stateHash(d.s)).toBe(before)
  })
  it('137의 이미 초기화된 마을에는 과거 명단을 소급하지 않는다',()=>{
    const d=setup(),raw=JSON.parse(serialize(d.s));raw.version=137;raw.sources=raw.sources.filter((source:{kind?:string})=>source.kind!=='residents')
    const s=deserialize(JSON.stringify(raw)),w:World={db:d.w.db,s};initializeSettlement(w)
    expect(s.version).toBe(SAVE_VERSION);expect({...s,version:137}).toEqual(raw);expect(s.sources!.some(source=>source.kind==='residents')).toBe(false)
  })
  it('세계 밖 복사본/플레이어/다른 지도의 몸은 새 명단에 넣지 않는다',()=>{
    const d=setup(),c=d.s.creatures.find(c=>d.source.members!.includes(c.id))!;d.s.sources=[]
    registerResidentSource(d.w,d.site,[d.p,structuredClone(c)]);expect(d.s.sources).toEqual([])
    c.mapId='other-map';registerResidentSource(d.w,d.site,[c]);expect(d.s.sources).toEqual([])
  })
  it('다른 지역의 주소로 현재 주민을 등록하지 않는다',()=>{
    const d=setup(),before=stateHash(d.s);registerResidentSource(d.w,{...d.site,id:'Region.Absent'},d.s.creatures);expect(stateHash(d.s)).toBe(before)
  })
  it('전달된 실제 새 인원만 등록하고 같은ID를 중복 세지 않는다',()=>{
    const d=setup(),c=d.s.creatures.find(c=>d.source.members!.includes(c.id))!;d.s.sources=[]
    registerResidentSource(d.w,d.site,[c,c]);expect(d.s.sources).toHaveLength(1);expect(d.s.sources[0].members).toEqual([c.id]);expect(d.s.sources[0].count).toBe(1)
  })
  it('현재 한 주민의 실제 사망만 자기 집단을 한 명 줄인다',()=>{
    const d=setup(),c=d.s.creatures.find(c=>d.source.members!.includes(c.id))!,count=d.source.count
    killCreature(d.w,c,'현지 인원 사망');expect(d.source.count).toBe(count-1);expect(sourceLivingCount(d.w,d.source,d.s.creatures)).toBe(count-1)
  })
  it('현지 집단 고갈을 적 야영지 승리 명성으로 지급하지 않는다',()=>{
    const d=setup();initializeStoryDirector(d.w,'gradual')
    for(const c of d.s.creatures.filter(c=>d.source.members!.includes(c.id)))killCreature(d.w,c,'현지 인원 사망',{killerId:d.p.id})
    expect(d.source.count).toBe(0);expect(d.s.storyteller.director!.fame!.value).toBe(0);expect(d.s.storyteller.director!.fame!.credited).toEqual([])
  })
  it('대표 생물의 기본 세력보다 명시한 실제 소유 세력을 따른다',()=>{
    const d=setup(),c=d.s.creatures.find(c=>d.source.members!.includes(c.id))!,legacy={...d.source,members:undefined,faction:'different-owner'}
    expect(sourceContains(d.w,legacy,c)).toBe(false);legacy.faction=c.faction;expect(sourceContains(d.w,legacy,c)).toBe(true)
  })
  it('주민 명단은 지역 전환과 보관에서 같은 원래ID를 유지한다',()=>{
    const d=setup(),ids=[...d.source.members!],at=turnOf(d.w);d.field();const stored=d.m.scenes[d.site.id].sources.find(source=>source.kind==='residents')!
    expect(stored.members).toEqual(ids);d.home();expect(d.s.sources!.find(source=>source.kind==='residents')!.members).toEqual(ids);expect(turnOf(d.w)).toBe(at)
  })
  it('미완료20턴을 복원해도 같은 실제 명단과 전체 상태를 보존한다',()=>{
    const d=setup();expect(playerAct(d.w,{type:'rest',turns:20},1)).toBeNull();expect(d.s.simulationPending).toBe(true)
    const copy:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)))
  })
})
