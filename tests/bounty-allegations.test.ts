import {describe,it,expect} from 'vitest'
import {bountyAllegationsFixture} from './bounty-allegations-fixture'
import {bountyOffers,bountyQuestionQuote,bountyReportQuote,questionBounty,reportBounty} from '../src/core/bounty-contracts'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {playerAct,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
import {reputation} from '../src/core/diplomacy'
import type {World} from '../src/core/ctx'

describe('의뢰인의 소속 주장과 실제 당사자의 증언',()=>{
 it('10% 게시 시드에서만 실제 만난 현지 원래 명단을 읽고 조회로 난수를 소비하지 않는다',()=>{
  const d=bountyAllegationsFixture('offer'),before=stateHash(d.s)
  for(let i=0;i<10;i++)expect(bountyOffers(d.w,d.p,d.trader).find(o=>o.template==='shepherdAllegation')).toEqual(d.offer)
  expect(stateHash(d.s)).toBe(before);expect(d.offer.targets).toEqual(d.source.members);expect(d.offer.claimedFaction).toBe('reavers');expect(d.guard.faction).toBe('coalition')
  for(const c of d.s.creatures)delete c.met
  expect(bountyOffers(d.w,d.p,d.trader).some(o=>o.template==='shepherdAllegation')).toBe(false)
 })
 it('주장과 같은 당사자 증언은 살해 없는 성공/환급으로 간주하지 않는다',()=>{
  const d=bountyAllegationsFixture(),r=d.record!;r.claimedFaction=d.guard.faction;d.act({type:'bountyQuestion',target:d.guard.id,contract:r.id});d.walk(d.trader);const before=stateHash(d.s);expect(bountyReportQuote(d.w,d.p,d.trader,r.id).error).toBeTruthy();expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('거짓 의뢰 확률0/1은 조회를 반복해도 정확한 양끝을 지킨다',()=>{
  const d=bountyAllegationsFixture('offer');for(const chance of [0,1]){const loaded=loadMods([...readPackages(),{manifest:{id:'chance-test',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'BountyContract.Hearth',path:'/targets/1/allegation/chance',value:chance}]}],['chance-test']);expect(loaded.report.errors).toEqual([]);d.w.db=loaded.db;const before=stateHash(d.s);expect(bountyOffers(d.w,d.p,d.trader).some(o=>o.template==='shepherdAllegation')).toBe(chance===1);expect(stateHash(d.s)).toBe(before)}
 })
 it('같은 독립 게시 키는 복원 후에도 같고 0확률 시드에는 추가 게시가 없다',()=>{
  const d=bountyAllegationsFixture('offer'),copy:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(bountyOffers(copy,copy.s.creatures.find(c=>c.id===copy.s.playerId)!,copy.s.creatures.find(c=>c.id===d.trader.id)!)).toEqual(bountyOffers(d.w,d.p,d.trader));const before=stateHash(d.s);d.s.seed='bounty-false-actual-0';expect(bountyOffers(d.w,d.p,d.trader).some(o=>o.template==='shepherdAllegation')).toBe(false);d.s.seed=d.proof.seed;expect(stateHash(d.s)).toBe(before)
 })
 it('기존 명단이 없는 옛 정착지의 인물은 추정하지 않는다',()=>{
  const d=bountyAllegationsFixture('offer');delete d.source.members;expect(bountyOffers(d.w,d.p,d.trader).some(o=>o.template==='shepherdAllegation')).toBe(false)
 })
 it('수락1턴은 실제 예치금만 옮기고 숨은 사실/증언을 만들지 않는다',()=>{
  const d=bountyAllegationsFixture('offer'),at=d.s.time,ids=d.s.creatures.map(c=>c.id),wallet=d.p.money
  d.act({type:'bountyAccept',target:d.trader.id,offer:d.offer.id,expectedReward:d.offer.reward});const r=d.m.contracts!.at(-1)!
  expect(d.s.time-at).toBe(100);expect(d.market.money).toBe(1000-d.offer.reward);expect(d.p.money).toBe(wallet);expect(r).not.toHaveProperty('testimony');expect(d.s.creatures.map(c=>c.id)).toEqual(ids)
 })
 it('당사자에게 묻는 실제1턴에 직접 들은 이름/소속/장소/시각만 기록한다',()=>{
  const d=bountyAllegationsFixture(),r=d.record!,at=d.s.time
  d.act({type:'bountyQuestion',target:d.guard.id,contract:r.id});expect(d.s.time-at).toBe(100)
  expect(r.testimony).toEqual({id:d.guard.id,name:d.guard.name,faction:'coalition',at:at/100,region:'Region.ShepherdDale',mapId:'surface'});expect(r.evidence).toEqual([]);expect(d.guard.alive).toBe(true)
 })
 it('중복 질문과 세계 밖 복사본은 전체 상태를 바꾸지 않는다',()=>{
  const d=bountyAllegationsFixture('testimony'),r=d.record!,before=stateHash(d.s)
  expect(questionBounty(d.w,d.p,d.guard,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  const q=bountyAllegationsFixture();expect(questionBounty(q.w,q.p,structuredClone(q.guard),q.record!.id)).toBeTruthy();expect(q.record!.testimony).toBeUndefined()
 })
 it.each(['asleep','far','wrongMap','unconscious','hostile']as const)('대화할 수 없는 실제 조건은 증언을 만들지 않는다 (%s)',kind=>{
  const d=bountyAllegationsFixture(),r=d.record!
  if(kind==='asleep')d.guard.asleep=true
  if(kind==='far')d.p.pos={x:1,y:1}
  if(kind==='wrongMap')d.guard.mapId='other'
  if(kind==='unconscious')d.p.unconscious=true
  if(kind==='hostile')(d.guard.attackedBy??=[]).push(d.p.id)
  const before=stateHash(d.s);expect(bountyQuestionQuote(d.w,d.p,d.guard,r.id).error).toBeTruthy();expect(questionBounty(d.w,d.p,d.guard,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('직접 증언 없이는 숨은 실제 세력만으로 처치 없는 환급을 승인하지 않는다',()=>{
  const d=bountyAllegationsFixture('accepted'),before=stateHash(d.s);expect(bountyReportQuote(d.w,d.p,d.trader,d.record!.id).error).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('모순 증언 보고1턴은 전원 생존/명단/자기 돈/평판을 보존하고 은행에만 환급한다',()=>{
  const d=bountyAllegationsFixture('report'),r=d.record!,at=d.s.time,cash=d.p.money,rep=reputation(d.w,d.trader.faction)
  d.act({type:'bountyReport',target:d.trader.id,contract:r.id,expectedReward:r.reward});expect(d.s.time-at).toBe(100);expect(r.status).toBe('cancelled');expect(r.outcome).toBe('contradicted');expect(r.escrow).toBe(0);expect(d.market.money).toBe(1000);expect(d.p.money).toBe(cash);expect(reputation(d.w,d.trader.faction)).toBe(rep);expect(d.source.count).toBe(d.proof.originalRoster.length);expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds);expect(d.s.creatures.filter(c=>d.proof.originalRoster.includes(c.id)).every(c=>c.alive)).toBe(true)
  const before=stateHash(d.s);expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('보수 변경/은행 환급 한도 오류는 증언과 전체 장부를 보존한다',()=>{
  const d=bountyAllegationsFixture('report'),r=d.record!,before=stateHash(d.s);expect(reportBounty(d.w,d.p,d.trader,r.id,r.reward+1)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
  d.market.money=Number.MAX_SAFE_INTEGER;const capped=stateHash(d.s);expect(reportBounty(d.w,d.p,d.trader,r.id)).toBeTruthy();expect(stateHash(d.s)).toBe(capped)
 })
 it('138의 과거 의뢰에 주장/증언을 소급하지 않는다',()=>{
  const d=bountyAllegationsFixture('accepted'),raw=JSON.parse(serialize(d.s));raw.version=138;delete raw.overworld.contracts.at(-1).claimedFaction;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:138}).toEqual(raw)
 })
 it('증언 후 미완료20턴의 전체 상태가 복원 뒤에도 같다',()=>{
  const d=bountyAllegationsFixture('testimony');expect(playerAct(d.w,{type:'rest',turns:20},1)).toBeNull();const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)))
 })
 it.each([['chance',-1],['chance',2],['faction','missing-faction']])('잘못된 거짓 의뢰 확률/세력은 모드 시작 전에 거절한다 (%s)',(key,value)=>{
  const {report}=loadMods([...readPackages(),{manifest:{id:'bad-allegation',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'BountyContract.Hearth',path:'/targets/1/allegation/'+key,value}]}],['bad-allegation']);expect(report.errors.some(e=>e.includes('bounty.allegation'))).toBe(true)
 })
})
