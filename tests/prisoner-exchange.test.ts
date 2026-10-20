import {describe,it,expect} from 'vitest'
import {prisonerExchangeFixture} from './prisoner-exchange-fixture'
import {prisonerExchangeQuote,prisonerExchangeOffers,startPrisonerExchange} from '../src/core/ransom'
import {activityStep} from '../src/core/actions'
import {allItems} from '../src/core/items'
import {stopActivity,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {releaseExchangedPrisoners} from '../src/core/prisoners'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import type {World} from '../src/core/ctx'
describe('같은 두 실제 포로와 밧줄의 교환 합의',()=>{
 it('새 사람 없이 원래 약탈자51을 실제 포박해 같은 두 원본을 준비한다',()=>{
  const d=prisonerExchangeFixture();expect(d.given.id).toBe(51);expect(d.victim.id).toBe(85);expect(d.given.captivity).toMatchObject({captor:d.p.id,rope:{uid:d.proof.originalGivenRopeUid}});expect(d.victim.captivity).toMatchObject({captor:46,rope:{uid:163}});expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('견적과 실제 근처 후보 조회는 상태/돈/난수를 바꾸지 않는다',()=>{
  const d=prisonerExchangeFixture(),before=stateHash(d.s);expect(prisonerExchangeQuote(d.w,d.p,d.captor,d.victim,d.given)).toMatchObject({error:null,price:0,turns:20});expect(prisonerExchangeOffers(d.w,d.p,d.captor,d.victim).map(o=>o.given.id)).toEqual([51]);expect(stateHash(d.s)).toBe(before)
 })
 it('시작은 두 원래 포로/밧줄 사본과 상호 대기만 묶고 실물/돈을 움직이지 않는다',()=>{
  const d=prisonerExchangeFixture(),next=d.s.nextId;expect(startPrisonerExchange(d.w,d.p,46,85,51,163,d.proof.originalGivenRopeUid)).toBeNull();expect(d.p.activity!.ransom).toMatchObject({person:85,ropeUid:163,price:0,exchange:{person:51,ropeUid:d.proof.originalGivenRopeUid}});expect(d.p.activity!.ransom!.exchange!.pos).not.toBe(d.captor.activity!.ransom!.exchange!.pos);expect(d.p.money).toBe(960);expect(d.captor.money).toBe(d.proof.originalHolderMoney);expect(d.victim.captivity).toBeDefined();expect(d.given.captivity).toBeDefined();expect(d.s.nextId).toBe(next)
 })
 it('실제 공개20턴 완료에 두 원래 인물을 풀며 두 밧줄/모든 원래 소지품/지갑을 보존한다',()=>{
  const d=prisonerExchangeFixture(),at=d.s.time,next=d.s.nextId,pm=d.p.money,hm=d.captor.money,vm=d.victim.money,gm=d.given.money,vItems=allItems(d.victim).filter(i=>i.uid!==163).map(i=>[i.uid,i.def,i.count]),gItems=allItems(d.given).filter(i=>i.uid!==d.proof.originalGivenRopeUid).map(i=>[i.uid,i.def,i.count]),bank=d.proof.originalBank
  d.act({type:'prisonerExchange',holder:46,person:85,given:51,receivedRope:163,givenRope:d.proof.originalGivenRopeUid});expect(d.s.time-at).toBe(2000);expect(d.victim.captivity).toBeUndefined();expect(d.given.captivity).toBeUndefined();expect([d.p.money,d.captor.money,d.victim.money,d.given.money]).toEqual([pm,hm,vm,gm]);expect(d.s.overworld!.markets!['Region.ShepherdDale'].money).toBe(bank);expect(allItems(d.victim).map(i=>[i.uid,i.def,i.count])).toEqual(vItems);expect(allItems(d.given).map(i=>[i.uid,i.def,i.count])).toEqual(gItems);expect(d.victim.faction).toBe('coalition');expect(d.given.faction).toBe('reavers');expect(d.victim.rescue!.by).toBe(d.p.id);expect(d.given.rescue!.by).toBe(46);expect(d.s.nextId).toBe(next);for(const uid of [163,d.proof.originalGivenRopeUid])expect(d.s.map.tiles.flatMap(t=>t.items).filter(i=>i.uid===uid)).toHaveLength(1);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('돈이 전혀 없어도 실제 포로 교환은 가능하며 없는 지갑을0으로 새로 쓰지 않는다',()=>{
  const d=prisonerExchangeFixture();delete d.p.money;delete d.captor.money;expect(prisonerExchangeQuote(d.w,d.p,d.captor,d.victim,d.given).error).toBeNull();d.act({type:'prisonerExchange',holder:46,person:85,given:51});expect(d.p.money).toBeUndefined();expect(d.captor.money).toBeUndefined();expect(d.victim.captivity).toBeUndefined();expect(d.given.captivity).toBeUndefined()
 })
 it.each(['copy','samePerson','sameHolder','missing','wrongOwner','wrongFaction','unbound','dead','far','map','escorting']as const)('실제 다른 인물/소속/포박/거리/현장이 맞지 않으면 견적은 전체 불변이다 (%s)',mode=>{
  const d=prisonerExchangeFixture();if(mode==='wrongOwner')d.given.captivity!.captor=99999;if(mode==='wrongFaction')d.given.faction='coalition';if(mode==='unbound')d.given.captivity=undefined;if(mode==='dead')d.given.alive=false;if(mode==='far')d.given.pos={x:3,y:3};if(mode==='map')d.given.mapId='other';if(mode==='escorting')d.given.captivity!.escort=true;if(mode==='missing')d.s.creatures=d.s.creatures.filter(c=>c!==d.given);const other=mode==='copy'?structuredClone(d.given):mode==='samePerson'?d.victim:mode==='sameHolder'?d.captor:d.given,before=stateHash(d.s);expect(prisonerExchangeQuote(d.w,d.p,d.captor,d.victim,other).error).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('화면에 제시한 어느 밧줄이라도 달라지면 작업을 시작하지 않는다',()=>{
  const d=prisonerExchangeFixture(),before=stateHash(d.s);expect(startPrisonerExchange(d.w,d.p,46,85,51,999999,d.proof.originalGivenRopeUid)).toBeTruthy();expect(startPrisonerExchange(d.w,d.p,46,85,51,163,999999)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('작업 전 완료 호출로 어느 한 사람만 풀지 못한다',()=>{
  const d=prisonerExchangeFixture(),before=stateHash(d.s);expect(releaseExchangedPrisoners(d.w,d.p,d.captor,d.victim,d.given,163,d.proof.originalGivenRopeUid)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('완료 전에는 한쪽도 풀지 않고 중단 시 같은 상호 대기만 정리한다',()=>{
  const d=prisonerExchangeFixture();expect(startPrisonerExchange(d.w,d.p,46,85,51)).toBeNull();activityStep(d.w,d.p);expect(d.victim.captivity).toBeDefined();expect(d.given.captivity).toBeDefined();stopActivity(d.w,d.p);expect(d.captor.activity).toBeUndefined();expect(d.victim.captivity).toBeDefined();expect(d.given.captivity).toBeDefined();expect(d.p.money).toBe(960)
 })
 it.each(['givenRope','receivedRope','givenMove','givenOwner','givenDead','holderMove','region']as const)('진행 중 어느 원본/장소/소속이 바뀌어도 다른 쪽을 먼저 풀지 않는다 (%s)',mode=>{
  const d=prisonerExchangeFixture();expect(startPrisonerExchange(d.w,d.p,46,85,51)).toBeNull();if(mode==='givenRope')d.given.captivity!.rope.uid++;if(mode==='receivedRope')d.victim.captivity!.rope.uid++;if(mode==='givenMove')d.given.pos.x--;if(mode==='givenOwner')d.given.captivity!.captor=99999;if(mode==='givenDead')d.given.alive=false;if(mode==='holderMove')d.captor.pos.x--;if(mode==='region')d.s.overworld!.currentRegion='other';const wallet=[d.p.money,d.captor.money];activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.captor.activity).toBeUndefined();expect(d.victim.captivity).toBeDefined();expect(d.given.captivity).toBeDefined();expect([d.p.money,d.captor.money]).toEqual(wallet)
 })
 it('성공한 당사자 사이 현재 공격 연결만 끝내고 과거 공격 이력을 지우지 않는다',()=>{
  const d=prisonerExchangeFixture();d.given.attackedBy=[d.p.id,999999];d.victim.attackedBy=[d.captor.id,999998];d.given.lastAttacker='과거의 실제 공격자';expect(startPrisonerExchange(d.w,d.p,46,85,51)).toBeNull();for(let i=0;d.p.activity&&i<30;i++)activityStep(d.w,d.p);expect(d.given.attackedBy).toEqual([999999]);expect(d.victim.attackedBy).toEqual([999998]);expect(d.given.lastAttacker).toBe('과거의 실제 공격자')
 })
 it('진행 중20턴의 같은 네 사람/밧줄/지갑/몸/난수가 전체 복원 뒤 같다',()=>{
  const d=prisonerExchangeFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))},at=d.s.time;expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(w);expect(d.s.time-at).toBe(2000);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.given.captivity).toBeUndefined();expect(d.victim.captivity).toBeUndefined();expect(d.captor.money).toBe(d.proof.originalHolderMoney)
 })
 it('150각인에 과거 교환 합의나 새 지갑을 소급하지 않는다',()=>{
  const d=prisonerExchangeFixture(),raw=JSON.parse(serialize(d.s));raw.version=150;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:150}).toEqual(raw)
 })
 it.each([0,1.5,28801])('잘못된 교환 합의 작업 시간을 거부한다 (%s)',value=>{
  const{report}=loadMods([...readPackages(),{manifest:{id:'bad-prisoner-exchange',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'PrisonerExchange.Hearth',path:'/turns',value}]}],['bad-prisoner-exchange']);expect(report.errors.some(e=>e.includes('PrisonerExchange.Hearth'))).toBe(true)
 })
})
