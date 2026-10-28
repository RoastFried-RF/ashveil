import {describe,it,expect} from 'vitest'
import {rescueContractsFixture} from './rescue-contracts-fixture'
import {acceptRescue,rescueOffers,rescueReportQuote,reportRescue,recordContractRescue} from '../src/core/rescue-contracts'
import {cancelSupply,contractsTick} from '../src/core/contracts'
import {turnOf,type World} from '../src/core/ctx'
import {reputation} from '../src/core/diplomacy'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {perform} from '../src/core/actions'
import {releaseCaptivity} from '../src/core/prisoners'
import {loadMods} from '../src/core/defs'
import {readPackages} from '../tools/loadContent'
const total=(d:ReturnType<typeof rescueContractsFixture>)=>(d.p.money??0)+Object.values(d.m.markets??{}).reduce((n,m)=>n+m.money,0)+(d.m.contracts??[]).reduce((n,r)=>n+r.escrow,0)
describe('목격한 같은 인물의 실제 해방과 귀환 구조 의뢰',()=>{
 it('실제 과거 목격만 게시하고 반복 조회는 시간/ID/난수/돈을 바꾸지 않는다',()=>{
  const d=rescueContractsFixture(),hash=stateHash(d.s);expect(rescueOffers(d.w,d.p,d.trader)).toEqual([d.offer]);expect(d.offer).toMatchObject({person:85,ropeUid:d.proof.originalRopeUid,reward:292});expect(stateHash(d.s)).toBe(hash)
 })
 it.each(['unknown','free','dead','held','otherFaction']as const)('조건에 맞지 않는 기억에서 숨은 현재 인물을 추정하지 않는다 (%s)',mode=>{
  const d=rescueContractsFixture(),r=d.s.knowledge.prisonerSightings![d.victim.id]!;if(mode==='unknown')delete d.s.knowledge.prisonerSightings;else if(mode==='otherFaction')r.faction='reavers';else r.state=mode;const before=stateHash(d.s);expect(rescueOffers(d.w,d.p,d.trader)).toEqual([]);expect(stateHash(d.s)).toBe(before)
 })
 it('숨은 현재 생사를 검사해 게시를 바꾸지 않는다',()=>{
  const d=rescueContractsFixture();d.victim.alive=false;expect(rescueOffers(d.w,d.p,d.trader)).toEqual([d.offer])
 })
 it('실제 수락1턴에 유한 장부만 예치하고 물품/인물/명부를 만들지 않는다',()=>{
  const d=rescueContractsFixture(),sum=total(d),at=d.s.time,next=d.s.nextId;d.act({type:'rescueContractAccept',target:d.trader.id,offer:d.offer.id,expectedReward:292});expect(d.s.time-at).toBe(100);expect(d.market.money).toBe(708);expect(d.p.money).toBe(960);expect(d.m.contracts!.at(-1)).toMatchObject({kind:'rescue',person:85,escrow:292,status:'active',ropeUid:d.proof.originalRopeUid});expect(d.s.nextId).toBe(next);expect(total(d)).toBe(sum);expect(d.victim.captivity!.rope.uid).toBe(d.proof.originalRopeUid)
 })
 it.each(['lowBank','price','remote','copy','copyTrader','traderMap']as const)('수락 실패가 전체 상태를 바꾸지 않는다 (%s)',mode=>{
  const d=rescueContractsFixture();if(mode==='lowBank')d.market.money=291;if(mode==='remote')d.p.pos={x:1,y:1};if(mode==='traderMap')d.trader.mapId='other';const before=stateHash(d.s);expect(acceptRescue(d.w,mode==='copy'?structuredClone(d.p):d.p,mode==='copyTrader'?structuredClone(d.trader):d.trader,d.offer.id,mode==='price'?293:292)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('원래 포박의 실제 공개 해방1턴 뒤에만 해방 증거를 쓴다',()=>{
  const d=rescueContractsFixture('field'),at=d.s.time;expect(d.record!.proof).toBeUndefined();d.act({type:'prisoner',operation:'release',target:d.victim.id});expect(d.s.time-at).toBe(100);expect(d.record!.proof).toEqual({at:at/100,by:d.p.id,ropeUid:d.proof.originalRopeUid});expect(d.victim.captivity).toBeUndefined();expect(d.p.money).toBe(960);expect(d.record!.escrow).toBe(292)
 })
 it('해방해도 돌아오지 않은 원격 사람의 몸/위치를 보고 견적에 드러내지 않는다',()=>{
  const d=rescueContractsFixture('freed');d.home();const a=rescueReportQuote(d.w,d.p,d.trader,d.record!.id);expect(a.error).toContain('이 장부 곁');expect(a.person).toBeUndefined();d.victim.alive=false;d.victim.pos={x:4,y:4};const before=stateHash(d.s),b=rescueReportQuote(d.w,d.p,d.trader,d.record!.id);expect(b.error).toBe(a.error);expect(stateHash(d.s)).toBe(before)
 })
 it('같은 사람이 장부 곁에 실제로 돌아와야 보고1턴·예치 보수·평판을 한 번만 받는다',()=>{
  const d=rescueContractsFixture('returned'),at=d.s.time,sum=total(d),next=d.s.nextId,body=structuredClone(d.victim.body),bag=structuredClone(d.victim.bag),rep=reputation(d.w,d.record!.faction);expect(rescueReportQuote(d.w,d.p,d.trader,d.record!.id).error).toBeNull();d.act({type:'rescueContractReport',target:d.trader.id,contract:d.record!.id,expectedReward:292});expect(d.s.time-at).toBe(100);expect(d.p.money).toBe(1252);expect(d.market.money).toBe(708);expect(d.record!.escrow).toBe(0);expect(d.record!.status).toBe('completed');expect(d.record!.returned!.person).toBe(85);expect(reputation(d.w,d.record!.faction)).toBe(rep+5);expect(total(d)).toBe(sum);expect(d.s.nextId).toBe(next);expect(d.victim.body).toEqual(body);expect(d.victim.bag.map(i=>[i.uid,i.def,i.count,i.durability])).toEqual(bag.map(i=>[i.uid,i.def,i.count,i.durability]));const before=stateHash(d.s);expect(reportRescue(d.w,d.p,d.trader,d.record!.id)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it.each(['missing','wrongPerson','dead','bound','far','wrongMap','wallet','price','copy']as const)('보고 조건이 맞지 않으면 전체 실패가 원자적이다 (%s)',mode=>{
  const d=rescueContractsFixture('returned');if(mode==='missing')d.s.creatures=d.s.creatures.filter(c=>c!==d.victim);if(mode==='wrongPerson')d.victim.id=999999;if(mode==='dead')d.victim.alive=false;if(mode==='bound')d.victim.captivity={...d.captor.captivity!,captor:d.captor.id,faction:'reavers',rope:{uid:d.proof.originalRopeUid,def:'Item.Rope',count:1},at:turnOf(d.w),surrendered:false};if(mode==='far')d.victim.pos={x:1,y:1};if(mode==='wrongMap')d.victim.mapId='other';if(mode==='wallet')d.p.money=Number.MAX_SAFE_INTEGER
  const before=stateHash(d.s);expect(reportRescue(d.w,mode==='copy'?structuredClone(d.p):d.p,d.trader,d.record!.id,mode==='price'?293:292)).toBeTruthy();expect(stateHash(d.s)).toBe(before)
 })
 it('복사 플레이어의 공개 명령도 실제 장부나 보수를 바꾸지 않는다',()=>{
  const d=rescueContractsFixture('returned'),before=stateHash(d.s);expect(perform(d.w,structuredClone(d.p),{type:'rescueContractReport',target:d.trader.id,contract:d.record!.id}).ok).toBe(false);expect(stateHash(d.s)).toBe(before)
 })
 it.each(['rope','person','map','targetMap','actorMap','region','time','copy','notRescued']as const)('다른 포박/인물/현장/수락 전 해방을 증거로 만들지 않는다 (%s)',mode=>{
  const d=rescueContractsFixture('field');releaseCaptivity(d.w,d.victim);d.s.time+=100;if(mode==='person')d.victim.id++;if(mode==='map')d.record!.mapId='other';if(mode==='targetMap')d.victim.mapId='other';if(mode==='actorMap')d.p.mapId='other';if(mode==='region')d.record!.region='other';if(mode==='time')d.record!.accepted=turnOf(d.w);const before=stateHash(d.s);recordContractRescue(d.w,mode==='copy'?structuredClone(d.p):d.p,d.victim,d.proof.originalRopeUid+(mode==='rope'?1:0),mode!=='notRescued');expect(d.record!.proof).toBeUndefined();expect(stateHash(d.s)).toBe(before)
 })
 it('취소와 기한 초과는 예치를 시장에 돌려주고 실제 포로를 건드리지 않는다',()=>{
  const d=rescueContractsFixture('accepted'),sum=total(d),cap=structuredClone(d.victim.captivity);expect(cancelSupply(d.w,d.p,d.trader,d.record!.id)).toBeNull();expect(d.market.money).toBe(1000);expect(d.p.money).toBe(960);expect(d.victim.captivity).toEqual(cap);expect(total(d)).toBe(sum)
  const e=rescueContractsFixture('accepted');e.s.time=e.record!.deadline*100;contractsTick(e.w);expect(e.record!.status).toBe('expired');expect(e.market.money).toBe(1000);expect(e.p.money).toBe(960);expect(e.victim.captivity).toBeDefined()
 })
 it('완료한 같은 사람을 다시 붙잡아 같은 장부 보수를 반복하지 못한다',()=>{
  const d=rescueContractsFixture('completed'),r=d.s.knowledge.prisonerSightings![d.victim.id]!;r.state='bound';expect(rescueOffers(d.w,d.p,d.trader)).toEqual([])
 })
 it('144각인에 과거 구조 장부를 소급하지 않는다',()=>{
  const d=rescueContractsFixture(),raw=JSON.parse(serialize(d.s));raw.version=144;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:144}).toEqual(raw)
 })
 it('진행 중20턴의 원래 포로/기억/예치/몸/난수가 전체 복원 뒤 같다',()=>{
  const d=rescueContractsFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.record!.escrow).toBe(292);expect(d.victim.captivity).toBeDefined()
 })
 it.each([['/refreshDays',0],['/deadlineBufferDays',1.5],['/wealthMult',2],['/threat',-1],['/reputation',.5]]as const)('잘못된 구조 Def 수치를 거부한다 (%s)',(path,value)=>{
  const{report}=loadMods([...readPackages(),{manifest:{id:'bad-rescue-contract',name:'검사',version:'1'},defs:[],patches:[{op:'replace',target:'RescueContract.Hearth',path,value}]}],['bad-rescue-contract']);expect(report.errors.some(e=>e.includes('RescueContract.Hearth'))).toBe(true)
 })
})
