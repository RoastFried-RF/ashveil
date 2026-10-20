import {describe,it,expect} from 'vitest'
import {captiveWitnessesFixture} from './captive-witnesses-fixture'
import {hasNewCaptiveSightings,hearCaptiveSightings,hearPrisonerSightings,observeNpcPrisoners} from '../src/core/prisoner-witnesses'
import {prisonerQuote,startPrisonerAction} from '../src/core/prisoners'
import {activityStep} from '../src/core/actions'
import {stopActivity,runUntilInput,SAVE_VERSION} from '../src/core/game'
import {rescueOffers} from '../src/core/rescue-contracts'
import {serialize,deserialize,stateHash} from '../src/core/save'
import type {World} from '../src/core/ctx'
describe('실제 완료한 포로 심문으로 들은 개인 목격',()=>{
 it('원래 목격자를 자기 실제 밧줄로 포박해도 다른 포로 소식은 저절로 얻지 않는다',()=>{
  const d=captiveWitnessesFixture();expect(d.witness.captivity).toMatchObject({captor:d.p.id,rope:{uid:d.proof.originalInterrogatorRopeUid}});expect(d.witness.id).toBe(67);expect(d.victim.id).toBe(85);expect(d.s.knowledge.prisonerSightings?.[d.victim.id]).toBeUndefined();expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(true)
 })
 it('지역의 기존 공급원 소문이 없는 실제 목격자도 새 자기 목격을 전할 수 있다',()=>{
  const d=captiveWitnessesFixture(),before=stateHash(d.s);expect(d.witness.prisonerRumor).toBeUndefined();expect(prisonerQuote(d.w,d.p,d.witness,'interrogate')).toMatchObject({error:null,turns:20});expect(stateHash(d.s)).toBe(before)
 })
 it('작업을 시작하거나 중간20턴을 완료하기 전에는 전달하지 않는다',()=>{
  const d=captiveWitnessesFixture();expect(startPrisonerAction(d.w,d.p,d.witness,'interrogate')).toBeNull();expect(d.p.activity!.total).toBe(20);activityStep(d.w,d.p);expect(d.p.activity!.remaining).toBeGreaterThan(0);const before=stateHash(d.s);expect(hearCaptiveSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before);expect(d.s.knowledge.prisonerSightings?.[d.victim.id]).toBeUndefined()
 })
 it('실제 공개20턴 심문을 끝낼 때만 원래 시각과 심문 출처를 기록한다',()=>{
  const d=captiveWitnessesFixture(),at=d.s.time,next=d.s.nextId,original=structuredClone(d.witness.prisonerSightings![d.victim.id]);d.act({type:'prisoner',operation:'interrogate',target:d.witness.id});expect(d.s.time-at).toBe(2000);expect(d.p.activity).toBeUndefined();expect(d.s.nextId).toBe(next);const r=d.s.knowledge.prisonerSightings![d.victim.id]!;expect(r.at).toBe(original.at);expect(r.pos).toEqual(original.pos);expect(r.heard).toMatchObject({fromId:67,fromName:d.witness.name,kind:'interrogation'});expect(r.heard!.at).toBeGreaterThan(original.at);expect(r).not.toHaveProperty('captor');expect(r).not.toHaveProperty('deathCause')
 })
 it('중단된 심문은 아직 전하지 않은 개인 기억을 옮기지 않는다',()=>{
  const d=captiveWitnessesFixture();expect(startPrisonerAction(d.w,d.p,d.witness,'interrogate')).toBeNull();activityStep(d.w,d.p);stopActivity(d.w,d.p);expect(d.s.knowledge.prisonerSightings?.[d.victim.id]).toBeUndefined();expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(true)
 })
 it.each(['far','asleep','unconscious','deaf','released','copy']as const)('완료 전에 상대/몸/거리/포박이 달라지면 정보가 생기지 않는다 (%s)',mode=>{
  const d=captiveWitnessesFixture();expect(startPrisonerAction(d.w,d.p,d.witness,'interrogate')).toBeNull();if(mode==='far')d.witness.pos={x:3,y:3};if(mode==='asleep')d.witness.asleep=true;if(mode==='unconscious')d.witness.unconscious=true;if(mode==='deaf')d.p.body.missing=['LeftEar','RightEar'];if(mode==='released')d.witness.captivity=undefined;if(mode==='copy'){const before=stateHash(d.s);expect(hearCaptiveSightings(d.w,structuredClone(d.p),d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before);return}for(let i=0;d.p.activity&&i<30;i++)activityStep(d.w,d.p);expect(d.p.activity).toBeUndefined();expect(d.s.knowledge.prisonerSightings?.[d.victim.id]).toBeUndefined()
 })
 it('일반 대화나 작업을 거치지 않은 직접 호출로 포로의 개인 기억을 읽지 못한다',()=>{
  const d=captiveWitnessesFixture(),before=stateHash(d.s);expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(0);expect(hearCaptiveSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('다른 편이 잡은 포로나 복사 목격자/다른 지도에는 새 심문 근거가 없다',()=>{
  const d=captiveWitnessesFixture();d.witness.captivity!.faction='reavers';expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(false);d.witness.captivity!.faction=d.p.faction;expect(hasNewCaptiveSightings(d.w,d.p,structuredClone(d.witness))).toBe(false);d.witness.mapId='other';expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(false)
 })
 it('같은 목격을 들은 뒤에는 다시 심문해 시각이나 내용을 굴리지 않는다',()=>{
  const d=captiveWitnessesFixture('heard'),before=stateHash(d.s);expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(false);expect(prisonerQuote(d.w,d.p,d.witness,'interrogate').error).toBeTruthy();expect(hearCaptiveSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('이전 공급원 소문을 이미 들었더라도 새로운 실제 재관찰은 별도로 전할 수 있다',()=>{
  const d=captiveWitnessesFixture('heard');d.witness.prisonerHeardBy=[d.p.id];const rumor={id:'original-fixed-rumor',kind:'supply' as const,regionId:'Region.GreyCloister',text:'기존 소문',source:'기존',hop:1,writtenAt:1,foundAt:1};d.witness.prisonerRumor=rumor
  d.act({type:'wait'});d.witness.pos={x:21,y:21};observeNpcPrisoners(d.w,d.witness);d.witness.pos={x:21,y:31};expect(hasNewCaptiveSightings(d.w,d.p,d.witness)).toBe(true);const r=structuredClone(d.witness.prisonerRumor);d.act({type:'prisoner',operation:'interrogate',target:d.witness.id});expect(d.witness.prisonerRumor).toEqual(r);expect(d.witness.prisonerHeardBy).toEqual([d.p.id]);expect(d.s.knowledge.prisonerSightings![d.victim.id]!.heard!.kind).toBe('interrogation')
 })
 it('심문에서 들은 근거로 맡는 구조 의뢰는 출처 종류도 보존한다',()=>{
  const d=captiveWitnessesFixture('offer'),offer=rescueOffers(d.w,d.p,d.witness).find(o=>o.person===d.victim.id)!;expect(offer.witness).toMatchObject({fromId:67,kind:'interrogation'});expect(offer.ropeUid).toBe(163);const at=d.s.time;d.act({type:'rescueContractAccept',target:d.witness.id,offer:offer.id,expectedReward:292});expect(d.s.time-at).toBe(100);expect(d.s.overworld!.contracts!.at(-1)).toMatchObject({witness:{fromId:67,kind:'interrogation'},escrow:292,status:'active'})
 })
 it('심문이 진행 중인 전체 각인 복원 뒤 같은 목격/몸/난수/원래 밧줄로 완료한다',()=>{
  const d=captiveWitnessesFixture();d.act({type:'prisoner',operation:'interrogate',target:d.witness.id},1);expect(d.s.simulationPending).toBe(true);const w:World={db:d.w.db,s:deserialize(serialize(d.s))};runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.s.knowledge.prisonerSightings![d.victim.id]!.heard!.kind).toBe('interrogation');expect(d.witness.captivity!.rope.uid).toBe(d.proof.originalInterrogatorRopeUid)
 })
 it('148각인에 과거 심문 출처를 소급하지 않는다',()=>{
  const d=captiveWitnessesFixture(),raw=JSON.parse(serialize(d.s));raw.version=148;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:148}).toEqual(raw)
 })
})
