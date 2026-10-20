import {describe,it,expect} from 'vitest'
import {newGame,playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {createCreature} from '../src/core/creatures'
import {killCreature} from '../src/core/combat'
import {sourceContains,sourceLivingCount} from '../src/core/population-sources'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {db} from './helpers'
import type {World} from '../src/core/ctx'
import {populationSourcesNativeFixture} from './population-sources-fixture'
const setup=()=>{const w:World={db,s:newGame(db,{seed:'original-source-roster',storyteller:'pursuit'})};return{w,s:w.s,camp:w.s.sources!.find(s=>s.id==='reaverCamp')!}}

describe('실제 배치한 공급원의 원래 인원 명단',()=>{
  it.each(['foreign','own']as const)('실제 네 공격 입력은 %s 명단의 사망만 정산한다',kind=>{
    const d=populationSourcesNativeFixture(kind),at=d.s.time
    for(let i=0;i<4;i++)d.act({type:'move',dir:2})
    expect(d.s.time-at).toBe(400);expect(d.target.alive).toBe(false);expect(d.source.count).toBe(kind==='foreign'?6:0);expect(d.s.storyteller.director!.fame!.value).toBe(kind==='foreign'?10:25)
    expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.initialIds)
  })
  it('생성된 야영지 인원의 원래ID만 저장하고 새 사람/난수를 만들지 않는다',()=>{
    const d=setup(),people=d.s.creatures.filter(c=>c.faction==='reavers');expect(d.camp.members).toEqual(people.map(c=>c.id));expect(d.camp.count).toBe(people.length);expect(people.length).toBeGreaterThan(0)
    const before=stateHash(d.s);expect(sourceLivingCount(d.w,d.camp,d.s.creatures)).toBe(people.length);expect(stateHash(d.s)).toBe(before)
  })
  it('같은 세력의 외부 인원이 들어와도 원래 공급원 인구를 늘리지 않는다',()=>{
    const d=setup(),count=d.camp.count,foreign=createCreature(d.w,'Creature.Reaver',{x:20,y:20});d.s.creatures.push(foreign)
    expect(sourceContains(d.w,d.camp,foreign)).toBe(false);expect(sourceLivingCount(d.w,d.camp,d.s.creatures)).toBe(count)
    expect(playerAct(d.w,{type:'wait'})).toBeNull();expect(d.camp.count).toBe(count)
  })
  it('외부 두목의 실제 사망은 두목10만 주고 원래 야영지를 고갈시키지 않는다',()=>{
    const d=setup(),count=d.camp.count,foreign=createCreature(d.w,'Creature.ReaverChief',{x:20,y:20});d.s.creatures.push(foreign)
    killCreature(d.w,foreign,'외부 두목',{killerId:d.s.playerId});expect(d.camp.count).toBe(count);expect(d.s.storyteller.director!.fame!.value).toBe(10)
    expect(d.s.storyteller.director!.fame!.credited.some(k=>k.includes(':source:'))).toBe(false)
  })
  it('원래 인원의 실제 사망만 그 공급원을 한 번 줄인다',()=>{
    const d=setup(),c=d.s.creatures.find(c=>d.camp.members!.includes(c.id))!,count=d.camp.count
    killCreature(d.w,c,'원래 인원',{killerId:d.s.playerId});expect(d.camp.count).toBe(count-1)
    const before=stateHash(d.s);killCreature(d.w,c,'같은 시체',{killerId:d.s.playerId});expect(stateHash(d.s)).toBe(before)
  })
  it('같은 세력의 별도 명단은 서로의 사망을 정산하지 않는다',()=>{
    const d=setup(),[a,b]=d.s.creatures.filter(c=>d.camp.members!.includes(c.id)),second={...structuredClone(d.camp),id:'second-camp',members:[b.id],count:1}
    d.camp.members=[a.id];d.camp.count=1;d.s.sources!.push(second)
    killCreature(d.w,a,'첫 야영지',{killerId:d.s.playerId});expect(d.camp.count).toBe(0);expect(second.count).toBe(1)
    expect(sourceLivingCount(d.w,second,d.s.creatures)).toBe(1)
  })
  it('명단이 비어 있으면 같은 세력의 다른 사람으로 채우지 않는다',()=>{
    const d=setup();d.camp.members=[];expect(sourceLivingCount(d.w,d.camp,d.s.creatures)).toBe(0)
  })
  it('명단/현재·정지 보관의 같은ID를 두 번 세지 않는다',()=>{
    const d=setup(),count=d.camp.count;d.camp.members!.push(d.camp.members![0]);expect(sourceLivingCount(d.w,d.camp,[...d.s.creatures,...d.s.creatures])).toBe(count)
  })
  it('다른 지도에 보관된 원래 몸도 동일ID로 추적한다',()=>{
    const d=setup(),id=d.camp.members![0],c=d.s.creatures.find(c=>c.id===id)!,count=d.camp.count
    d.s.creatures=d.s.creatures.filter(c=>c.id!==id);d.s.offCreatures.crypt1=[c]
    expect(sourceLivingCount(d.w,d.camp,[...d.s.creatures,...Object.values(d.s.offCreatures).flat()])).toBe(count)
  })
  it('현재 세계에 없는 복사 객체의 사망으로 원래 인구를 줄이지 않는다',()=>{
    const d=setup(),original=d.s.creatures.find(c=>c.id===d.camp.members![0])!,copy=structuredClone(original),count=d.camp.count
    killCreature(d.w,copy,'세계 밖 사본',{killerId:d.s.playerId});expect(d.camp.count).toBe(count);expect(original.alive).toBe(true)
  })
  it('135 각인에는 없던 명단을 소급하지 않고 버전만 이관한다',()=>{
    const d=setup(),raw=JSON.parse(serialize(d.s));raw.version=135;for(const source of raw.sources)delete source.members
    const copy=deserialize(JSON.stringify(raw));expect(copy.version).toBe(SAVE_VERSION);expect({...copy,version:135}).toEqual(raw);expect(copy.sources![0]).not.toHaveProperty('members')
    const w:World={db,s:copy},foreign=createCreature(w,'Creature.Reaver',{x:20,y:20});copy.creatures.push(foreign)
    expect(sourceContains(w,copy.sources![0],foreign)).toBe(true)
  })
  it('명시한 명단은 현재 각인의 전체 복원과 미완료20턴에서도 같다',()=>{
    const d=setup();expect(playerAct(d.w,{type:'rest',turns:20},1)).toBeNull();expect(d.s.simulationPending).toBe(true)
    const copy:World={db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(copy);expect(copy.s).toEqual(d.s);expect(copy.s.sources![0].members).toEqual(d.camp.members)
  })
})
