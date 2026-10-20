import {describe,it,expect} from 'vitest'
import {prisonerWitnessesFixture} from './prisoner-witnesses-fixture'
import {prisonerMemoryFixture} from './prisoner-memory-fixture'
import {hearPrisonerSightings,observeNpcPrisoners} from '../src/core/prisoner-witnesses'
import {prisonerSightings} from '../src/core/prisoner-memory'
import {rescueOffers,isRescueContract} from '../src/core/rescue-contracts'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {invalidateLights} from '../src/core/fov'
import type {World} from '../src/core/ctx'
describe('실제 NPC 개인 목격과 곁의 대화로 들은 포로 소식',()=>{
 it('실제 주민의 차례에서 본 포로는 개인 기억에만 남는다',()=>{
  const d=prisonerWitnessesFixture('private');expect(d.witness.id).toBe(67);expect(d.witness.prisonerSightings![d.victim.id]).toMatchObject({id:85,state:'bound',region:'Region.GreyCloister',pos:{x:21,y:20},lastCapture:{ropeUid:163}});expect(d.s.knowledge.prisonerSightings).toBeUndefined();expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('목격자와 곁에 서 있는 것만으로 플레이어에게 소식을 옮기지 않는다',()=>{
  const d=prisonerWitnessesFixture();expect(d.s.knowledge.prisonerSightings).toBeUndefined();d.act({type:'wait'});expect(d.s.knowledge.prisonerSightings).toBeUndefined()
 })
 it('실제 공개 대화1턴 뒤 같은 과거 모습과 실제 전달자를 사본으로 기록한다',()=>{
  const d=prisonerWitnessesFixture(),at=d.s.time,old=structuredClone(d.witness.prisonerSightings![d.victim.id]!);d.act({type:'talk',target:d.witness.id});expect(d.s.time-at).toBe(100);const r=prisonerSightings(d.w)[0]!;expect(r.at).toBe(old.at);expect(r.heard).toMatchObject({fromId:d.witness.id,fromName:d.witness.name});expect(r.heard!.at).toBeGreaterThanOrEqual(r.at);expect(r.pos).toEqual(old.pos);expect(r.pos).not.toBe(d.witness.prisonerSightings![d.victim.id]!.pos);expect(r.lastCapture).not.toBe(d.witness.prisonerSightings![d.victim.id]!.lastCapture);expect(r).not.toHaveProperty('captor');expect(r).not.toHaveProperty('deathCause')
 })
 it('보이지 않는 현재 이동/사망은 대화로 들은 과거 목격에 섞지 않는다',()=>{
  const d=prisonerWitnessesFixture('stale'),before=structuredClone(d.s.knowledge.prisonerSightings);expect(d.victim.alive).toBe(false);expect(prisonerSightings(d.w)[0]!.state).toBe('bound');expect(prisonerSightings(d.w)[0]!.pos).not.toEqual(d.victim.pos);d.act({type:'talk',target:d.witness.id});expect(d.s.knowledge.prisonerSightings).toEqual(before)
 })
 it('같은 소식을 반복해서 들어도 목격 시각/출처/난수를 다시 만들지 않는다',()=>{
  const d=prisonerWitnessesFixture('heard'),before=stateHash(d.s);expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it.each(['copyPlayer','copyWitness','far','speakerAsleep','playerAsleep','speakerUnconscious','speakerMap','playerMap','deaf','captive','hostile']as const)('실제 두 사람과 몸/시청각/거리/지도 조건이 맞지 않으면 옮기지 않는다 (%s)',mode=>{
  const d=prisonerWitnessesFixture();if(mode==='far')d.witness.pos={x:3,y:3};if(mode==='speakerAsleep')d.witness.asleep=true;if(mode==='playerAsleep')d.p.asleep=true;if(mode==='speakerUnconscious')d.witness.unconscious=true;if(mode==='speakerMap')d.witness.mapId='other';if(mode==='playerMap')d.p.mapId='other';if(mode==='deaf')d.p.body.missing=['LeftEar','RightEar'];if(mode==='captive')d.witness.captivity=structuredClone(d.victim.captivity);if(mode==='hostile')d.s.overworld!.society!.reputation[d.witness.faction]=-100;const before=stateHash(d.s);expect(hearPrisonerSightings(d.w,mode==='copyPlayer'?structuredClone(d.p):d.p,mode==='copyWitness'?structuredClone(d.witness):d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('다른 NPC에게 들은 사본을 직접 목격이라고 다시 전달하지 않는다',()=>{
  const d=prisonerWitnessesFixture(),r=d.witness.prisonerSightings![d.victim.id]!;r.heard={at:r.at,fromId:999,fromName:'전언자'};const before=stateHash(d.s);expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('미래 시각의 조작된 목격을 전달하지 않는다',()=>{
  const d=prisonerWitnessesFixture();d.witness.prisonerSightings![d.victim.id]!.at=Math.floor(d.s.time/100)+1;const before=stateHash(d.s);expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('NPC가 자기 편 포박을 말했다고 플레이어 소유 포로로 표시하지 않는다',()=>{
  const d=prisonerWitnessesFixture();d.witness.prisonerSightings![d.victim.id]!.state='held';expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(1);expect(prisonerSightings(d.w)[0]!.state).toBe('bound')
 })
 it('이후 직접 식별한 모습은 전언 표시를 없애고 실제 현재 목격으로 바뀐다',()=>{
  const d=prisonerWitnessesFixture('direct'),r=prisonerSightings(d.w)[0]!;expect(r.heard).toBeUndefined();expect(r.name).toBe(d.victim.name);expect(r.at).toBeGreaterThan(d.proof.actualWitnessObservationAt)
 })
 it('오래된 주민 소식으로 더 새 직접 목격을 덮어쓰지 않는다',()=>{
  const d=prisonerWitnessesFixture('direct');d.witness.pos={x:21,y:22};const before=stateHash(d.s);expect(hearPrisonerSightings(d.w,d.p,d.witness)).toBe(0);expect(stateHash(d.s)).toBe(before)
 })
 it('알지 못하는 개인 이름이나 플레이어만 만난 정보는 주민의 개인 목격에 쓰지 않는다',()=>{
  const d=prisonerWitnessesFixture('private');d.victim.name='NPC가 모르는 개인 이름';d.victim.met=true;observeNpcPrisoners(d.w,d.witness);expect(d.witness.prisonerSightings![d.victim.id]!.name).toBe(d.w.db.creature(d.victim.def).label)
 })
 it('복사 NPC/어둠/다른 지도에서는 개인 목격을 새로 만들지 않는다',()=>{
  for(const mode of ['copy','dark','map']){const d=prisonerWitnessesFixture('private');delete d.witness.prisonerSightings;if(mode==='dark'){d.witness.equip.off!.lit=false;d.s.map.kind='dungeon';d.s.map.ambient=0;d.s.map.lights=[];invalidateLights(d.w)}if(mode==='map')d.witness.mapId='other';const before=stateHash(d.s);observeNpcPrisoners(d.w,mode==='copy'?structuredClone(d.witness):d.witness);expect(stateHash(d.s),mode).toBe(before)}
 })
 it('목격의 전달자 사본을 고쳐도 원래 개인/플레이어 기억을 바꾸지 않는다',()=>{
  const d=prisonerWitnessesFixture('heard'),before=stateHash(d.s),r=prisonerSightings(d.w)[0]!;r.heard!.fromName='사본';r.heard!.at++;r.pos.x++;expect(stateHash(d.s)).toBe(before)
 })
 it('전해 들은 근거의 구조 의뢰는 출처를 명시하고 같은 사람/밧줄로 수락한다',()=>{
  const d=prisonerWitnessesFixture('offer'),before=stateHash(d.s),offer=rescueOffers(d.w,d.p,d.witness)[0]!;expect(offer).toMatchObject({person:85,ropeUid:163,reward:292,witness:{fromId:67,fromName:d.witness.name}});expect(offer.witness).not.toBe(d.s.knowledge.prisonerSightings![d.victim.id]!.heard);expect(stateHash(d.s)).toBe(before);d.act({type:'rescueContractAccept',target:d.witness.id,offer:offer.id,expectedReward:292});expect(d.s.overworld!.contracts!.filter(isRescueContract).at(-1)).toMatchObject({person:85,ropeUid:163,witness:offer.witness,escrow:292,status:'active'})
 })
 it('147각인에 주민이 과거 포로를 봤다고 소급하지 않는다',()=>{
  const d=prisonerMemoryFixture(),raw=JSON.parse(serialize(d.s));raw.version=147;const s=deserialize(JSON.stringify(raw));expect(s.version).toBe(SAVE_VERSION);expect({...s,version:147}).toEqual(raw)
 })
 it('진행 중20턴의 원래 목격자/개인 기억/몸/난수가 전체 복원 뒤 같다',()=>{
  const d=prisonerWitnessesFixture('pending'),w:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(w);expect(JSON.parse(serialize(w.s))).toEqual(JSON.parse(serialize(d.s)));expect(d.s.knowledge.prisonerSightings).toBeUndefined();expect(d.witness.prisonerSightings![d.victim.id]).toBeDefined()
 })
})
