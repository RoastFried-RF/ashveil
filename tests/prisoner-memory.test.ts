import {describe,expect,it} from 'vitest'
import {rememberVisiblePrisoners,prisonerSightings} from '../src/core/prisoner-memory'
import {invalidateLights,updatePlayerVision} from '../src/core/fov'
import {player,type World} from '../src/core/ctx'
import {killCreature} from '../src/core/combat'
import {activityStep} from '../src/core/actions'
import {startPrisonerAction} from '../src/core/prisoners'
import {runUntilInput,SAVE_VERSION} from '../src/core/game'
import {serialize,deserialize,stateHash} from '../src/core/save'
import {prisonerMemoryFixture} from './prisoner-memory-fixture'
import {prisonerFixture} from './prisoner-fixture'
describe('직접 식별한 포로의 마지막 목격',()=>{
 it('숨은 실제 원래 경비/포박자/밧줄이 있어도 목격 기억을 만들지 않는다',()=>{
  const d=prisonerMemoryFixture();expect(d.victim.captivity!.rope.uid).toBe(d.proof.originalRopeUid);expect(d.victim.id).toBe(85);expect(d.s.knowledge.prisonerSightings).toBeUndefined();expect(prisonerSightings(d.w)).toEqual([])
 })
 it('실제 공개 걸음으로 식별한 원래 인물과 위치만 기록한다',()=>{
  const d=prisonerMemoryFixture('observed'),r=prisonerSightings(d.w)[0]!;expect(r).toMatchObject({id:d.victim.id,state:'bound',region:'Region.GreyCloister',mapId:d.s.map.id,mapName:d.s.map.name,pos:d.victim.pos,lastCapture:{ropeUid:d.proof.originalRopeUid,seenAt:r.at}});expect(r.pos).not.toBe(d.victim.pos);expect(r).not.toHaveProperty('captor');expect(r).not.toHaveProperty('deathCause');expect(d.s.creatures.map(c=>c.id)).toEqual(d.proof.originalActorIds)
 })
 it('공개 해방을 실제 마친 뒤 마지막 포박 기록을 보존하며 자유로운 모습을 갱신한다',()=>{
  const d=prisonerMemoryFixture('released'),r=prisonerSightings(d.w)[0]!;expect(d.victim.captivity).toBeUndefined();expect(r.state).toBe('free');expect(r.firstSeen).toBeLessThan(r.at);expect(r.lastCapture!.seenAt).toBe(r.firstSeen);expect(r.lastCapture!.ropeUid).toBe(d.proof.originalRopeUid)
 })
 it('식별 가능한 시신을 직접 볼 때만 사망 상태를 기록한다',()=>{
  const d=prisonerMemoryFixture('dead'),r=prisonerSightings(d.w)[0]!;expect(d.victim.alive).toBe(false);expect(r.state).toBe('dead');expect(r.lastCapture!.ropeUid).toBe(d.proof.originalRopeUid);expect(r).not.toHaveProperty('deathCause')
 })
 it('보이지 않는 현재 이동/해방/사망을 과거 목격에 반영하지 않는다',()=>{
  const d=prisonerMemoryFixture('stale'),before=structuredClone(d.s.knowledge.prisonerSightings);expect(d.victim.alive).toBe(false);expect(prisonerSightings(d.w)[0]!.state).toBe('bound');expect(prisonerSightings(d.w)[0]!.pos).not.toEqual(d.victim.pos);d.act({type:'wait'});expect(d.s.knowledge.prisonerSightings).toEqual(before)
 })
 it('없는/다른 지도에 있는 인물을 전역 명부로 추적하지 않는다',()=>{
  const d=prisonerMemoryFixture('observed'),before=structuredClone(d.s.knowledge.prisonerSightings);d.victim.mapId='unseen-other-map';d.victim.pos={x:d.p.pos.x+1,y:d.p.pos.y};updatePlayerVision(d.w,d.p);expect(d.s.knowledge.prisonerSightings).toEqual(before);d.s.creatures=d.s.creatures.filter(c=>c!==d.victim);updatePlayerVision(d.w,d.p);expect(d.s.knowledge.prisonerSightings).toEqual(before)
 })
 it.each(['asleep','unconscious','dead','blind','wrongMap','copy','npc']as const)('플레이어 관찰 자격을 다시 검사한다 (%s)',mode=>{
  const d=prisonerMemoryFixture('observed');delete d.s.knowledge.prisonerSightings;let observer=d.p
  if(mode==='asleep')d.p.asleep=true;if(mode==='unconscious')d.p.unconscious=true;if(mode==='dead')d.p.alive=false;if(mode==='blind')d.p.body.missing=['LeftEye','RightEye'];if(mode==='wrongMap')d.p.mapId='other';if(mode==='copy')observer=structuredClone(d.p);if(mode==='npc')observer=d.captor
  const before=stateHash(d.s);rememberVisiblePrisoners(d.w,observer,[d.victim.pos.y*d.s.map.w+d.victim.pos.x]);expect(stateHash(d.s)).toBe(before)
 })
 it('주입한 보임 배열만 믿고 거리/시선을 건너뛰지 않는다',()=>{
  const d=prisonerMemoryFixture();rememberVisiblePrisoners(d.w,d.p,[d.victim.pos.y*d.s.map.w+d.victim.pos.x]);expect(d.s.knowledge.prisonerSightings).toBeUndefined()
 })
 it('어둠에서 물체가 보이더라도 포박을 정밀 식별하지 않는다',()=>{
  const d=prisonerMemoryFixture('observed');delete d.s.knowledge.prisonerSightings;d.p.equip.off!.lit=false;d.s.map.kind='dungeon';d.s.map.ambient=.2;d.s.map.lights=[];d.p.pos={x:d.victim.pos.x,y:d.victim.pos.y+1};invalidateLights(d.w);updatePlayerVision(d.w,d.p);expect(d.s.visible).toContain(d.victim.pos.y*d.s.map.w+d.victim.pos.x);expect(d.s.knowledge.prisonerSightings).toBeUndefined()
 })
 it('과거 포박을 알지 못한 일반 자유 인물을 구조 대상으로 만들지 않는다',()=>{
  const d=prisonerMemoryFixture('observed');delete d.s.knowledge.prisonerSightings;delete d.victim.captivity;updatePlayerVision(d.w,d.p);expect(d.s.knowledge.prisonerSightings).toBeUndefined()
 })
 it('비공개 개인 이름/원래 소속과 숨은 포박 시작 시각을 옮기지 않는다',()=>{
  const d=prisonerFixture();expect(startPrisonerAction(d.w,d.p,d.target,'bind')).toBeNull();for(let i=0;d.p.activity&&i<10;i++)activityStep(d.w,d.p);d.target.met=false;d.target.residentSite=undefined;d.target.name='비공개 개인 이름';d.target.captivity!.at=1;updatePlayerVision(d.w,d.p);const r=prisonerSightings(d.w)[0]!;expect(r.state).toBe('held');expect(r.name).not.toBe(d.target.name);expect(r.faction).toBeUndefined();expect(r.lastCapture!.seenAt).not.toBe(1)
 })
 it('같은 포박의 첫 목격은 유지하고 관찰을 다시 할 때만 최신 시각을 바꾼다',()=>{
  const d=prisonerMemoryFixture('observed'),before=structuredClone(prisonerSightings(d.w)[0]!);d.act({type:'wait'});const r=prisonerSightings(d.w)[0]!;expect(r.firstSeen).toBe(before.firstSeen);expect(r.lastCapture).toEqual(before.lastCapture);expect(r.at).toBeGreaterThan(before.at)
 })
 it('질의 사본을 고쳐도 원래 목격/난수/시간이 바뀌지 않는다',()=>{
  const d=prisonerMemoryFixture('observed'),before=stateHash(d.s),r=prisonerSightings(d.w)[0]!;r.pos.x++;r.lastCapture!.seenAt++;r.name='사본';expect(stateHash(d.s)).toBe(before)
 })
 it('목격 뒤 시신이 치워져도 과거 기록을 지우거나 현재 생존으로 추정하지 않는다',()=>{
  const d=prisonerMemoryFixture('dead'),before=structuredClone(prisonerSightings(d.w));d.s.creatures=d.s.creatures.filter(c=>c!==d.victim);updatePlayerVision(d.w,d.p);expect(prisonerSightings(d.w)).toEqual(before)
 })
 it('143각인에 과거 포로의 목격을 소급 생성하지 않는다',()=>{
  const d=prisonerMemoryFixture(),raw=JSON.parse(serialize(d.s));raw.version=143;const restored=deserialize(JSON.stringify(raw));expect(restored.version).toBe(SAVE_VERSION);expect({...restored,version:143}).toEqual(raw)
 })
 it('진행 중20턴의 같은 인물/밧줄/관찰/몸/난수가 전체 복원 뒤 같다',()=>{
  const d=prisonerMemoryFixture('pending'),copy:World={db:d.w.db,s:deserialize(serialize(d.s))};expect(d.s.simulationPending).toBe(true);runUntilInput(d.w);runUntilInput(copy);expect(JSON.parse(serialize(copy.s))).toEqual(JSON.parse(serialize(d.s)));expect(prisonerSightings(copy)[0]!.state).toBe('free');expect(player(copy).id).toBe(d.p.id)
 })
 it('멀리서 사망한 사람을 직접 다시 식별하기 전에는 사망 기록을 만들지 않는다',()=>{
  const d=prisonerMemoryFixture('observed'),before=structuredClone(prisonerSightings(d.w));d.p.pos={x:21,y:32};killCreature(d.w,d.victim,'제어한 숨은 사망');updatePlayerVision(d.w,d.p);expect(prisonerSightings(d.w)).toEqual(before);d.p.pos={x:21,y:21};updatePlayerVision(d.w,d.p);expect(prisonerSightings(d.w)[0]!.state).toBe('dead')
 })
})
