import {SAVE_VERSION} from '../src/core/game'
import {describe,expect,it} from 'vitest'
import {activityStep,perform} from '../src/core/actions'
import {addWound} from '../src/core/body'
import {clinicQuote,requestClinic} from '../src/core/clinic'
import {ensureCompanionBond} from '../src/core/companion-bond-state'
import {hireCompanion,hireQuote} from '../src/core/companions'
import {player,turnOf} from '../src/core/ctx'
import {bargain,bargainChance,exchange,talk,tradeQuote,tradePrice} from '../src/core/economy'
import {firstImpression,firstImpressionReply,firstImpressionScore} from '../src/core/first-impression-state'
import {rememberMeeting} from '../src/core/first-impressions'
import {playerAct} from '../src/core/game'
import {addToBag,makeItem} from '../src/core/items'
import {innQuote,rentInnBed} from '../src/core/inn'
import {startProsthetic} from '../src/core/prosthetics'
import {completeHealing} from '../src/core/recovery'
import {Rng} from '../src/core/rng'
import {deserialize,serialize,stateHash} from '../src/core/save'
import {lessonQuote,requestLesson} from '../src/core/teaching'
import {approachResident,firstImpressionsFixture as setup} from './first-impressions-fixture'
function scar(d:ReturnType<typeof setup>,part:string){
 const wd=addWound(d.w,d.p,{def:'Wound.Cut',part,severity:1,source:'원래 아문 상처'}).wound;wd.scar=true;wd.healed=wd.severity;completeHealing(d.w,d.p)
}
describe('실제 첫 만남의 인상과 원래 주민의 기억',()=>{
 it('실제 정착지의 원래 주민/재고를 유지하며 조회는 기억·난수·UID를 만들지 않는다',()=>{
  const {w,p,trader,market}=setup(),hash=stateHash(w.s)
  expect(w.s.overworld!.currentRegion).toBe(trader.traderSite);expect(w.s.map.settlementInitialized).toBe(true);expect(w.s.creatures).toHaveLength(5);expect(market.items.length).toBeGreaterThan(5)
  expect(firstImpressionScore(w,p,trader)).toBe(-5);bargainChance(w,p,trader);tradeQuote(w,p,trader,[],[]);expect(firstImpressionReply(w,trader,p)).toBeUndefined()
  expect(stateHash(w.s)).toBe(hash);expect(trader.firstImpressions).toBeUndefined()
 })
 it.each([19,20])('위생%i의 실제 연합 주민 문턱은20미만이다',h=>{
  const {w,p,trader}=setup();p.needs.hygiene=h;expect(firstImpressionScore(w,p,trader)).toBe(h<20?-5:0)
 })
 it('위생 설정이 꺼지면 남아 있는19와 다른 세력에 악취 감점을 강요하지 않는다',()=>{
  const {w,p,trader}=setup();w.s.hygieneEnabled=false;expect(firstImpressionScore(w,p,trader)).toBe(0)
  w.s.hygieneEnabled=true;trader.faction='guild';expect(firstImpressionScore(w,p,trader)).toBe(0)
 })
 it('실제1턴 대화가 같은 사람의 단방향 첫 기억을 한 번 기록한다',()=>{
  const {w,p,trader}=setup(),time=w.s.time,at=turnOf(w)
  expect(playerAct(w,{type:'talk',target:trader.id})).toBeNull();expect(w.s.time-time).toBe(100)
  expect(trader.firstImpressions?.[p.id]).toMatchObject({at,score:-5,attitude:'wary',heard:true});expect(p.firstImpressions).toBeUndefined()
  expect(firstImpressionReply(w,trader,p)).toContain('경계')
  const old=structuredClone(trader.firstImpressions);expect(talk(w,p,trader)).toBeNull();expect(trader.firstImpressions).toEqual(old)
 })
 it('원래 두 병의 실제2L 목욕 뒤에도 기존 주민 기억은 유지되고 새 경비는 깨끗한 첫 인상을 기억한다',()=>{
  const {w,p,trader,guard,water}=setup();expect(talk(w,p,trader)).toBeNull();const old=structuredClone(trader.firstImpressions),ids=water.map(i=>i.uid),time=w.s.time
  expect(playerAct(w,{type:'wash'})).toBeNull();expect(w.s.time-time).toBe(20000);expect(p.needs.hygiene).toBeGreaterThan(78);expect(p.needs.hygiene).toBeLessThan(80)
  expect(water.map(i=>i.uses)).toEqual([0,0]);expect(ids.every(id=>p.bag.some(i=>i.uid===id))).toBe(true)
  expect(talk(w,p,trader)).toBeNull();expect(trader.firstImpressions).toEqual(old)
  approachResident(w,guard);expect(talk(w,p,guard)).toBeNull();expect(guard.firstImpressions?.[p.id].score).toBe(0);expect(firstImpressionScore(w,p,trader)).toBe(-5)
 })
 it('냉혈과 기존 탈주 노예 배경은 실제 modifier를 한 번 합산한다',()=>{
  const {w,p,trader}=setup();p.needs.hygiene=70;p.traits=['Trait.ColdBlooded'];expect(firstImpressionScore(w,p,trader)).toBe(-5)
  p.background='Bg.EscapedSlave';expect(firstImpressionScore(w,p,trader)).toBe(-10)
 })
 it('실제 아문 얼굴 상처는 여러 개여도 한 번 감점하고 두피는 얼굴로 꾸미지 않는다',()=>{
  const d=setup();d.p.needs.hygiene=70;scar(d,'Skull');expect(firstImpressionScore(d.w,d.p,d.trader)).toBe(0)
  scar(d,'Nose');scar(d,'Jaw');expect(firstImpression(d.w,d.p,d.trader)?.terms).toEqual([{kind:'scar',value:-5}]);expect(d.p.body.wounds).toEqual([])
 })
 it('원래 유리 눈의 실제 설치만 가산하며 배낭·고장·대체된 눈 흉터는 제외한다',()=>{
  const d=setup();d.p.needs.hygiene=70;scar(d,'LeftEye');d.p.body.missing=['LeftEye'];d.p.skills.medicine=10
  const eye=makeItem(d.w,'Item.GlassEye');expect(addToBag(d.w,d.p,eye)).toBe(0);expect(firstImpressionScore(d.w,d.p,d.trader)).toBe(0)
  expect(startProsthetic(d.w,d.p,'install','LeftEye',eye.uid,1)).toBeNull()
  for(let i=0;d.p.activity&&i<1000;i++)activityStep(d.w,d.p)
  expect(d.p.activity).toBeUndefined();expect(d.p.body.prosthetics!.LeftEye.item.uid).toBe(eye.uid);expect(firstImpressionScore(d.w,d.p,d.trader)).toBe(3)
  d.p.body.prosthetics!.LeftEye.item.durability=0;expect(firstImpressionScore(d.w,d.p,d.trader)).toBe(0)
 })
 it('얼굴을 볼 수 없고 냄새도 맡을 수 없으면 외형/악취를 알아내지 않는다',()=>{
  const d=setup();scar(d,'Nose');d.trader.body.missing=['LeftEye','RightEye','Nose'];expect(firstImpression(d.w,d.p,d.trader)?.terms).toEqual([])
 })
 it('실패·원거리·잠든 상대는 접촉 기억·돈·난수를 바꾸지 않는다',()=>{
  const {w,p,trader,market}=setup();p.money=0
  let hash=stateHash(w.s);expect(exchange(w,p,trader,[{uid:market.items[0].uid,count:1}],[])).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  trader.asleep=true;hash=stateHash(w.s);expect(talk(w,p,trader)).not.toBeNull();expect(rememberMeeting(w,p,trader)).toBeUndefined();expect(stateHash(w.s)).toBe(hash)
  trader.asleep=false;p.pos.x-=5;hash=stateHash(w.s);expect(talk(w,p,trader)).not.toBeNull();expect(firstImpression(w,p,trader)).toBeUndefined();expect(stateHash(w.s)).toBe(hash)
 })
 it('첫 실제 흥정은 보인 확률과 원래 이야기 난수를 쓰며 가격/현금/물품을 복제하지 않는다',()=>{
  const {w,p,trader,market}=setup();const dirty=bargainChance(w,p,trader);p.needs.hygiene=70;expect(bargainChance(w,p,trader)).toBe(dirty+5);p.needs.hygiene=19
  const old=structuredClone({items:market.items,cash:market.money,money:p.money,bag:p.bag}),r=new Rng([...w.s.rng.story]),success=r.chance(dirty/100)
  expect(bargain(w,p,trader)).toBeNull();expect(market.haggle?.successes).toBe(success?1:0);expect(w.s.rng.story).toEqual(r.s);expect(trader.firstImpressions?.[p.id].score).toBe(-5)
  expect({items:market.items,cash:market.money,money:p.money,bag:p.bag}).toEqual(old)
 })
 it('실제 구매에서 기억을 남기되 원래 가격·유한 현금·재고를 보존한다',()=>{
  const {w,p,trader,market}=setup(),item=market.items.find(i=>i.def==='Item.Bandage')!,cash=p.money!+market.money,count=item.count,price=tradePrice(w,p,trader,item,true)
  expect(exchange(w,p,trader,[{uid:item.uid,count:1}],[])).toBeNull();expect(trader.firstImpressions?.[p.id].score).toBe(-5);expect(p.money!+market.money).toBe(cash);expect(p.money).toBe(200-price)
  expect(market.items.find(i=>i.def===item.def)!.count).toBe(count-1)
 })
 it.each([-5,0])('새 실제 고용은 첫 인상%i에서 관계를 시작하며 견적/거절은 읽기 전용이다',score=>{
  const {w,p,guard}=setup();p.needs.hygiene=score?19:70;const hash=stateHash(w.s),cash=p.money!+(guard.money??0)
  expect(hireQuote(w,guard).error).toBeNull();expect(stateHash(w.s)).toBe(hash);expect(hireCompanion(w,guard)).toBeNull()
  expect(guard.companion?.bond?.score).toBe(score);expect(p.money!+guard.money!).toBe(cash);expect(guard.firstImpressions?.[p.id].score).toBe(score)
  const bond=guard.companion!.bond!;p.needs.hygiene=100;expect(ensureCompanionBond(w,guard,50)).toBe(bond);expect(bond.score).toBe(score)
 })
 it('고용료 부족은 첫 인상을 기억하지 않고 기존 관계를 재초기화하지 않는다',()=>{
  const {w,p,guard}=setup();p.money=0;const hash=stateHash(w.s);expect(hireCompanion(w,guard)).toContain('부족');expect(stateHash(w.s)).toBe(hash);expect(guard.firstImpressions).toBeUndefined()
 })
 it('원래 진료의 실패는 원자적이고 실제 예약은 같은 의사에 기억을 남긴다',()=>{
  const {w,p,doctor}=setup();p.pos={x:doctor.pos.x-1,y:doctor.pos.y};const wd=addWound(w,p,{def:'Wound.Cut',part:'LeftForearm',severity:1,source:'실제 환자'}).wound,q=clinicQuote(w,p,doctor,{kind:'bandage',woundId:wd.id})
  expect(q.error).toBeNull();const hash=stateHash(w.s);expect(requestClinic(w,p,doctor,{kind:'bandage',woundId:wd.id},q.fee+1)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  expect(requestClinic(w,p,doctor,{kind:'bandage',woundId:wd.id},q.fee)).toBeNull();expect(doctor.firstImpressions?.[p.id].score).toBe(-5)
  const copy=deserialize(serialize(w.s));expect(copy).toEqual(JSON.parse(serialize(w.s)));expect(copy.version).toBe(SAVE_VERSION)
 })
 it('실제 문해 수업 계약은 기억을 남기고 바뀐 견적은 남기지 않는다',()=>{
  const {w,p,trader}=setup();p.literacy=0;p.literate=false;const q=lessonQuote(w,p,trader);expect(q.error).toBeNull()
  const hash=stateHash(w.s);expect(requestLesson(w,p,trader,q.fee+1)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  expect(requestLesson(w,p,trader,q.fee)).toBeNull();expect(trader.firstImpressions?.[p.id].score).toBe(-5)
 })
 it('원래 여관의 실제 계약은 기억을 남기며 잘못된 견적은 아무것도 만들지 않는다',()=>{
  const {w,p,trader}=setup(),bed=w.s.map.innBeds![0],q=innQuote(w,p,trader,bed.id);expect(q.error).toBeNull()
  const hash=stateHash(w.s);expect(rentInnBed(w,p,trader,bed.id,q.fee+1)).not.toBeNull();expect(stateHash(w.s)).toBe(hash)
  expect(rentInnBed(w,p,trader,bed.id,q.fee)).toBeNull();expect(trader.firstImpressions?.[p.id].score).toBe(-5)
 })
 it('구형 이미 만난 사람의 모르는 첫 인상을 소급 생성하지 않고 아직 안 만난 사람만 새로 기억한다',()=>{
  const {w,trader,guard}=setup();trader.met=true;const old=JSON.parse(serialize(w.s));old.version=67
  const restored=deserialize(JSON.stringify(old));expect({...restored,version:67}).toEqual(old);const copy={db:w.db,s:restored},cp=player(copy),ct=restored.creatures.find(c=>c.id===trader.id)!,cg=restored.creatures.find(c=>c.id===guard.id)!
  expect(firstImpressionScore(copy,cp,ct)).toBe(0);expect(talk(copy,cp,ct)).toBeNull();expect(ct.firstImpressions).toBeUndefined()
  expect(talk(copy,cp,cg)).toBeNull();expect(cg.firstImpressions?.[cp.id].score).toBe(-5)
 })
 it('전체 각인은 동일 인물의 첫 기억/몸/원래 현금/난수와 재대화 결과를 보존한다',()=>{
  const {w,p,trader}=setup();expect(perform(w,p,{type:'talk',target:trader.id}).ok).toBe(true)
  const copy={db:w.db,s:deserialize(serialize(w.s))};expect(copy.s).toEqual(JSON.parse(serialize(w.s)))
  for(const x of[w,copy]){const c=x.s.creatures.find(c=>c.id===trader.id)!;player(x).needs.hygiene=100;expect(talk(x,player(x),c)).toBeNull()}
  expect(copy.s).toEqual(JSON.parse(serialize(w.s)));expect(firstImpressionScore(copy,player(copy),copy.s.creatures.find(c=>c.id===trader.id)!)).toBe(-5)
 })
})
